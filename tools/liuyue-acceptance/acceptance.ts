import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BaziChart } from '../../frontend/app/lib/core/yiqi-core/types';
import { availableLiuYueYears, buildLiuYueYear, defaultLiuYueYear } from '../../frontend/lib/bazi/liuyue';
import { validateAiRequest } from '../../server/src/services/tool-interpretation.service';

const fixture = JSON.parse(readFileSync(join(__dirname, '../visual-harness/fixtures/chart-result.json'), 'utf8'));
const chart = fixture.chart.bazi as BaziChart;
const years = availableLiuYueYears(chart);
assert.ok(years.includes(2026));
assert.equal(buildLiuYueYear(chart, 1899), null, '不得在命盘流年范围之外拼接月运');

function payloadFor(view: NonNullable<ReturnType<typeof buildLiuYueYear>>, index: number) {
  const month = view.months[index];
  return { basis: view.basis, year: view.year, monthIndex: index + 1, monthName: month.name,
    startBeijing: month.startBeijing, endBeijing: month.endBeijing,
    monthGanZhi: month.ganZhi, annualGanZhi: view.annualGanZhi,
    dayunGanZhi: view.dayunGanZhi, dayMaster: view.dayMaster,
    ganShiShen: month.ganShiShen, cangGan: month.cangGan,
    natalRelations: month.natalRelations, yearRelations: month.yearRelations,
    dayunRelations: month.dayunRelations };
}

for (const year of years) {
  const result = buildLiuYueYear(chart, year);
  assert.ok(result, `${year} 的原盘流年干支、库 exact 月柱与月柱计算必须一致`);
  assert.equal(result.months.length, 12);
  for (let index = 0; index < 12; index++) {
    const month = result.months[index];
    assert.ok(month.startUtcMs < month.endUtcMs);
    if (index > 0) assert.equal(result.months[index - 1].endUtcMs, month.startUtcMs);
    assert.equal(month.cangGan.length > 0, true);
    assert.equal(typeof month.ganShiShen, 'string');
    assert.equal(validateAiRequest({ tool: 'liuyue', payload: payloadFor(result, index) }).ok, true,
      `${year} ${month.name} 的前后端契约必须一致`);
  }
}

const selected = buildLiuYueYear(chart, 2026)!;
assert.equal(defaultLiuYueYear(chart, Date.UTC(2026, 9, 28)), 2026);
assert.equal(defaultLiuYueYear(chart, Date.UTC(2027, 0, 20)), 2026,
  '公历一月立春前必须仍选上一流年的丑月');
assert.equal(defaultLiuYueYear(chart, Date.UTC(2027, 1, 5)), 2027,
  '立春交节后才进入新流年寅月');
assert.match(selected.months[0].startBeijing, /^2026-02-04/);
assert.match(selected.months[11].endBeijing, /^2027-02-04/);
assert.equal(selected.months[0].name, '寅月');
assert.equal(selected.months[11].name, '丑月');
const altered = structuredClone(chart);
altered.dayun.find(d => d.liuNian.some(n => n.year === 2026))!
  .liuNian.find(n => n.year === 2026)!.ganZhi.gan = '甲';
assert.equal(buildLiuYueYear(altered, 2026), null, '若盘面流年与节气历法不一致必须拒绝展示');
const valid = payloadFor(selected, 0);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, model: 'x' } }).ok, false);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, monthName: '卯月' } }).ok, false);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, startBeijing: '2026-02-01 00:00' } }).ok, false);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, monthGanZhi: { gan: '甲', zhi: '寅' } } }).ok, false);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, ganShiShen: '正官' } }).ok, false);
assert.equal(validateAiRequest({ tool: 'liuyue', payload: { ...valid, yearRelations: ['伪造关系'] } }).ok, false);

console.log(`liuyue acceptance: ${years.length} years × 12 months, seasonal boundaries and drift guard passed`);
