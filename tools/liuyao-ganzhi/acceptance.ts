// 六爻时间干支验收：把 frontend/lib/liuyao/core 的干支层逐日对齐全站八字引擎（lunar-typescript）。
//
// 用法（tsx 在 fate-reverse/bazi-engine/node_modules/.bin 下；methods/*.ts 用的是站里 @/* 别名，
// 外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到）：
//   cd <repo root> && NODE_PATH="<…>/fate-reverse/reproduce/node_modules" \
//     "<…>/fate-reverse/bazi-engine/node_modules/.bin/tsx" --tsconfig=frontend/tsconfig.json \
//     tools/liuyao-ganzhi/acceptance.ts --out=.liuyao-ganzhi.txt
// 完整报告写 --out=<file>（控制台只打 ASCII 摘要，Windows 控制台会把 UTF-8 截断成乱码）。
//
// §8.9 之后同时 import 后端 server/src/core/liuyao/najia 做双引擎对拍。那条链只用相对导入、
// 不依赖 server/node_modules，所以在 frontend/tsconfig.json 下可以直接混着跑。
import { writeFileSync } from 'node:fs';
import { Solar } from 'lunar-typescript';
import {
  getDayGanZhi, getYearGanZhi, getMonthGanZhi, getHourGanZhi, getXunKong, getLiuShen,
} from '../../frontend/lib/liuyao/core/calcGanZhi';
import { getNaJia, NAJIA_BASIS } from '../../frontend/lib/liuyao/core/getNaJia';
import { S64, GUA_MAP } from '../../frontend/lib/liuyao/core/constants';
import {
  NAJIA_GOLD, YANG_GUA, goldLiuQin, goldShiYing, gongBits,
  TRIGRAM_BITS, TRIGRAM_BY_BITS, TRIGRAMS, goldFor, goldOld, guaNameToTrigrams,
  goldPlate, WX_BY_ZHI,
} from './gold';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { buildTimeResult } from '../../frontend/lib/liuyao/methods/time';
import { buildNumberResult } from '../../frontend/lib/liuyao/methods/number';
import { analyzeLiuyao } from '../../frontend/lib/liuyao/analysis';
import { buildReportContext } from '../../frontend/lib/liuyao/report/contextBuilder';
import { buildReportPrompt } from '../../frontend/lib/liuyao/report/promptBuilder';
import { qiGuaByTime, qiGuaByNumbers, QISHU_BASIS } from '../../frontend/lib/meihua/engine';
import { dateToGanZhi } from '../../frontend/app/lib/core/liuyao/constants';
import { resolveQiguaMoment } from '../../frontend/lib/liuyao/solar-basis';
import { lookupGeo } from '../../frontend/app/lib/true-solar/birth-wiring';
import { paiPan } from '../../server/src/core/liuyao/najia';

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
  ['number', buildNumberResult({ question: '验收', questionType: '其他', nums: [3, 5], now })],
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
  ['number', buildNumberResult({ question: '验收', questionType: '其他', nums: [3, 5], now })],
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

// ── 8.7 时间起卦的变卦与变卦纳甲（裁定 1，2026-10-17）──
// 有动爻就必须出行变卦与变卦纳甲。独立复算走两条与被测模块不同的路：
//   ① 梅花那份是另一套实现（buildFromTrigrams，卦形由 GUA_MAP 的键反推），它被 §1 观梅占
//      「泽火革·初爻动→变泽山咸」钉住；同一时刻两条页面必须出同一张盘。
//   ② 卦形翻转：变卦爻形 = 本卦爻形把第 dongYao 爻取反，与 bianNaJia 逐爻的 爻值奇偶 对拍。
{
  // 已知盘：2026-10-17 14:00 → 坤为地 六二动 → 变 地水师（下卦 000→010 = 坎，师属坎宫归魂卦）
  ok('bian/known-plate-2026-10-17',
    tsRes.bianGua.name === '地水师' && tsRes.bianGua.gong === '坎' && tsRes.bianGua.wuxing === '水' &&
    tsRes.bianNaJia.length === 6 &&
    tsRes.bianNaJia.map(y => y.value).join() === '8,7,8,8,8,8',
    `坤为地 动二 → 变${tsRes.bianGua.name}（${tsRes.bianGua.gong}宫${tsRes.bianGua.wuxing}）纳甲${tsRes.bianNaJia.length}爻 爻值[${tsRes.bianNaJia.map(y => y.value)}]，应 地水师 坎/水 6爻 8,7,8,8,8,8`);
  // 变卦纳甲带着变卦自己那宫的世应：师属坎宫归魂卦 → 世三爻、应六爻（本卦坤为地是坤宫本宫卦，世六应三）
  ok('bian/known-plate-shiying',
    tsRes.shiYing.shi === 5 && tsRes.shiYing.ying === 2 &&
    tsRes.bianNaJia.find(y => y.shiYing === '世')?.position === 3 &&
    tsRes.bianNaJia.find(y => y.shiYing === '应')?.position === 6,
    `本卦坤为地 世${tsRes.shiYing.shi + 1}应${tsRes.shiYing.ying + 1}（本宫卦世六应三），变卦地水师纳甲上标出 世${tsRes.bianNaJia.find(y => y.shiYing === '世')?.position}应${tsRes.bianNaJia.find(y => y.shiYing === '应')?.position}（归魂卦世三应六）`);

  const mhRef = qiGuaByTime(tsSample);
  ok('bian/known-plate-vs-meihua',
    tsRes.benGua.name === mhRef.ben.name && tsRes.dongYao[0] === mhRef.dongYao && tsRes.bianGua.name === mhRef.bian.name,
    `同一时刻与梅花对拍：${tsRes.benGua.name} 动${tsRes.dongYao} → ${tsRes.bianGua.name} vs ${mhRef.ben.name} 动${mhRef.dongYao} → ${mhRef.bian.name}`);

  // 扫盘：任一时间起卦只要 dongYao 非空，bianGua.name 必须非 null，且与独立复算一致
  let bc = 0, bb = 0;
  const bBad: string[] = [];
  for (let i = 0; i < 731; i++) {
    const base = new Date(2025, 0, 1 + i);
    if (base.getFullYear() > 2026) break;
    for (const h of [2, 8, 14, 20]) {
      const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 30, 0);
      const r = buildTimeResult({ question: '验收', questionType: '其他', date: dt });
      const mh = qiGuaByTime(dt);
      bc++;
      const dong = r.dongYao[0];
      const vals = r.yaoRecords.map(y => y.value);
      // 独立复算的变卦爻值：动爻那一爻老变少、阴阳互易（9→8，6→7），其余原样。
      const flip = vals.map((v, j) => (j + 1 === dong ? (v === 9 ? 8 : 7) : v));
      const bad =
        r.dongYao.length !== 1 || r.bianGua.name === null || r.bianGua.gong === null || r.bianGua.wuxing === null ||
        r.bianNaJia.length !== 6 ||
        r.bianGua.name !== mh.bian.name || r.benGua.name !== mh.ben.name || dong !== mh.dongYao ||
        // 变卦逐爻：只有动爻那一爻变阴阳，其余与本卦同；动爻由老变少
        !r.bianNaJia.every((y, j) => y.position === j + 1 && y.value === flip[j]) ||
        !r.bianNaJia.every(y => y.ganZhi.length === 2 && !!y.naZhi && !!y.liuQin);
      if (bad) {
        bb++;
        if (bBad.length < 6) bBad.push(`${base.getMonth() + 1}-${base.getDate()} ${h}:30 → ${r.benGua.name}动${dong} 变[${r.bianGua.name}/${r.bianNaJia.map(y => y.value)}] 梅花[${mh.ben.name}动${mh.dongYao}/${mh.bian.name}]`);
      }
    }
  }
  ok('bian/time-plate-always-has-bian', bb === 0 && bc > 2900,
    `2025–2026 ${bc} 个时间起卦盘，动爻唯一且变卦（名/宫/五行/纳甲六爻）齐备、与梅花那份及翻转复算不符 ${bb} 例${bBad.length ? ' 例:' + bBad.join(' | ') : ''}`);
}

