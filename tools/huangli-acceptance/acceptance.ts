// 黄历宜忌验收：这一页没有自己的算法，所以验收的对象是「它有没有偷偷长出第二份历法」
// 和「报给用户的每一个字都出自通书规则」这两件事。
//
// 用法（tsx 在 server/node_modules 下，@/* 别名要显式指认 frontend/tsconfig.json）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/huangli-acceptance/acceptance.ts --out=.huangli.txt
// 裁判表一律手写（建除十二神、黄黑道六黄道归属），不拿被测的 lunar-typescript 自证。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Lunar } from 'lunar-typescript';
import { queryHuangli, queryHuangliRange } from '../../frontend/lib/huangli/engine';
import { getDayGanZhi } from '../../frontend/lib/liuyao/core/calcGanZhi';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.huangli.txt';

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};
const push = (list: string[], cap: number, s: string) => { if (list.length < cap) list.push(s); };

// 与站点同日取数：正午锚定，避开子时换日与夏令时。
const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0);

// 1901-01-01…2099-12-31 全量逐日。必须是年/月/日嵌套枚举：
// 用 setDate 步进会在每个夏令时切换点多跳或重复一天（六爻批次实测过，72,684 才对）。
const days: { y: number; m: number; d: number }[] = [];
for (let y = 1901; y <= 2099; y++) {
  for (let m = 1; m <= 12; m++) {
    const last = new Date(y, m, 0).getDate();
    for (let d = 1; d <= last; d++) days.push({ y, m, d });
  }
}

