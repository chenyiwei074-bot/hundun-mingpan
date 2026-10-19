// 生成 harness 用的八字结果态 fixture（tools/visual-harness/fixtures/chart-result.json）。
//
// 为什么要有这个文件：/chart/result/[id] 的盘面来自后端 /api/chart/result/<id>，本地没有
// Express/Postgres 时它只会落到「网络异常」空态。而 --stub 模式下那条 fetch 恰恰是从
// sessionStorage 的 chart_preview 取盘的 —— 不给这份 dump，「场景矩阵」那一节根本没被
// 测量过，census 只会审到一张空壳页（与首页那次「假绿」、六爻那次「只审到输入态」同类）。
//
// 两条硬规矩，与 tools/liuyao-ganzhi/make-fixture.ts 同一条路：
//  1. fixture 只由本文件产出，不许手改。盘里存的是引擎算出来的四柱，手改等于把错值焊进绿灯 gate。
//  2. 判据取自外部权威来源：tools/bazi-acceptance/cases/bazi-validation-v1.json
//     （github.com/openfate-ai/bazi-engine v1.1.1 的公开校验用例，合成数据、无真人出生信息）。
//     本文件先把「站点引擎输出 == 该用例期望」逐条断住，才把盘写盘；再把同一批期望值打成
//     token 印到 coverage 报告里，供 census.mjs 的 CHART_PINS 抄死。这样 fixture 若哪天存了
//     错四柱，打不出来的是本文件（FAIL），亮不起绿灯的是 census（token 对不上）。
//
// 选 historical-dst-iana 这一条：戊辰/己未/辛未/乙未，日主辛，顺行大运首运庚申，
// 而且同时踩到历史夏令时（dstOffset 1）与真太阳时校正（13:59），是站点最复杂的一条输入路径。
//
// 时钟敏感性不靠印象：引擎里 ziwei-standard.ts 调 calculateXuSui(birthInfo.year) 取当前虚岁
// （默认 new Date()），所以紫微那半边的「当前大限/流年区间」会随自然年漂。本文件每次都做一遍
// 跨年重排并逐路径 diff，据此断言 ① 漂移全部落在 chart.ziwei 内、② chart.bazi 逐字节不变。
// --check 因此分两种红：STALE（只有紫微漂移 → 重跑本文件刷新）与 DRIFT（八字半边变了 → 真变化）。
//
// 用法（同 acceptance.ts，外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到 @/*）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/visual-harness/make-chart-fixture.ts [--check]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChart, BirthInfo } from '../../frontend/app/lib/core/yiqi-core';
import { resolveZoneInfo } from '../../frontend/app/lib/true-solar/dst-resolver';

const CASE_ID = 'historical-dst-iana';
const CASES = join(__dirname, '..', 'bazi-acceptance', 'cases', 'bazi-validation-v1.json');
const OUT = join(__dirname, 'fixtures', 'chart-result.json');
const TOKENS = join(__dirname, 'fixtures', 'chart-coverage.txt');
const CHART_NAME = '验收样本·男';

const CHECK = process.argv.includes('--check');

const fails: string[] = [];
const ok = (name: string, cond: boolean, detail: string) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name.padEnd(28) + detail);
  if (!cond) fails.push(name + ' → ' + detail);
};

const realDate = Date;
const shiftClock = (iso: string) => {
  const target = new realDate(iso + 'T12:00:00Z').getTime();
  // @ts-ignore —— 只在此工具进程里挪时钟，不进产品代码。
  globalThis.Date = class extends realDate {
    constructor(...a: any[]) { super(...(a.length ? a : [target])); }
    static now() { return target; }
  };
};
const restoreClock = () => { (globalThis as any).Date = realDate; };

// 逐路径找两个对象的差异键。数组按下标比，够用且不会漏字段。
function diffPaths(a: any, b: any, prefix: string, acc: string[] = []): string[] {
  if (a === b) return acc;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) acc.push(prefix + '.length');
    for (let k = 0; k < Math.min(a.length, b.length); k++) diffPaths(a[k], b[k], `${prefix}[${k}]`, acc);
    return acc;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!(key in a) || !(key in b)) acc.push(prefix + '.' + key);
      else diffPaths(a[key], b[key], prefix + '.' + key, acc);
    }
    return acc;
  }
  acc.push(prefix);
  return acc;
}

