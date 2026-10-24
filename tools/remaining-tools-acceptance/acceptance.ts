// 新开放工具的关键边界：跨零度相位、历法有效性、单字虚数及官方朔望时刻。
import assert from 'node:assert/strict';
import { computeAspects } from '../../frontend/lib/astro/aspects';
import type { PlanetPlace } from '../../frontend/lib/astro/planets';
import { computeMoonCycle } from '../../frontend/lib/astro/moon-cycle';
import { calculateLifePath, calculateNameNumber } from '../../frontend/lib/numerology/core';
import { calculateFiveGrids, elementRelation, parseStrokes } from '../../frontend/lib/name-compat/five-grids';

const place = (key: PlanetPlace['key'], lon: number): PlanetPlace => ({
  key, 名称: key, lon, lat: 0, signIndex: 0, 星座: '白羊座', signDeg: 0, signMin: 0,
});

const wrap = computeAspects([place('mars', 359), place('venus', 1)]);
assert.equal(wrap.length, 1);
assert.equal(wrap[0].name, '合相');
assert.equal(wrap[0].separation, 2);
assert.equal(computeAspects([place('mars', 0), place('venus', 9)]).length, 0);
assert.equal(computeAspects([place('sun', 0), place('mars', 7)]).length, 1);
assert.equal(computeAspects([place('mars', 0), place('venus', 120)]).length, 1);
assert.equal(computeAspects([place('mars', 0)]).length, 0);
assert.equal(computeAspects([place('mars', 0)], [place('mars', 180)]).length, 1);

assert.equal(calculateLifePath('2024-02-29')?.date, '2024-02-29');
assert.equal(calculateLifePath('2023-02-29'), null);
assert.equal(calculateLifePath('0001-01-01')?.total.value, 3);
assert.equal(calculateLifePath('2009-11-22')?.month.value, 11);
assert.equal(calculateLifePath('2009-11-22')?.day.value, 22);
assert.equal(calculateNameNumber('ADA')?.total.value, 6);
assert.equal(calculateNameNumber('张三'), null);

assert.deepEqual(parseStrokes('7, 8'), [7, 8]);
assert.equal(parseStrokes('7, 8, 9'), null);
assert.equal(parseStrokes('0'), null);
const oneOne = calculateFiveGrids([7], [6]);
assert.ok(oneOne);
assert.deepEqual(['天格', '人格', '地格', '外格', '总格'].map(name =>
  oneOne.values[name as keyof typeof oneOne.values].value), [8, 13, 7, 2, 13]);
const twoTwo = calculateFiveGrids([7, 8], [6, 5]);
assert.ok(twoTwo);
assert.deepEqual(['天格', '人格', '地格', '外格', '总格'].map(name =>
  twoTwo.values[name as keyof typeof twoTwo.values].value), [15, 14, 11, 12, 26]);
assert.equal(elementRelation('木', '火'), '甲生乙');
assert.equal(elementRelation('木', '土'), '甲克乙');
assert.equal(elementRelation('水', '土'), '乙克甲');

// 美国海军天文台 2024 年主月相表：朔 4 月 8 日 18:21 UTC，望 4 月 23 日 23:49 UTC。
// https://aa.usno.navy.mil/calculated/moon/phases?date=2024-4-08&format=p&nump=5&submit=Get+Data
const moon = computeMoonCycle(Date.parse('2024-04-08T00:00:00Z'));
assert.ok(moon);
assert.ok(Math.abs(moon.nextNewMoonUtcMs - Date.parse('2024-04-08T18:21:00Z')) < 60_000);
assert.ok(Math.abs(moon.nextFullMoonUtcMs - Date.parse('2024-04-23T23:49:00Z')) < 60_000);
assert.ok(moon.nextNewMoonUtcMs > moon.utcMs && moon.nextFullMoonUtcMs > moon.nextNewMoonUtcMs);
assert.equal(computeMoonCycle(Number.NaN), null);

console.log('remaining tools acceptance: key boundaries and USNO moon phases passed');
