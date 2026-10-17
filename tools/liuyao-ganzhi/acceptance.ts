// 六爻时间干支验收：把 frontend/lib/liuyao/core 的干支层逐日对齐全站八字引擎（lunar-typescript）。
//
// 用法（tsx 在 fate-reverse/bazi-engine/node_modules/.bin 下；methods/*.ts 用的是站里 @/* 别名，
// 外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到）：
//   cd <repo root> && NODE_PATH="<…>/fate-reverse/reproduce/node_modules" \
//     "<…>/fate-reverse/bazi-engine/node_modules/.bin/tsx" --tsconfig=frontend/tsconfig.json \
//     tools/liuyao-ganzhi/acceptance.ts --out=.liuyao-ganzhi.txt
// 完整报告写 --out=<file>（控制台只打 ASCII 摘要，Windows 控制台会把 UTF-8 截断成乱码）。
import { writeFileSync } from 'node:fs';
import { Solar } from 'lunar-typescript';
import {
  getDayGanZhi, getYearGanZhi, getMonthGanZhi, getHourGanZhi, getXunKong, getLiuShen,
} from '../../frontend/lib/liuyao/core/calcGanZhi';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { buildTimeResult } from '../../frontend/lib/liuyao/methods/time';
import { buildNumberResult } from '../../frontend/lib/liuyao/methods/number';
import { dateToGanZhi } from '../../frontend/app/lib/core/liuyao/constants';
import { resolveQiguaMoment } from '../../frontend/lib/liuyao/solar-basis';
import { lookupGeo } from '../../frontend/app/lib/true-solar/birth-wiring';

const out = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = out('out') || '.liuyao-ganzhi.txt';

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

const LIUSHEN_START: Record<string, string> = {
  甲: '青龙', 乙: '青龙', 丙: '朱雀', 丁: '朱雀', 戊: '勾陈',
  己: '螣蛇', 庚: '白虎', 辛: '白虎', 壬: '玄武', 癸: '玄武',
};

// 六旬旬空的标准表（通书口径，按旬首地支查），独立于被测实现，也独立于 lunar-typescript：
// 甲子旬空戌亥 / 甲戌旬空申酉 / 甲申旬空午未 / 甲午旬空辰巳 / 甲辰旬空寅卯 / 甲寅旬空子丑。
// 加这条断言的直接原因：app/lib/core/liuyao/constants.ts 那份 getXunKong 把旬索引写成
// `xunStart/2` 而不是 `5 - xunStart/2`，六旬整体反转却在 60/60 的错法下无人发现（已于 2026-10-17 删除）。
const XUNKONG_BY_XUN_HEAD: Record<string, string> = {
  子: '戌亥', 戌: '申酉', 申: '午未', 午: '辰巳', 辰: '寅卯', 寅: '子丑',
};
const GAN_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 旧实现的日柱锚点（2000-01-01 记成 GAN[0]，真值应为 戊午），用来量化「修前错多少」。
function oldDayGanZhi(date: Date): string {
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ref = new Date(2000, 0, 1);
  const days = Math.floor((date.getTime() - ref.getTime()) / 86400000);
  return GAN[((0 + days) % 10 + 10) % 10] + ZHI[((6 + days) % 12 + 12) % 12];
}
function oldMonthGanZhi(y: number, m: number): string {
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const YUE_GAN_START: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 0, 5: 2, 6: 4, 7: 6, 8: 8, 9: 0 };
  const mz = m % 12;
  const sg = YUE_GAN_START[(y - 4) % 10] ?? 2;
  return GAN[(sg + (mz - 2 + 12) % 12) % 10] + ZHI[mz];
}
function oldYearGanZhi(y: number): string {
  const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return GAN[(y - 4) % 10] + ZHI[(y - 4) % 12];
}

// ── 1. 全库逐日扫描 1901-01-01 … 2099-12-31 ──
let days = 0;
let badDay = 0, badYear = 0, badMonth = 0, badXun = 0, badLiu = 0;
let oldBadDay = 0, oldBadMonth = 0, oldBadYear = 0;
let firstBad: string[] = [];