const suite = JSON.parse(readFileSync(CASES, 'utf8'));
const c = suite.cases.find((x: any) => x.id === CASE_ID);
if (!c) { console.log('FAIL  用例 ' + CASE_ID + ' 不在 ' + CASES); process.exit(1); }
const i = c.input;
const e = c.expected;

// 与 tools/bazi-acceptance/acceptance.ts 完全同一套入参映射 —— 两边不是巧合地一致，
// 而是走同一个 resolveZoneInfo；换时区解析器就两边一起红。
const civil = { year: i.year, month: i.month, day: i.day, hour: i.hour, minute: i.minute };
const zone = resolveZoneInfo(civil, i.timezoneId);
const birthInfo: BirthInfo = {
  year: i.year, month: i.month, day: i.day, hour: i.hour, minute: i.minute,
  isLunar: i.calendarType === 'lunar',
  gender: i.gender === 'female' ? 'female' : 'male',
  timeZone: zone.standardOffsetHours,
  longitude: i.longitude,
  dstOffset: zone.dstOffsetHours,
  enableTrueSolarTime: i.enableTrueSolarTime !== false,
};

const chart: any = createChart(birthInfo);
const bazi = chart.bazi;
const ganZhi = (p: any) => (p && p.gan && p.zhi ? p.gan + p.zhi : '??');
const siZhu = [ganZhi(bazi?.siZhu?.year), ganZhi(bazi?.siZhu?.month), ganZhi(bazi?.siZhu?.day), ganZhi(bazi?.siZhu?.hour)];

// ── 1. 盘面必须等于外部用例的期望值（没有一个字是从引擎输出抄的）
const expPillars = [e.pillars.year, e.pillars.month, e.pillars.day, e.pillars.hour];
ok('golden/pillars', siZhu.join(' ') === expPillars.join(' '),
  `期望 ${expPillars.join(' ')}｜实得 ${siZhu.join(' ')}`);
ok('golden/dayMaster', bazi?.dayMaster === e.dayMaster, `期望 ${e.dayMaster}｜实得 ${bazi?.dayMaster}`);
const firstCycleGanZhi = bazi?.dayun?.[0]?.ganZhi;
const firstCycle = firstCycleGanZhi ? `${firstCycleGanZhi.gan}${firstCycleGanZhi.zhi}` : undefined;
ok('golden/firstDayun', firstCycle === e.daYun.firstCycle,
  `期望 ${e.daYun.firstCycle}｜实得 ${firstCycle}`);
ok('golden/dstOffset', zone.dstOffsetHours === e.metadata.dstOffset,
  `期望 ${e.metadata.dstOffset}｜实得 ${zone.dstOffsetHours}`);
// 用例给到分（"13:59"），站点引擎给到秒（"13:59:42"）—— 两边都不是"应该相等"的关系，
// 所以钉的是秒级那一串：它必须等于用例 calendar.calculationSolar 的时分秒。
const tst = bazi?.trueSolarTime?.trueSolarTime;
const calcSolar = String(e.calendar.calculationSolar).split(' ')[1];
ok('golden/trueSolarTime', tst === calcSolar,
  `期望 ${calcSolar}（用例 calculationSolar 的时分秒）｜实得 ${tst}`);
// 用例里 solarTime 可以为 null（不做真太阳时的那几条）。直接读它的字段会抛 TypeError，
// 那是工具自己的坑：换用例应当得到一条 FAIL，不是一屏堆栈。
const wantLon = e.solarTime && e.solarTime.longitudeCorrectionMinutes;
const gotLon = bazi?.trueSolarTime && bazi.trueSolarTime.longitudeCorrectionMinutes;
ok('golden/longitudeCorrection', wantLon === gotLon,
  `期望 ${wantLon}｜实得 ${gotLon}${e.solarTime ? '' : '（该用例不校正真太阳时）'}`);