// ── 8.8 世应爻位（裁定 2，2026-10-17）──
// analysis.shiYing.shiPosition/yingPosition 来自 naJia.position，是 **1-based**；
// 爻名表 YAO_NAMES 是 0-based。页面必须按 YAO_NAMES[position-1] 取名，否则整张盘的世应结论错位一格。
// 这份表按《周易》爻位手写，不 import 页面，避免把同一个错误抄进断言。
const YAO_NAMES_REF = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
{
  const mkRecords = (bits: string) => bits.split('').map((b, i) => {
    const v = b === '1' ? 7 : 8;
    return { position: i + 1, coins: [] as any, value: v, label: v === 7 ? '少阳' : '少阴', isDong: false };
  });
  // 已知盘（京房八宫：本宫世在上爻、三世卦世在三爻、游魂世在四爻、归魂世在三爻；应 = 世 ± 3）
  // 爻串按 初→上 写，前 3 位是下卦、后 3 位是上卦（乾111 兑110 离101 震100 巽011 坎010 艮001 坤000）
  const known: [string, string, number, number][] = [
    ['111111', '乾为天', 6, 3],   // 乾宫本宫卦：上乾下乾
    ['111000', '地天泰', 3, 6],   // 坤宫三世卦（owner 举例的那张）：上坤下乾
    ['000101', '火地晋', 4, 1],   // 乾宫游魂卦：上离下坤
    ['111101', '火天大有', 3, 6], // 乾宫归魂卦：上离下乾
  ];
  for (const [bits, name, shiWant, yingWant] of known) {
    const plate = buildCoinResult({ question: '验收', questionType: '其他', records: mkRecords(bits) as any, now: tsSample });
    const an = analyzeLiuyao(plate);
    const p = an.shiYing!;
    ok(`shiying/known-${name}`,
      plate.benGua.name === name && p.shiPosition === shiWant && p.yingPosition === yingWant &&
      YAO_NAMES_REF[p.shiPosition - 1] !== undefined && YAO_NAMES_REF[p.yingPosition - 1] !== undefined,
      `${name}：世${YAO_NAMES_REF[p.shiPosition - 1]}(${p.shiPosition})、应${YAO_NAMES_REF[p.yingPosition - 1]}(${p.yingPosition})，应 世${shiWant}爻/应${yingWant}爻；旧写法 YAO_NAMES[${p.shiPosition}] 会取到「${YAO_NAMES_REF[p.shiPosition] ?? 'undefined'}」`);
  }
  // 64 卦全覆盖：世应名称永不 undefined，且名字对应的爻在盘上确实标着世/应
  let sc = 0, sBad = 0;
  const sBadList: string[] = [];
  for (const shang of XIAN_TIAN_NUM) {
    for (const xia of XIAN_TIAN_NUM) {
      const shangBits = XIAN_TIAN_BITS[XIAN_TIAN_NUM.indexOf(shang)];
      const xiaBits = XIAN_TIAN_BITS[XIAN_TIAN_NUM.indexOf(xia)];
      const plate = buildCoinResult({ question: '验收', questionType: '其他', records: mkRecords(xiaBits + shangBits) as any, now: tsSample });
      const an = analyzeLiuyao(plate);
      const p = an.shiYing!;
      sc++;
      const shiMark = plate.naJia.find(y => y.position === p.shiPosition)?.shiYing;
      const yingMark = plate.naJia.find(y => y.position === p.yingPosition)?.shiYing;
      const okRow =
        p.shiPosition >= 1 && p.shiPosition <= 6 && p.yingPosition >= 1 && p.yingPosition <= 6 &&
        Math.abs(p.shiPosition - p.yingPosition) === 3 &&
        YAO_NAMES_REF[p.shiPosition - 1] !== undefined && YAO_NAMES_REF[p.yingPosition - 1] !== undefined &&
        shiMark === '世' && yingMark === '应';
      if (!okRow) {
        sBad++;
        if (sBadList.length < 6) sBadList.push(`${plate.benGua.name} 世${p.shiPosition}(${shiMark ?? '-'}) 应${p.yingPosition}(${yingMark ?? '-'})`);
      }
    }
  }
  ok('shiying/64-gua-name-mapping', sc === 64 && sBad === 0,
    `64 卦全扫：世应位置 1-based 落在 1–6、世应相隔三爻、YAO_NAMES_REF[pos-1] 无 undefined、且与盘上标记一致，不符 ${sBad} 例${sBadList.length ? ' 例:' + sBadList.join(' | ') : ''}`);
}