for (let y = 1901; y <= 2099; y++) {
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(y, m, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(y, m - 1, d, 12, 0, 0); // 正午，避开夜子时边界
      const lunar = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar();
      days++;

      const gz = getDayGanZhi(dt);
      const mine = gz.gan + gz.zhi;
      if (mine !== lunar.getDayInGanZhiExact()) {
        badDay++;
        if (firstBad.length < 5) firstBad.push(`${y}-${m}-${d} day ${mine} != ${lunar.getDayInGanZhiExact()}`);
      }
      if (getYearGanZhi(dt) !== lunar.getYearInGanZhiExact()) badYear++;
      if (getMonthGanZhi(dt) !== lunar.getMonthInGanZhiExact()) badMonth++;
      if (getXunKong(gz.ganIdx, gz.zhiIdx) !== lunar.getDayXunKongExact()) badXun++;
      if (getLiuShen(gz.ganIdx)[0] !== LIUSHEN_START[gz.gan]) badLiu++;

      if (oldDayGanZhi(dt) !== lunar.getDayInGanZhiExact()) oldBadDay++;
      if (oldMonthGanZhi(y, m) !== lunar.getMonthInGanZhiExact()) oldBadMonth++;
      if (oldYearGanZhi(y) !== lunar.getYearInGanZhiExact()) oldBadYear++;
    }
  }
}

ok('sweep/coverage', days === 72684, `覆盖 ${days} 天（1901-01-01…2099-12-31 应为 72684）`);
ok('day/matches-engine', badDay === 0, `日柱不符 ${badDay} 天${firstBad.length ? ' 例:' + firstBad.join(' | ') : ''}`);
ok('year/matches-engine', badYear === 0, `年柱不符 ${badYear} 天`);
ok('month/matches-engine', badMonth === 0, `月柱不符 ${badMonth} 天`);
ok('xunkong/matches-engine', badXun === 0, `旬空不符 ${badXun} 天`);
ok('liushen/table', badLiu === 0, `六神起点不符 ${badLiu} 天`);
say(`BEFORE 旧实现同口径错误率：日柱 ${oldBadDay}/${days}、月柱 ${oldBadMonth}/${days}、年柱 ${oldBadYear}/${days}`);

// ── 2. 夜子时：23:00 起日柱归次日、时柱用次日日干 ──
const z23 = getDayGanZhi(new Date(2026, 9, 16, 23, 30, 0));
const z22 = getDayGanZhi(new Date(2026, 9, 16, 22, 30, 0));
ok('zi-hour/rolls-at-23', z23.gan + z23.zhi === '甲子' && z22.gan + z22.zhi === '癸亥',
  `22:30=${z22.gan + z22.zhi}（应癸亥）23:30=${z23.gan + z23.zhi}（应甲子）`);
ok('zi-hour/xun-follows-day', getXunKong(z23.ganIdx, z23.zhiIdx) === '戌亥' && getXunKong(z22.ganIdx, z22.zhiIdx) === '子丑',
  `旬空 23:30=${getXunKong(z23.ganIdx, z23.zhiIdx)}（应戌亥）22:30=${getXunKong(z22.ganIdx, z22.zhiIdx)}（应子丑）`);

// ── 3. 时柱：五鼠遁逐时对齐引擎 getTimeInGanZhi ──
let badHour = 0, hourCases = 0;
const hourBad: string[] = [];
for (const [yy, mm, dd] of [[2026, 10, 16], [2026, 2, 4], [2025, 7, 23], [2024, 12, 31], [2023, 1, 1], [2000, 2, 29], [1986, 5, 12], [1949, 10, 1]] as const) {
  for (let h = 0; h < 24; h++) {
    const lunar = Solar.fromYmdHms(yy, mm, dd, h, 30, 0).getLunar();
    const gz = getDayGanZhi(new Date(yy, mm - 1, dd, h, 30, 0));
    const mine = getHourGanZhi(gz.ganIdx, h);
    hourCases++;
    if (mine !== lunar.getTimeInGanZhi()) {
      badHour++;
      if (hourBad.length < 6) hourBad.push(`${yy}-${mm}-${dd} ${h}:30 ${mine} != ${lunar.getTimeInGanZhi()}`);
    }
  }
}
ok('hour/matches-engine', badHour === 0, `时柱不符 ${badHour}/${hourCases} 例${hourBad.length ? ' 例:' + hourBad.join(' | ') : ''}`);