// ── 2. 前提断言：这张盘必须真能喂到「场景矩阵」上。空盘同样能出一张截图，
//       所以这里必须在写盘之前咬住，而不是等 census 报「那一节渲染出来了」。
ok('premise/siZhu-on-plate', !!bazi?.siZhu && siZhu.every(s => s !== '??'), '四柱完整');
ok('premise/dayun-nonempty', Array.isArray(bazi?.dayun) && bazi.dayun.length > 0,
  `大运 ${bazi?.dayun?.length ?? 0} 段`);
ok('premise/shiShen-nonempty', !!bazi?.shiShen && Object.keys(bazi.shiShen).length >= 4,
  `十神 ${Object.keys(bazi.shiShen || {}).length} 柱`);
const cangGanPillars = ['year', 'month', 'day', 'hour'].filter(p => (bazi?.cangGan as any)?.[p]?.length);
const cangGanCount = cangGanPillars.reduce((n, p) => n + ((bazi?.cangGan as any)?.[p] || []).length, 0);
ok('premise/cangGan-nonempty', cangGanCount > 0,
  `藏干 ${cangGanCount} 条，分布在 ${cangGanPillars.length} 柱（引擎里是 {{gan,shiShen}} 数组、按柱分键，不是扁平 tenGod）`);
ok('premise/ziwei-renderable', !!chart?.ziwei, '紫微那半边也在盘里（同一页要一起测）');

// ── 3. 跨年重排：证明「八字半边与时钟无关」是测出来的，不是写注释写出来的。
// payload 形状与 /create 写进去的那一份逐键一致（geo / dstOffset / ambiguousDst / warning）：
// 页面只吃 chart 与 chartName，但 harness 审的必须是真实会话能产出的那个对象，
// 不能是「为了测而发明」的第五种盘结构。
const payloadOf = (x: any) => JSON.stringify({
  chart: x, chartName: CHART_NAME,
  trueSolarWiring: { geo: null, dstOffset: zone.dstOffsetHours, ambiguousDst: false, warning: undefined },
});
const today = new realDate();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusYears = (n: number) => { const d = new realDate(today.getTime()); d.setFullYear(d.getFullYear() + n); return iso(d); };
const shift = (nextYearIso: string) => {
  shiftClock(nextYearIso);
  const x: any = createChart(birthInfo);
  restoreClock();
  return x;
};
// 大限每段跨 10 年，挪 1 年常常还在同一段里（实测 2026→2027 漂移 0 条，探测会空过）。
// 所以牙齿用 +11：无论如何都跨过了至少一段大限，"漂移全部落在紫微内"这句话才是被测出来的。
const movedIso = plusYears(11);
const drifted = diffPaths(chart, shift(movedIso), 'chart');
const annualIso = plusYears(1);
const annual = diffPaths(chart, shift(annualIso), 'chart');
ok('drift/probe-crossed-a-dayun', new realDate(movedIso + 'T12:00:00Z').getFullYear() === today.getFullYear() + 11,
  `探针日期 ${movedIso}（挪 11 年，必跨一段大限）`);
ok('drift/bazi-half-identical', JSON.stringify(chart.bazi) === JSON.stringify(shift(movedIso).bazi),
  `同一入参在两个时钟下 chart.bazi 逐字节相同（场景矩阵吃这半边）：漂移路径 ${drifted.filter(p => p.startsWith('chart.bazi')).length} 条`);
ok('drift/nothing-outside-ziwei-moved', drifted.every(p => p.startsWith('chart.ziwei')),
  `共 ${drifted.length} 条路径随时间变化${drifted.length ? '：' + drifted.slice(0, 3).map(p => p.replace(/^chart\./, '')).join(' / ') + (drifted.length > 3 ? ` …（另 ${drifted.length - 3} 条）` : '') : ''}`);
// 前提断言：探测本身必须真观察到东西在动，否则上面两条绿灯只是「什么都没变」空过。
ok('drift/probe-had-teeth', drifted.length > 0,
  `挪到 ${movedIso} 确实改到了紫微里的字段（0 条说明这盘不带当前大限/流年，探测形同虚设）`);
