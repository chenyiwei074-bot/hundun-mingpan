// 「本命行星位置」验收（批 E2）。
//
// 这一批是有引擎、有出处、有对拍的第一项西方功能，所以这里钉的东西与批D 相反：
// 批D 钉的是"不许先许诺"，这一批钉的是"许诺的那一小块真的对得上权威星历，
// 而且没做的那几样在屏上写得出来"。运维 2026-10-23 裁定的口径是这套判据的根据：
// 地心 / 回归黄道 / 无 ayanamsa / 戳 astro-planets-v1 / 客户端算 /
// 与权威星历抽样对拍且公差进文档与套件 / 显示名不叫"星盘"。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/astro-acceptance/acceptance.ts --out=.astro.txt
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../_lib/codesrc';
import { VETTED_PINNED } from '../_lib/vettedDeps';
import { computePlanets, ASTRO_BASIS, ASTRO_CROSS_CHECK, ASTRO_DONE, PLANETS, SIGNS } from '../../frontend/lib/astro/planets';
import { computeAngles, ANGLE_CROSS_CHECK } from '../../frontend/lib/astro/angles';
import { computeHouseCusps, HOUSE_CROSS_CHECK, HOUSE_SYSTEMS, type HouseSystem } from '../../frontend/lib/astro/houses';
import { applyZodiacFrame, CHIRON_EPHEMERIS, computeChironPosition, computeLunarNodes, lahiriAyanamsha, LAHIRI_ICRC_EPOCH_UTC_MS } from '../../frontend/lib/astro/extensions';
import { toUtc, MOMENT_BASIS, availableZones } from '../../frontend/lib/astro/moment';
import { TROPICAL_SIGNS_BASIS, ASPECT_GEOMETRY_BASIS, type BasisTriple } from '../../frontend/lib/astro/classics';
import { readWesternBases } from '../_lib/classics';
import { PG_NOTE_ANCHOR, canon } from '../_lib/pgnorm';
import { WESTERN_INTENTS, WESTERN_TOOL_BY_SLUG } from '../../frontend/lib/tools/western-catalog';
import { ROUTER_SPECS } from '../../frontend/lib/assistant/intent';
import { build } from './make-reference';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.astro.txt';
const ROOT = join(__dirname, '../..');
const HERE = join(ROOT, 'tools', 'astro-acceptance');
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

// ── 本轮新增：凯龙、月球交点与拉希里恒星黄道 ──
{
  const epoch = lahiriAyanamsha(LAHIRI_ICRC_EPOCH_UTC_MS);
  ok('astro/lahiri-icrc-anchor', Math.abs(epoch - 23.25) < 1e-7,
    `拉希里 ICRC 1956 零点应为 23°15′；实得 ${epoch.toFixed(9)}°`);

  const instant = Date.parse('2026-10-25T00:00:00.000Z');
  const meanNodes = computeLunarNodes(instant, 'mean');
  const trueNodes = computeLunarNodes(instant, 'true');
  const antipodal = (rows: typeof meanNodes) => Math.abs(Math.abs(rows[0].lon - rows[1].lon) - 180) < 1e-8;
  ok('astro/lunar-nodes-antipodal', antipodal(meanNodes) && antipodal(trueNodes),
    '平均与真交点都应成 180° 对点');
  ok('astro/lunar-node-mode-distinct', Math.abs(meanNodes[0].lon - trueNodes[0].lon) > 0.01,
    `本例真交点与平均交点应体现短周期差异；实差 ${Math.abs(meanNodes[0].lon - trueNodes[0].lon).toFixed(4)}°`);
  const trial = { ...PLANETS[0], 名称: '太阳', lon: 100, lat: 0, signIndex: 3, 星座: '巨蟹座', signDeg: 10, signMin: 0 };
  const siderealTrial = applyZodiacFrame(trial, 'sidereal-lahiri', lahiriAyanamsha(instant));
  ok('astro/sidereal-frame-offset', Math.abs(((trial.lon - siderealTrial.lon + 360) % 360) - lahiriAyanamsha(instant)) < 1e-8,
    '恒星黄道位置必须与回归黄道位置相差同一拉希里岁差角');

  const binaryPath = join(ROOT, 'frontend', 'public', 'ephemeris', 'chiron-jpl-1900-2100-v1.bin');
  const bytes = readFileSync(binaryPath);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = bytes.subarray(0, 4).toString('ascii');
  const version = view.getUint32(4, true), count = view.getUint32(8, true), stride = view.getUint32(12, true);
  const validHeader = magic === 'CHRN' && version === 1 && count === CHIRON_EPHEMERIS.samples && stride === 2 && bytes.byteLength === 16 + count * 8;
  ok('astro/chiron-jpl-dataset-shape', validHeader,
    `NASA/JPL 凯龙星历二进制结构、样本数与范围相符；${bytes.byteLength} bytes / ${count} samples`);
  if (validHeader) {
    const longitudes = new Float32Array(count), latitudes = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      longitudes[index] = view.getFloat32(16 + index * 8, true);
      latitudes[index] = view.getFloat32(20 + index * 8, true);
    }
    const data = { longitudes, latitudes, startUtcMs: CHIRON_EPHEMERIS.fromUtcMs, count };
    const first = computeChironPosition(CHIRON_EPHEMERIS.fromUtcMs, data);
    const last = computeChironPosition(CHIRON_EPHEMERIS.throughUtcMs, data);
    const outside = computeChironPosition(CHIRON_EPHEMERIS.fromUtcMs - 1, data);
    const mid = computeChironPosition(CHIRON_EPHEMERIS.fromUtcMs + 43_200_000, data);
    ok('astro/chiron-range-and-interpolation', !!first && !!last && outside === null && !!mid
      && Number.isFinite(mid.lon) && Number.isFinite(mid.lat),
      `1900 / 2100 边界可算、范围外拒算、日内插值有效；首 ${first?.lon.toFixed(3)}° / 末 ${last?.lon.toFixed(3)}°`);
  } else {
    ok('astro/chiron-range-and-interpolation', false, '历表结构无效，无法检查边界和插值');
  }
  const source = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'NatalPlanets.tsx'), 'utf8'));
  ok('astro/extension-sources-visible', /horizons\.html/.test(source) && /swisseph\.htm/.test(source)
    && /IAU2006_Resolution_B1\.pdf/.test(source) && /britishmuseum/.test(stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'tarot', 'traditions.ts'), 'utf8'))),
    '星历、交点 / 拉希里方法与塔罗马赛牌组应各有可打开的原始来源');
}