// ── 8.9 纳甲金标准（#66 裁定，2026-10-17）──
// 金标准表本体在 tools/liuyao-ganzhi/gold.ts（手写《京氏易传》京房纳甲表 + 五行生克 + 八宫变爻规则），
// 与本文件 §8.10 make-fixture 共用同一份：两处各抄一份就会长出第二个真相。
// 既不 import 前端 core/constants 的 NA_GAN+NA_ZHI，也不抄后端 core/liuyao/constants 的 NAJIA。
// 金标准必须独立于被测实现：#66 的错不在表（两份表都对），而在取数的下标，
// 拿任何一份实现当参照都会把同一个错洗成"正确"。
const GOLD_DATE = new Date(2026, 9, 17, 12, 0);
{
  // 金标准自检：爻数、地支不重复、乾坤分纳内外、阳顺阴逆等差 2。
  const shapeBad: string[] = [];
  for (const g of TRIGRAMS) {
    const t = NAJIA_GOLD[g];
    if (!t || t.nei.length !== 3 || t.wai.length !== 3) { shapeBad.push(`${g}爻数`); continue; }
    const six = [...t.nei, ...t.wai];
    if (six.some(x => x.length !== 2)) shapeBad.push(`${g}字长`);
    if (new Set(six.map(x => x[1])).size !== 6) shapeBad.push(`${g}地支重复`);
    const oneGan = new Set(six.map(x => x[0])).size === 1;
    if ((g === '乾' || g === '坤') === oneGan) shapeBad.push(`${g}内外天干`);   // 只有乾坤分纳两干
    const step = YANG_GUA.includes(g) ? 2 : 10;                                // −2 ≡ +10 (mod 12)
    for (let i = 1; i < 6; i++) {
      if ((ZHI_NAMES.indexOf(six[i][1]) - ZHI_NAMES.indexOf(six[i - 1][1]) + 12) % 12 !== step) shapeBad.push(`${g}第${i + 1}爻顺逆`);
    }
    // 八个经卦的内外三支必须两两不同 —— 这条决定 #66 的覆盖面是 64/64 而不是某几宫。
    if (t.nei.map(x => x[1]).join('') === t.wai.map(x => x[1]).join('')) shapeBad.push(`${g}内外三支相同`);
  }
  // 卦形表自检：gold.ts 那份是按「八口卦诀」手写的，本文件 §8.6 另有一份按先天数二进制
  // 推出来的（乾1=111 … 坤8=000）。两份来源互相独立，对得上才算钉死 ——
  // 拿 gold 自己的表比自己的表是恒真式，没有牙齿。
  const jueBad = TRIGRAMS.filter(g => {
    const i = XIAN_TIAN_NUM.indexOf(g);
    return i < 0 || TRIGRAM_BITS[g] !== XIAN_TIAN_BITS[i];
  });
  // 卦名反查表自检：make-fixture 用「前两字 = 上象名+下象名」把盘面存的卦名读回上下卦，
  // 这张手写象名表必须与 64 卦名一一对得上，否则 fixture 的断言值会从错的卦上取。
  const revBad: string[] = [];
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) {
    const nm = S64[shang + xia];
    if (!nm) { revBad.push(`S64 缺 ${shang}${xia}`); continue; }
    const t = guaNameToTrigrams(nm);
    if (t.shang !== shang || t.xia !== xia) revBad.push(`${nm} 反查 上${t.shang}/下${t.xia} ≠ 上${shang}/下${xia}`);
  }
  // 八宫生成规则自检：乾宫、坤宫八卦名手写（京房八宫本宫卦序），用来证明 gongBits() 的变爻规则没推错。
  const GONG8_REF: Record<string, string[]> = {
    乾: ['乾为天', '天风姤', '天山遁', '天地否', '风地观', '山地剥', '火地晋', '火天大有'],
    坤: ['坤为地', '地雷复', '地泽临', '地天泰', '雷天大壮', '泽天夬', '水天需', '水地比'],
  };
  const gongBad: string[] = [];
  for (const [g, names] of Object.entries(GONG8_REF)) {
    names.forEach((n, k) => {
      const b = gongBits(g, k);
      const got = S64[TRIGRAM_BY_BITS[b.slice(3, 6)] + TRIGRAM_BY_BITS[b.slice(0, 3)]] || '?';
      if (got !== n) gongBad.push(`${g}宫${k}世 推出「${got}」≠手抄「${n}」`);
    });
  }
  ok('najia/golden-table-selfcheck', shapeBad.length === 0 && jueBad.length === 0 && gongBad.length === 0,
    `手写金标准自检：8 卦纳甲齐、内外各 3 爻、地支不重、唯乾坤分纳内外干、阳顺阴逆（等差 2）、卦形与 §8.6 先天数二进制两份手写表互检，八宫变爻规则推出乾/坤两宫 16 卦名与手抄一致${shapeBad.length ? ' 结构不符:' + shapeBad.join(',') : ''}${jueBad.length ? ' 卦形不符:' + jueBad.join(',') : ''}${gongBad.length ? ' 宫序不符:' + gongBad.join(' | ') : ''}`);
  ok('najia/gua-name-reverse-map', revBad.length === 0,
    `64 卦名 → 上下卦 反查（手写象名表 天地雷风水火山泽 + 纯卦「X为Y」，供 make-fixture 独立复算金标准）：不符 ${revBad.length} 例${revBad.length ? ' 例:' + revBad.slice(0, 6).join(' | ') : ''}`);
}
{
  // 64 卦（按京房八宫枚举）× 6 爻：钉 纳甲干支 + 六亲 + 世应，前端与后端各对一遍金标准，再逐爻互检。
  // 纳甲错一格，六亲跟着错、每爻空亡跟着错 —— 所以钉的不能只是干支。
  let cmp = 0, feBad = 0, beBad = 0, engBad = 0, nameBad = 0, scanned = 0;
  const feBadList: string[] = [], beBadList: string[] = [], engBadList: string[] = [], nameBadList: string[] = [];
  for (const gong of TRIGRAMS) for (let k = 0; k < 8; k++) {
    scanned++;
    const bits = gongBits(gong, k);                                   // 初→上
    const xia = TRIGRAM_BY_BITS[bits.slice(0, 3)], shang = TRIGRAM_BY_BITS[bits.slice(3, 6)];
    const vals = bits.split('').map(b => (b === '1' ? 7 : 8));
    const want = goldFor(shang, xia);
    const wantQin = want.map(z => goldLiuQin(gong, z[1]));
    const { shi, ying } = goldShiYing(k);
    const feName = S64[shang + xia] || `?${shang}${xia}`;
    const fe = getNaJia(feName, shang, xia, vals);
    const pan = paiPan(vals as any, GOLD_DATE);
    if (feName !== pan.benGua.name) {
      nameBad++;
      if (nameBadList.length < 6) nameBadList.push(`${gong}宫${k}世 上${shang}下${xia} 前端「${feName}」/ 后端「${pan.benGua.name}」`);
    }
    for (let i = 0; i < 6; i++) {
      cmp++;
      const beGz = pan.yaoList[i].naGan + pan.yaoList[i].naZhi;
      const feMark = fe[i].shiYing || '', beMark = pan.yaoList[i].shiYing || '';
      const wantMark = i + 1 === shi ? '世' : i + 1 === ying ? '应' : '';
      if (fe[i].ganZhi !== want[i] || fe[i].liuQin !== wantQin[i] || feMark !== wantMark) {
        feBad++;
        if (feBadList.length < 8) feBadList.push(`${feName}(${gong}宫)${YAO_NAMES_REF[i]} 前端${fe[i].ganZhi}${fe[i].liuQin}${feMark || '-'}≠金标准${want[i]}${wantQin[i]}${wantMark || '-'}`);
      }
      if (beGz !== want[i] || pan.yaoList[i].liuQin !== wantQin[i] || beMark !== wantMark) {
        beBad++;
        if (beBadList.length < 8) beBadList.push(`${pan.benGua.name}(${gong}宫)${YAO_NAMES_REF[i]} 后端${beGz}${pan.yaoList[i].liuQin}${beMark || '-'}≠金标准${want[i]}${wantQin[i]}${wantMark || '-'}`);
      }
      if (fe[i].ganZhi !== beGz || fe[i].liuQin !== pan.yaoList[i].liuQin || feMark !== beMark) {
        engBad++;
        if (engBadList.length < 8) engBadList.push(`${feName}${YAO_NAMES_REF[i]} 前端${fe[i].ganZhi}${fe[i].liuQin}${feMark || '-'} / 后端${beGz}${pan.yaoList[i].liuQin}${beMark || '-'}`);
      }
    }
    if (feName === '乾为天' || feName === '坤为地') {
      say(`BEFORE/AFTER ${feName} 六爻纳甲：修前复算[${goldOld(shang, xia).join(' ')}] → 金标准[${want.join(' ')}]（实测 4/5/6 爻 = ${fe.slice(3).map(y => y.ganZhi).join(' ')}）`);
    }
  }
  ok('najia/frontend-64x6-vs-golden', scanned === 64 && feBad === 0,
    `前端 getNaJia 对金标准（${scanned} 卦 × 6 爻 = ${cmp} 处，钉干支+六亲+世应）：不符 ${feBad} 处${feBadList.length ? ' 例:' + feBadList.join(' | ') : ''}`);
  ok('najia/backend-64x6-vs-golden', beBad === 0,
    `后端 paiPan 对同一份金标准（同样钉干支+六亲+世应）：${cmp} 处，不符 ${beBad} 处${beBadList.length ? ' 例:' + beBadList.join(' | ') : ''}`);
  ok('najia/two-engines-per-yao', engBad === 0,
    `两引擎逐爻互检（干支+六亲+世应）：${cmp} 处，不符 ${engBad} 处${engBadList.length ? ' 例:' + engBadList.join(' | ') : ''}`);
  ok('najia/gua-name-two-engines', nameBad === 0,
    `64 卦卦名两引擎一致（八宫变爻规则推出的卦 vs 前端 S64 键 / 后端 GUA64 码）：不符 ${nameBad} 例${nameBadList.length ? ' 例:' + nameBadList.join(' | ') : ''}`);
  // 修前后同一张已知盘的 4/5/6 爻对比表（验收要求 五）。「修前」按 goldOld 复算，「修后」取 live 实测，
  // 三列必须 实测 == 金标准 != 修前，防止哪天表被改塌成「修前=修后」或两张表自证。
  const live456 = (shang: string, xia: string) => getNaJia(S64[shang + xia] || '?', shang, xia, [7, 8, 7, 8, 7, 8]).slice(3).map(y => y.ganZhi).join('/');
  const cmpRows: Array<[string, string, string]> = [['乾', '乾', '乾为天'], ['坤', '坤', '坤为地'], ['震', '离', '雷火丰'], ['兑', '震', '泽雷随']];
  let cmpTableBad = 0;
  for (const [shang, xia, name] of cmpRows) {
    const before = goldOld(shang, xia).slice(3).join('/'), after = live456(shang, xia), gold = goldFor(shang, xia).slice(3).join('/');
    if (after !== gold || before === after || before === gold) cmpTableBad++;
    say(`对比表 4/5/6 爻 | ${name} 修前[${before}] → 修后·实测[${after}] → 金标准[${gold}]`);
  }
  ok('najia/compare-table-456', cmpTableBad === 0,
    `对比表四行（乾为天/坤为地/雷火丰/泽雷随）自证：实测 4/5/6 爻 == 金标准 且 != 修前复算，异常 ${cmpTableBad} 行`);
  const qianNow = getNaJia('乾为天', '乾', '乾', [7, 7, 7, 7, 7, 7]).map(y => y.ganZhi).join(' ');
  const kunNow = getNaJia('坤为地', '坤', '坤', [8, 8, 8, 8, 8, 8]).map(y => y.ganZhi).join(' ');
  ok('najia/known-plate-qian-kun',
    qianNow === goldFor('乾', '乾').join(' ') && kunNow === goldFor('坤', '坤').join(' ')
    && goldOld('乾', '乾').join(' ') === '甲子 甲寅 甲辰 壬子 壬寅 壬辰' && goldOld('坤', '坤').join(' ') === '乙未 乙巳 乙卯 癸未 癸巳 癸卯',
    `已知盘逐爻：乾为天 修前[甲子 甲寅 甲辰 壬子 壬寅 壬辰]→现值[${qianNow}]（金标准 4/5/6 = 壬午/壬申/壬戌）；坤为地 修前[乙未 乙巳 乙卯 癸未 癸巳 癸卯]→现值[${kunNow}]（金标准 4/5/6 = 癸丑/癸亥/癸酉）`);
}