console.log('  NOTE  跨年一格（' + annualIso + '）漂移 ' + annual.length + ' 条' +
  (annual.length === 0 ? ' —— 所以 --check 只会在跨大限那一年才报 STALE，不是每年' : ''));

const paylo = payloadOf(chart);

if (fails.length) {
  console.log('\n引擎输出与外部用例不符 —— 不写盘。先修引擎或改用例，别把错值存进 fixture。');
  process.exit(1);
}

if (CHECK) {
  let committed: any = null;
  try { committed = JSON.parse(readFileSync(OUT, 'utf8')); } catch { }
  if (!committed) {
    console.log('FAIL  fixture 不存在或不是 JSON：' + OUT + '\n先不带 --check 跑一次本文件。');
    process.exit(1);
  }
  const baziSame = JSON.stringify(committed?.chart?.bazi) === JSON.stringify(bazi);
  const wholeSame = JSON.stringify(committed) === paylo;
  // 第二份（降级态）也必须跟主份一起新鲜：只核主份的话，harness 的降级态测的是过期盘。
  let committed2: any = null;
  try { committed2 = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'chart-result-no-sizhu.json'), 'utf8')); } catch { }
  const probe2 = JSON.parse(paylo); delete probe2.chart.bazi.siZhu;
  const variantSame = JSON.stringify(committed2) === JSON.stringify(probe2);
  let committed3: any = null;
  try { committed3 = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'chart-result-barren.json'), 'utf8')); } catch { }
  const probe3 = JSON.parse(paylo);
  delete probe3.chart.bazi.siZhu; delete probe3.chart.bazi.dayun; delete probe3.chart.bazi.dayMaster;
  const barrenSame = JSON.stringify(committed3) === JSON.stringify(probe3);
  console.log((wholeSame ? '  PASS  ' : '  FAIL  ') + 'check/byte-identical'.padEnd(28) +
    (wholeSame ? 'committed 与现排逐字节一致' : '有差异，判据见下'));
  console.log((baziSame ? '  PASS  ' : '  FAIL  ') + 'check/bazi-half-matches'.padEnd(28) +
    `八字半边与 committed 一致：${baziSame ? '是' : '否 —— 引擎变了，必须查'}`);
  console.log((variantSame ? '  PASS  ' : '  FAIL  ') + 'check/degrade-variant-fresh'.padEnd(28) +
    `无四柱那份与主份同步（只差 chart.bazi.siZhu 一条路径）：${variantSame ? '是' : '否/文件不存在'}`);
  console.log((barrenSame ? '  PASS  ' : '  FAIL  ') + 'check/barren-variant-fresh'.padEnd(28) +
    `贫盘（无四柱+无大运+无日主）与主份同步：${barrenSame ? '是' : '否/文件不存在'}`);
  if (!baziSame || !variantSame || !barrenSame) { console.log('\nDRIFT  八字半边或某份降级份变了 —— 这是真变化。'); process.exit(1); }
  if (!wholeSame) {
    const keys = diffPaths(chart, committed.chart, 'chart').filter(p => !p.startsWith('chart.bazi'));
    console.log('STALE  只有紫微那半边的当前大限/流年随自然年更新（预期内）：' +
      (keys.slice(0, 6).map(p => p.replace(/^chart\./, '')).join(' / ') || '（未定位到具体键）'));
    console.log('       重跑本文件（不带 --check）刷新 fixture。八字半边没变，场景矩阵的判据不受影响。');
    process.exit(1);
  }
  console.log('\nfixture 新鲜，无需重写。');
  process.exit(0);
}

mkdirSync(join(__dirname, 'fixtures'), { recursive: true });
writeFileSync(OUT, paylo, 'utf8');

// 第二份：同一张盘，只把 chart.bazi.siZhu 摘掉 —— 测「无盘降级」那一支（裁定 6）。
// 必须是"同一张盘缺一层"而不是另编一张空壳：降级分支要防的正是"盘在、四柱不全"。
const noPlate = JSON.parse(paylo);
delete noPlate.chart.bazi.siZhu;
const noPlateOut = join(__dirname, 'fixtures', 'chart-result-no-sizhu.json');
const noPlateStr = JSON.stringify(noPlate);
const variantDiff = diffPaths(JSON.parse(paylo).chart, noPlate.chart, 'chart');
ok('variant/only-siZhu-removed',
  variantDiff.join(',') === 'chart.bazi.siZhu',
  `两份盘只该差 chart.bazi.siZhu 这一条路径：实得 ${variantDiff.join(' / ') || '（无差异）'}`);
