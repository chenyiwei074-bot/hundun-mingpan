// 西方上升点 / 整宫制 20 组对拍夹具校验（纯数据，不依赖运行时库）。
// 数据来源：tools/astro-acceptance/fixtures/ascendant-whole-sign-v1.json
// 生成参考：natal-chart-math (MIT) + astronomy-engine；第二实现：Celestine (MIT)。
// 运行：cd /opt && node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json tools/astro-acceptance/ascendant-fixtures-check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures', 'ascendant-whole-sign-v1.json');
const data = JSON.parse(readFileSync(FIX, 'utf8')) as {
  schemaVersion: number;
  fixtureVersion: string;
  toleranceDeg: number;
  cases: Array<{
    id: string; place: string; lat: number; lon: number; timezone: string;
    localDate: string; localTime: string; utcISO: string;
    ascendantDeg: number; wholeSignCuspsDeg: number[];
    crossCheck: { maxDiffDeg: number; toleranceDeg: number; ok: boolean };
  }>;
};

let pass = 0; let fail = 0;
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};
const wrap = (x: number) => ((x % 360) + 360) % 360;

ok('schema/version', data.schemaVersion === 1 && data.fixtureVersion === 'ascendant-whole-sign-v1',
  `fixtureVersion=${data.fixtureVersion}`);
ok('fixture/count', data.cases.length === 20, `cases=${data.cases.length}`);
ok('fixture/tolerance', data.toleranceDeg === 0.05, `tolerance=${data.toleranceDeg}`);

for (const c of data.cases) {
  const id = `case/${c.id}`;
  ok(id + '/coords', Number.isFinite(c.lat) && Number.isFinite(c.lon)
    && c.lat >= -90 && c.lat <= 90 && c.lon >= -180 && c.lon <= 180,
  `${c.place} lat=${c.lat} lon=${c.lon}`);
  ok(id + '/tz', /^Asia\/(Shanghai|Taipei|Hong_Kong|Macau)$/.test(c.timezone), c.timezone);
  ok(id + '/utc', !Number.isNaN(Date.parse(c.utcISO)), c.utcISO);
  ok(id + '/asc', Number.isFinite(c.ascendantDeg) && c.ascendantDeg >= 0 && c.ascendantDeg < 360,
    `asc=${c.ascendantDeg}`);
  ok(id + '/cusps-count', Array.isArray(c.wholeSignCuspsDeg) && c.wholeSignCuspsDeg.length === 12,
    `cusps=${c.wholeSignCuspsDeg?.length}`);
  const spacing = c.wholeSignCuspsDeg.map((v, i) =>
    wrap(v - c.wholeSignCuspsDeg[(i + 11) % 12] + 360));
  ok(id + '/whole-sign-spacing', spacing.every(d => Math.abs(d - 30) < 1e-6),
    `spacing=${spacing.map(x => x.toFixed(3)).join(',')}`);
  ok(id + '/crosscheck', c.crossCheck.ok === true && c.crossCheck.maxDiffDeg <= 0.05,
    `maxDiff=${c.crossCheck.maxDiffDeg}° / tolerance=${c.crossCheck.toleranceDeg}°`);
}

console.log(`\nSUMMARY ascendant fixtures: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