// ── 手写裁判表（《协纪辨方书》通行口径）：建除十二神次序、黄黑道六黄道归属 ──
const ZHIXING_12 = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];
const HUANGDAO_6 = ['青龙', '明堂', '金匮', '天德', '玉堂', '司命'];
const HEIDAO_6 = ['天刑', '朱雀', '白虎', '天牢', '玄武', '勾陈'];
const SHA4 = ['东', '南', '西', '北'];
// 喜/财/福/阳贵/阴贵五方由八字引擎给的是「正北 / 东北 / 西南」一类复合方位，
// 实测 1901-2099 的取值域就是下面 12 个；写成八方会把「正北」判成违例（本条第一版就踩了）。
const DIRS = ['东', '南', '西', '北', '东南', '东北', '西南', '西北', '正东', '正南', '正西', '正北'];
const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// ── 1–4 单趟全量扫描：宜忌性质 + 干支双路互检 + 值宿同源 + 枚举 census ──
const c = {
  emptyYi: 0, emptyJi: 0, badWord: 0, overlap: 0,
  dayBad: 0, yearBad: 0, monthBad: 0, yearDayDiff: 0, yearDiffNotLichun: 0, monthDayDiff: 0, monthDiffNotJie: 0,
  xiuBad: 0, zhiBad: 0, daoBad: 0, luckBad: 0, shaBad: 0, posBad: 0, xiuLuckBad: 0, kongBad: 0, nayinBad: 0,
  zhu: 0, yuShu: 0, wu: 0,
};
const ex: Record<string, string[]> = {
  overlap: [], badWord: [], day: [], year: [], month: [], xiu: [], dao: [], zhi: [], pos: [], kong: [],
};
for (const x of days) {
  const h = queryHuangli(x.y, x.m, x.d);
  const lu = Lunar.fromDate(noon(x.y, x.m, x.d));

  if (!h.yi.length) c.emptyYi++;
  if (!h.ji.length) c.emptyJi++;
  for (const v of [...h.yi, ...h.ji]) {
    if (typeof v !== 'string' || !v || v === 'undefined' || v === 'null') { c.badWord++; push(ex.badWord, 4, `${h.civil} 词条非法[${String(v)}]`); }
  }
  const both = h.yi.filter(v => h.ji.includes(v));
  if (both.length) { c.overlap++; push(ex.overlap, 4, `${h.civil} 既宜又忌[${both.join('、')}]`); }
  if (h.ji.includes('诸事不宜')) c.zhu++;
  if (h.yi.includes('馀事勿取')) c.yuShu++;
  if (h.ji.length === 1 && h.ji[0] === '无') c.wu++;

  // 口径分叉可见化：本页年/月柱按交节「瞬时」（与本站四柱同源），印本通书多按「当日即换」。
  // 两者的差只允许出现在节气当天；出现在别处说明正午锚点被改坏了。
  if (lu.getYearInGanZhiExact() !== lu.getYearInGanZhiByLiChun()) {
    c.yearDayDiff++;
    if (lu.getJieQi() !== '立春') { c.yearDiffNotLichun++; push(ex.year, 4, `${h.civil} 两种年柱口径不同而今日非立春（今日节气[${lu.getJieQi() || '无'}]）`); }
  }
  if (lu.getMonthInGanZhiExact() !== lu.getMonthInGanZhi()) {
    c.monthDayDiff++;
    if (!lu.getJieQi()) { c.monthDiffNotJie++; push(ex.month, 4, `${h.civil} 两种月柱口径不同而今日非节气`); }
  }

  if (h.ganZhi.day !== lu.getDayInGanZhi()) { c.dayBad++; push(ex.day, 4, `${h.civil} 本站${h.ganZhi.day} vs 引擎${lu.getDayInGanZhi()}`); }
  // 年/月柱必须等于本站干支层所用的「交节瞬时」口径；与「当日即换」的印本口径之差
  // 只允许出现在立春日 / 节气日 —— 出现在别的日子才说明锚点写错了。
  if (h.ganZhi.year !== lu.getYearInGanZhiExact()) { c.yearBad++; push(ex.year, 4, `${h.civil} 本站${h.ganZhi.year} vs 交节瞬时口径${lu.getYearInGanZhiExact()}`); }
  if (h.ganZhi.month !== lu.getMonthInGanZhiExact()) { c.monthBad++; push(ex.month, 4, `${h.civil} 本站${h.ganZhi.month} vs ${lu.getMonthInGanZhiExact()}`); }

  if (h.xiu.xiu !== lu.getXiu()) { c.xiuBad++; push(ex.xiu, 4, `${h.civil} 宿引擎「${h.xiu.xiu}」 vs 八字引擎「${lu.getXiu()}」`); }
  if (h.xiu.fullName.indexOf(h.xiu.xiu) !== 0) { c.xiuBad++; push(ex.xiu, 4, `${h.civil} 宿全名「${h.xiu.fullName}」与单字「${h.xiu.xiu}」不同源`); }

  if (!ZHIXING_12.includes(h.zhiXing)) { c.zhiBad++; push(ex.zhi, 4, `${h.civil} 建除[${h.zhiXing}]`); }
  const daoStd = HUANGDAO_6.includes(h.tianShen.name) ? '黄道' : HEIDAO_6.includes(h.tianShen.name) ? '黑道' : null;
  if (!daoStd || daoStd !== h.tianShen.dao) { c.daoBad++; push(ex.dao, 4, `${h.civil} ${h.tianShen.name} 标${h.tianShen.dao} 标准应${daoStd ?? '不在十二神'}`); }
  if (h.tianShen.luck !== '吉' && h.tianShen.luck !== '凶') c.luckBad++;
  if (h.xiu.luck !== '吉' && h.xiu.luck !== '凶') { c.xiuLuckBad++; push(ex.xiu, 4, `${h.civil} 宿吉凶[${h.xiu.luck}]`); }
  if (!SHA4.includes(h.sha)) { c.shaBad++; push(ex.pos, 4, `${h.civil} 煞方[${h.sha}]`); }
  for (const v of Object.values(h.positions)) if (!DIRS.includes(v)) { c.posBad++; push(ex.pos, 4, `${h.civil} 方位[${v}]`); }
  if (h.xunKong.length !== 2 || !h.xunKong.split('').every(k => ZHI12.includes(k))) { c.kongBad++; push(ex.kong, 4, `${h.civil} 旬空[${h.xunKong}]`); }
  if (!h.naYin || h.naYin.length < 3) c.nayinBad++;
}

ok('huangli/sweep-days-72684', days.length === 72684,
  `枚举覆盖 1901-01-01…2099-12-31 共 ${days.length} 天（嵌套枚举，非 setDate 步进）`);
