// 真太阳时上线前对拍：同一个出生输入，三条链路各算一次四柱。
//   A) 前端表单实际链路：buildTrueSolarWiring -> frontend createChart（带经度/夏令时）
//   B) 仓库后端实际链路：generateChart -> chart.service.ts parseBirthInfo -> server createChart
//      （走 service 导出的那个函数，不自己拼 BirthInfo —— 接线就在 parseBirthInfo 里，
//       手拼等于绕过被测对象。0b94f5d 之前它 timeZone 写死 8、无经度，那是当时的真实后端。）
//   C) 把 A 算出的真太阳时时刻喂给后端引擎（「后端只要接上同一份时刻就能对上吗」）
// A==C 是引擎层一致性；A==B 是接线一致性。05/08 后端补丁已随 ops/backend-tst-lunar-liuyao
// 并入 git（0b94f5d），所以 A==B 从「只报不判」改成默认硬判 —— 加 --no-require-backend 才降级。
// B 红而 C 绿 = 后端引擎没问题、是接线/传输层不一致，这两列就是为了分这两种情况而存在。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/tst-acceptance/check.ts
// 控制台只打 ASCII 摘要（Windows 会把 UTF-8 截成乱码），四柱等中文明细看 --out=<file>。
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChart as feCreateChart, BirthInfo } from '../../frontend/app/lib/core/yiqi-core';
import { calculateTrueSolarTime } from '../../frontend/app/lib/core/yiqi-core/true-solar-time';
import { buildTrueSolarWiring } from '../../frontend/app/lib/true-solar/birth-wiring';
import { toCivilInput } from '../../frontend/app/lib/core/yiqi-core/lunar-input';
import { createChart as beCreateChart } from '../../server/src/core/yiqi-core';
import { generateChart as beGenerateChart } from '../../server/src/services/chart.service';

const ROOT = join(__dirname, '../..');
const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const REQUIRE_BACKEND = !process.argv.includes('--no-require-backend');