// ── 4. 立春 / 节 边界抽样 ──
const liChunCases: Array<[number, number, number, number, string, string]> = [
  [2026, 2, 3, 12, '乙巳', '丙午'],   // 立春前仍属乙巳年
  [2026, 2, 5, 12, '丙午', '丙午'],   // 立春后入丙午年
  [2026, 3, 4, 12, '庚寅', '辛卯'],   // 惊蛰前月建庚寅，后换辛卯
  [2026, 3, 6, 12, '辛卯', '辛卯'],
];
for (const [yy, mm, dd, hh, wantYearOld, wantYearNew] of liChunCases) {
  const dt = new Date(yy, mm - 1, dd, hh, 0, 0);
  const lunar = Solar.fromYmdHms(yy, mm, dd, hh, 0, 0).getLunar();
  ok(`boundary/${yy}-${mm}-${dd}`,
    getYearGanZhi(dt) === lunar.getYearInGanZhiExact() && getMonthGanZhi(dt) === lunar.getMonthInGanZhiExact(),
    `年=${getYearGanZhi(dt)}(引擎${lunar.getYearInGanZhiExact()} 旧口径范围 ${wantYearOld}/${wantYearNew}) 月=${getMonthGanZhi(dt)}(引擎${lunar.getMonthInGanZhiExact()})`);
}

// ── 5. 三种起卦法产出的 ganZhi 与引擎一致 ──
const now = new Date(2026, 9, 16, 22, 30, 0);
const records = [7, 8, 7, 9, 6, 7].map((v, i) => ({
  position: i + 1, coins: (v === 7 ? ['字', '字', '花'] : v === 8 ? ['字', '花', '花'] : v === 9 ? ['花', '花', '花'] : ['字', '字', '字']) as any,
  value: v, label: v === 7 ? '少阳' : v === 8 ? '少阴' : v === 9 ? '老阳' : '老阴', isDong: v === 6 || v === 9,
}));
const truth = Solar.fromYmdHms(2026, 10, 16, 22, 30, 0).getLunar();
const plate = `丙午年 戊戌月 癸亥日 癸亥时 · 子丑旬空`;
for (const [label, r] of [
  ['coin', buildCoinResult({ question: '验收', questionType: '其他', records, now })],
  ['time', buildTimeResult({ question: '验收', questionType: '其他', date: now })],
  ['number', buildNumberResult({ question: '验收', questionType: '其他', nums: [3, 5, 2], now })],
] as const) {
  const shown = `${r.ganZhi.year}年 ${r.ganZhi.month}月 ${r.ganZhi.day}日 ${r.ganZhi.hour}时 · ${r.xunKong}旬空`;
  ok(`result/${label}-ganZhi`, shown === plate, `${label} 盘面「${shown}」应等于「${plate}」`);
  ok(`result/${label}-monthZhi`, r.monthZhi === truth.getMonthInGanZhiExact().slice(-1), `${label} monthZhi=${r.monthZhi}`);
  ok(`result/${label}-liuShen`, r.liuShen[0] === '玄武', `${label} 初爻六神=${r.liuShen[0]}（癸日起玄武）`);
}

// ── 6. 运维 400 天差分回归（2020-01-01 起，双引擎交叉：lunar-typescript × 同源副本）──
// 运维口径 A1-③：改完必须 400/400。两份参照引擎本身也必须 400/400 互洽，否则差分无意义。
let ownerDays = 0, ownerBad = 0, crossBad = 0;
const ownerBadList: string[] = [];
for (let i = 0; i < 400; i++) {
  const dt = new Date(2020, 0, 1 + i, 12, 0, 0);
  const y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate();
  const truth = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getDayInGanZhiExact();
  const copy = dateToGanZhi(dt);           // app/lib/core 那份（2026-10-17 已修 DST；后端那份同一坑待运维同步）
  const mine = getDayGanZhi(dt);
  ownerDays++;
  if (truth !== copy.gan + copy.zhi) crossBad++;
  if (mine.gan + mine.zhi !== truth) {
    ownerBad++;
    if (ownerBadList.length < 5) ownerBadList.push(`${y}-${m}-${d} ${mine.gan + mine.zhi} != ${truth}`);
  }
}
ok('owner-400d/two-engines-agree', crossBad === 0, `两份引擎互检不符 ${crossBad}/${ownerDays} 天`);
ok('owner-400d/day-pillar', ownerBad === 0, `日柱不符 ${ownerBad}/${ownerDays} 天（运维要求 400/400）${ownerBadList.length ? ' 例:' + ownerBadList.join(' | ') : ''}`);