ok('huangli/yi-ji-nonempty', c.emptyYi === 0 && c.emptyJi === 0 && c.badWord === 0,
  `逐日宜/忌均非空且词条合法：宜空 ${c.emptyYi} 天、忌空 ${c.emptyJi} 天、非法词条 ${c.badWord} 处${ex.badWord.length ? ' 例:' + ex.badWord.join(' | ') : ''}`);
ok('huangli/yi-ji-disjoint', c.overlap === 0,
  `同一日「既宜又忌」：${c.overlap} 天${ex.overlap.length ? ' 例:' + ex.overlap.join(' | ') : ''}（通书规则不应自相矛盾）`);
ok('huangli/day-ganzhi-cross-engine', c.dayBad === 0,
  `${days.length} 天日柱与八字引擎 getDayInGanZhi 逐日相等（本站走 calcGanZhi 这条独立路径，两者不同源实现）：不符 ${c.dayBad} 天${ex.day.length ? ' 例:' + ex.day.join(' | ') : ''}`);
ok('huangli/year-ganzhi-jiaojie-instant', c.yearBad === 0,
  `年柱恒等于本站干支层所用的交节瞬时口径 getYearInGanZhiExact（不另立年界、不改成当日即换）：不符 ${c.yearBad} 天${ex.year.length ? ' 例:' + ex.year.join(' | ') : ''}`);
ok('huangli/year-divergence-only-on-lichun', c.yearDiffNotLichun === 0,
  `与「立春当日即换」印本口径的分叉（实测 ${c.yearDayDiff} 天）必须全部落在立春日：非立春日分叉 ${c.yearDiffNotLichun} 天${ex.year.length ? ' 例:' + ex.year.join(' | ') : ''}`);
ok('huangli/month-divergence-only-on-jie', c.monthDiffNotJie === 0,
  `与「节气当日即换」口径的分叉（实测 ${c.monthDayDiff} 天）必须全部落在节气日：非节气日分叉 ${c.monthDiffNotJie} 天${ex.month.length ? ' 例:' + ex.month.join(' | ') : ''}`);
ok('huangli/month-ganzhi-jieqi', c.monthBad === 0,
  `月柱恒等于节气口径 getMonthInGanZhiExact：不符 ${c.monthBad} 天${ex.month.length ? ' 例:' + ex.month.join(' | ') : ''}`);
ok('huangli/xiu-single-source', c.xiuBad === 0,
  `值日宿与 lib/xiu/engine 及八字引擎 getXiu() 逐日一致（黄历不抄第三份宿表）：不符 ${c.xiuBad} 例${ex.xiu.length ? ' 例:' + ex.xiu.join(' | ') : ''}`);
ok('enum/zhiXing-12', c.zhiBad === 0, `建除十二神恒在手写表「${ZHIXING_12.join('')}」内：违例 ${c.zhiBad}${ex.zhi.length ? ' 例:' + ex.zhi.join(' | ') : ''}`);
ok('enum/tianShen-huanghei', c.daoBad === 0,
  `黄黑道归属逐日与手写《协纪辨方书》六黄道表相符（${HUANGDAO_6.join('/')}为黄道，${HEIDAO_6.join('/')}为黑道）：违例 ${c.daoBad}${ex.dao.length ? ' 例:' + ex.dao.join(' | ') : ''}`);
ok('enum/luck-binary', c.luckBad === 0 && c.xiuLuckBad === 0, `天神吉凶、值宿吉凶只出「吉/凶」：违例 ${c.luckBad + c.xiuLuckBad}`);
ok('enum/sha-and-positions', c.shaBad === 0 && c.posBad === 0,
  `煞方 ∈ {东南西北}、喜/财/福/阳贵/阴贵五方 ∈ 八方：违例 ${c.shaBad + c.posBad}${ex.pos.length ? ' 例:' + ex.pos.join(' | ') : ''}`);
ok('enum/xunkong-and-nayin', c.kongBad === 0 && c.nayinBad === 0,
  `旬空恒为两地支、纳音非空：违例 ${c.kongBad + c.nayinBad}${ex.kong.length ? ' 例:' + ex.kong.join(' | ') : ''}`);