const ENTRY = WESTERN_TOOL_BY_SLUG['astro-natal'];
const REF_FILE = join(HERE, 'cases', 'astro-ephemeris-reference.json');
// 比对前先去掉行尾差异：这一条要抓的是"重算的数变了"，不是"git 在 checkout 时把 LF 换成 CRLF"。
// 数据文件已用 .gitattributes 标 -text 保住原样，这里再兜一层是因为 autocrlf=true 的机器上
// 一次 rebase 就会把工作区换成 CRLF —— 那次红指的是行尾，会让人去查一个不存在的口径改动。
const eolFree = (s: string) => s.replace(/\r\n/g, '\n');
const refText = existsSync(REF_FILE) ? readFileSync(REF_FILE, 'utf8') : '';
const ref = refText ? JSON.parse(refText) : null;

// ── 0. 上升/整宫对拍夹具：20 组，公差不许超过 0.05° ──
{
  const file = join(HERE, 'fixtures', 'ascendant-whole-sign-v1.json');
  ok('angles/fixture-present', existsSync(file), `上升/整宫夹具必须存在：${file}`);
  if (existsSync(file)) {
    const fix = JSON.parse(readFileSync(file, 'utf8')) as {
      toleranceDeg: number; cases: Array<{ id: string; utcISO: string; lat: number; lon: number; ascendantDeg: number; wholeSignCuspsDeg: number[] }>;
    };
    ok('angles/fixture-count', fix.cases.length === 20 && fix.toleranceDeg === ANGLE_CROSS_CHECK.toleranceDeg,
      `20 组、公差 ${ANGLE_CROSS_CHECK.toleranceDeg}°：cases=${fix.cases.length} tolerance=${fix.toleranceDeg}`);
    let max = 0; let bad = '';
    const diff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };
    for (const c of fix.cases) {
      const r = computeAngles(Date.parse(c.utcISO), c.lat, c.lon);
      if (!r.ok) { bad = `${c.id}: ${r.reason}`; break; }
      const d = Math.max(diff(r.ascendant.lon, c.ascendantDeg), ...r.wholeSignCusps.map((x, i) => diff(x.lon, c.wholeSignCuspsDeg[i])));
      if (d > max) { max = d; if (d > 0.05) bad = `${c.id}: ${d.toFixed(6)}°`; }
    }
    ok('angles/fixture-match', !bad && max <= 0.05,
      bad ? `对拍超差 ${bad}` : `20 组上升/整宫全部在 0.05°内，实测最大差 ${max.toFixed(6)}°`);
  }
}

// ── 0b. 非整宫制：20 个时刻逐系统对拍 Swiss Ephemeris 与 Celestine ──
{
  const file = join(HERE, 'fixtures', 'house-systems-v1.json');
  ok('houses/fixture-present', existsSync(file), `宫制对拍夹具必须存在：${file}`);
  if (existsSync(file)) {
    const fix = JSON.parse(readFileSync(file, 'utf8')) as {
      toleranceDeg: number; systems: HouseSystem[];
      cases: Array<{ id: string; utcISO: string; lat: number; lon: number;
        references: Record<string, { swissEphemeris: number[]; celestine: number[] }> }>;
    };
    const expectedSystems = fix.systems;
    ok('houses/fixture-count', fix.cases.length === 20 && fix.toleranceDeg === HOUSE_CROSS_CHECK.toleranceDeg
      && fix.systems.length === HOUSE_CROSS_CHECK.fixtureSystems
      && HOUSE_CROSS_CHECK.verifiedSystems === fix.systems.length
      && HOUSE_CROSS_CHECK.pendingReferenceSystems.length === 0
      && HOUSE_CROSS_CHECK.implementedNonWholeSystems === fix.systems.length
      && fix.systems.every(system => HOUSE_SYSTEMS.some(item => item.id === system)),
      `20 组 × ${expectedSystems.join('/')}，已实现的非整宫制均有独立夹具，公差 ${HOUSE_CROSS_CHECK.toleranceDeg}°：cases=${fix.cases.length} systems=${fix.systems.join('/')} tolerance=${fix.toleranceDeg}`);
    let maxSwiss = 0; let maxCelestine = 0; let bad = '';
    const diff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };
    for (const c of fix.cases) {
      const angles = computeAngles(Date.parse(c.utcISO), c.lat, c.lon);
      if (!angles.ok) { bad = `${c.id}: ${angles.reason}`; break; }
      for (const system of expectedSystems) {
        const result = computeHouseCusps(angles, system);
        if (!result.ok || result.cusps.length !== 12) { bad = `${c.id}/${system}: ${result.ok ? '宫头不满 12 个' : result.reason}`; break; }
        const refs = c.references[system];
        if (!refs || refs.swissEphemeris.length !== 12 || refs.celestine.length !== 12) { bad = `${c.id}/${system}: 缺独立参考值`; break; }
        for (let i = 0; i < 12; i++) {
          maxSwiss = Math.max(maxSwiss, diff(result.cusps[i].lon, refs.swissEphemeris[i]));
          maxCelestine = Math.max(maxCelestine, diff(result.cusps[i].lon, refs.celestine[i]));
        }
      }
      if (bad) break;
    }
    ok('houses/fixture-match-swiss', !bad && maxSwiss <= HOUSE_CROSS_CHECK.toleranceDeg,
      bad ? `Swiss Ephemeris 对拍失败 ${bad}` : `${fix.cases.length * expectedSystems.length * 12} 个宫头对拍通过，最大差 ${maxSwiss.toFixed(6)}°`);
    ok('houses/fixture-match-celestine', !bad && maxCelestine <= HOUSE_CROSS_CHECK.toleranceDeg,
      bad ? `Celestine 对拍失败 ${bad}` : `${fix.cases.length * expectedSystems.length * 12} 个宫头对拍通过，最大差 ${maxCelestine.toFixed(6)}°`);
  }
  const sampleAngles = computeAngles(Date.parse('2000-01-01T12:00:00.000Z'), 67, 0);
  const polar = sampleAngles.ok ? computeHouseCusps(sampleAngles, 'placidus') : sampleAngles;
  ok('houses/polar-limit-explicit', !polar.ok && polar.reason === '极区不适用',
    `Placidus 极区条件必须明确报错，不静默换宫制：${polar.ok ? '意外返回可用' : polar.reason}`);
}