// ── 6.5 dateToGanZhi（app/lib/core 那份副本）的时区/DST 回归 ──
// 旧实现用 `Math.floor((date.getTime() - new Date(1900,0,1).getTime()) / 86400000)` 算日序，
// 零点那天的余量本来就归零，一旦落到夏令时年份（1919 / 1940–49 / 1986–91）时区提前一小时，
// 日序就被少算一天。2026-10-17 改为用 Date.UTC(y, m-1, d) 组成 UTC 日序，时刻不再参与运算。
// 这里同时跑「修复前的算法」和「修复后的实现」，两边都必须拿正午与零点各测一遍。
function dateToGanZhiOld(date: Date): string {
  const days = Math.floor((date.getTime() - new Date(1900, 0, 1).getTime()) / 86400000);
  return GAN_NAMES[((0 + days) % 10 + 10) % 10] + ZHI_NAMES[((10 + days) % 12 + 12) % 12];
}
let copyDays = 0;
let copyNoonBad = 0, copyMidBad = 0, oldNoonBad = 0, oldMidBad = 0;
const copyMidBadList: string[] = [];
for (let y = 1901; y <= 2099; y++) {
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(y, m, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const truth = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getDayInGanZhiExact();
      const noon = new Date(y, m - 1, d, 12, 0, 0);
      const mid = new Date(y, m - 1, d, 0, 0, 0);
      const cn = dateToGanZhi(noon), cm = dateToGanZhi(mid);
      copyDays++;
      if (cn.gan + cn.zhi !== truth) copyNoonBad++;
      if (cm.gan + cm.zhi !== truth) {
        copyMidBad++;
        if (copyMidBadList.length < 5) copyMidBadList.push(`${y}-${m}-${d} ${cm.gan + cm.zhi} != ${truth}`);
      }
      if (dateToGanZhiOld(noon) !== truth) oldNoonBad++;
      if (dateToGanZhiOld(mid) !== truth) oldMidBad++;
    }
  }
}
ok('copy/day-noon', copyNoonBad === 0, `副本正午日柱不符 ${copyNoonBad}/${copyDays} 天`);
ok('copy/day-midnight', copyMidBad === 0, `副本零点日柱不符 ${copyMidBad}/${copyDays} 天${copyMidBadList.length ? ' 例:' + copyMidBadList.join(' | ') : ''}`);
ok('copy/hour-independent', copyNoonBad === copyMidBad, `正午 ${copyNoonBad} 与零点 ${copyMidBad} 必须同值（时刻不该参与日序运算）`);
say(`BEFORE 旧算法同口径错误率：正午 ${oldNoonBad}/${copyDays}、零点 ${oldMidBad}/${copyDays} 天（零点错的全是夏令时年份）`);

// ── 7. 每爻空亡：标记必须恰好落在旬空地支的爻上 ──
for (const [label, r] of [
  ['coin', buildCoinResult({ question: '验收', questionType: '其他', records, now })],
  ['time', buildTimeResult({ question: '验收', questionType: '其他', date: now })],
  ['number', buildNumberResult({ question: '验收', questionType: '其他', nums: [3, 5, 2], now })],
] as const) {
  const want = r.naJia.map(y => r.xunKong.includes(y.naZhi));
  const got = r.naJia.map(y => y.xunKong);
  ok(`xunkong-per-yao/${label}`, JSON.stringify(want) === JSON.stringify(got),
    `${label} 旬空${r.xunKong} 应标 ${want.filter(Boolean).length} 爻（${r.naJia.filter(y => y.xunKong).map(y => y.naZhi).join('')}），实标 ${got.filter(Boolean).length} 爻`);
  const bianWant = r.bianNaJia.map(y => r.xunKong.includes(y.naZhi));
  const bianGot = r.bianNaJia.map(y => y.xunKong);
  ok(`xunkong-per-yao/${label}-bian`, r.bianNaJia.length === 0 || JSON.stringify(bianWant) === JSON.stringify(bianGot),
    `${label} 变卦 ${r.bianNaJia.length} 爻标记一致`);
}