ok('variant/no-dayun-either', !!(noPlate.chart.bazi?.dayun), '只摘四柱，大运留着（守卫必须按 siZhu 判，不能顺手把 dayun 也当证据）');

// 第三份：把四柱、大运、日主一起摘掉 —— 人生K线（#41）的降级分支只有在这种盘上才走到。
// 它只缺 no-sizhu 那份再多的两层，仍然是"同一张盘缺几层"，不是另编一张空壳。
const barren = JSON.parse(paylo);
delete barren.chart.bazi.siZhu; delete barren.chart.bazi.dayun; delete barren.chart.bazi.dayMaster;
const barrenOut = join(__dirname, 'fixtures', 'chart-result-barren.json');
const barrenStr = JSON.stringify(barren);
const barrenDiff = diffPaths(JSON.parse(paylo).chart, barren.chart, 'chart').sort();
ok('variant/barren-diff-exact', barrenDiff.join(',') === ['chart.bazi.dayMaster', 'chart.bazi.dayun', 'chart.bazi.siZhu'].sort().join(','),
  `贫盘只该差这三条路径：实得 ${barrenDiff.join(' / ') || '（无差异）'}`);
ok('variant/barren-keeps-ziwei', !!barren.chart.ziwei, '贫盘仍带紫微半边 —— 它测的是"八字岁运缺席"，不是整页空白');

if (fails.length) { console.log('\nvariant 断言未过 —— 不写第二、三份。'); process.exit(1); }
writeFileSync(noPlateOut, noPlateStr, 'utf8');
console.log('写入 ' + noPlateOut + '（' + noPlateStr.length + ' 字节）');
writeFileSync(barrenOut, barrenStr, 'utf8');
console.log('写入 ' + barrenOut + '（' + barrenStr.length + ' 字节）');

// coverage 报告：census.mjs 的 CHART_PINS 从这里抄死，抄的是用例期望值而不是引擎返回值。
const P = ['year', 'month', 'day', 'hour'] as const;
const lines = [
  `# make-chart-fixture.ts 生成，勿手改。判据来源：用例 ${CASE_ID}（tools/bazi-acceptance/cases/bazi-validation-v1.json）。`,
  `四柱: ${siZhu.join(' ')}`,
  `日主: ${bazi.dayMaster}`,
  `大运首段: ${firstCycle}（起 ${bazi.dayun?.[0]?.startYear} 岁 ${bazi.dayun?.[0]?.startAge}）`,
  `大运段数: ${bazi.dayun?.length}（人生K线的运段 chip 数就是这个数）`,
  `首段流年: ${(bazi.dayun?.[0]?.liuNian || []).map((x: any) => `${x.year}${x.ganZhi.gan}${x.ganZhi.zhi}`).join(' ')}`,
  `首段区间: ${bazi.dayun?.[0]?.startYear}–${bazi.dayun?.[0]?.endYear}`,
  `真太阳时: ${tst}`,
  `夏令时偏移: ${zone.dstOffsetHours}`,
  `十神: ${P.map(k => `${k}干${bazi.shiShen[k]}`).join(' ')}`,
  `藏干: ${P.map(k => `${k}支[${((bazi.cangGan as any)?.[k] || []).map((x: any) => `${x.gan}${x.shiShen}`).join('')}]`).join(' ')}`,
  `纳音: ${P.map(k => k + (bazi.naYin?.[k] ?? '?')).join(' ')}`,
  `随时间漂移的路径: ${drifted.length} 条（+11 年探针），全部在 chart.ziwei 内；chart.bazi 逐字节稳定`,
  `payload 字节: ${paylo.length}`,
];
writeFileSync(TOKENS, lines.join('\n') + '\n', 'utf8');
console.log('\n写入 ' + OUT);
console.log(lines.join('\n'));