// ── 1. 对拍夹具：先在，再能重算，再看公差 ──
{
  ok('astro/reference-present', !!ref && Array.isArray(ref.samples) && ref.samples.length > 0,
    `对拍夹具必须存在且非空（离线可读的那一份权威值）：${ref ? ref.samples.length + ' 点' : '文件缺失'}`);
  const bodies = [...new Set((ref?.samples || []).map(s => s.body))];
  ok('astro/every-body-in-sample', !!ref && bodies.length === PLANETS.length
    && PLANETS.every(p => bodies.includes(p.key)),
    `十颗星必须全进对拍集：少一颗就是那一颗没人核过（实得 ${bodies.length} 颗${bodies.length ? '：' + bodies.join('、') : ''}）`);
  const perBody = new Map<string, number>();
  for (const s of (ref?.samples || [])) perBody.set(s.body, (perBody.get(s.body) || 0) + 1);
  const counts = [...perBody.values()];
  const minCount = counts.length ? Math.min(...counts) : 0;
  // 原意是"别让某颗星只剩一个历元"。批F⑤ 之后月亮**故意**比别的星密（换座边界那 16 个点），
  // 所以钉的不再是"大家都一样多"，而是"每颗都到得了那个下限，且多的那一颗多得有理由"。
  ok('astro/uniform-epochs', !!ref && perBody.size === PLANETS.length && minCount >= 9
    && (perBody.get('moon') || 0) > minCount,
    `每颗星至少 9 个历元（5 常规 + 1860/2160 各 2），月亮还要再带贴换座边界那一串（实得最低 ${minCount}，`
    + `月亮 ${perBody.get('moon') || 0}）：掉回个位数就是那颗又变成单点自证`);

  // 重算一次：权威那侧（原始星历输出）+ 引擎，必须复现仓库里那份夹具。
  // 这一条同时是"引擎升了版/口径改了却没升戳"的探针。
  let repro = '';
  try { repro = JSON.stringify(build(), null, 1) + '\n'; } catch (e) { repro = 'ERR ' + (e instanceof Error ? e.message : String(e)); }
  ok('astro/reference-reproducible', !!ref && eolFree(repro) === eolFree(refText),
    '从 horizons/ 原始输出重算必须与夹具逐字一致 —— 不一致就是星历源、解析列义或引擎版本动过，'
    + '必须重跑 make-reference.ts 并核过新偏差才允许钉住' + (repro.startsWith('ERR') ? `（本次重算失败：${repro.slice(0, 120)}）` : ''));

  const tol = ref?.toleranceDeg;
  // 窗口内/窗口外分开判：夹具里既有 1860—2026（全部达标），也有 2160 那一批（月亮实测超线）。
  // 把它们混在一个 max 里只会得到两种坏结果 —— 要么放宽整条线（那 1860 的达标也就白钉了），
  // 要么永远红着（那下次真出错就没人看）。所以窗口这件事必须是**数据**，不是注释。
  const win = ref?.window;
  const yearOf = (s: { iso: string }) => +/^(\d{4})/.exec(s.iso)![1];
  const inWin = (ref?.samples || []).filter(s => !win || yearOf(s) <= win.to);
  const outWin = (ref?.samples || []).filter(s => win && yearOf(s) > win.to);
  const worstLon = inWin.reduce((a, s) => Math.max(a, Math.abs(s.dLon)), 0);
  const worstLat = inWin.reduce((a, s) => Math.max(a, Math.abs(s.dLat)), 0);
  ok('astro/within-tolerance', typeof tol === 'number' && tol > 0 && tol <= 0.02 && worstLon <= tol,
    `窗口内每点 |Δ黄经| 必须 ≤ 公差：公差 ${tol}°，实测最大 ${worstLon}°（0.02° = 1.2 角分，月亮约 2 分钟的走时）`);
  // 批F⑤ 补的那一维：黄纬。以前只核经度，"整个换了参考平面""黄纬符号反了""章动算歪"这三类
  // 错里后两类在经度上几乎看不出来，却在盘面上是错的信息。
  ok('astro/within-tolerance-latitude', typeof tol === 'number' && worstLat <= tol,
    `窗口内每点 |Δ黄纬| 走同一条线：实测最大 ${worstLat}° vs 公差 ${tol}°（黄纬不进闸门 = 那一半没人核）`);
  ok('astro/tolerance-documented', !!ref && typeof ref.toleranceDeg === 'number',
    `公差必须写在夹具里随仓库走，不许只活在某人的终端记录里：${ref ? ref.toleranceDeg + '°' : '无夹具'}`);
  ok('astro/window-documented', !!win && win.from < win.to && typeof ref?.countInWindow === 'number'
    && typeof ref?.countOutOfWindow === 'number' && ref.countInWindow + ref.countOutOfWindow === ref.samples.length,
    `对拍窗口必须是数据（from/to + 两侧各自的点数），否则"窗口外那条上限"就只是注释：`
    + `${win ? `${win.from}—${win.to}` : '无'} / 窗口内 ${ref?.countInWindow ?? '无'} 点 / 窗口外 ${ref?.countOutOfWindow ?? '无'} 点`);
  {
    // 窗口外不是"没测"，是"测了、超线了、如实记着"。这一条要求：确实有点超 0.02°，
    // 也确实给了它们一条自己的上限 —— 少了前者就是自欺（"我们的远未来也全部达标"这种绿不能要），
    // 少了后者就是无人认领。
    const outWorst = outWin.reduce((a, s) => Math.max(a, Math.abs(s.dLon), Math.abs(s.dLat)), 0);
    const cap = ref?.outOfWindowToleranceDeg;
    ok('astro/out-of-window-honest', outWin.length > 0 && typeof cap === 'number'
      && outWorst > (tol || 0.02) && outWorst <= cap,
      `2100 之后实测 ${outWorst}°（月亮），必须 > 窗口内公差 ${tol}° 且 ≤ 自己的上限 ${cap ?? '无'}°：`
      + `这条判据红有两种意思 —— 要么远未来又长了一截，要么有人把"测出来超线"这件事删了`);
  }
  {
    // 月亮贴 0°/30° 整数界的那一串：错了就整条线错，而这一批点同时是"落座边界"的判据。
    const moon = (ref?.samples || []).filter(s => s.body === 'moon');
    const near = moon.map(s => {
      const into = ((s.refLon % 30) + 30) % 30;
      return Math.min(into, 30 - into);
    }).reduce((a, v) => Math.min(a, v), 99);
    ok('astro/moon-pinned-at-sign-boundary', moon.length >= 20 && near <= 0.05,
      `月亮必须有贴着换座整数界的样本（离边界 ≤0.05°）：实得最近 ${near.toFixed(4)}°、历元 ${moon.length} 个。`
      + `没有贴边界的点，"30° 一条线切错位置"这类错在屏上是看不出来的`);
    // 落座本身也要在边界上对得上：权威值与我方值算出的"第几宫"必须同一格（含 359.99→0 那种绕回）。
    const signDiff = moon.filter(s => Math.floor(((s.refLon % 360) + 360) % 360 / 30) !== Math.floor(((s.ourLon % 360) + 360) % 360 / 30));
    ok('astro/sign-index-agrees-at-boundary', signDiff.length === 0,
      `每颗月亮样本的落座（⌊黄经/30⌋）两侧必须同一格，边界那一串尤其：不一致 ${signDiff.map(s => s.iso).join('、') || '无'}`);
  }
  {
    const cov = ref?.coverage;
    ok('astro/extreme-epochs-covered', !!cov && cov.pre1900 >= 10 && cov.after2100 >= 10
      && cov.yearMin < 1870 && cov.yearMax > 2150,
      `1900 前与 2100 后都必须真的进对拍集（不是文档里写一句"也测过"）：`
      + `实得 ${cov ? `${cov.yearMin}—${cov.yearMax}，1900 前 ${cov.pre1900} 点 / 2100 后 ${cov.after2100} 点` : '无 coverage 字段'}`);
  }
  const maxKeys = Object.keys(ref?.maxAbsDLon || {});
  ok('astro/max-per-body-documented', maxKeys.length === PLANETS.length
    && Object.keys(ref?.maxAbsDLat || {}).length === PLANETS.length,
    `逐颗星的实测最大偏差（经、纬两份）都要留档（只留一个总最大值就看不出是不是某颗星一直贴着线）：`
    + `经度 ${maxKeys.length}/10、纬度 ${Object.keys(ref?.maxAbsDLat || {}).length}/10`);
  ok('astro/cross-check-single-source', !!ref && ref.toleranceDeg === ASTRO_CROSS_CHECK.toleranceDeg
    && ref.window?.from === ASTRO_CROSS_CHECK.from && ref.window?.to === ASTRO_CROSS_CHECK.to,
    `公差与窗口只有一个出处（lib/astro/planets.ts 的 ASTRO_CROSS_CHECK），夹具必须与它逐字相等：`
    + `夹具 ${ref?.toleranceDeg}/${ref?.window?.from}-${ref?.window?.to} vs 常量 ${ASTRO_CROSS_CHECK.toleranceDeg}/${ASTRO_CROSS_CHECK.from}-${ASTRO_CROSS_CHECK.to}`);

  // 反空转：全零的 Δ 说明两边读的是同一个数（自证），历元不变 likewise。
  const deltas = (ref?.samples || []).map(s => Math.abs(s.dLon));
  const allZero = deltas.length > 0 && deltas.every(d => d === 0);
  const varies = (ref?.samples || []).filter(s => s.body === 'moon').map(s => s.refLon);
  ok('astro/cross-check-not-vacuous', !allZero && new Set(varies).size === varies.length && varies.length >= 3,
    `对拍必须同时满足"两侧不完全相等"与"同一颗星跨历元的权威值本身在动"：`
    + `全零点 ${deltas.filter(d => d === 0).length}/${deltas.length}，月亮历元 ${new Set(varies).size} 个不同值`);
  ok('astro/authority-is-jpl', (() => {
    // 常规那三份 + 批F⑤ 新抓的两类历元（1860 / 2160 / 月亮换座边界）一起核：
    // 新那份也得自己带着"地心 / DE441 / 列义"这三件事，否则那一类历元只是夹具里的数。
    const files = ['body-10.txt', 'body-301.txt', 'body-999.txt',
      'body-10-1860.txt', 'body-10-2160.txt', 'body-301-ingress.txt'];
    return files.every(f => {
      const t = readFileSync(join(HERE, 'horizons', f), 'utf8');
      const id = /^body-(\d{2,3})/.exec(f)![1];
      return new RegExp(`Target body name:.*\\(${id}\\)`).test(t)
        && /Center body name:.*Earth \(399\)/.test(t) && /source:\s*DE441/.test(t) && /ObsEcLon\s+ObsEcLat/.test(t);
    });
  })(),
    '原始星历输出必须自己带着"目标星 = 文件名那个编号、观测中心=地球(399) 地心 / DE441 / 列义含 ObsEcLon ObsEcLat"：'
    + '这几样是对拍口径的证据，不在注释里，在权威那侧回写的表头里（含批F⑤ 新抓的极端历元）');
  // 极端历元与换座边界那几份原始输出必须在仓库里（夹具是从它们算的；文件不在就等于那 40 个点没人能复核）。
  ok('astro/extreme-raw-present', ['body-10-1860.txt', 'body-10-2160.txt', 'body-301-ingress.txt']
    .every(f => existsSync(join(HERE, 'horizons', f))),
    `批F⑤ 那两类新样本的原始输出要随仓库走：缺一份就是那一类历元只剩夹具里的数，别人没法重看`);
}