// ── 8. 起卦时刻口径：默认不校正，选了地点必须按真太阳时前移，且口径可标注 ──
const wlmq = lookupGeo({ city: '乌鲁木齐市' });
const shanghai = lookupGeo({ city: '上海市' });
ok('solar/geo-resolved', !!wlmq && !!shanghai, `乌鲁木齐 ${wlmq?.lng}°E / 上海 ${shanghai?.lng}°E`);

const stdMoment = resolveQiguaMoment(new Date(2026, 9, 17, 22, 43));
ok('solar/default-uncorrected', stdMoment.info.mode === 'standard' && stdMoment.date.getTime() === new Date(2026, 9, 17, 22, 43).getTime(),
  `缺省口径「${stdMoment.info.label}」，时刻原样`);

const west = resolveQiguaMoment(new Date(2026, 9, 17, 22, 43), { province: '新疆维吾尔自治区', city: '乌鲁木齐市' });
const wantLon = +(((wlmq?.lng ?? 0) - 120) * 4).toFixed(1);
ok('solar/longitude-term', Math.abs(west.info.longitudeCorrectionMinutes - wantLon) < 0.05,
  `经度时差 ${west.info.longitudeCorrectionMinutes} 分 应 ${wantLon} 分（(经度−120)×4）`);
ok('solar/label-not-silent', west.info.label.includes('真太阳时') && !!west.info.place,
  `口径必须显式：${west.info.label} @ ${west.info.place}`);
ok('solar/western-shift', west.info.correctionMinutes < -100 && west.info.correctionMinutes > -145,
  `总校正 ${west.info.correctionMinutes} 分 → 真太阳时 ${west.info.solarText}（钟表 ${west.info.clockText}）`);

const east = resolveQiguaMoment(new Date(2026, 9, 17, 12, 0), { city: '上海市' });
ok('solar/east-of-120-positive', east.info.longitudeCorrectionMinutes > 0,
  `上海经度时差 ${east.info.longitudeCorrectionMinutes} 分（东经 > 120 应为正）`);

// 00:10 的乌鲁木齐真太阳时回到前一天晚上，日柱必须跟着前移，不是只改时柱
const cross = resolveQiguaMoment(new Date(2026, 9, 17, 0, 10), { city: '乌鲁木齐市' });
const crossCivil = new Date(2026, 9, 17, 0, 10);
const gzSolar = getDayGanZhi(cross.date), gzCivil = getDayGanZhi(crossCivil);
ok('solar/crosses-day', cross.info.crossedDay && cross.date.getDate() === 16,
  `00:10 乌鲁木齐 → ${cross.date.getMonth() + 1}-${cross.date.getDate()} ${cross.info.solarText}`);
ok('solar/day-pillar-follows', gzSolar.gan + gzSolar.zhi !== gzCivil.gan + gzCivil.zhi,
  `日柱 校正后 ${gzSolar.gan + gzSolar.zhi} ≠ 钟表 ${gzCivil.gan + gzCivil.zhi}`);

const hr = resolveQiguaMoment(new Date(2026, 9, 17, 9, 20), { city: '乌鲁木齐市' });
const gzHr = getDayGanZhi(hr.date);
const hourSolar = getHourGanZhi(gzHr.ganIdx, hr.date.getHours());
const hourCivil = getHourGanZhi(getDayGanZhi(new Date(2026, 9, 17, 9, 20)).ganIdx, 9);
ok('solar/hour-pillar-follows', hourSolar !== hourCivil,
  `时柱 校正后 ${hourSolar}（真太阳 ${hr.info.solarText}）≠ 钟表 ${hourCivil}`);

