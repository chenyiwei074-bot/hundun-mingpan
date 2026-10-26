// 已知四柱独立计算：严格输入 + 复用 enrichBazi，不创建任何记录。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { parseDirectPillars, calculateDirectPillars } = require('../../server/dist/services/bazi-pillars.service.js');
const { enrichBazi } = require('../../server/dist/core/bazi-enrich/enrich.js');

const valid = {
  年: { gan: '甲', zhi: '子' },
  月: { gan: '丙', zhi: '寅' },
  日: { gan: '戊', zhi: '辰' },
  时: { gan: '壬', zhi: '子' },
};

test('合法四柱解析并计算，字段与 enrichBazi 完全一致', () => {
  const parsed = parseDirectPillars({ siZhu: valid });
  assert.equal(parsed.ok, true);
  const enrichment = calculateDirectPillars(parsed.siZhu);
  assert.deepEqual(enrichment, enrichBazi(valid));
  for (const key of ['五行统计', '格局', '旺衰', '调候用神', '天干关系', '地支关系', '自坐', '整柱']) {
    assert.ok(key in enrichment, '缺少 ' + key);
  }
});

test('未知字段 / 缺柱 / 非字符串被拒，且不进入完整命盘', () => {
  assert.equal(parseDirectPillars({ siZhu: valid, name: '张三' }).code, 'invalid_pillars');
  assert.equal(parseDirectPillars({ siZhu: { ...valid, 年: undefined } }).ok, false);
  assert.equal(parseDirectPillars({ siZhu: { ...valid, 年: { gan: '甲' } } }).code, 'invalid_pillars');
  assert.equal(parseDirectPillars({ siZhu: { ...valid, 年: { gan: 1, zhi: '子' } } }).code, 'invalid_pillars');
});

test('单柱非法六十甲子配对被拒', () => {
  const bad = { ...valid, 月: { gan: '甲', zhi: '丑' } };
  const r = parseDirectPillars({ siZhu: bad });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'invalid_ganzhi');
});