// ── 8.10 变卦纳甲对拍（#67 裁定，2026-10-17）──
// 摇卦/报数那份 变卦 上下卦 是自己按位串拼的：bsBits = bv.slice(3) 直接当上卦查 GUA_MAP，
// 但 GUA_MAP 的键是「上→下」读法，slice(3) 是「四→上」初爻在前，两处反了。
// 这里独立复算：本卦爻值 → 动爻翻转 → 下卦=初..三、上卦=四..五..上 → 金标准纳甲，不走被测模块。
function mkDongRecords(bits: string, dong: number) {
  return bits.split('').map((b, i) => {
    const yang = b === '1';
    const v = i + 1 === dong ? (yang ? 9 : 6) : (yang ? 7 : 8);
    return { position: i + 1, coins: [] as any, value: v, label: v === 7 ? '少阳' : v === 8 ? '少阴' : v === 9 ? '老阳' : '老阴', isDong: i + 1 === dong };
  });
}
/** 爻值数组 → 变卦的金标准纳甲（初→上）；翻转位由调用方给定。 */
function goldBianFromBits(bits: string, dong: number) {
  const flip = bits.split(''); flip[dong - 1] = flip[dong - 1] === '1' ? '0' : '1';
  const joined = flip.join('');
  const bXia = TRIGRAM_BY_BITS[joined.slice(0, 3)], bShang = TRIGRAM_BY_BITS[joined.slice(3, 6)];
  return { gz: goldFor(bShang, bXia), name: S64[bShang + bXia] || `?${bShang}${bXia}`, xia: bXia, shang: bShang };
}
{
  let cnt = 0, bad = 0; const badList: string[] = [];
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) for (let dong = 1; dong <= 6; dong++) {
    const bits = TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang];
    const want = goldBianFromBits(bits, dong);
    const r = buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(bits, dong) as any, now: GOLD_DATE });
    cnt++;
    const got = r.bianNaJia.map(y => y.ganZhi);
    const at = got.findIndex((g, i) => g !== want.gz[i]);
    if (got.length !== 6 || at >= 0 || r.bianGua.name !== want.name) {
      bad++;
      if (badList.length < 6) badList.push(`${r.benGua.name}动${dong}→${want.name} 四五六 得[${got.slice(3).join(' ')}] 应[${want.gz.slice(3).join(' ')}]${r.bianGua.name !== want.name ? ` 变卦名${r.bianGua.name}` : ''}`);
    }
  }
  ok('bian-naJia/coin-384-vs-golden', cnt === 384 && bad === 0,
    `摇卦 64 卦 × 6 动爻 = ${cnt} 例变卦纳甲对金标准：不符 ${bad} 例${badList.length ? ' 例:' + badList.join(' | ') : ''}`);
}
// 报数是「两数之和定动爻」：固定一组上下卦后，给任一数加 8 的整倍数不改卦、只把和挪 0/2/4，
// 所以同一卦可达的动爻只有与 (n1+n2) 同奇偶的那三个。六个动爻全覆盖由摇卦那 384 例负责，
// 这里把报数可达的 64×3=192 例全部摊开，别让人以为报数也测到了六个动爻。
const NUM_OFF = [0, 8, 16];
{
  let cnt = 0, bad = 0; const badList: string[] = [];
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) for (const off of NUM_OFF) {
    const r = buildNumberResult({ question: '验收', questionType: '其他', nums: [a, b + off], now: GOLD_DATE });
    const vals = r.yaoRecords.map(y => y.value);
    const bits = vals.map(v => (v % 2 === 1 ? '1' : '0')).join('');
    const dong = r.yaoRecords.findIndex(y => y.isDong) + 1;
    const want = goldBianFromBits(bits, dong);
    cnt++;
    const got = r.bianNaJia.map(y => y.ganZhi);
    if (got.length !== 6 || got.some((g, i) => g !== want.gz[i]) || r.bianGua.name !== want.name) {
      bad++;
      if (badList.length < 6) badList.push(`nums[${a},${b + off}] 动${dong}→${want.name} 四五六 得[${got.slice(3).join(' ')}] 应[${want.gz.slice(3).join(' ')}]`);
    }
  }
  ok('bian-naJia/number-192-vs-golden', cnt === 192 && bad === 0,
    `报数 8×8×3 = ${cnt} 例变卦纳甲对金标准（按盘上爻值独立复算）：不符 ${bad} 例${badList.length ? ' 例:' + badList.join(' | ') : ''}`);
}
{
  // 三种起卦法共用同一个 getNaJia：盘上六爻纳甲必须等于金标准(该盘自己标的上下卦)。
  // 这就是浏览器里要肉眼核对的那件事 —— 同一时刻三张盘，4/5/6 爻的地支得是同一套。
  let cnt = 0, bad = 0; const badList: string[] = [];
  const one = (tag: string, r: { benGua: { name: string; shangGua: string; xiaGua: string }; naJia: { ganZhi: string }[] }) => {
    cnt++;
    const want = goldFor(r.benGua.shangGua, r.benGua.xiaGua);
    const at = r.naJia.findIndex((y, i) => y.ganZhi !== want[i]);
    if (r.naJia.length !== 6 || at >= 0) {
      bad++;
      if (badList.length < 6) badList.push(`${tag}${r.benGua.name} 四五六 得[${r.naJia.slice(3).map(y => y.ganZhi).join(' ')}] 应[${want.slice(3).join(' ')}]`);
    }
  };
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) {
    one('摇卦', buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang], 0) as any, now: GOLD_DATE }));
  }
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
    one('报数', buildNumberResult({ question: '验收', questionType: '其他', nums: [a, b], now: GOLD_DATE }));
  }
  for (let d = 0; d < 24; d++) {
    const dt = new Date(2026, 9, 17); dt.setHours(dt.getHours() + d);
    one('时间', buildTimeResult({ question: '验收', questionType: '其他', date: dt }));
  }
  ok('najia/three-methods-vs-golden', cnt === 152 && bad === 0,
    `三种起卦（摇卦 64 + 报数 64 + 时间连扫 24 小时 = ${cnt} 张盘）盘上纳甲对金标准(本盘上下卦)：不符 ${bad} 例${badList.length ? ' 例:' + badList.join(' | ') : ''}`);
  let stampBad = 0; const stampList: string[] = [];
  const stampOf = (tag: string, v?: string) => { if (v !== NAJIA_BASIS) { stampBad++; if (stampList.length < 3) stampList.push(`${tag}=${v ?? '缺失'}`); } };
  stampOf('coin', buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords('111111', 1) as any, now: GOLD_DATE }).najiaBasis);
  stampOf('number', buildNumberResult({ question: '验收', questionType: '其他', nums: [1, 1], now: GOLD_DATE }).najiaBasis);
  stampOf('time', buildTimeResult({ question: '验收', questionType: '其他', date: GOLD_DATE }).najiaBasis);
  ok('najia/basis-stamp-three-methods', stampBad === 0,
    `三种起卦都写口径版本戳 najiaBasis=${NAJIA_BASIS}（additive，老盘缺此字段只标注不重排）：${stampBad ? '缺/错 ' + stampList.join(',') : '三条路径齐'}`);
}
{
  // #74：纳甲只该由「卦」决定，不该由起卦方式决定。
  // 同一时刻把三种起卦的本卦 + 变卦全部摊开，按卦名聚合：同一个卦名无论从哪种方式、
  // 作为本卦还是变卦出现，盘上的 六亲+干支+五行+世应 必须是同一套，而且这套等于金标准
  // （金标准一侧的上下卦由卦名反查，不看盘自己标的上下卦字段）。
  // 牙齿在「跨方式」这一半：#67 那种位序反转只错在摇卦/报数的变卦上，同一个卦名作为另一张盘
  // 的本卦时是对的 —— 上面各方法各验各的抓不到它，按卦名聚合才抓得到。
  // 空亡不进这个 key：同一时刻旬空相同，跨方式比对里它是常数，钉它得靠 make-fixture 那份推导断言。
  type Row74 = { liuQin: string; ganZhi: string; naZhi: string; shiYing: string };
  const key = (rows: Row74[]) => rows.map(y => `${y.liuQin}${y.ganZhi}${WX_BY_ZHI[y.naZhi]}${y.shiYing || '-'}`).join(' ');
  const byName = new Map<string, Set<string>>();
  const add = (name: string | null, rows: Row74[]) => {
    if (!name || rows.length !== 6) return;
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name)!.add(key(rows));
  };
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) for (let dong = 1; dong <= 6; dong++) {
    const r = buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang], dong) as any, now: GOLD_DATE });
    add(r.benGua.name, r.naJia); add(r.bianGua.name, r.bianNaJia);
  }
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) for (const off of NUM_OFF) {
    const r = buildNumberResult({ question: '验收', questionType: '其他', nums: [a, b + off], now: GOLD_DATE });
    add(r.benGua.name, r.naJia); add(r.bianGua.name, r.bianNaJia);
  }
  for (let d = 0; d < 24; d++) {
    const dt = new Date(2026, 9, 17); dt.setHours(dt.getHours() + d);
    const r = buildTimeResult({ question: '验收', questionType: '其他', date: dt });
    add(r.benGua.name, r.naJia); add(r.bianGua.name, r.bianNaJia);
  }
  const splitBad: string[] = [], goldBad: string[] = [];
  for (const [name, set] of byName) {
    if (set.size > 1) { if (splitBad.length < 4) splitBad.push(`${name} 有 ${set.size} 套值: ${[...set].join(' || ')}`); continue; }
    const t = guaNameToTrigrams(name), gp = goldPlate(t.shang, t.xia);
    const want = key(gp.ganZhi.map((z, i) => ({
      liuQin: gp.liuQin[i], ganZhi: z, naZhi: z[1],
      shiYing: i + 1 === gp.shi ? '世' : i + 1 === gp.ying ? '应' : '',
    })));
    if ([...set][0] !== want && goldBad.length < 4) goldBad.push(`${name} 盘上[${[...set][0]}] ≠ 金标准[${want}]`);
  }
  ok('najia/name-keyed-cross-method', byName.size === 64 && splitBad.length === 0 && goldBad.length === 0,
    `按卦名聚合（摇卦 384 + 报数 192 + 时间 24 张盘的本卦与变卦）：覆盖 ${byName.size}/64 卦，同名跨方式给出多套值的 ${splitBad.length} 例，与金标准(上下卦由卦名反查)不符的 ${goldBad.length} 例${splitBad.length ? ' 分裂:' + splitBad.join(' | ') : ''}${goldBad.length ? ' 对不上:' + goldBad.join(' | ') : ''}`);
}
{
  // D8 裁定（2026-10-18）：报名与爻象必须同源，不许名一套象一套。
  // 修前这份把「先天数序号的二进制」当爻象（乾 idx0→000、坤 idx7→111），既不是该卦的爻形
  // 也没跟着 allBits[5-i] 反转，于是 64/64 全不一致 —— 当时只留 MEASURED 行没敢断言。
  // 现在拿三方对照：卦名经 gold.ts 那张手写象名表读出的上下卦、盘面存的上下卦字段、盘上真画出来的六条爻。
  // 不用 S64 参与判定，否则「名对不对」又变成自己证明自己。
  let nmBad = 0; const nmEx: string[] = [];
  let dongBad = 0; const dongEx: string[] = [];
  let parityBad = 0; const parityEx: string[] = [];
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
    const r = buildNumberResult({ question: '验收', questionType: '其他', nums: [a, b], now: GOLD_DATE });
    const bits = r.yaoRecords.map(y => (y.value % 2 === 1 ? '1' : '0')).join('');   // 初→上
    const t = guaNameToTrigrams(r.benGua.name);
    const wantBits = TRIGRAM_BITS[t.xia] + TRIGRAM_BITS[t.shang];
    if (t.shang !== r.benGua.shangGua || t.xia !== r.benGua.xiaGua || bits !== wantBits) {
      nmBad++;
      if (nmEx.length < 4) nmEx.push(`nums[${a},${b}] 报名「${r.benGua.name}」应为[${wantBits}]（上${t.shang}下${t.xia}），盘面标[${r.benGua.shangGua}/${r.benGua.xiaGua}] 实画[${bits}]`);
    }
    // 取数口径单独钉一遍：动爻 = 两数之和 mod 6（余 0 作 6），不跟着盘上的 isDong 走。
    const want = fullMod(a + b, 6);
    const dong = r.yaoRecords.findIndex(y => y.isDong) + 1;
    if (dong !== want || r.dongYao.length !== 1 || r.dongYao[0] !== want) {
      dongBad++;
      if (dongEx.length < 4) dongEx.push(`nums[${a},${b}] 和${a + b} 应动第${want}爻，盘上动第${dong}爻(dongYao=[${r.dongYao}])`);
    }
    // 「改一处即可」的可证伪版本：六爻盘与本仓库梅花 engine 同一次取数必须给同一张盘。
    const mh = qiGuaByNumbers([a, b], 'number');
    if (r.benGua.name !== mh.ben.name || r.bianGua.name !== mh.bian.name || dong !== mh.dongYao) {
      parityBad++;
      if (parityEx.length < 4) parityEx.push(`nums[${a},${b}] 六爻盘[${r.benGua.name}→${r.bianGua.name} 动${dong}] ≠ 梅花[${mh.ben.name}→${mh.bian.name} 动${mh.dongYao}]`);
    }
  }
  ok('number/name-vs-image-64', nmBad === 0,
    `报数 8×8 = 64 张盘 名与象同源（卦名读出的上下卦 == 盘面上下卦字段 == 盘上爻形）：不符 ${nmBad}/64${nmEx.length ? ' 例:' + nmEx.join(' | ') : ''}`);
  ok('number/dong-from-sum-64', dongBad === 0,
    `报数 64 张盘 动爻 = (第一数 + 第二数) mod 6、余 0 作 6（独立复算，不读引擎）：不符 ${dongBad}/64${dongEx.length ? ' 例:' + dongEx.join(' | ') : ''}`);
  ok('number/qishu-parity-with-meihua', parityBad === 0,
    `报数 64 张盘与本仓库梅花 engine 同源（本卦/变卦/动爻三项全等）：不符 ${parityBad}/64${parityEx.length ? ' 例:' + parityEx.join(' | ') : ''}`);
  // 取数版本戳：吃梅花取数的两条路径（时间 / 报数）都要写，摇卦不吃取数所以不该有。
  // 老盘不重排（A4）靠这个戳认口径：修前的报数盘两个干支/纳甲戳齐全，只有它认得出来。
  const qishuOf = (r: { qiShu?: { version?: string } }) => r.qiShu?.version ?? '缺失';
  const stampBad: string[] = [];
  const numQs = buildNumberResult({ question: '验收', questionType: '其他', nums: [1, 1], now: GOLD_DATE });
  const timeQs = buildTimeResult({ question: '验收', questionType: '其他', date: GOLD_DATE });
  if (qishuOf(numQs) !== QISHU_BASIS) stampBad.push(`number=${qishuOf(numQs)}`);
  if (qishuOf(timeQs) !== QISHU_BASIS) stampBad.push(`time=${qishuOf(timeQs)}`);
  const coinNoQiShu = buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords('111111', 1) as any, now: GOLD_DATE }).qiShu;
  if (coinNoQiShu) stampBad.push('coin 不该有 qiShu（摇卦无取数）');
  ok('qishu/stamp-number-time', stampBad.length === 0,
    `两条吃梅花取数的路径都写取数版本戳 qiShu.version=${QISHU_BASIS}（摇卦不吃取数，无此字段）：${stampBad.length ? stampBad.join(' | ') : '齐'}`);
}
{
  // #67 单独计数（不含 #66 的叠算），回答「288 还是 384」：按旧写法 bv.slice(3) 直查 GUA_MAP 复算一遍上下卦。
  // 乾111/坤000/离101/坎010 位序反转后等于自己，兑110↔巽011、震100↔艮001 会互换 —— 所以只有一半不到的例数认错。
  let cnt = 0, oldBad = 0; const ex: string[] = [];
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) for (let dong = 1; dong <= 6; dong++) {
    const bits = TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang];
    const vals = bits.split('').map((b, i) => (i + 1 === dong ? (b === '1' ? 9 : 6) : (b === '1' ? 7 : 8)));
    const bv = vals.map(v => (v === 9 ? 8 : v === 6 ? 7 : v));
    const asc = bv.map(v => (v % 2 === 1 ? '1' : '0'));
    const oldShang = GUA_MAP[asc.slice(3).join('')] || '?';        // 旧写法：四爻在前的串拿去查「上爻在前」的键
    const oldXia = GUA_MAP[asc.slice(0, 3).join('')] || '?';
    const want = goldBianFromBits(bits, dong);
    cnt++;
    if (oldShang !== want.shang || oldXia !== want.xia) {
      oldBad++;
      if (ex.length < 4) ex.push(`${S64[shang + xia]}动${dong} 旧认作 上${oldShang}/下${oldXia}，应是 上${want.shang}/下${want.xia}`);
    }
  }
  say(`MEASURED #67 认错上下卦单独计数：${oldBad}/${cnt}（与 #66 叠算后变卦纳甲不符 384/${cnt}）${ex.length ? ' 例:' + ex.join(' | ') : ''}`);
}