// ── 8.5 live 空亡路径：六十甲子逐一对照标准旬空表（独立权威，不依赖 lunar-typescript）──
let xk60 = 0, xk60Bad = 0;
const xk60BadList: string[] = [];
for (let i = 0; i < 60; i++) {
  const g = i % 10, z = i % 12;                 // i 就是六十甲子的序号：干 i%10、支 i%12
  const headZhi = ZHI_NAMES[(i - g) % 12];      // 该日所在旬的旬首地支（甲X）
  const want = XUNKONG_BY_XUN_HEAD[headZhi];
  const got = getXunKong(g, z);                 // frontend/lib/liuyao/core/calcGanZhi
  xk60++;
  if (got !== want) {
    xk60Bad++;
    if (xk60BadList.length < 6) xk60BadList.push(`${GAN_NAMES[g]}${ZHI_NAMES[z]}(旬首甲${headZhi}) 实=${got} 应=${want}`);
  }
}
ok('xunkong/60-jiazi', xk60Bad === 0 && xk60 === 60,
  `六十甲子旬空对标准表不符 ${xk60Bad}/${xk60}${xk60BadList.length ? ' 例:' + xk60BadList.join(' | ') : ''}`);

// ── 8.6 时间起卦取数（D9，2026-10-17 裁定口径）──
// 上卦 =（年支序 + 农历月 + 农历日）mod 8，下卦 = 再加时辰序 mod 8，动爻 = 同一个和 mod 6；
// 余 0 不作 0 按满数计（卦 8、爻 6）；年支按**农历年（正月初一）**；23 时农历日按次日计；闰月按本数月计（取绝对值）。
// 下面这份 qiShuIndependent 只调 lunar-typescript，不走被测模块，用来把 methods/time.ts 的盘独立复算出来。
const XIAN_TIAN_NUM = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];   // 先天八卦数 1..8
// 卦形表按「初爻在最左」写死，与先天数自洽：二进制读法恒等于 8 − 先天数
// （乾1=111=7 … 坤8=000=0），即宋人「自下而上、阳爻记 1」的二元计数。
const XIAN_TIAN_BITS = ['111', '110', '101', '100', '011', '010', '001', '000'];
const ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const fullMod = (n: number, m: number) => { const r = n % m; return r === 0 ? m : r; };

function qiShuIndependent(date: Date) {
  const solar = Solar.fromYmdHms(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), 0);
  const lunar = solar.getLunar();
  const nianZhi = lunar.getYearInGanZhi().charAt(1);                       // 正月初一界
  const nianZhiLiChun = lunar.getYearInGanZhiExact().charAt(1);            // 立春界（只为对照）
  const shiZhi = lunar.getTimeZhi();
  const dayLunar = date.getHours() === 23 ? solar.next(1).getLunar() : lunar;
  const n = ZHI_ORDER.indexOf(nianZhi) + 1, h = ZHI_ORDER.indexOf(shiZhi) + 1;
  const yue = Math.abs(dayLunar.getMonth()), ri = dayLunar.getDay();
  const upper = n + yue + ri, total = upper + h;
  return {
    nianZhi, nianZhiLiChun, shiZhi, n, h, yue, ri, upper, total,
    leap: dayLunar.getMonth() < 0,
    shang: fullMod(upper, 8), xia: fullMod(total, 8), dong: fullMod(total, 6),
    shangIfLiChun: fullMod(ZHI_ORDER.indexOf(nianZhiLiChun) + 1 + yue + ri, 8),
  };
}

// 样例（owner 给的实测数）：2026-10-17 14:00 → 农历九月初八、年支午(7)、时辰序未(8) → 上8/下8/动2
const tsSample = new Date(2026, 9, 17, 14, 0, 0);
const tsInd = qiShuIndependent(tsSample);
const tsRes = buildTimeResult({ question: '验收', questionType: '其他', date: tsSample });
ok('time-qishu/sample-2026-10-17',
  tsInd.nianZhi === '午' && tsInd.n === 7 && tsInd.yue === 9 && tsInd.ri === 8 && tsInd.h === 8 &&
  tsInd.upper === 24 && tsInd.total === 32 && tsInd.shang === 8 && tsInd.xia === 8 && tsInd.dong === 2,
  `取数 年支${tsInd.nianZhi}${tsInd.n} + ${tsInd.yue}月 + ${tsInd.ri}日 = ${tsInd.upper}，加时支${tsInd.shiZhi}${tsInd.h} = ${tsInd.total} → 上${tsInd.shang}/下${tsInd.xia}/动${tsInd.dong}（应 午7/9/8/未8 → 24/32 → 8/8/2）`);
