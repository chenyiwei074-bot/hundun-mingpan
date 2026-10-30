import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { buildAvatarBrief } = require('../../server/dist/services/avatar.service.js');
const { generateChart } = require('../../server/dist/services/chart.service.js');

const base = {
  calendar: '公历', birthday: '1990-05-15 14:30', isLeapMonth: false,
  birthPlace: '浙江省 杭州市 西湖区', occupation: '创业者', consent: true,
};

test('合法资料返回白名单主题且不含出生资料/性别/百分比', () => {
  const result = buildAvatarBrief(base);
  assert.equal(result.ok, true);
  const text = JSON.stringify(result);
  assert.equal(text.includes('birthPlace'), false);
  assert.equal(text.includes('birthday'), false);
  assert.equal(text.includes('1990-05-15'), false);
  assert.equal(text.includes('gender'), false);
  assert.doesNotMatch(text, /%|百分比|五行统计/);
  assert.equal(result.data.concept.visual.theme, 'dawn-mountain-path');
  assert.deepEqual(result.data.concept.visual.motifs, ['sunrise', 'mountain', 'ascending_path']);
  assert.ok(result.data.concept.meaning.every(item => item.plainText.length > 5));
  assert.equal(result.data.chartSummary.dayMaster, '庚金');
});

test('复用现有排盘：四柱与 generateChart 一致', () => {
  const brief = buildAvatarBrief(base);
  const chart = generateChart({
    visitor_id: 'avatar-test', name: 'avatar-test', gender: '男', calendar: '公历',
    birthday: base.birthday, isLeapMonth: false, birthPlace: base.birthPlace,
    currentPlace: '', persona: 'standard', depth: 'brief',
  });
  const expected = Object.fromEntries(['year', 'month', 'day', 'hour'].map(key => [key, chart.bazi.siZhu[key].gan + chart.bazi.siZhu[key].zhi]));
  assert.equal(JSON.stringify({ year: brief.data.chartSummary.year, month: brief.data.chartSummary.month, day: brief.data.chartSummary.day, hour: brief.data.chartSummary.hour }), JSON.stringify(expected));
});

test('同输入稳定，不同职业只改对应说明', () => {
  const a = buildAvatarBrief(base);
  const b = buildAvatarBrief(base);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = buildAvatarBrief({ ...base, occupation: '设计师' });
  assert.notEqual(c.data.concept.title, a.data.concept.title);
  assert.match(c.data.concept.plainSummary, /设计师/);
});

test('同意、职业、区县、公历闰月、未知字段均被拒', () => {
  assert.equal(buildAvatarBrief({ ...base, consent: false }).code, 'consent_required');
  assert.equal(buildAvatarBrief({ ...base, occupation: 'x' }).code, 'invalid_occupation');
  assert.equal(buildAvatarBrief({ ...base, birthPlace: '浙江省 杭州市 不存在区' }).code, 'invalid_birth_info');
  assert.equal(buildAvatarBrief({ ...base, calendar: '公历', isLeapMonth: true }).code, 'invalid_birth_info');
  const extra = buildAvatarBrief({ ...base, gender: '女' });
  assert.equal(extra.ok, false);
});
