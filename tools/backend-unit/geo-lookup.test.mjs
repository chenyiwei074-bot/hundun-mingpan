// 中国地点/时区纯逻辑单测（node --test）。依赖 server/dist 已构建。
// 运行：cd /opt && node --test tools/backend-unit/geo-lookup.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { lookupGeo } = require('../../server/dist/lib/true-solar/birth-wiring.js');

test('深圳市：地级市中心坐标 + Asia/Shanghai', () => {
  const g = lookupGeo({ province: '广东省', city: '深圳市' });
  assert.ok(g);
  assert.equal(g.tz, 'Asia/Shanghai');
  assert.equal(g.src, 'city');
  assert.ok(Math.abs(g.lng - 114.057939) < 0.000001);
  assert.ok(Math.abs(g.lat - 22.543527) < 0.000001);
});

test('北京：直辖市按 city 命中', () => {
  const g = lookupGeo({ province: '北京市' });
  assert.ok(g);
  assert.equal(g.src, 'city');
  assert.equal(g.tz, 'Asia/Shanghai');
});

test('名称归一化：深圳 vs 深圳市', () => {
  const a = lookupGeo({ province: '广东省', city: '深圳' });
  const b = lookupGeo({ province: '广东省', city: '深圳市' });
  assert.deepEqual(a, b);
});

test('港澳台使用各自时区', () => {
  assert.equal(lookupGeo({ province: '香港特别行政区', city: '香港岛' })?.tz, 'Asia/Hong_Kong');
  assert.equal(lookupGeo({ province: '澳门特别行政区', city: '澳门半岛' })?.tz, 'Asia/Macau');
  assert.equal(lookupGeo({ province: '台湾省', city: '台北市' })?.tz, 'Asia/Taipei');
});

test('未收录地点返回 null，不猜坐标', () => {
  assert.equal(lookupGeo({ province: '不存在省', city: '不存在市' }), null);
  assert.equal(lookupGeo({}), null);
});