// ── 8.11 报告层世应（#68 裁定，2026-10-17）──
// 改前的前置检查结果（写进报告，不动手改之前先给证据）：
//   git grep -ln "contextBuilder|buildReportContext" -- 'tools/**' → 空，即 #43/A5 那套验收从未覆盖这条 builder；
//   live 路径 = frontend/app/api/liuyao/report/route.ts:21 buildReportContext(result, analysis)，由结果页 fetch 调用；
//   真实文件 = frontend/lib/liuyao/report/contextBuilder.ts（不是 frontend/lib/report/）。
{
  let cnt = 0, bad = 0; const badList: string[] = [];
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) {
    const bits = TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang];
    const plate = buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(bits, 0) as any, now: GOLD_DATE });
    const an = analyzeLiuyao(plate);
    const ctx = buildReportContext(plate, an);
    const p = an.shiYing!;
    const sYao = plate.naJia.find(y => y.position === p.shiPosition)!;
    const yYao = plate.naJia.find(y => y.position === p.yingPosition)!;
    cnt++;
    const badRow =
      !ctx.shiYing.shiGanZhi || !ctx.shiYing.yingGanZhi ||
      ctx.shiYing.shiGanZhi !== sYao.ganZhi || ctx.shiYing.yingGanZhi !== yYao.ganZhi ||
      ctx.shiYing.shiLabel !== YAO_NAMES_REF[p.shiPosition - 1] || ctx.shiYing.yingLabel !== YAO_NAMES_REF[p.yingPosition - 1] ||
      ctx.shiYing.shiPosition !== p.shiPosition || ctx.shiYing.yingPosition !== p.yingPosition;
    if (badRow) {
      bad++;
      if (badList.length < 6) badList.push(`${plate.benGua.name} 世${p.shiPosition} 报[${ctx.shiYing.shiPosition}/${ctx.shiYing.shiLabel || '空'}/${ctx.shiYing.shiGanZhi || '空'}] 盘[${p.shiPosition}/${YAO_NAMES_REF[p.shiPosition - 1]}/${sYao.ganZhi}]`);
    }
  }
  ok('report/shiying-ganzhi-nonempty', cnt === 64 && bad === 0,
    `报告层 64 卦：世/应干支非空且与盘面逐爻相等、爻名按 position-1、position 透传不再 +1，不符 ${bad} 例${badList.length ? ' 例:' + badList.join(' | ') : ''}`);
}

