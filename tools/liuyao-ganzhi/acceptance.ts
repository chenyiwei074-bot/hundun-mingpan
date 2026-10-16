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
  const copy = dateToGanZhi(dt);           // app/lib/core 同源副本（后端那份的镜像）
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

// ── 8. 控制台摘要（ASCII）──
const summary = `liuyao ganzhi acceptance: days=${days} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
