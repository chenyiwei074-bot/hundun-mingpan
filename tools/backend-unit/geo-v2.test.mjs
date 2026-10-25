// 区县级地点 v2 单测（依赖 server/dist 已构建）。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { lookupGeoV2 } = require('../../server/dist/services/geo.service.js');

test('北京东城区：district 精度 + Asia/Shanghai', () => {
  const g = lookupGeoV2({ province: '北京市', city: '北京市', district: '东城区' });
  assert.ok(g);
  assert.equal(g.precision, 'district');
  assert.equal(g.districtMatched, true);
  assert.equal(g.src, 'county');
  assert.equal(g.tz, 'Asia/Shanghai');
  assert.ok(Math.abs(g.lng - 116.416) < 0.2);
  assert.ok(Math.abs(g.lat - 39.928) < 0.2);
});

test('深圳南山区 / 上海浦东新区：能命中区县', () => {
  assert.equal(lookupGeoV2({ province: '广东省', city: '深圳市', district: '南山区' })?.precision, 'district');
  assert.equal(lookupGeoV2({ province: '上海市', city: '上海市', district: '浦东新区' })?.precision, 'district');
});

test('未知区县回退城市坐标，districtMatched=false', () => {
  const g = lookupGeoV2({ province: '广东省', city: '深圳市', district: '不存在区' });
  assert.ok(g);
  assert.equal(g.precision, 'city');
  assert.equal(g.districtMatched, false);
  assert.equal(g.src, 'city');
});

test('不传 district 时走 v1 城市结果', () => {
  const g = lookupGeoV2({ province: '广东省', city: '深圳市' });
  assert.ok(g);
  assert.equal(g.precision, 'city');
  assert.equal(g.districtMatched, false);
});