// ── 8.12 报告层五行（裁定 2，2026-10-18）──
// 改前实况：contextBuilder.ts 的 wangShuai[].wuxing 填的是 nj?.naZhi，也就是地支本身；
// 同时 promptBuilder 的「旺衰」块只渲染 "地支" 不渲染 "五行"，所以这个错值既没进 AI 上下文、
// 也没有任何断言守着 —— 属于「字段名承诺五行、值里装地支」这一类，不是个案。断言因此做两层：
//   a) 逐爻：wuxing 必须 ∈ 五行枚举、必须等于金标准 WX_BY_ZHI[该爻地支]、且不得等于地支本身；
//   b) 整份 prompt：凡 "五行":"…" 的位置（本卦/变卦/世/应/用神/旺衰）都不许出现地支或空值，
//      这样换个字段复发同一类缺陷也会被抓住。裁判表用 gold.ts 的 WX_BY_ZHI（手写，不 import 被测的 core WX）。
{
  const WUXING = ['木', '火', '土', '金', '水'];
  const ZHI = Object.keys(WX_BY_ZHI);
  let cnt = 0, bad = 0; const badList: string[] = [];
  let pCnt = 0, pBad = 0; const pList: string[] = [];
  const feed = (tag: string, plate: ReturnType<typeof buildCoinResult>) => {
    const ctx = buildReportContext(plate, analyzeLiuyao(plate));
    ctx.wangShuai.forEach((w, i) => {
      const y = plate.naJia[i];
      cnt++;
      if (!y || w.position !== y.position || w.zhi !== y.naZhi ||
          !ZHI.includes(w.zhi) || !WUXING.includes(w.wuxing) ||
          w.wuxing !== WX_BY_ZHI[w.zhi] || w.wuxing === w.zhi) {
        bad++;
        if (badList.length < 6) badList.push(`${tag}${plate.benGua.name}/${w.label} 报[支=${w.zhi}行=${w.wuxing}] 应[支=${y?.naZhi}行=${y ? WX_BY_ZHI[y.naZhi] : '?'}]`);
      }
    });
    for (const m of buildReportPrompt(ctx).matchAll(/"五行":"([^"]*)"/g)) {
      pCnt++;
      if (!WUXING.includes(m[1])) {
        pBad++;
        if (pList.length < 6) pList.push(`${tag}${plate.benGua.name} 五行="${m[1]}"`);
      }
    }
  };
  for (const shang of TRIGRAMS) for (const xia of TRIGRAMS) {
    const bits = TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang];
    feed('摇', buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(bits, 0) as any, now: GOLD_DATE }));
    feed('摇动', buildCoinResult({ question: '验收', questionType: '其他', records: mkDongRecords(bits, 3) as any, now: GOLD_DATE }));
  }
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
    feed('数', buildNumberResult({ question: '验收', questionType: '其他', nums: [a, b], now: GOLD_DATE }));
  }
  for (let d = 0; d < 24; d++) {
    const dt = new Date(2026, 9, 17); dt.setHours(dt.getHours() + d);
    feed('时', buildTimeResult({ question: '验收', questionType: '其他', date: dt }));
  }
  ok('report/wangshuai-wuxing-vs-golden', cnt === 6 * (64 * 2 + 64 + 24) && bad === 0,
    `报告层旺衰逐爻五行对金标准 WX_BY_ZHI：${cnt} 爻（摇卦 64 静 + 64 动三爻 + 报数 64 + 时间 24），不符 ${bad} 例${badList.length ? ' 例:' + badList.join(' | ') : ''}`);
  ok('report/prompt-wuxing-all-in-enum', pCnt > 0 && pBad === 0,
    `整份 AI prompt 里 ${pCnt} 处 "五行" 取值全部 ∈ 五行枚举（本卦/变卦/世/应/用神/旺衰一起查）：违例 ${pBad} 处${pList.length ? ' 例:' + pList.join(' | ') : ''}`);
}