const CASES: { label: string; y: number; mo: number; d: number; h: number; mi: number; province: string; city: string; control?: boolean }[] = [
  // 运维给的验收案例：乌鲁木齐，1988 年（中国夏令时 1986–1991 内）
  { label: '1988-07-15 15:20 / Urumqi', y: 1988, mo: 7, d: 15, h: 15, mi: 20, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 同一时刻换到北京：经度只差 13 分，但夏令时仍要减 1 小时 -> 也跨时辰
  { label: '1988-07-15 15:20 / Beijing', y: 1988, mo: 7, d: 15, h: 15, mi: 20, province: '北京市', city: '北京市' },
  // 真太阳时跨日：钟表已是次日凌晨，校正后回到前一天 -> 日柱也跟着变
  { label: '2000-01-01 00:25 / Urumqi', y: 2000, mo: 1, d: 1, h: 0, mi: 25, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 夏令时之外（1992 起中国不再调夏令时）：经度时差照样能把时辰挪一格
  { label: '1993-03-08 09:40 / Urumqi', y: 1993, mo: 3, d: 8, h: 9, mi: 40, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 正对照：近标准经线 + 无夏令时 + 不压时辰边界，A 必须与 B 逐字相同
  // （没有这条，A==B 全红也可能是我的对拍脚本自己写错了）
  { label: '1995-06-10 10:00 / Beijing', y: 1995, mo: 6, d: 10, h: 10, mi: 0, province: '北京市', city: '北京市', control: true },
];

const sig = (c: any) => ['year', 'month', 'day', 'hour'].map(k => `${c.bazi.siZhu[k].gan}${c.bazi.siZhu[k].zhi}`).join(' ');
const lines: string[] = [];
const say = (s: string) => { lines.push(s); console.log(s); };

let engineBad = 0, backendBad = 0, controlBad = 0;
for (const cs of CASES) {
  const civil = toCivilInput({ year: cs.y, month: cs.mo, day: cs.d, hour: cs.h, minute: cs.mi, isLunar: false, isLeapMonth: false });
  const wiring = buildTrueSolarWiring(
    { province: cs.province, city: cs.city, district: '' },
    { year: civil.year, month: civil.month, day: civil.day, hour: civil.hour, minute: civil.minute },
  );
  const fe = feCreateChart({
    year: cs.y, month: cs.mo, day: cs.d, hour: cs.h, minute: cs.mi,
    isLunar: false, gender: 'male',
    timeZone: wiring.timeZone, longitude: wiring.longitude, dstOffset: wiring.dstOffset, enableTrueSolarTime: true,
  } as BirthInfo);
  const tst = (fe.bazi as any).trueSolarTime;

  // 后端 transport 层的真实入参：走 service 导出的 generateChart，让 parseBirthInfo 自己
  // 做「农历换算 + 按 birthPlace 解析经度 + 补历史夏令时」。birthPlace 的「省 市 区」空格
  // 分隔就是 API 契约里的形状，不是对拍脚本的发明。
  const pad = (n: number) => String(n).padStart(2, '0');
  const be = beGenerateChart({
    visitor_id: 'tst-check', name: '对拍', gender: '男' as const, calendar: '公历' as const,
    birthday: `${cs.y}-${pad(cs.mo)}-${pad(cs.d)} ${pad(cs.h)}:${pad(cs.mi)}`,
    isLeapMonth: false, birthPlace: `${cs.province} ${cs.city}`, currentPlace: '',
    persona: 'standard' as const, depth: 'brief' as const,
  });

  const t = tst?.trueSolarDateTime;
  const beGivenClock = t ? beCreateChart({ year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, isLunar: false, gender: 'male', timeZone: 8 } as any) : null;

  const a = sig(fe), b = sig(be), c = beGivenClock ? sig(beGivenClock) : a;
  if (a !== c) engineBad++;
  if (a !== b) backendBad++;
  // 正对照必须 A==B：它不成立说明对拍脚本本身错了，而不是后端缺 TST
  if (cs.control && a !== b) controlBad++;

  say('==== ' + cs.label);
  say(`  geo      : lng=${wiring.longitude ?? '-'} tzStd=${wiring.timeZone} dst=${wiring.dstOffset} ambiguous=${wiring.ambiguousDst}`);
  say(`  trueSolar: ${tst?.civilTime ?? '-'} -> ${tst?.trueSolarTime ?? '-'} (${tst?.totalCorrectionMinutes ?? 0} min) crossed=${JSON.stringify(tst?.crossed ?? null)}`);
  say(`  A frontend        : ${a}`);
  say(`  B repo backend    : ${b}`);
  say(`  C backend@TSTtime : ${c}   (fed ${t ? `${t.year}-${t.month}-${t.day} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : '-'})`);
  say(`  A==C(engine parity) ${a === c ? 'YES' : 'NO'}   A==B(backend wiring) ${a === b ? 'YES' : 'NO'}`);
}

// 这两格共用同一批小工具：从真实盘的产出里取时支/日柱，不自己重算任何一条口径。
const ziIdx = (h: number) => Math.floor((h + 1) / 2) % 12;
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const tstOf = (o: any) => o.bazi.trueSolarTime;
const hourZhiOf = (o: any) => o.bazi.siZhu.hour.zhi;
const plateAt = (y: number, mo: number, d: number, h: number, mi: number,
  lon: number | null, dst: number, mode?: 'ZI_HOUR_23' | 'MIDNIGHT_00') =>
  feCreateChart({
    year: y, month: mo, day: d, hour: h, minute: mi, isLunar: false, gender: 'male',
    timeZone: 8, longitude: lon, dstOffset: dst, enableTrueSolarTime: lon !== null,
    dayBoundaryMode: mode,
  } as BirthInfo);

// 裁定①（2026-10-21）：crossed.day 也换成"取日柱那一天"的比法，参照同样是 civil。
// 准绳必须是真的去比日柱，而不是比日历日串 —— 23 点要把日子往后滚一天，
// 于是"日期变了但日柱没变"与"日期没变但日柱变了"两类样本一定都存在
// （这一批扫下来：误报 18 组、漏报 18 组，机制都是夜子时那一滚，不是夏令时）。
// 两种 dayBoundaryMode 都扫：只扫默认那一种的话，"mode 传下去了"这件事本身没被证明。
const dayKey = (o: any) => Date.UTC(o.year, o.month - 1, o.day) / 86400000;
let dayBad = 0, daySwept = 0, dayTrue = 0, dayOver = 0, dayUnder = 0;
const dayExamples: string[] = [];
for (const mode of ['ZI_HOUR_23', 'MIDNIGHT_00'] as const) {
  for (const lon of [116.4074, 87.62, 121.4737]) {
    for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 10) {
      const on = plateAt(1990, 6, 15, h, m, lon, mode === 'ZI_HOUR_23' ? 1 : 0, mode);
      const off = plateAt(1990, 6, 15, h, m, null, mode === 'ZI_HOUR_23' ? 1 : 0, mode);
      const t = on.bazi.siZhu.day.gan + on.bazi.siZhu.day.zhi !== off.bazi.siZhu.day.gan + off.bazi.siZhu.day.zhi;
      daySwept++;
      if (t) dayTrue++;
      if (on.bazi.trueSolarTime.crossed.day !== t) {
        dayBad++;
        if (dayExamples.length < 4) dayExamples.push(`${mode} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} flag=${on.bazi.trueSolarTime.crossed.day} 日柱${t ? '变' : '没变'}`);
      }
      // 顺手把"只比日历日"的错法按方向分开量：它是这次改动的全部理由，
      // 而两个方向都必须抓到 —— 只挡住一边（比如只处理"滚进来"不管"滚出去"）
      // 也照样能让"总数 > 0"那种粗断言绿着。
      const naive = dayKey(on.bazi.trueSolarTime.trueSolarDateTime) !== dayKey(on.bazi.trueSolarTime.civilDateTime);
      if (naive && !t) dayOver++;
      if (!naive && t) dayUnder++;
    }
  }
}
say(`  ${dayBad ? 'FAIL' : 'PASS'} crossed-day/sweep-flag-equals-pillar-change  `
  + `${daySwept} 组（ZI_HOUR_23 与 MIDNIGHT_00 各半）里 flag 与"日柱真的变了"全部一致（真跨 ${dayTrue} 组），`
  + `不一致 ${dayBad} 组${dayExamples.length ? ' 例:' + dayExamples.join(' | ') : ''}`);
say(`  ${dayOver > 0 && dayUnder > 0 ? 'PASS' : 'FAIL'} crossed-day/naive-date-compare-wrong-both-ways  `
  + `只比日历日：误报 ${dayOver} 组（如 00:20 校正到前一日 23:45，23 点把日柱滚回来，日子跨了日柱没跨）、`
  + `漏报 ${dayUnder} 组（如 23:00 滚成次日、校正到同日 22:45 不滚，日期没跨日柱却差一天）—— `
  + `两个方向都要 >0，否则这次扫描根本没考验到新准绳`);

// ── crossed.hour 的语义（2026-10-21 裁定 ③）──
// 这一格以前比的是**整点小时数**，可时辰是两小时一格，于是同格内的移动被报成"已跨时辰"；
// 而夏令时那一步造成的跨格反而被漏掉。改按时辰比、参照换成 civilDateTime（卡片上印的那串钟表时间）。

// 裁定给的两条算例，逐字钉住。
const ruled = [
  { label: '02:00 -> 01:45 同属丑时（旧定义会误报）', h: 2, mi: 0, want: false },
  { label: '夏令时 01:15 -> 00:00 丑变子（旧定义会漏报）', h: 1, mi: 15, dst: 1, want: true },
];
let ruledBad = 0;
for (const r of ruled) {
  const t = calculateTrueSolarTime({
    year: 1990, month: 6, day: 15, hour: r.h, minute: r.mi, second: 0,
    longitude: 116.4074, timezone: 8, dstOffset: r.dst ?? 0, enable: true,
  });
  const pOn = plateAt(1990, 6, 15, r.h, r.mi, 116.4074, r.dst ?? 0);
  const pOff = plateAt(1990, 6, 15, r.h, r.mi, null, r.dst ?? 0);
  const truth = hourZhiOf(pOn) !== hourZhiOf(pOff);
  const okFlag = t.crossed.hour === r.want && truth === r.want;
  if (!okFlag) ruledBad++;
  say(`  ${okFlag ? 'PASS' : 'FAIL'} crossed/${r.label}`
    + `  flag=${t.crossed.hour} want=${r.want} 时支 ${hourZhiOf(pOff)}->${hourZhiOf(pOn)} (真变了=${truth})`
    + `  ${t.civilTime}->${t.trueSolarTime}`);
}

// 铺一遍网格，判据是"标志 == 时支真的不一样"，不是比字符串。
// 这条能同时挡住两个方向的回归：又按整点比（误报）与参照选错（漏报）。
let sweepBad = 0, swept = 0, tp = 0, fp = 0;
for (const [lon, name] of [[116.4074, '北京'], [87.62, '乌鲁木齐'], [121.4737, '上海']] as [number, string][]) {
  for (const dst of [0, 1]) for (let h = 0; h < 24; h += 2) for (const mi of [0, 30]) {
    const t = tstOf(plateAt(1990, 6, 15, h, mi, lon, dst));
    const truth = hourZhiOf(plateAt(1990, 6, 15, h, mi, lon, dst)) !== hourZhiOf(plateAt(1990, 6, 15, h, mi, null, dst));
    swept++;
    if (t.crossed.hour !== truth) {
      sweepBad++;
      if (sweepBad <= 3) say(`  FAIL crossed/sweep ${name} dst${dst} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} `
        + `flag=${t.crossed.hour} 时支实际变化=${truth} ${t.civilTime}->${t.trueSolarTime}`);
    } else if (truth) tp++; else if (t.crossed.hour) fp++;
  }
}
say(`  ${sweepBad ? 'FAIL' : 'PASS'} crossed/sweep-flag-equals-pillar-change  `
  + `${swept} 组里 flag 与"时支真的变了"全部一致（真跨 ${tp} 组），不一致 ${sweepBad} 组`);
// 同格内的移动不许再报：这是这次改动的靶心，单独钉一条，别让它埋在上面的计数里。
const sameBucket = calculateTrueSolarTime({
  year: 1990, month: 6, day: 15, hour: 2, minute: 0, second: 0,
  longitude: 116.4074, timezone: 8, dstOffset: 0, enable: true,
});
const sbMove = sameBucket.trueSolarDateTime.hour !== 2;
say(`  ${sbMove && !sameBucket.crossed.hour ? 'PASS' : 'FAIL'} crossed/same-bucket-move-stays-silent  `
  + `整点从 2 挪到 ${String(sameBucket.trueSolarDateTime.hour).padStart(2, '0')}（旧定义在这里报 true），`
  + `但 ${ZHI[ziIdx(2)]}时 内不动 -> flag=${sameBucket.crossed.hour}`);

// server/ 那份同源拷贝由运维改（server/untouched 那条闸门写着这个分工）。
// 不钉成红 —— 红了会把整套卡住；这条要的是"随时看得见同步到哪一步"：
// 运维照搬之后每一行自己变 SYNCED，谁也不用回来改断言。
// 一次改动的落点会跨文件（① 同时动 true-solar-time.ts 与 bazi.ts 的换日调用），
// 所以这里是一张表，不是一个档案名 —— 少一个档案就等于漏报。
const SYNC_CHECKS: { file: string; want: [RegExp, string][]; forbid?: [RegExp, string][]; note: string }[] = [
  {
    file: 'true-solar-time.ts',
    want: [
      [/function ziChenIndex\(hour: number\)/, 'ziChenIndex 那个按时辰比的 helper'],
      [/ziChenIndex\(civil\.hour\)/, 'crossed.hour 以 civil 为参照'],
      [/function dayPillarKey\(/, 'dayPillarKey（把 23 点换日折进来的日柱取日）'],
      [/dayPillarKey\(civil, dayBoundaryMode\)/, 'crossed.day 比的是取日柱那一天、以 civil 为参照'],
      [/export function rollsToNextDay\(/, 'rollsToNextDay 这一份换日规则的唯一实现'],
    ],
    note: '裁定③（hour）+ 裁定①（day）都落在这一份',
  },
  {
    file: 'bazi.ts',
    want: [
      [/if \(rollsToNextDay\(hour, mode\)\)/, '换日判断改吃共享规则'],
      [/dayBoundaryMode: birthInfo\.dayBoundaryMode/, '把口径传给 calculateTrueSolarTime'],
    ],
    forbid: [[/console\.error\('\[晚子时处理\]/, '晚子时那条正常路径打印']],
    note: '裁定①（共享换日规则）+ 裁定②（删晚子时 console.error）',
  },
];
for (const sc of SYNC_CHECKS) {
  let src = '';
  try { src = readFileSync(join(ROOT, 'server', 'src', 'core', 'yiqi-core', sc.file), 'utf8'); } catch { /* 后端没有这个档案就是没有，下面按未同步报 */ }
  const missing = sc.want.filter(([re, what]) => !re.test(src)).map(([, what]) => what);
  const stillThere = (sc.forbid || []).filter(([re]) => re.test(src)).map(([, what]) => what);
  const parts = [...missing.map(m => '缺 ' + m), ...stillThere.map(s => '仍有 ' + s)];
  say(`  ${parts.length ? 'PENDING' : 'SYNCED'} server-copy/${sc.file}  `
    + (parts.length ? parts.join('、') + ` —— 逐字照搬前端那几行。${sc.note}` : `两盘同一套口径。${sc.note}`));
}

say('');
say(`ENGINE PARITY A==C : ${CASES.length - engineBad}/${CASES.length} ${engineBad ? 'FAIL' : 'PASS'}`);
say(`CONTROL A==B       : ${controlBad ? 'FAIL (the comparison itself is wrong)' : 'PASS'}`);
say(`BACKEND WIRING A==B: ${CASES.length - backendBad}/${CASES.length} measured` +
  (REQUIRE_BACKEND ? (backendBad ? ' FAIL' : ' PASS') : ' (informational; --no-require-backend to relax)'));
say(`CROSSED HOUR SEMANTICS: ruled ${ruled.length - ruledBad}/${ruled.length}, `
  + `sweep flag==时支真变化 ${swept - sweepBad}/${swept} ${ruledBad || sweepBad ? 'FAIL' : 'PASS'}`);
say(`CROSSED DAY SEMANTICS: sweep flag==日柱真变化 ${daySwept - dayBad}/${daySwept}（真跨 ${dayTrue}），`
  + `只比日历日 误报 ${dayOver} / 漏报 ${dayUnder} ${dayBad || !dayOver || !dayUnder ? 'FAIL' : 'PASS'}`);

if (arg('out')) writeFileSync(arg('out')!, lines.join('\n') + '\n', 'utf8');
process.exit(engineBad || controlBad || ruledBad || sweepBad || dayBad || !dayOver || !dayUnder
  || (REQUIRE_BACKEND && backendBad) ? 1 : 0);