ok('time-qishu/sample-plate',
  tsRes.benGua.name === '坤为地' && tsRes.benGua.shangGua === '坤' && tsRes.benGua.xiaGua === '坤' &&
  tsRes.dongYao.join() === '2' && tsRes.yaoRecords.map(y => y.value).join() === '8,6,8,8,8,8',
  `盘面 本卦${tsRes.benGua.name} 上${tsRes.benGua.shangGua}/下${tsRes.benGua.xiaGua} 动爻[${tsRes.dongYao}] 爻值[${tsRes.yaoRecords.map(y => y.value)}]（应 坤为地 坤/坤 动二 8,6,8,8,8,8：六爻皆阴、二爻动取老阴 6）`);

// 年界判别：2026 立春 2-04、正月初一 2-17，中间这段两个口径差一支，盘面必须跟着正月初一那份走
const tsBoundary = new Date(2026, 1, 5, 12, 0, 0);
const tbInd = qiShuIndependent(tsBoundary);
const tbRes = buildTimeResult({ question: '验收', questionType: '其他', date: tsBoundary });
ok('time-qishu/year-boundary',
  tbInd.nianZhi === '巳' && tbInd.nianZhiLiChun === '午' && tbInd.shang !== tbInd.shangIfLiChun &&
  tbRes.benGua.shangGua === XIAN_TIAN_NUM[tbInd.shang - 1],
  `2026-02-05：正月初一取${tbInd.nianZhi}(上卦${tbInd.shang}=${XIAN_TIAN_NUM[tbInd.shang - 1]}) vs 立春取${tbInd.nianZhiLiChun}(上卦${tbInd.shangIfLiChun}=${XIAN_TIAN_NUM[tbInd.shangIfLiChun - 1]})，盘面取${tbRes.benGua.shangGua}，两口径必须可分辨且实盘跟正月初一`);

// 逐年逐日 × 14 个时辰，与独立复算对拍（卦名、卦形、动爻、爻值结构）。
// 跨 2025–2026 两个公历年而不是只跑 2026：闰月落在 2025 的闰六月（2025-07-25～08-22，29 天），
// 2026 整年没有闰月，只跑 2026 会让「闰月按本数月计」这条口径 0 例通过。
let tsCases = 0, tsBad = 0, tsLeap = 0, tsLateZi = 0;
const tsLeapMonths = new Set<string>();
const tsBadList: string[] = [];
for (let i = 0; i < 731; i++) {
  const base = new Date(2025, 0, 1 + i);
  if (base.getFullYear() > 2026) break;
  for (const h of [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23]) {
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 30, 0);
    const ind = qiShuIndependent(dt);
    const r = buildTimeResult({ question: '验收', questionType: '其他', date: dt });
    tsCases++;
    if (ind.leap) { tsLeap++; tsLeapMonths.add(`${ind.yue}月`); }
    if (h === 23) tsLateZi++;
    const vals = r.yaoRecords.map(y => y.value);
    const dongList = r.yaoRecords.filter(y => y.isDong).map(y => y.position);
    // 爻值还原成卦形：7/9 阳、6/8 阴，初爻在下 → 0-2 位是下卦、3-5 位是上卦。
    const bits = vals.map(v => (v === 7 || v === 9 ? '1' : '0')).join('');
    const structural =
      r.benGua.shangGua === XIAN_TIAN_NUM[ind.shang - 1] &&
      r.benGua.xiaGua === XIAN_TIAN_NUM[ind.xia - 1] &&
      r.dongYao.length === 1 && r.dongYao[0] === ind.dong && dongList.join() === String(ind.dong) &&
      vals.every((v, j) => (j + 1 === ind.dong ? (v === 6 || v === 9) : (v === 7 || v === 8))) &&
      vals.every(v => [6, 7, 8, 9].includes(v)) &&
      bits.slice(0, 3) === XIAN_TIAN_BITS[ind.xia - 1] &&
      bits.slice(3, 6) === XIAN_TIAN_BITS[ind.shang - 1];
    if (!structural) {
      tsBad++;
      if (tsBadList.length < 6) tsBadList.push(`${dt.getMonth() + 1}-${dt.getDate()} ${h}:30 → ${r.benGua.name}(上${r.benGua.shangGua}/下${r.benGua.xiaGua} 形${bits}) 应 上${XIAN_TIAN_NUM[ind.shang - 1]}(${XIAN_TIAN_BITS[ind.shang - 1]})/下${XIAN_TIAN_NUM[ind.xia - 1]}(${XIAN_TIAN_BITS[ind.xia - 1]}) 动${ind.dong}`);
    }
  }
}
ok('time-qishu/matches-independent', tsBad === 0 && tsCases > 9000,
  `2025–2026 ${tsCases} 个「日 × 时辰」盘与独立复算不符 ${tsBad} 例${tsBadList.length ? ' 例:' + tsBadList.join(' | ') : ''}`);