// ── 10. 裁定 ④：变卦的每一爻都得有六亲（功能本来就在，这条是把它钉住，不是补功能）──
// 结果页那一行 `dy.before.liuQin → 变 dy.after.liuQin` 里 after 是可空的：
// `analyzeDongYao` 用 `bianNaJia.find(...)` 找不到就给 null，而 `wuxing: WX[..] || '?'`
// 又是一个会安静落地的兜底。两种情况都不会报错，页面上就是"变那一截少了点什么"。
{
  const LIU_QIN = ['兄弟', '父母', '妻财', '官鬼', '子孙'];
  const isLiuQin = (v: unknown) => typeof v === 'string' && (LIU_QIN as string[]).includes(v);
  // 动爻花样：单动（初/四）、隔位双动、全动 —— 全动那张会把六爻全部翻掉，变卦与本卦完全不同宫。
  const PATTERNS: number[][] = [[1], [4], [2, 5], [1, 4], [1, 2, 3, 4, 5, 6]];
  const mk = (bits: string, dong: number[]) => bits.split('').map((b, i) => {
    const yang = b === '1', isDong = dong.includes(i + 1);
    // 老阳 9 动而之阴，老阴 6 动而之阳；不动的就是 7 / 8。
    const value = isDong ? (yang ? 9 : 6) : (yang ? 7 : 8);
    return { position: i + 1, coins: [] as any, value, label: String(value), isDong };
  });

  let plates = 0, platesWithBian = 0, yaoChecked = 0;
  const bad: string[] = [];
  for (const xia of XIAN_TIAN_BITS) {
    for (const shang of XIAN_TIAN_BITS) {
      const bits = xia + shang;
      for (const dong of PATTERNS) {
        const plate = buildCoinResult({ question: '验收', questionType: '其他', records: mk(bits, dong) as any, now: tsSample });
        plates++;
        const an = analyzeLiuyao(plate);
        const bian = plate.bianNaJia as { position: number; liuQin: string; ganZhi: string; naZhi: string }[];
        if (bian.length) platesWithBian++;
        // 1) 变卦必须是六爻齐全的一整张盘，不是只有动的那几爻
        if (bian.length !== 6) bad.push(`${bits}动${dong.join('')}：bianNaJia ${bian.length} 爻`);
        // 2) 每一爻都要有六亲、有干支，五行不许落到 '?' 兜底
        for (const b of bian) {
          yaoChecked++;
          if (!isLiuQin(b.liuQin)) bad.push(`${bits}动${dong.join('')} 第${b.position}爻 六亲=${JSON.stringify(b.liuQin)}`);
          if (!b.ganZhi || b.ganZhi.length < 2) bad.push(`${bits}动${dong.join('')} 第${b.position}爻 干支=${JSON.stringify(b.ganZhi)}`);
        }
        // 3) 每一个动爻都要有"变"那一截，且与整张变卦那一爻逐字相同
        if (an.dongYao.length !== dong.length) bad.push(`${bits}动${dong.join('')}：dongYao ${an.dongYao.length} 条，应为 ${dong.length}`);
        for (const dy of an.dongYao) {
          if (!dy.after) { bad.push(`${bits}动${dong.join('')} 第${dy.position}爻 after=null（页面上"变"那一截整块不出现）`); continue; }
          if (!isLiuQin(dy.after.liuQin)) bad.push(`${bits} 第${dy.position}爻 after.liuQin=${JSON.stringify(dy.after.liuQin)}`);
          if (dy.after.wuxing === '?') bad.push(`${bits} 第${dy.position}爻 after.wuxing 落到 '?' 兜底（naZhi=${(dy.after as any).naZhi}）`);
          const row = bian.find(x => x.position === dy.position);
          if (row && (dy.after.liuQin !== row.liuQin || dy.after.ganZhi !== row.ganZhi))
            bad.push(`${bits} 第${dy.position}爻 动爻摘要与变卦那一爻不一致 ${dy.after.liuQin}${dy.after.ganZhi} vs ${row.liuQin}${row.ganZhi}`);
        }
      }
    }
  }
  // 前提：这批扫描真的产出过带变卦的盘。全是静卦的话上面三条会一条都不触发，绿灯是假的。
  ok('dong/bian-plates-actually-produced', plates === 64 * PATTERNS.length && platesWithBian === plates,
    `${plates} 张盘都要带得出变卦（实得 ${platesWithBian} 张）—— 带不出就是这批扫描本身没测到那一支`);
  ok('dong/bian-liuQin-every-line', bad.length === 0,
    `变卦每一爻都有六亲∈${LIU_QIN.join('/')}、有干支、五行不落 '?'，且每个动爻的"变"那一截与整张变卦逐字对齐：`
    + `查了 ${plates} 张盘 / ${yaoChecked} 个变爻，违例 ${bad.length} 条${bad.length ? ' 例:' + bad.slice(0, 4).join(' | ') : ''}`);
  // 反向前提：静卦那一支也必须真的没有变卦，否则上面的"全都有"可能是因为根本没有不动的盘
  const stillPlate = buildCoinResult({ question: '验收', questionType: '其他', records: mk('111111', []) as any, now: tsSample });
  const stillAn = analyzeLiuyao(stillPlate);
  ok('dong/still-plate-has-no-bian', stillPlate.bianNaJia.length === 0 && stillAn.dongYao.length === 0,
    `全静的一张：bianNaJia ${stillPlate.bianNaJia.length} 爻、dongYao ${stillAn.dongYao.length} 条，都应为 0（这一条不成立说明起卦层把不动的爻也当动爻）`);
}

// ── 9. 控制台摘要（ASCII）──
const summary = `liuyao ganzhi acceptance: days=${days} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