// ── 2. 口径戳：引擎内部保留标识，产品文案不展示工程代号 ──
{
  const stampShape = /^[a-z]+(?:-[a-z]+)+-v\d+$/;
  ok('astro/stamp-shape', stampShape.test(ASTRO_BASIS) && stampShape.test(MOMENT_BASIS) && ASTRO_BASIS !== MOMENT_BASIS,
    `两个戳都要是 xxx-yyy-vN 形状且互不相同（时刻换算与历表是两条口径，合成一个戳就分不出是谁变了）：`
    + `${ASTRO_BASIS} / ${MOMENT_BASIS}`);
  const basis = [ENTRY.name, ENTRY.question, ENTRY.method, ENTRY.basis, ENTRY.reading, ENTRY.note || ''].join(' ');
  ok('astro/catalog-hides-engine-stamps', !basis.includes(ASTRO_BASIS) && !basis.includes(MOMENT_BASIS),
    '对外介绍只说明计算体系与适用范围，不显示内部版本代号');
  const page = stripComments(readFileSync(join(ROOT, 'frontend', 'app', 'astro', 'page.tsx'), 'utf8'));
  ok('astro/page-hides-engine-stamps', !/ASTRO_BASIS|MOMENT_BASIS|astro-planets-v1|astro-moment-iana-v1/.test(page),
    '产品页面不展示内部版本标识');
}