say(`MEASURED 通书原话覆盖：忌含「诸事不宜」${c.zhu} 天、宜含「馀事勿取」${c.yuShu} 天、忌仅作「无」${c.wu} 天 —— 原样上屏，页面不改写`);
say(`MEASURED 年界口径分叉规模：与印本「当日即换」相比，年柱 ${c.yearDayDiff}/72684 天不同、月柱 ${c.monthDayDiff}/72684 天不同，全部落在立春/节气当日 —— 本页以正午代表该日，交节在午后则当天仍属上一柱，已写进取值口径，不静默改口径`);

// ── 5. 边界：年界、闰月、节气日、节日、夏令时、跨年 ──
{
  const cases: { civil: string; want: (h: ReturnType<typeof queryHuangli>) => boolean; note: string }[] = [
    { civil: '2024-02-03', want: h => h.ganZhi.year === '癸卯', note: '立春前仍属上一年柱' },
    { civil: '2022-02-04', want: h => h.ganZhi.year === '壬寅', note: '立春交节 04:50 早于正午 → 当日即换新柱' },
    { civil: '2024-02-04', want: h => h.ganZhi.year === '癸卯', note: '立春交节 16:27 晚于正午 → 当日仍属上一年柱（正午锚定的后果，已写进取值口径）' },
    { civil: '2025-07-25', want: h => h.lunarMonth === '闰六月', note: '2025 闰六月初一' },
    { civil: '2025-08-22', want: h => h.lunarMonth === '闰六月', note: '闰六月末日' },
    { civil: '2026-10-18', want: h => h.festivals.includes('重阳节'), note: '九月初九重阳在农历节日里' },
    { civil: '2026-10-01', want: h => h.solarFestivals.length > 0, note: '公历节日走 Solar.getFestivals，不与农历节日混列' },
    { civil: '2026-10-23', want: h => h.jieQiToday === '霜降', note: '节气当日标节气' },
    { civil: '1986-05-04', want: h => { const g = getDayGanZhi(noon(1986, 5, 4)); return h.ganZhi.day === `${g.gan}${g.zhi}`; }, note: '中国 1986 夏令时起手日，正午锚定不受时钟前跳影响' },
    { civil: '2026-12-31', want: h => (h.nextJieQi?.name ?? '') === '小寒' && h.nextJieQi.offsetDays > 0, note: '跨年后的下一个节气仍可算' },
  ];
  let bad = 0; const list: string[] = [];
  for (const cc of cases) {
    const [y, m, d] = cc.civil.split('-').map(Number);
    const h = queryHuangli(y, m, d);
    if (!cc.want(h)) { bad++; list.push(`${cc.civil}(${cc.note})`); }
  }
  ok('boundary/ten-cases', bad === 0,
    `十条边界（立春换柱 3、闰六月 2、节日 2、节气 1、夏令时 1、跨年 1）：不符 ${bad}${list.length ? ' 例:' + list.join(' | ') : ''}`);

  // 2026 全年无闰月，所以「闰」字这一年一次都不该出现；这条专门防把闰标签写反。
  let leapIn2026 = 0;
  for (let i = 0; i < 365; i++) {
    const dt = new Date(2026, 0, 1 + i, 12, 0);
    const h = queryHuangli(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    if (h.lunarMonth.indexOf('闰') === 0) leapIn2026++;
  }
  ok('boundary/no-leap-month-in-2026', leapIn2026 === 0,
    `2026 全年 365 天里带「闰」的农历月名应为 0（闰六月在 2025），实测 ${leapIn2026}`);
}

// ── 6. 速览条与幂等 ──
{
  const center = { y: 2026, m: 10, d: 18 };
  const range = queryHuangliRange(center, 5, 5);
  let contig = true;
  for (let i = 1; i < range.length; i++) {
    const [py, pm, pd] = range[i - 1].civil.split('-').map(Number);
    const [cy, cm, cd] = range[i].civil.split('-').map(Number);
    if (Math.round((Number(noon(cy, cm, cd)) - Number(noon(py, pm, pd))) / 86400000) !== 1) contig = false;
  }
  ok('range/eleven-contiguous', range.length === 11 && contig && range[5].civil === '2026-10-18',
    `前后各 5 天共 ${range.length} 项、日历日连续无跳、第 6 项即本日为锚点：${range[0].civil}…${range[range.length - 1].civil}`);
  ok('range/idempotent', JSON.stringify(queryHuangli(2026, 10, 18)) === JSON.stringify(queryHuangli(2026, 10, 18)),
    '同一日两次取值逐字节相同（无 Date.now / 随机数 / 环境依赖）');
  const steps = queryHuangli(2026, 10, 18).steps;
  const basis = queryHuangli(2026, 10, 18).basis;
  ok('range/steps-and-basis-present', steps.length >= 6 && basis.length >= 5 && basis.some(b => b.includes('lunar-typescript')),
    `取数过程 ${steps.length} 步、取值口径 ${basis.length} 条且写明算法来源：${steps.length}/${basis.length}`);
}

// ── 7. 单源护栏：黄历目录里不许出现第二份历法，也不许出现自研评分 ──
{
  const enginePath = join(__dirname, '../../frontend/lib/huangli/engine.ts');
  const pagePath = join(__dirname, '../../frontend/app/huangli/page.tsx');
  let engine = '';
  let page = '';
  try { engine = readFileSync(enginePath, 'utf8'); } catch { /* 缺文件 → 下面判失败 */ }
  try { page = readFileSync(pagePath, 'utf8'); } catch { /* 缺文件 → 下面判失败 */ }
  const both = engine + '\n' + page;
  ok('source/both-files-present', engine.length > 0 && page.length > 0,
    `两份被测文件都在（engine ${engine.length}B，page ${page.length}B）—— 缺任一份本节不能空过`);
  const lunarInPage = /lunar-typescript/.test(page);
  ok('source/no-second-engine-in-page', !lunarInPage && page.length > 0,
    `页面不得直接 import lunar-typescript（否则能在组件里现算一套宜忌绕开引擎）：命中 ${Number(lunarInPage)}`);
  const ganzhiTable = /['"]甲['"]\s*,\s*['"]乙['"]/.test(both) || /['"]子['"]\s*,\s*['"]丑['"]/.test(both);
  const yijiTable = /\b(const|let)\s+(YI|JI|YIJI|SHENSHA|TIANSHEN|ZHIXING)\w*\s*[:=]/.test(both);
  ok('source/no-local-ganzhi-or-yiji-table', !ganzhiTable && !yijiTable && both.length > 0,
    `黄历两处不得出现干支表或宜忌表字面量：干支表 ${Number(ganzhiTable)}、宜忌表 ${Number(yijiTable)}`);
  // 结构判定而不是文案判定：本站的免责声明里就写着「不自建吉凶评分」，用正则扫文案会自己咬自己。
  const numericKeys = Object.entries(queryHuangli(2026, 10, 18) as unknown as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number').map(([k]) => k);
  const inventedLabel = /倾向指数|打分|吉凶指数/.test(page);
  ok('source/no-self-invented-scoring', numericKeys.length === 0 && !inventedLabel,
    `黄历输出里不得有顶层数值字段（评分/权重一旦加进来就会先在这里露形迹），页面也不得出现打分文案：数值字段 [${numericKeys.join(',')}]、打分文案 ${Number(inventedLabel)}`);
  const reuses = /from '@\/lib\/liuyao\/core\/calcGanZhi'/.test(engine) && /from '@\/lib\/xiu\/engine'/.test(engine) && /GANZHI_BASIS/.test(engine);
  ok('source/reuses-sanctioned-wrappers', reuses,
    '引擎必须显式复用站里干支层与宿引擎，并把口径戳 GANZHI_BASIS 带到界面上');
  const dayBoundary = /dayBoundaryMode|MIDNIGHT|ZI_HOUR/.test(both);
  ok('source/no-zi-hour-switch', !dayBoundary,
    `黄历按公历日历日取数，不许引入夜子时开关（那是盘类功能的口径，混进来会让同一天有两份宜忌）：命中 ${Number(dayBoundary)}`);
}

const summary = `huangli acceptance: days=${days.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