// 闰月单独钉一条：lunar-typescript 把闰月记成负数（2025 闰六月 → getMonth() = -6），
// 传统「闰月按本数月计」= 取绝对值 6，既不另起一月、也不并入下月。
// 这条不走 qiShuIndependent 的 abs，直接把库里的原始符号钉住，免得两份实现同时把负号读错。
const tlDay = new Date(2025, 7, 1, 12, 0, 0);
const tlLunar = Solar.fromYmdHms(2025, 8, 1, 12, 0, 0).getLunar();
const tlRaw = tlLunar.getMonth();
const tlInd = qiShuIndependent(tlDay);
const tlRes = buildTimeResult({ question: '验收', questionType: '其他', date: tlDay });
ok('time-qishu/leap-month-counted',
  tlRaw === -6 && tlInd.leap && tlInd.yue === 6 &&
  tlRes.benGua.shangGua === XIAN_TIAN_NUM[tlInd.shang - 1] && tlRes.benGua.xiaGua === XIAN_TIAN_NUM[tlInd.xia - 1],
  `2025-08-01 农历${tlLunar.getMonthInChinese()}月${tlLunar.getDayInChinese()}：库里 getMonth()=${tlRaw}（负号=闰），取数按本数月 ${tlInd.yue} → 上${tlInd.shang}=${XIAN_TIAN_NUM[tlInd.shang - 1]}/下${tlInd.xia}=${XIAN_TIAN_NUM[tlInd.xia - 1]}，盘面 ${tlRes.benGua.name}`);

// 晚子时（23 时）单独钉一条：同一日的 22:30 与 23:30 分属两个农历日，23:30 与次日 00:30 同属一日。
const tzPrev = qiShuIndependent(new Date(2026, 9, 17, 22, 30));
const tzLate = qiShuIndependent(new Date(2026, 9, 17, 23, 30));
const tzEarly = qiShuIndependent(new Date(2026, 9, 18, 0, 30));
ok('time-qishu/late-zi-uses-next-day',
  tzLate.ri === tzPrev.ri + 1 && tzPrev.shiZhi === '亥' && tzLate.shiZhi === '子' &&
  tzLate.shang === tzEarly.shang && tzLate.xia === tzEarly.xia && tzLate.dong === tzEarly.dong,
  `2026-10-17 ${tzPrev.ri}日亥时(${tzPrev.shang}/${tzPrev.xia}/动${tzPrev.dong}) → 23:30 已是${tzLate.ri}日子时(${tzLate.shang}/${tzLate.xia}/动${tzLate.dong})，与 10-18 00:30(${tzEarly.shang}/${tzEarly.xia}/动${tzEarly.dong}) 同盘`);

ok('time-qishu/covers-leap-and-latezi', tsLeap > 0 && tsLateZi > 0,
  `这轮对拍覆盖 闰月 ${tsLeap} 例（闰${[...tsLeapMonths].join('、闰')}）、23 时（晚子时换日）${tsLateZi} 例，两条口径都真被测到了`);

// ── 9. 控制台摘要（ASCII）──
const summary = `liuyao ganzhi acceptance: days=${days} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