// ── 3. 已开放范围与“不叫星盘”口径 ──
{
  ok('astro/status-is-open', ENTRY.status === '可用' && ENTRY.href === '/astro',
    `七种宫制范围已开放并有入口：实得 ${ENTRY.status} / ${ENTRY.href || '无'}`);
  ok('astro/href-route-exists', existsSync(join(ROOT, 'frontend', 'app', 'astro', 'page.tsx')),
    '入口指向的 /astro 必须有真的 page.tsx（与东方 dir/live-hrefs-resolve 同一条纪律）');
  ok('astro/display-name-not-chart', ENTRY.name === '本命行星位置' && !/星盘|命盘|排盘结果/.test(ENTRY.name),
    `裁定③：宫位没做就不许叫"星盘"。实得显示名「${ENTRY.name}」`);
  ok('astro/done-list-equals-engine', JSON.stringify(ENTRY.done) === JSON.stringify([...ASTRO_DONE]),
    `「已做」那份清单必须与引擎导出的 ASTRO_DONE 逐字同序：目录 ${JSON.stringify(ENTRY.done)} / 引擎 ${JSON.stringify([...ASTRO_DONE])}`);
  ok('astro/extensions-are-listed-as-done', (ENTRY.done || []).some(s => /凯龙星/.test(s))
    && (ENTRY.done || []).some(s => /北交点与南交点/.test(s))
    && (ENTRY.done || []).some(s => /拉希里恒星黄道/.test(s)),
    `凯龙星、南北交点与恒星黄道均列入开放范围：${JSON.stringify(ENTRY.done)}`);
  ok('astro/house-system-scope-is-listed', (ENTRY.done || []).some(s => /雷吉奥蒙塔努斯/.test(s) && /坎帕纳斯/.test(s)),
    `七种宫制范围必须包括 Regiomontanus 与 Campanus：${JSON.stringify(ENTRY.done)}`);
  ok('astro/angles-done', (ENTRY.done || []).some(s => /上升点/.test(s) && /整宫制/.test(s)),
    `「已做」里必须出现上升点与整宫制：${JSON.stringify(ENTRY.done)}`);
  // 目录给用户看的说明应使用中文，不把工程版本标识或实现库名称当作产品文案。
  const screenFields = [ENTRY.name, ENTRY.question, ENTRY.method, ENTRY.basis, ENTRY.reading, ENTRY.note || '', ...(ENTRY.done || [])].join(' ');
  const latin = [...new Set(screenFields.match(/[a-z]{4,}/gi) || [])];
  const internal = /astro-planets-v1|astro-moment-iana-v1|astronomy-engine|DE441|\bMIT\b/i.test(screenFields);
  ok('astro/screen-words-are-chinese', latin.length === 0 && !internal,
    `目录卡面的介绍用中文表达，不显示工程版本号、实现库或许可信息：英文 ${latin.join('、') || '无'}；内部标识 ${internal ? '仍有' : '无'}`);
  // 反向：已经不算的东西不许出现在"会算"的那一侧，也不许在问题与读法里许诺。
  const promises = [ENTRY.name, ENTRY.question, ENTRY.method, ENTRY.reading, ENTRY.teaser || '', ...(ENTRY.done || [])].join(' ');
  const banned = ['性格'].filter(w => promises.includes(w));
  ok('astro/no-undelivered-promise', banned.length === 0,
    `开放范围内的描述不许承诺未列入的预测功能：命中 ${banned.join('、') || '无'}`);
  ok('astro/renders-open-scope', (() => {
    const card = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'tools', 'ToolCatalog.tsx'), 'utf8'));
    return /t\.done/.test(card) && /开放内容/.test(card);
  })(), '目录卡片必须呈现明确的开放内容范围');
  const comp = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'NatalPlanets.tsx'), 'utf8'));
  ok('astro/work-page-reads-catalog', /WESTERN_TOOL_BY_SLUG/.test(comp) && /宫制范围/.test(comp),
    '工作页必须展示七种宫制和适用边界');
  // 问事框的路由词表也算"承诺"：这个页面尚不是完整星盘，也没有所有传统宫制。
  const askWords = ROUTER_SPECS['astro-natal'].ask;
  const undelivered = ['星盘', '本命盘'];
  const over = askWords.filter(k => undelivered.some(u => k.includes(u)));
  ok('astro/router-words-are-delivered', over.length === 0,
    `astro-natal 的路由关键词只能是我做得到的那几样（实得 ${askWords.join('、')}）：越界 ${over.join('、') || '无'}`);
  ok('astro/work-page-says-not-chart', /不叫星盘/.test(comp),
    '「不叫星盘」这句话要在盘面上（裁定③的理由要能被读者看到，不是只写在裁定里）');
  // 窗口这件事必须让读者看到：夹具里那句"2100 之后不打包票"只护得住核过它的人，
  // 屏上没这一句，页面上任何一年看起来都一样可信。数字读 ASTRO_CROSS_CHECK，不另抄一份。
  ok('astro/page-states-cross-check-window', /ASTRO_CROSS_CHECK/.test(comp)
    && /对拍|逐点核过|逐星核过/.test(comp) && /不打包票/.test(comp),
    '工作页必须写明"与权威星历核过、窗口是多少、窗口外不打包票"，且那几个数读的是引擎里那一个常量');
  const extensionSource = stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'astro', 'extensions.ts'), 'utf8'));
  ok('astro/work-page-client-only', /^'use client';/.test(stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'NatalPlanets.tsx'), 'utf8')).replace(/^\uFEFF/, ''))
    && /fetch\(CHIRON_EPHEMERIS\.url/.test(extensionSource) && !/fetch\(['"`]\/api\//.test(comp)
    && !/\/api\//.test(comp) && !/\/api\//.test(extensionSource),
    '出生资料仍只在本机参与计算；唯一读取的是随站点部署的静态凯龙星历文件，不调用 API 上传生辰');
  ok('astro/extension-controls-and-rendering', /astro-zodiac-frame/.test(comp) && /astro-node-mode/.test(comp)
    && /data-astro-extensions/.test(comp) && /data-astro-point=\{point\.key\}/.test(comp),
    '页面必须提供两种黄道与交点模式选择，并渲染凯龙和南北交点扩展表');
  ok('astro/tap-targets-in-source', (comp.match(/minHeight: 44/g) || []).length >= 4,
    `日期、钟面、时区、按钮四个控件都要 44px 命中区（本批新增控件不许天生矮）：实得 ${(comp.match(/minHeight: 44/g) || []).length} 处`);
  // 批F③：E2 第一版把 2000-01-01 12:00 当预填样例，形状是"一张已经填好时间的表单"——
  // 用户一个键都没碰就按下按钮，得到的是一张看起来属于他的盘，而那个时刻是我们替他挑的。
  // 这一条钉三件事：两个初值都是空串、没填完按钮是灰的、源码里不残留那个样例日期。
  ok('astro/no-prefilled-birth-moment',
    (comp.match(/= useState\(''\)/g) || []).length >= 2
    && /(?<!aria-)disabled=\{!可算\}/.test(comp) && /if \(!可算\) return/.test(comp)
    && !/2000-01-01/.test(comp),
    `出生时刻不许预填：日期与钟面初值都要是空串、没填完时按钮 disabled 且 run() 早退、源码里不含样例日期`
    + `（空串 ${/useState\(''\)/.test(comp) ? '有' : '没有'} / disabled 门闩 ${/(?<!aria-)disabled=\{!可算\}/.test(comp) ? '有' : '没有'} / 样例残留 ${/2000-01-01/.test(comp) ? '在' : '不在'}）`);
}

// ── 4. 其余西方已开放项也有真实入口与范围说明 ──
{
  const others = WESTERN_INTENTS.flatMap(g => g.tools).filter(t => t.slug !== 'astro-natal');
    const otherViolations = others.filter(t => {
      if (t.status === '未开放') return !!t.href || (t.note || '').length < 8 || !t.basis.includes('缺');
      if (t.status === '可用') return !t.href || !existsSync(join(ROOT, 'frontend', 'app', t.href.slice(1), 'page.tsx'))
        || (t.note || '').length < 8;
      return true;
    });
  ok('astro/others-still-closed', otherViolations.length === 0,
      `本命行星位置之外，其余 ${others.length} 项要有真实入口与准确范围说明——`
      + `违规 ${otherViolations.map(t => t.slug).join('、') || '无'}`);
  const syn = WESTERN_TOOL_BY_SLUG['astro-synastry'];
  ok('astro/synastry-rationale-updated', /相位/.test(syn.basis) && /宫位叠合/.test(syn.note || '')
    && /中点盘/.test(syn.note || ''),
    `跨盘相位的开放范围与未纳入内容须明示：${syn.basis.slice(0, 40)}…`);
  const liveSlugs = WESTERN_INTENTS.flatMap(g => g.tools).filter(t => t.status !== '未开放').map(t => t.slug).sort();
  ok('astro/open-one-does-not-flip-others', JSON.stringify(liveSlugs) === JSON.stringify(
    ['astro-natal', 'astro-synastry', 'lunar-phase', 'numerology', 'tarot-draw']),
    `西方五项均有对应实现与明确范围：实得 ${liveSlugs.join('、') || '无'}`);
}

// ── 5. 降级：算不出来要说明白，不许猜 ──
{
  const bad = computePlanets(Number.NaN);
  ok('astro/degrade-bad-time', !bad.ok && bad.reason === '时刻无效', `拿不到世界时时刻要判"时刻无效"：${JSON.stringify(bad)}`);
  const gap = toUtc({ year: 2024, month: 3, day: 10, hour: 2, minute: 30, timeZone: 'America/New_York' });
  ok('astro/dst-gap-report', !gap.ok && gap.reason === '本地时间不存在',
    `夏令时跳表那一小时里不存在这个墙钟（2024-03-10 02:30 纽约）：${JSON.stringify(gap)}`);
  const amb = toUtc({ year: 2024, month: 11, day: 3, hour: 1, minute: 30, timeZone: 'America/New_York' });
  ok('astro/dst-ambiguity-report', !amb.ok && amb.reason === '本地时间有两次',
    `回拨那一小时墙钟读了两遍（2024-11-03 01:30 纽约），选哪一侧会让月亮差两度 —— 报出来，不替用户选：${JSON.stringify(amb)}`);
  const noZone = toUtc({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, timeZone: '' });
  const weirdZone = toUtc({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, timeZone: 'Mars/Olympus_Mons' });
  ok('astro/degrade-missing-and-unknown-zone', !noZone.ok && noZone.reason === '缺时刻'
    && !weirdZone.ok && weirdZone.reason === '时区未知',
    `没选时区与设备不认识的时区是两件事，各自要有原因码：${noZone.reason} / ${weirdZone.reason}`);
  const comp = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'NatalPlanets.tsx'), 'utf8'));
  const friendlyReasons = [
    '请补全出生日期、时间和地点。', '出生日期或时间无效，请核对后重试。',
    '暂时无法确定这个地点的时区', '所填时间不存在', '暂时无法唯一确定', '行星位置暂时无法计算',
  ];
  ok('astro/degrade-reason-on-screen', /tier="danger"/.test(comp) && /failureText\(why\)/.test(comp)
    && !/why\.detail/.test(comp) && friendlyReasons.every(s => comp.includes(s)),
    '每类失败都显示可理解的下一步提示，不把历算引擎原始错误细节直接展示给用户');
  const reasons = ['引擎不可用', '时刻无效', '无效日期', '本地时间不存在', '本地时间有两次', '缺时刻', '时区未知'];
  const src = stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'astro', 'planets.ts'), 'utf8'))
    + stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'astro', 'moment.ts'), 'utf8'));
  const missing = reasons.filter(r => !src.includes(`'${r}'`));
  ok('astro/reason-codes-exist', missing.length === 0,
    `每一个降级理由都要是代码里真的存在的字面量（文档里列了、代码里没有 = 界面上永远不会出现）：缺 ${missing.join('、') || '无'}`);
  const badMonth = toUtc({ year: 2000, month: 13, day: 1, hour: 12, minute: 0, timeZone: 'UTC' });
  ok('astro/invalid-date-rejected', !badMonth.ok && badMonth.reason === '无效日期',
    `Date.UTC 会把 13 月顺延成下一年 —— 那种"看起来算出来了"的错要当场拒：${JSON.stringify(badMonth)}`);
  // 「墙上钟面 → 世界时刻」只能有一份实现：真太阳时那批的 dst-resolver 已经拿公开验证集
  // 回归过，这一层再写一遍枚举就是第二个真相（而 E2 第一版就是这么写、就是这么写错的）。
  const moment = stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'astro', 'moment.ts'), 'utf8'));
  ok('astro/moment-delegates-dst-resolver', /resolveCivil\(/.test(moment)
    && !/for \(let (h|d) = -(24|48)/.test(moment) && !/offsetMinutesAt\(/.test(moment),
    'lib/astro/moment.ts 必须调 app/lib/true-solar/dst-resolver 的 resolveCivil，'
    + '自己不许再出现候选偏移的采样循环（两份时区实现迟早一份对一份错）');
}

// ── 6. 时间轴与黄道几何的牙齿 ──
{
  const utc = toUtc({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, timeZone: 'UTC' });
  ok('astro/utc-roundtrip', utc.ok && utc.utcMs === Date.UTC(2000, 0, 1, 12, 0, 0) && utc.offsetMin === 0,
    `UTC 时区下墙上钟面就是世界时：${JSON.stringify(utc)}`);
  const sh = toUtc({ year: 2024, month: 7, day: 1, hour: 12, minute: 0, timeZone: 'Asia/Shanghai' });
  const lon = toUtc({ year: 2024, month: 7, day: 1, hour: 12, minute: 0, timeZone: 'Europe/London' });
  const ld = toUtc({ year: 2024, month: 1, day: 15, hour: 12, minute: 0, timeZone: 'Europe/London' });
  ok('astro/offsets-include-dst', sh.ok && lon.ok && ld.ok
    && sh.offsetMin === 480 && lon.offsetMin === 60 && ld.offsetMin === 0,
    `同一地不同时节的偏移要对（伦敦夏时 +60、冬令 0；上海恒 +480）：${sh.offsetMin}/${lon.offsetMin}/${ld.offsetMin}`);
  const eq = computePlanets(Date.UTC(2024, 2, 20, 0, 0, 0));
  const sun = eq.ok ? eq.sun : null;
  ok('astro/sign-wrap-at-zero', !!sun && sun.lon > 359 && sun.lon < 360 && sun.星座 === '双鱼座'
    && sun.signIndex === 11 && sun.signDeg === 29,
    `春分前几小时太阳黄经在 359.x°，落座必须绕回"双鱼座 29°"而不是变成第 13 个区间：${JSON.stringify(sun)}`);
  const all = computePlanets(Date.UTC(2000, 0, 1, 12, 0, 0));
  const badCell = all.ok ? all.positions.filter(p => !(p.signDeg >= 0 && p.signDeg <= 29 && p.signMin >= 0 && p.signMin <= 59
    && p.lon >= 0 && p.lon < 360 && SIGNS[p.signIndex] === p.星座)) : [];
  ok('astro/cell-domain', all.ok && badCell.length === 0,
    `每颗星的读数都要落在合法区间内（30° 那一格永远不许出现，29°59′ 那一档要夹住）：越界 ${badCell.map(p => p.名称).join('、') || '无'}`);
  // 极端年份不许把异常抛到渲染路径外面（抛了整页白屏，界面上什么都读不到）。
  let threw = '';
  try {
    const y1 = toUtc({ year: 1, month: 1, day: 1, hour: 0, minute: 0, timeZone: 'UTC' });
    if (y1.ok) computePlanets(y1.utcMs);
  } catch (e) { threw = e instanceof Error ? e.message : String(e); }
  ok('astro/far-past-does-not-throw', threw === '',
    `公元 1 年这种极端输入要么算得出、要么走降级原因码，就是不许抛异常（抛了整页白屏）：${threw || '未抛出'}`);
  ok('astro/zone-list-usable', availableZones().includes('UTC') && availableZones().includes('Asia/Shanghai')
    && availableZones().length > 10,
    `时区下拉必须真的来自 Intl（这台设备上 ${availableZones().length} 个，含 UTC 与 Asia/Shanghai）：`
    + '兜底清单只在 supportedValuesOf 缺失时才用，静默用兜底会让界面只剩 16 个时区');
}

// ── 7. 文档与依赖：公差进文档、引擎按裁定钉版本 ──
{
  const docs = readFileSync(join(ROOT, 'docs', 'design-hundun-20261022.md'), 'utf8');
  ok('astro/tolerance-in-docs', docs.includes(ASTRO_BASIS) && /0\.02\s*°|0\.02 度|0\.02/.test(docs),
    '裁定要求"公差写进文档与套件"：文档里要同时找得到口径戳与那个 0.02');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  const ver = (pkg.dependencies || {})['astronomy-engine'];
  ok('astro/engine-pinned-exact', !!ver && /^\d+\.\d+\.\d+$/.test(ver) && ver === VETTED_PINNED['astronomy-engine'],
    `对拍的权威侧靠引擎版本可复现，所以必须钉死精确版本（白名单在 tools/_lib/vettedDeps.ts）：实得 ${ver || '未安装'}，裁定钉 ${VETTED_PINNED['astronomy-engine']}`);
  const license = JSON.parse(readFileSync(join(ROOT, 'frontend', 'node_modules', 'astronomy-engine', 'package.json'), 'utf8')).license;
  ok('astro/engine-license-mit', license === 'MIT',
    `裁定里批准的是 MIT 那一个（AGPL 与 1★ 仓库两条红线仍在）：实得 license=${JSON.stringify(license)}`);
}

// ── 8. 「依据」三层与西方底本（批H-W。业主两条裁定：窄路只认 PG 键入本 / 近代必须标）──
{
  const bases = [TROPICAL_SIGNS_BASIS, ASPECT_GEOMETRY_BASIS];
  const files = readWesternBases(ROOT);
  const byPath = new Map(files.map(f => [f.文件, f]));
  const find = (b: BasisTriple) => { const f = byPath.get(b.底本); return f ? { f, p: f.passages.find(x => x.id === b.底本段) } : { f: undefined, p: undefined }; };

  // 每条口径都得指得到一个真实存在、且真有那一段的底本 —— 悬空引文比不引更坏：它承诺了复核却没处可核。
  const dangling = bases.map(b => { const { f, p } = find(b); return (!f || !p) ? `${b.底本段}@${b.底本}` : null; }).filter(Boolean);
  // 塔罗底本已移到 docs/classics/tarot/：本命页只认两份 PG 西方占星底本。
  ok('astro/basis-files-registered', files.length === 2 && dangling.length === 0,
    `两份西方底本在册且每条依据都能落到具体段：实得 ${files.length} 份（${files.map(f => f.文件).join('、') || '无'}）；悬空 ${dangling.join('、') || '无'}`);

  // 逐字性：规范化之后判连续子串（两侧同一个 canon —— 折叠方式不同会伪装成"引文不一致"）
  const badQuote = bases.filter(b => { const { p } = find(b); return !(p && canon(p.text).includes(canon(b.原文))); });
  ok('astro/basis-quote-is-substring-of-classics', badQuote.length === 0,
    `页面每条引文必须是所登记 PASSAGE 的连续子串，差一字即红：未命中 ${badQuote.map(b => b.底本段).join('、') || '无'}（共 ${bases.length} 条）`);

  // PG 注号是注者锚点，不是古籍正文。带进引文就等于把注者语当原文卖（orb 那条教训）
  const withAnchor = bases.filter(b => PG_NOTE_ANCHOR.test(b.原文));
  ok('astro/basis-quote-carries-no-note-anchor', withAnchor.length === 0 && bases.every(b => !/\[\d{1,3}\]/.test(b.原文)),
    `引文里不许出现 [44] 这类 PG 注号：命中 ${withAnchor.map(b => b.底本段).join('、') || '无'}`);

  // 元数据齐不齐、段哈希自不自洽是**底本层**的事，判据在 western-acceptance
  // （west/bases-registered、west/base-hashes-immutable）。这里不重复实现一遍 ——
  // 同一件事两套断言迟早一套先坏，坏的那套还会给出看起来合理的红。

  // 三层缺一层就不算有出处；白话要自证非他人译本；出处行显示版本与章节，不显示仓库文件位置。
  const comp = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'BasisQuote.tsx'), 'utf8'));
  const missLayer = ['原文', '白话', '口径'].filter(k => !comp.includes(k));
  ok('astro/basis-three-layers', missLayer.length === 0 && /basis\.原文/.test(comp) && /basis\.白话/.test(comp)
    && /basis\.口径/.test(comp) && /basis\.版本/.test(comp) && /basis\.位置/.test(comp)
    && !/basis\.底本段|basis\.底本/.test(comp) && /非原文、非他人译本/.test(comp),
    `「依据」块保留原文、本站白话、来源版本与章节位置，不把仓库路径和内部段落编号展示给用户：缺 ${missLayer.join('、') || '无'}`);

  // 近代词条只许待在近代层，且一处都不许混进任何原文字段。
  // 上一版这里写的是"四个词条必须全部被覆盖"，那是条**假要求**：Life Path 属于数字命理，
  // 那一页还不存在，逼着 /astro 去替它声明分层，等于让页面说一件它没做的事。
  // 改成两条真不变量：① 这页写出来的近代词条必须在近代层；② 任何一个近代词条都不许出现在
  // 原文层或古籍层 —— Life Path 今天不出场所以①不涉它，但它哪天被写进古籍层，②立刻红。
  const MODERN = ['orb', 'Placidus', 'synastry', 'Life Path'];
  const CITED_HERE = ['orb', 'Placidus', 'synastry'];
  const tiersWith = (w: string) => bases.flatMap(b => b.口径.filter(t => t.说法.toLowerCase().includes(w.toLowerCase())));
  const misplaced = MODERN.flatMap(w => tiersWith(w).filter(t => t.属于 !== '无古籍出处 · 近代约定')
    .map(t => `${w} 被放进「${t.属于}」`));
  const missing = CITED_HERE.filter(w => !tiersWith(w).some(t => t.属于 === '无古籍出处 · 近代约定'));
  const leaked = MODERN.filter(w => bases.some(b => b.原文.toLowerCase().includes(w.toLowerCase())));
  ok('astro/basis-modern-tier-labeled', misplaced.length === 0 && missing.length === 0 && leaked.length === 0
    && bases.every(b => b.口径.some(t => t.属于 === '古籍原文')),
    `近代词条不许出现在原文层或古籍层：错位 ${misplaced.join('；') || '无'}；本页该标而没标 ${missing.join('、') || '无'}；`
    + `混进引文 ${leaked.join('、') || '无'}；每条依据都带古籍原文层 = ${bases.every(b => b.口径.some(t => t.属于 === '古籍原文'))}`);

  // 拉丁原文只挂在 /astro，不许被抄进目录卡面（那边另有 E1 的拉丁词判据，这条是为了第一时间点名）
  const catalogFields = [ENTRY.name, ENTRY.question, ENTRY.method, ENTRY.basis, ENTRY.reading, ENTRY.note || ''].join(' ');
  ok('astro/basis-quote-stays-off-catalog', !/Tetrabiblos|Gutenberg|De Laurence/.test(catalogFields) && !catalogFields.includes('tropical'),
    '逐字原文与原书名只许出现在 /astro 的依据块里；进目录卡面就是把拉丁词搬进中文页');
}

// 计数锁：本套件的判据条数钉死。删一条就红（"更绿了"不等于"更好了"），
// 加一条要把这个数字一起改 —— 改的是这条锁，不是产品。
// 批H-W 的 §8 有 8 条（底本在册／引文子串／无注号／元数据齐／哈希自洽／三层齐／
// 近代词条分层／引文不进目录）；本轮新增 7 条凯龙、交点、黄道与来源判据。
const EXPECT = 80;
ok('astro/count-lock', pass + fail + 1 === EXPECT,
  `本套件必须恰好 ${EXPECT} 条判据（实得 ${pass + fail + 1} 条，含本条）：少了是有人删了一条，多了是有人加完没登记`);

const summary = `astro acceptance: samples=${ref ? ref.count : 0} tol=${ref ? ref.toleranceDeg : 0}° stamp=${ASTRO_BASIS} pass=${pass} fail=${fail}`;
try { writeFileSyncOut(); } catch { /* ignore */ }
function writeFileSyncOut() {
  // eslint-disable-next-line
  const { writeFileSync } = require('node:fs');
  writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
}
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
