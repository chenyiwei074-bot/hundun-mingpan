// 人生K线验收（#41，A 案：类别轴）。这一层要守的是「只摆事实、不造方向」，
// 所以断言围绕五件事：泳道是固定十条且一段都不许少；十神全部可回指到盘面同一张表；
// 输出对象一层数值字段都不能有（年份走字符串）；吉凶/评分那类词一个不出现；
// 事件只能来自用户输入，落点（合冲）必须显式写着"本批未接"。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/kline-acceptance/acceptance.ts --out=.kline.txt
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// 引用判据要连字面量一起剥（tools/_lib/codesrc.ts）；其余文本判据用本档的 strip() 剥注释。
import { stripLiterals } from '../_lib/codesrc';
import { unvettedDeps } from '../_lib/vettedDeps';
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import { getZhiCangGanFull } from '../../frontend/app/lib/core/yiqi-core/bazi';
import { getShiShen, DIZHI } from '../../frontend/app/lib/core/bazi-enrich/tables';
import { zhiPairRelations } from '../../frontend/app/lib/core/bazi-enrich/zhi-relations';
import { SHISHEN_MAP } from '../../frontend/app/lib/core/yiqi-core/ganzhi';
import { getNaYin, getNaYinWuXing } from '../../frontend/app/lib/core/yiqi-core/nayin';
import type { BaziChart } from '../../frontend/app/lib/core/yiqi-core/types';
import { TOOL_BY_SLUG } from '../../frontend/lib/tools/catalog';
import {
  buildKline, eventLabel, KLINE_BASIS, KLINE_LANES, KLINE_GROUPS,
  KLINE_NO_SCORE, KLINE_LICHUN_NOTE, KLINE_RELATION_NOTE, KLINE_RELATION_MISSING,
} from '../../frontend/lib/bazi/kline';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.kline.txt';
const ROOT = join(__dirname, '../..');
const lines: string[] = [];
let pass = 0; let fail = 0;
const skips: string[] = [];   // 判定不了的必须说出来，不能算过
const say = (s: string) => lines.push(s);
/** 字样扫描前先剥注释 —— 这个仓库踩过四次：模块自己的注释里写着"不许这样做"，
 *  不剥掉的话反向断言会被作者本人的说明喂绿。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

// 两张真盘。男女各一张：岁运排法顺逆不同，泳道必须两路都填得出东西。
const birth = (gender: 'male' | 'female') => (createChart({
  year: 1988, month: 7, day: 15, hour: 15, minute: 20,
  isLunar: false, gender, timeZone: 8, longitude: 116.4074, dstOffset: 1,
  enableTrueSolarTime: true,
} as never) as never as { bazi: BaziChart }).bazi;
const maleChart = birth('male');
const femaleChart = birth('female');
const male = buildKline(maleChart)!;
const female = buildKline(femaleChart)!;

// 页面上不许出现的"方向词"。这不只是文案检查：y 轴一旦被排成高低，它就是评分。
const DIRECTION_WORDS = ['吉', '凶', '评分', '分数', '得分', '加权', '轻重', '优劣',
  '指数', '开运', '行运吉凶', '旺', '衰'];

/** 递归找数值字段。年份与虚岁是日历事实，一律写成字符串，所以这里一律按 number 类型判。 */
function numericPaths(v: unknown, prefix = ''): string[] {
  if (typeof v === 'number' && !Number.isNaN(v)) return [prefix];
  if (Array.isArray(v)) return v.flatMap((x, i) => numericPaths(x, `${prefix}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => numericPaths(x, `${prefix}.${k}`));
  return [];
}

// ── 1. 前提：两张盘都得摆得出东西，否则后面每一条都会空过 ──
{
  const cells = male.段.reduce((n, s) => n + s.流年.length, 0);
  const marks = male.段.reduce((n, s) => n + s.泳道.reduce((m, l) => m + l.标注.length, 0), 0);
  ok('premise/non-empty', male.段.length > 0 && cells > 0 && marks > 0,
    `真盘上必须有段、有流年格、有泳道命中（是 0 多半喂错了对象，ChartResult 与 BaziChart 差一层 bazi）：段 ${male.段.length} / 流年格 ${cells} / 命中 ${marks}`);
  ok('premise/female-also', female.段.length > 0 && female.段.reduce((n, s) => n + s.泳道.reduce((m, l) => m + l.标注.length, 0), 0) > 0,
    `女盘同样填得出格子：段 ${female.段.length}`);
  ok('premise/no-chart-is-null', buildKline({ ...maleChart, dayun: [] } as never) === null
    && buildKline(undefined) === null,
    '没有岁运序列时必须是 null（由组件走降级说明），不能返回一张空图假装排过了');
}

// ── 2. 泳道：固定十条、一段不许少、顺序与分组就是那五组十神 ──
{
  const got = male.段[0].泳道.map(l => l.十神);
  ok('lane/ten-fixed', JSON.stringify(got) === JSON.stringify(KLINE_LANES),
    `十条道必须齐且顺序固定（缺一条就会让"没标"看起来像"这条道不存在"）：实得 ${got.join('、')}`);
  const short = male.段.filter(s => s.泳道.length !== 10);
  ok('lane/ten-in-every-segment', short.length === 0,
    `每一步大运都要有完整十条道：缺道的段 ${short.map(s => s.段序).join('、') || '无'}`);
  const badGroup = male.段[0].泳道.filter(l => KLINE_GROUPS[l.十神 as never] !== l.分组);
  ok('lane/group-consistent', badGroup.length === 0,
    `分组名必须由 KLINE_GROUPS 单点定义（比劫/食伤/财/官杀/印，只作图例，不表轻重）：不一致 ${badGroup.length} 条`);
  const outside = male.段.flatMap(s => s.泳道.map(l => l.十神)).filter(g => !KLINE_LANES.includes(g as never));
  ok('lane/no-outside-god', outside.length === 0, `十神只能落在这十条道里：越界 ${outside.join('、') || '无'}`);
}

// ── 3. 十神可回指：独立复算每一条标注，三个来源都要对得上 ──
{
  const dm = maleChart.dayMaster;
  const byYear = new Map(male.段.flatMap(s => s.流年.map(m => [`${s.段序}|${m.年纪}`, m] as const)));
  let bad = 0, checked = 0;
  for (const s of male.段) for (const lane of s.泳道) for (const t of lane.标注) {
    const [年纪, 干支, 来源] = t.split('·');
    const m = byYear.get(`${s.段序}|${年纪}`);
    if (!m) { bad++; continue; }
    checked++;
    if (来源 === '流年干') { if (m.干十神 !== lane.十神 || m.干支 !== 干支) bad++; }
    else {
      const role = 来源.replace('流年支', '');
      const cang = getZhiCangGanFull(干支[1], dm);
      const idx = ['本气', '中气', '余气'].indexOf(role);
      if (!cang[idx] || cang[idx].shiShen !== lane.十神) bad++;
    }
  }
  ok('mark/recompute-all', checked > 0 && bad === 0,
    `每条标注都要能独立复算回盘面（格子 ${checked} 条，对不上 ${bad} 条）`);
  // 十神取值不许自建：tables 推导 == yiqi-core 表 == 盘面已发的大运两级
  let tableDiff = 0;
  for (const a of Object.keys(SHISHEN_MAP)) for (const b of Object.keys(SHISHEN_MAP))
    if ((getShiShen as never)(a as never, b as never) !== (SHISHEN_MAP as never)[a as never][b as never]) tableDiff++;
  ok('god/no-second-table', tableDiff === 0,
    `本站两套十神实现必须逐对相等（tables.ts:54 推导 vs yiqi-core 的 SHISHEN_MAP），否则本模块就没有"用哪张表"可言：100 对里不一致 ${tableDiff} 对`);
  const dayunDisagree = maleChart.dayun.filter(d =>
    d.ganShiShen !== getShiShen(dm, d.ganZhi.gan)
    || d.zhiShiShen !== (getZhiCangGanFull(d.ganZhi.zhi, dm)[0] || {}).shiShen);
  ok('god/dayun-headers-are-plate-values', maleChart.dayun.length > 0 && dayunDisagree.length === 0,
    `大运段的表头直接用盘面已发的 ganShiShen/zhiShiShen（不重算）：实得 ${maleChart.dayun.length} 段，与盘面不一致 ${dayunDisagree.length} 段`);
}

// ── 4. 无评分：整棵输出树一层数值字段都不许有 ──
{
  const hits = numericPaths(male);
  ok('score/no-numeric-field', hits.length === 0,
    `输出对象任何一层都不得有数值字段（泳道不排高低、格子不记权重，所以连"数"都不该存在）：命中 ${hits.slice(0, 6).join(' | ') || '0 处'}`);
  const withYears = male.段.filter(s => /\d{4}–\d{4}/.test(s.区间));
  ok('score/years-live-in-strings', withYears.length === male.段.length && male.段.every(s => /^第 \d+ 步大运$/.test(s.段序)),
    `年份与段序都只能是字符串（${withYears.length}/${male.段.length} 段的区间形如 1996–2005）：样例 ${male.段[0].区间}／${male.段[0].起岁}`);
  const comp = strip(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8'));
  const codeOnly = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // 「不构成吉凶评分」这句声明本身就带「吉凶」「评分」四个字，所以扫描要绕开 边界 这一栏 ——
  // 它是声明通道，不是事实内容。真正要盯的是格子：段、泳道、标注里一个字的方向词都不许有。
  const inData = DIRECTION_WORDS.filter(w => JSON.stringify({ ...male, 边界: [] }).includes(w));
  ok('score/no-direction-word-in-data', inData.length === 0,
    `事实内容（去掉声明栏）里不许出现方向/评分词（${DIRECTION_WORDS.slice(0, 6).join('、')} 等 ${DIRECTION_WORDS.length} 个）：命中 ${inData.join('、') || '0 个'}`);
  // 组件侧改查"排序与计分"这类构造：类别轴一旦被排高低就是评分，从命中条数推权重也是评分。
  const constructs = ['.sort(', 'score', 'weight', '点数', '星数', 'Math.max'].filter(t => codeOnly.includes(t));
  ok('score/no-ranking-construct', constructs.length === 0,
    `组件里不得出现排序/计分的构造（泳道顺序固定、格子只答"有没有"）：命中 ${constructs.join('、') || '无'}`);
  ok('score/boundary-sentence', male.边界.includes(KLINE_NO_SCORE),
    `「${KLINE_NO_SCORE}」必须是边界声明里的第一条：实得 ${male.边界.join(' ｜ ')}`);
}

// ── 5. 事件只能来自用户输入；落点必须显式写着未接 ──
{
  const hasEventField = male.段.some(s => s.流年.some(m => Object.keys(m).some(k => k.includes('事件'))));
  ok('event/not-fabricated', !hasEventField,
    '事实层不得自带事件字段 —— 事件只有用户输入这一条来源，模型不许替盘主编经历');
  ok('event/default-says-none', eventLabel(undefined) === '无事件（未由你标注）'
    && eventLabel({ 年纪: '1996', 标注: '  ' }) === '无事件（未由你标注）',
    `没输入时必须明写无事件（含只有空白的输入）：实得「${eventLabel(undefined)}」`);
  ok('event/echoes-user', eventLabel({ 年纪: '1996', 标注: '参加工作' }) === '1996：参加工作',
    '有输入就原样回显年份与用户文字，不加工、不推断');
  const comp = strip(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8'));
  const codeOnly = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // 名字挡不住任何东西（改成 events0 / cannedEvents 就绕过了），所以查构造不查名字：
  // 写进 events 的入口只允许有两个 —— 从 localStorage 读回来、和 save() 里由 draft 生成；
  // 而组件里任何 `标注: '<字面量>'` 都是预置事件的形状。
  const writers = (codeOnly.match(/setEvents\(/g) || []).length;
  const literalEvent = (codeOnly.match(/标注:\s*['"`][^'"`]/g) || []).length;
  ok('event/no-canned-list', writers <= 2 && literalEvent === 0,
    `事件只能有两条来路（本地读回 + 用户输入入库）：setEvents 调用 ${writers} 处（>2 就是多了一条写入路），预置事件字面量 ${literalEvent} 处`);
  // 落点现在接上了，断言随之换向：不再是"必须声明未接"，而是"必须真报得出、且条条可复算"。
  const landings = male.段.flatMap(s => s.落点.concat(s.流年.flatMap(m => m.落点)));
  ok('relation/wired', landings.length > 0 && male.边界.includes(KLINE_RELATION_NOTE)
    && !/未接|待裁/.test(KLINE_RELATION_NOTE),
    `落点必须真报出来且边界改写为"已接自现有成对函数"：实得 ${landings.length} 条，样例「${landings[0] || '（无）'}」`);
  const oneLanding = landings.filter(x => !/×/.test(x) || !/→/.test(x));
  ok('relation/points-at-two-branches', oneLanding.length === 0,
    `每条落点都要写清"哪两支配对、成什么关系"（回指盘内事实，不许写成一句断语）：不合形 ${oneLanding.length} 条`);
  // 成对入口与"手写的那张期望表"逐对比，144 组全覆盖。
  // 为什么不与 detectZhiRelations 对拍：它按柱族聚合（寅巳申三支族里两支齐就出一条，
  // pillars 把四柱全列上；暗合的抑制也看整张盘），而成对入口一次只看两支，两者的
  // pillars/条数天然不同 —— 拿一个的输出去比另一个只会制造假红，比不出真问题。
  const unordered = (x: string, y: string) => (x < y ? x + y : y + x);
  const EXPECT: Record<string, Array<[string, string]>> = {
    六冲: [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']],
    六合: [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']],
    六害: [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']],
    // 相刑：子卯两支即成；寅巳申、丑戌未两支齐为半刑，故族内任一双都算。
    相刑: [['子', '卯'], ['寅', '巳'], ['巳', '申'], ['寅', '申'], ['丑', '戌'], ['戌', '未'], ['丑', '未']],
    自刑: [['辰', '辰'], ['午', '午'], ['酉', '酉'], ['亥', '亥']],
  };
  const expectSet = new Map<string, Set<string>>();
  for (const [t, arr] of Object.entries(EXPECT)) expectSet.set(t, new Set(arr.map(([x, y]) => unordered(x, y))));
  let typeMiss = 0, typeExtra = 0; const badPairs: string[] = [];
  const anHePairs: string[] = [];
  for (const a of DIZHI) for (const b of DIZHI) {
    const got = zhiPairRelations(a, b);
    for (const r of got) {
      if (r.type === '暗合') { anHePairs.push(unordered(a, b)); continue; }
      if (!expectSet.get(r.type)?.has(unordered(a, b))) { typeExtra++; badPairs.push(`${a}${b}:${r.type}`); }
    }
    for (const [t, set] of expectSet) if (set.has(unordered(a, b)) && !got.some(r => r.type === t)) { typeMiss++; badPairs.push(`${a}${b}缺${t}`); }
  }
  ok('relation/pairwise-equals-hand-table', typeMiss === 0 && typeExtra === 0,
    `144 组逐一比手写期望表：少报 ${typeMiss}、多报 ${typeExtra}${badPairs.length ? '（' + badPairs.slice(0, 5).join('、') + '）' : ''}`);
  // 暗合只钉三件能讲清的事：它与显式关系互斥、同支不报、且确实按藏干五合出得来。
  const anHe = new Set(anHePairs);
  ok('relation/anhe-rules', anHe.has(unordered('卯', '申')) && !anHe.has(unordered('寅', '巳'))
    && !anHe.has(unordered('辰', '辰')) && !anHe.has(unordered('子', '午')),
    `暗合：卯申（乙庚合）要报、寅巳（已是六害+半刑）不许再叠、同支与已显式的对不许报。实得 ${anHePairs.length} 对`);
  // 相破：本站不存在这张表，页面上也不许出现这个字（裁定：不做，也别写"我们不做相破"把它带上页面）
  const withLanding = JSON.stringify(male);
  ok('relation/no-xiangpo', !withLanding.includes('破'),
    `输出里不得出现「破」字 —— 没有这张表就不报，也不声明"不做"把它送上面来`);
  // 没有四柱就不能配对：这条走的是 fixture 里那张"无四柱但大运仍在"的盘，
  // 它同时证明落点不是硬编出来的（缺输入时确实为空），也证明边界话术跟着换。
  const noZhu = buildKline({ ...maleChart, siZhu: undefined } as never)!;
  ok('relation/degrades-without-pillars',
    noZhu.段.every(s => s.落点.length === 0 && s.流年.every(m => m.落点.length === 0))
    && noZhu.边界.includes(KLINE_RELATION_MISSING) && noZhu.边界.includes(KLINE_RELATION_NOTE)
    && noZhu.段[0].泳道.some(l => l.标注.length > 0),
    `缺四柱时：落点必须为空且不假装报过（泳道照旧报得出），边界额外加一句"无从配对"：实得边界 ${noZhu.边界.length} 条`);
  // 抄表就是"第四份引擎拷贝"，这条把它拦在提交之前
  const klineSrc = strip(readFileSync(join(ROOT, 'frontend', 'lib', 'bazi', 'kline.ts'), 'utf8'));
  const banned = ['LIU_CHONG', 'LIU_HE', 'SAN_HE', 'XIANG_XING', 'LIU_HAI', 'ZHI_CHONG', '地支六冲'];
  const copied = banned.filter(t => klineSrc.includes(t));
  ok('relation/no-copied-table', copied.length === 0,
    `事实层不得自带地支关系表（现有函数只遍历命局四柱，要接落点必须在算法层开导出函数）：命中 ${copied.join('、') || '无'}`);
}

// ── 6. 立春口径必须写在页面上：公历年与干支年不是同一个轴 ──
{
  ok('basis/lichun-disclosed', male.边界.includes(KLINE_LICHUN_NOTE),
    `流年干支按立春换年，公历轴与干支轴不重合，这句必须在边界里：${KLINE_LICHUN_NOTE}`);
  const comp = strip(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8'));
  // 页面不各抄一份声明，只照读 view.边界 —— 所以这条钉的是"有没有把边界整个渲染出来"，
  // 而不是"页面里能不能搜到这句字面量"（后者会把两份文案硬编在组件里当成通过）。
  const compCode = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const copied = ['流年干支按立春换年', '落点取的是流年支'].filter(x => compCode.includes(x));
  ok('basis/boundary-rendered-from-data', /view\.+边界\.map\(/.test(compCode) && copied.length === 0,
    `边界由数据给、页面照读：组件里有 view.边界.map( ${/view\.+边界\.map\(/.test(compCode)})，把声明抄进正文的有 ${copied.length} 句（抄一份就必然与数据漂移）`);
  ok('basis/stamp', male.口径戳 === KLINE_BASIS && KLINE_BASIS === 'kline-category-v1',
    `口径戳 ${KLINE_BASIS}（盘面输出里带的也是它）：改摆法必须升它，否则老截图无法区分`);

  // ── 6b. #88（2026-10-19 裁定）：格子只读、选年只有年票这一条路 ──
  // 上一版这里 110 个 button 各用 ::after 把自己扩到 44px。分段扫实测：375px 上 110 格
  // 全部 <44，只有 21 格连自己的中心点都还归自己，那 21 格的四角又全解析到邻居身上（miss4），
  // 另 89 格中心点直接被抢。十列网格里补命中区是走不通的，所以格子改回"读"的东西，
  // 选年收进会换行的年票。这一组钉的是"别再长回可点元素"，不是钉我这一次的写法。
  // FragmentRow 是这个文件的最后一个函数，截到文件尾即为它自己的函数体。
  // （用 [\s\S]*?\n\} 会停在类型注解那行的 "\n}) {" 上 —— 实测只抓到 113 字符。）
  const rowFn = (comp.match(/function FragmentRow[\s\S]*$/) || [''])[0];
  const rowCode = rowFn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('cell/fragment-row-found', rowCode.length > 200,
    `必须找得到画格子的那个函数（找不到下面三条全是空过）：实得 ${rowCode.length} 字符`);
  ok('cell/read-only', /<td\s/.test(rowCode) && !/<button|onClick|role="button"|tabIndex/.test(rowCode),
    `格子必须是不可交互的元素：<td> 在=${/<td\s/.test(rowCode)}，还能点/能聚焦的写法命中 `
    + `${['<button', 'onClick', 'role="button"', 'tabIndex'].filter(t => rowCode.includes(t)).join('、') || '无'}`);
  ok('cell/table-semantics', /<table[\s>]/.test(compCode) && /<th\s+scope="row"/.test(compCode)
    && /scope="col"/.test(compCode) && /aria-describedby="kline-axis-note"/.test(compCode),
    `只读≠不可读：表格语义齐（<table>=${/<table[\s>]/.test(compCode)}、行头=${/<th\s+scope="row"/.test(compCode)}`
    + `、列头=${/scope="col"/.test(compCode)}、轴说明用 aria-describedby 指向那段话=`
    + `${/aria-describedby="kline-axis-note"/.test(compCode)}）`);
  const yearChip = (comp.match(/<button[^>]*data-tick=[\s\S]*?onClick=\{\(\) => setYearIdx\(i\)\}/) || [''])[0];
  ok('year/chip-is-the-only-entry', yearChip.length > 40 && /minWidth: 44/.test(yearChip)
    && /minHeight: 44/.test(yearChip) && /setYearIdx/.test(yearChip),
    `选年的入口就是年票，且 44×44 写在票自己身上（不靠 ::after 补）：实得 ${yearChip.length} 字符`);
  ok('year/chips-wrap-no-scroll', /flexWrap: 'wrap'/.test(compCode) && !/overflowX/.test(compCode),
    `年票排不下就换行，不许开横向滚动：flexWrap 在=${/flexWrap: 'wrap'/.test(compCode)}，`
    + `组件里出现 overflowX 的处数=${(compCode.match(/overflowX/g) || []).length}`);
  ok('year/row-gap-clears-expansion', /rowGap: (1[1-9]|[2-9][0-9])/.test(compCode),
    `会换行的 .qn-chip 容器行距必须 >10（globals.css 自己写的规矩：::after 的 44 带上下各伸 5px）：`
    + `实得 ${/rowGap: (\d+)/.exec(compCode)?.[1] ?? '未声明'}`);
  ok('year/copy-says-readonly', compCode.includes('格子只读'),
    '页面上要有一句告诉用户格子不点（改了交互却不改话术，用户会以为坏了）');
}

// ── 7. 边界：只 import 引擎与两份现成函数、不联网、不新增路由/入口、零新依赖 ──
{
  const src = strip(readFileSync(join(ROOT, 'frontend', 'lib', 'bazi', 'kline.ts'), 'utf8'));
  const imports = (src.match(/^import .*$/gm) || []);
  const offside = imports.filter(i => !/core\/yiqi-core|core\/bazi-enrich|@\/app\/lib\/core/.test(i));
  ok('dep/engine-only-imports', offside.length === 0,
    `事实层只能 import 引擎与现成函数：越界 ${offside.join(' | ') || '无'}`);
  const comp = strip(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8'));
  ok('dep/no-network', !/fetch\(|XMLHttpRequest|WebSocket|axios/.test(comp) && !/fetch\(|axios/.test(src),
    '本节的取数与标注全程在浏览器本地：不得有任何网络调用');
  // 本地存的纪律：键必须带版本前缀，读写都必须包在 try/catch（隐私模式会直接抛）
  const hasTry = (comp.match(/try\s*\{/g) || []).length >= 2;
  ok('storage/prefixed-and-guarded', /['"]kline-events-v1:/.test(comp) && hasTry,
    `localStorage 键必须带版本前缀且读写都包 try/catch（隐私模式写不进去是常态）：try 块 ${(comp.match(/try\s*\{/g) || []).length} 个`);
  ok('storage/no-visitor-id', !/getVisitorId|visitor_id/.test(comp),
    '标注键只用四柱+日主，不挂 visitorId —— 那是报告归属凭据，不该把本地涂鸦与账号绑起来');
  const mounted = strip(readFileSync(join(ROOT, 'frontend', 'app', 'chart', 'result', '[id]', 'page.tsx'), 'utf8'));
  ok('route/mounted-unconditional', /<LifeCurve chart=\{enrichedChartData\.bazi\} chartId=\{id\} independentHref=\{`\/dayun\/\$\{encodeURIComponent\(id\)\}`\} \/>/.test(mounted)
    && !/LifeCurve chart=\{[^}]*\}\s*&&/.test(mounted),
    '结果页无条件挂载，且提供与当前命盘绑定的独立岁运入口；降级由组件自己给');
  const home = strip(readFileSync(join(ROOT, 'frontend', 'app', 'page.tsx'), 'utf8'));
  const dayun = TOOL_BY_SLUG.dayun;
  ok('route/dayun-catalog-entry', !/人生K线/.test(home) && dayun?.status === '可用' && dayun.href === '/dayun',
    `人生曲线已作为命盘读法提供独立入口：目录状态=${dayun?.status || '缺失'}，href=${dayun?.href || '缺失'}`);
  const pkg = JSON.parse(readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8'));
  const basePkg = JSON.parse(execSync('git show origin/main:frontend/package.json',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }));
  const keysOf = (o: { dependencies?: object; devDependencies?: object }) =>
    Object.keys({ ...o.dependencies, ...o.devDependencies }).sort();
  // 白名单只有一个出处（tools/_lib/vettedDeps.ts）：以前 kline 与 scenario 各写一份
  // ['three','@types/three']，E2 再加第三个就变成三份，迟早有一份漏改。
  const added = unvettedDeps(keysOf(pkg), keysOf(basePkg));
  ok('dep/no-new-package', added.length === 0, `零新依赖：实得新增 ${added.join('、') || '无'}`);
  // 批范围断言只能读"这个分支提交了什么"，不能读工作区。
  // 教训（2026-10-19 的 #89）：原来这里读 `git diff origin/main` 与 `git ls-files --others`，
  // 于是运维为对齐 server 那份同源拷贝而存在的**未提交改动**会被算成我碰了 server/ ——
  // 首轮 39/1、他提交之后四跑 40/0。看起来像随机 flake，其实是我把别人正在干的活
  // 当成我的违规来判。读提交（merge-base..HEAD）之后，同一棵工作区不管谁在改什么都与这条无关。
  const base = execSync('git merge-base origin/main HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const ahead = Number(execSync(`git rev-list --count ${base}..HEAD`, { cwd: ROOT, encoding: 'utf8' }).trim());
  const touched = execSync(`git diff --name-only ${base}..HEAD`, { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
  const worktreeDirty = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT, encoding: 'utf8' }).trim().length > 0;
  const onMain = ['master', 'main'].includes(execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim());
  if (ahead === 0 && !worktreeDirty) {
    // 2026-10-23：在 main 上做"合后复验"时没有"本批"可审（origin/main == HEAD）。
    // 这三条按 SKIP 处理：既不算通过，也不算违规；工作区脏时仍走下面的判红。
    skips.push(`批范围三条断言（改动清单 / 算法层范围 / server 不碰）—— HEAD 已与 origin/main 同步${onMain ? '（在 main 上做合后复验）' : ''}，没有"本批"可审`);
  } else {
    ok('change-list/is-real', ahead > 0 && touched.length >= 1,
      ahead === 0 ? 'HEAD 相对 merge-base 还没有提交：这几条判定的是"本批交了什么"，先 commit 再跑（现在计 SKIP，不算通过）'
        : `本批提交里能列出改动文件（否则下面"没乱动算法层"是空过）：${ahead} 个提交 / ${touched.length} 个文件`);
  }
  // 2026-10-19 裁定：合冲落点这一批**只许**在 zhi-relations.ts 就地开成对入口。
  // 所以这一条不再是"算法层一个字节都不许动"，而是"只能动那一个文件的那一个导出，
  // 且行为必须逐字节不变"（由 tools/zhi-relations 的全枚举 golden 钉），
  // 并且 server/ 那份同源拷贝仍不许我碰（运维自己改，改完 diff 校验）。
  const engine = touched.filter(f => /app\/lib\/core\/(yiqi-core|bazi-enrich)\//.test(f));
  // 2026-10-20 合盘 #49 裁定：算法层允许的就地导出从 1 个文件扩到 2 个 ——
  // zhi-relations（合冲那批）与 gan-relations（合盘要的成对天干）。扩的是点名清单，不是"随便动"：
  // 新增第三个文件仍然红；两个文件各自的行为不变由全枚举 golden 钉住。
  const ENGINE_ALLOW = new Set(['bazi-enrich/zhi-relations.ts', 'bazi-enrich/gan-relations.ts']);
  // 2026-10-20 既有缺陷批 P2 裁定「yiqi-core 的调试打印删掉」，那必然要动 bazi.ts —— 清单外的第三个算法层文件。
  // 没有把清单放宽，而是加一道只放行"纯删日志"的窄门：该文件新增行数必须为 0，
  // 且删掉的每一行都得是一条 console.* 语句。这样它照常挡住任何行为改动（哪怕只改一个字符），
  // 放过的只有这次唯一被授权的那种变化。
  const inAllow = (f: string) => [...ENGINE_ALLOW].some(x => f.replace(/\\/g, '/').endsWith(x));
  const diffOf = (f: string) => execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
  const loggingOnlyRemoval = (f: string) => {
    const d = execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' });
    const added = d.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
    const removed = d.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));
    // 允许删空行（挨着被删语句的那一行本来就是空行）；除此之外只认 console.* 语句本身。
    const notConsole = removed.filter(l => l.trim() !== '-' && !/^\-\s*console\.(log|info|debug|warn|error|trace)\(/.test(l));
    return added.length === 0 && removed.length > 0 && notConsole.length === 0;
  };
  // 2026-10-21 裁定 ③：crossed.hour 改语义要动 yiqi-core/true-solar-time.ts。
  // 照 裁定 ① 的口径放宽的是**一类行为**，不是给清单加一个名字：
  //  A. 纯注释/空行（给声明补文档，编译器看不见的那种改动）；
  //  B. 只碰 crossed 这一格的计算 —— 行里必须出现 crossed / ziChenIndex，别的一律挡。
  // 这样下一个借"顺手修口径"去动四柱计算的人仍然直接红，而这两条放过的正是被授权的那两种。
  // 空行、注释、以及只由花括号加分号/逗号组成的行都不带行为 —— helper 的 `+}` 与被拆开重排的
  // 对象字面量收尾 `+    },` 都是这一类。这已经是第二次撞上了：门放过字段那一行、
  // 却把它的收尾算成"别的代码"，等于"这批只准改一行"，下一个合法批次照样被挡。
  const inertLine = (l: string) => {
    const b = l.slice(1).trim().replace(/[;,]+$/, '');
    return b === '' || /^(\/\/|\/\*|\*)/.test(b) || /^[{}]$/.test(b);
  };
  const commentOnlyLines = (d: string[]) => d.length > 0 && d.every(inertLine);
  // 放行的是"crossed 与换日口径这一段"，认得四种行：字段本身、被授权删掉的那条打印、
  // 换日/取格的 helper（rollsToNextDay / dayPillarKey / ziChenIndex）与其签名行、
  // 以及把口径传下去的 dayBoundaryMode。逐类点名，别的算术与别的取数一律挡在外面。
  // 放行的是"crossed 与换日口径这一段"。认得的行用标识符点名：新实现那几个
  // (crossed / ziChenIndex / dayPillarKey / rollsToNextDay / dayBoundaryMode)，加上被这次改动
  // 替掉的旧实现那几个 (stdLocal / sameDay / hour === 23 / MIDNIGHT_00 / 晚子时 / true-solar-time)。
  // 旧名必须一起放行，否则"改名"这件事本身就没法通过 —— 被删的那一行不带新标识符。
  const CROSSED_SHAPE = /crossed|ziChenIndex|dayPillarKey|rollsToNextDay|dayBoundaryMode|stdLocal|sameDay|hour === 23|MIDNIGHT_00|晚子时|true-solar-time|Math\.floor\(\(hour \+ 1\) \/ 2\)/;
  const REMOVED_CONSOLE = /^-\s*console\.(log|info|debug|warn|error|trace)\(/;
  const crossedFlagLines = (d: string[]) => d.length > 0
    && d.filter(l => !inertLine(l) && !CROSSED_SHAPE.test(l) && !REMOVED_CONSOLE.test(l)).length === 0;
  const commentOnlyChange = (f: string) => commentOnlyLines(diffOf(f));
  const crossedFlagOnly = (f: string) => crossedFlagLines(diffOf(f));
  // 2026-10-21 批7 的三条裁定全部落在算法层（删兜底、删打印、删死代码），放宽的仍然是**一类行为**，不是文件名。
  // 这一类叫"只减不增产出"：不许往算法层带进任何新名字，唯一被授权的新语句是 `throw new Error(...)`。
  // 于是"删掉一个没人调的函数""把查不到时的兜底改成抛错""把两个符号的 import 收成一个"都能过；
  // "顺手加一次取数""换一种格法算术""给产出对象添一格带新标识符的字段"照旧直接红。
  const IDENT = /[A-Za-z_$][A-Za-z0-9_$]{1,}/g;
  const srcOf = (l: string) => l.slice(1).trim();
  const noNewNameChange = (ls: string[]) => {
    if (!ls.length) return false;
    const before = new Set((ls.filter(l => l.startsWith('-')).join('\n').match(IDENT) || []));
    return ls.filter(l => l.startsWith('+') && !inertLine(l)).every(l => /^throw new Error\(/.test(srcOf(l))
      || (srcOf(l).match(IDENT) || []).every(id => before.has(id)));
  };
  const deletedFunctionNames = (ls: string[]) => [...new Set(ls.filter(l => l.startsWith('-'))
    .map(l => srcOf(l).match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/))
    .filter(Boolean).map(m => m![1]))];
  // 数"还有谁在调"：只扫 frontend/（会被编译进站点的那棵树）。
  // 不扫 tools/ —— 这是第四次踩"套件自己的文本咬自己的断言"：tst 的同步表要写"别留 runZiweiTests"，
  // 那是在**点名要删的东西**，不是调用点；把它算成引用，等于要求断言不许提到被测对象。
  // 判据用**连字面量一起剥掉**的那一份（stripLiterals）：产品代码的注释与文案里提到一个函数名
  // 也不是调用点。上一批只能靠"少扫一棵树"绕开，那是收窄范围，不是判据变对。
  const refsOf = (names: string[], exceptFile: string) => {
    const hit: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!/node_modules|\.next|\.git|dist/.test(e.name)) walk(join(dir, e.name)); }
        else if (/\.tsx?$/.test(e.name)) {
          const p = join(dir, e.name);
          if (p === exceptFile) continue;
          const body = stripLiterals(readFileSync(p, 'utf8'));
          for (const g of names) if (new RegExp(`\\b${g}\\b`).test(body)) hit.push(`${g}←${p.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/'), '')}`);
        }
      }
    };
    walk(join(ROOT, 'frontend'));
    return hit;
  };
  const refusalOnlyChange = (f: string) => {
    const d = execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' });
    const ls = d.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
    if (!noNewNameChange(ls)) return false;
    // 删掉的函数必须"仓库里已经没人调"：纯删除如果删的是活代码，这一半把它挡住。
    // （活函数被删通常 tsc 先炸，但 tsc 看不见 tools/ 里的套件，也看不出"只在同文件内被调、转头又补了个同名的"。）
    const gone = deletedFunctionNames(ls);
    return gone.length === 0 || refsOf(gone, join(ROOT, f)).length === 0;
  };
  // 两道窄门自己的牙齿，喂**假 diff** 给分类器 —— 不依赖仓库当下改了什么。
  // 拿真实文件当反例的那种写法会自己失效：下一个只改了注释的批次会让"反例"变成正例。
  ok('algo/crossed-hatch-is-narrow',
    crossedFlagLines(['-    crossed: { hour: a !== b, day: !s },', '+    crossed: { hour: ziChenIndex(x) !== ziChenIndex(c), day: !s },'])
    && crossedFlagLines(['+function ziChenIndex(hour: number): number {', '+  return Math.floor((hour + 1) / 2) % 12;', '+}', '+'])
    && crossedFlagLines(['-    console.error(\'[晚子时处理] 23点\');', '+  if (rollsToNextDay(hour, mode)) {', '+    dayBoundaryMode: birthInfo.dayBoundaryMode,'])
    && crossedFlagLines(['-  if (hour === 23 && mode !== \'MIDNIGHT_00\') {', '-import { calculateTrueSolarTime } from \'./true-solar-time\';', '+import { calculateTrueSolarTime, rollsToNextDay } from \'./true-solar-time\';'])
    && crossedFlagLines(['+  crossed: {', '+    hour: ziChenIndex(a) !== ziChenIndex(b),', '+  },', '+'])
    && commentOnlyLines(['+  /** 时辰是两小时一格 */'])
    && !crossedFlagLines(['+    const dayGan = getDayGan(x);'])
    && !crossedFlagLines(['-  const solar = Solar.fromYmdHms(a, b, c, 23, 0, 0);', '+  const solar = Solar.fromYmdHms(a, b, c, 0, 0, 0);'])
    && !crossedFlagLines(['+  return Math.floor((hour + 2) / 2) % 12;'])
    // 加一条 console 不许混进来：放行的是"删被授权的打印"，不是"随便动打印"。
    && !crossedFlagLines(['+    console.warn(\'新加的调试打印\');'])
    && !commentOnlyLines(['+  const a = 1;']) && !commentOnlyLines([]) && !crossedFlagLines([]),
    '窄门只放过"只碰 crossed / 换日口径"和"纯注释"两种：普通取数代码、改了格法算术的行、'
    + '新加的打印都必须判 false；空 diff 两条都判 false（没改动也算通过就是空过）');
  // 标识符点名是**必要不充分**：有人在 sameDay 那一行里夹点别的，这道门看不见。
  // 下面这条不是"要求它一直弱"，是**示警桩**：它现在必须过（= 承认有这个洞），
  // 哪天有人把分类器收紧到能挡住这种夹带，它会变红 —— 那时该把它删掉，不是把它改成期望 false。
  ok('algo/hatch-known-gap-canary', crossedFlagLines(['+  const sameDay = corrected.day > 0;']),
    '已知弱点，立此存照：同一行里出现放行标识符就放行，夹带的算术这道门看不见。'
    + '所以行为必须由别几套证据钉：20736 组地支关系 digest、A==C / A==B 对拍、bazi 8/8、'
    + 'crossed 那 144 + 864 组"标志 == pillar 真的变了"。这条红了说明分类器收紧了，删掉它');
  // 第四道窄门（只减不增产出）自己的牙齿，同样喂假 diff。
  // 顺手把这一类**看不见**的那种也立成一条断言：`return nayin || '海中金'` 不带新名字，
  // 这一类放它过去是设计如此（它不是新行为，是把老兜底换个写法），真正挡它的是
  // core/nayin-has-no-fabricated-default。两道门一对一错，谁也别想单独睡着。
  ok('algo/refusal-class-teeth',
    noNewNameChange(['-  if (!nayin) {', '-    console.warn(`未找到纳音: ${key}`);', '-    return \'海中金\'; // 默认值', '-  }',
      '+  if (!nayin) {', '+    throw new Error(`纳音表里没有「${key}」`);', '+  }'])
    && noNewNameChange(['-import { createZiweiChart, runFooTests } from \'./ziwei-standard\';', '+import { createZiweiChart } from \'./ziwei-standard\';'])
    && noNewNameChange(['-export function runFooTests() {', '-  console.error(\'测试功能待实现\');', '-  return { passed: 0, failed: 0 };', '-}'])
    && noNewNameChange(['-  const totalFailed = baziResults.failed + ziweiResults.failed;', '+  const totalFailed = baziResults.failed;'])
    && !noNewNameChange(['+  const wx = getWuXingFromDayun(zhi);'])
    && !noNewNameChange(['+    naYinV2: getSiZhuNaYin(siZhu),'])
    && !noNewNameChange(['+  return Math.floor((hour + 2) / 2) % 12;'])
    && !noNewNameChange([])
    && noNewNameChange(['-  return nayin;', '+  return nayin || \'海中金\';']),
    '这一类放过：改抛错、收 import、纯删函数、把 A+B 改成 A；挡住：新调一个函数、给产出对象加一格新字段、改格法算术。'
    + '已知它放过"把老兜底换个写法"（不带新名字），那一档由 core/nayin-has-no-fabricated-default 挡');
  // 被删的函数"确实没人调"这句话要可核对，不能只写在我这次的 grep 里。
  const deletedFns = engine.filter(f => !inAllow(f)).flatMap(f => {
    const d = execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' });
    return deletedFunctionNames(d.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---')));
  });
  const stillReferenced = deletedFns.flatMap(g => refsOf([g], '').map(r => r));
  ok('algo/deleted-functions-were-really-dead', stillReferenced.length === 0,
    `本批从算法层删掉的函数（${deletedFns.join('、') || '无'}）在 frontend/ 那棵树里必须已经零引用 —— `
    + `"死代码"这三个字要么可机检，要么别说（扫的是会被编译进站点的代码，套件文本里点名要删的东西不算调用点）：实得 ${stillReferenced.join(' | ') || '0 处引用'}`);
  // 报错要指名"哪个文件是被什么放过的 / 哪个是真不合规"。以前这里直接把清单外全列出来，
  // 于是纯注释的 types.ts 也一起上榜，读的人会去查一个根本没失败的档案。
  const engineBad = engine.filter(f => !inAllow(f) && !loggingOnlyRemoval(f) && !commentOnlyChange(f) && !crossedFlagOnly(f) && !refusalOnlyChange(f));
  const why = (f: string) => loggingOnlyRemoval(f) ? '纯删日志' : commentOnlyChange(f) ? '纯注释'
    : crossedFlagOnly(f) ? (diffOf(f).some(l => CROSSED_SHAPE.test(l)) ? '只碰 crossed' : '删打印+补注释')
    : refusalOnlyChange(f) ? '只减不增产出' : '不合规';
  ok('algo/only-the-pairwise-export', engineBad.length === 0,
    `动到的算法层文件只能是 ${[...ENGINE_ALLOW].join(' / ')}（清单外只放行四种：新增 0 行且删的全是 console.* 语句 / 纯注释空行 / 只碰 crossed 那一格 / `
    + `"只减不增产出"=不带进任何新标识符、新语句只许 throw、且被删函数在仓库里已无引用）：实得 ${engine.map(f => f.replace(/^frontend\/app\/lib\/core\//, '') + '=' + (inAllow(f) ? '点名放行' : why(f))).join(' | ') || '（无）'}`
    + `${engineBad.length ? '；被挡住的 ' + engineBad.map(f => {
      const d = execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' });
      return f.replace(/^frontend\/app\/lib\/core\//, '') + '[' + d.split('\n').filter(l => (l.startsWith('+') && !l.startsWith('+++')) || (l.startsWith('-') && !l.startsWith('---'))).join('').slice(0, 160) + ']';
    }).join(' ') : ''}`);
  // 合盘层不许自带第二份地支/天干关系表 —— 复用算法层导出，是这批允许改算法层的交换条件。
  let hepanCopied: string[] = [];
  try {
    const hepanSrc = ['engine.ts', 'local-store.ts', 'types.ts']
      .map(f => strip(readFileSync(join(ROOT, 'frontend', 'lib', 'hepan', f), 'utf8'))).join('\n');
    hepanCopied = ['GAN_HE_PAIRS', 'LIU_CHONG', 'LIU_HE', 'SAN_HE', 'SAN_HUI', 'XIANG_XING', 'LIU_HAI', 'ZHI_CHONG']
      .filter(tok => hepanSrc.includes(tok));
  } catch { /* 合盘文件不存在时这条不适用 */ }
  ok('algo/hepan-no-copied-table', hepanCopied.length === 0,
    `合盘层不得自带关系表（必须复用 bazi-enrich 的导出）：命中 ${hepanCopied.join('、') || '无'}`);
  const server = touched.filter(f => f.startsWith('server/'));
  ok('server/untouched', ahead === 0 || server.length === 0,
    `本批提交里没有 server/ 文件（那份 byte-同拷贝由运维改）：实得 ${server.join(' | ') || '（无）'}`);
  const rel = strip(readFileSync(join(ROOT, 'frontend', 'app', 'lib', 'core', 'bazi-enrich', 'zhi-relations.ts'), 'utf8'));
  ok('algo/export-surface-minimal', /export function zhiPairRelations/.test(rel)
    && (rel.match(/^export /gm) || []).length === 4,
    `算法层的导出面只多这一个函数（现在四个：ZhiRelation 类型、detectZhiRelations、zhiPairRelations + 类型）：实得 ${(rel.match(/^export /gm) || []).length} 个 export`);

  // 引擎里不许有无条件的调试打印。这不是风格问题：每次排盘往控制台打两行「🔍 八字计算结果」，
  // 意味着任何人 F12 就能看见一张别人的命盘，而且那两行不在 catch 里、跟着成功路径走。
  // harness 那条 CONSOLE 通道监听的是 Log.entryAdded，而 Log 域从未 enable —— 它在浏览器侧
  // 根本收不到东西，所以这条只能从源码侧钉（那个空通道另记 report-only）。
  // 2026-10-20 裁定 ① 把口径写死了：console.error/warn 在错误路径里允许（排障要看得到），
  // console.log/info/debug/trace 一律禁 —— 下面这条正是按这个口径实现的。
  const yqDir = join(ROOT, 'frontend', 'app', 'lib', 'core', 'yiqi-core');
  const yqFiles = readdirSync(yqDir).filter(f => f.endsWith('.ts'));
  // 2026-10-21 裁定②：口径从"log/info/debug/trace 一律禁"扩成
  // "error/warn 也不许走在正常路径上" —— 判据是它 lexical 地在不在 catch 块里。
  // 晚子时那条就是例子：23 点出生是无辜的，可它每次排盘都往控制台写一行。
  // 例外走 allowlist（档案:行号片段:理由），且每条都要还命中得上一一失配就判红，
  // 否则 allowlist 只会越长越像地基，没人敢删。
  // 2026-10-21 裁定②（批6）建的这张 allowlist，批7 把里面三条全部裁掉了：
  // jieqi「节气校正」删打印、ziwei-standard 的 runZiweiTests 桩整块删、
  // nayin 未命中的 return '海中金' 改成抛错（顺带那条 warn 也没了）。
  // 留空数组是**最严**的状态：catch 外一处打印都不许有。条目一有失配照样判红，
  // 所以谁往回加例外，就得同时把理由写清楚。
  const PRINT_ALLOWLIST: { where: string; reason: string }[] = [];
  // 从打印那一行往上找包住它的那个 { ，看它前面是不是 catch。
  // 够用且可核对：字符串里出现裸花括号会看错，而这一批的打印都没有；真要扩到那种文件再说。
  const insideCatch = (lines: string[], idx: number): boolean => {
    let depth = 0;
    for (let i = idx; i >= 0; i--) {
      const l = lines[i];
      for (let j = l.length - 1; j >= 0; j--) {
        if (l[j] === '}') depth++;
        else if (l[j] === '{') {
          if (depth === 0) return /\bcatch\b/.test(l.slice(0, j));
          depth--;
        }
      }
    }
    return false;
  };
  const prints: string[] = [];
  const allowHits = new Set<string>();
  for (const f of yqFiles) {
    const raw = readFileSync(join(yqDir, f), 'utf8');
    const code = strip(raw);
    for (const m of code.match(/console\.(log|info|debug|trace)\(/g) || []) prints.push(`${f}: ${m}（一律禁）`);
    for (const m of code.match(/console\.\w+\([^)]*(?:🔍|计算结果)[^)]*\)/g) || []) prints.push(`${f}: 调试打印 ${m.slice(0, 40)}`);
    const lines = code.split('\n');
    lines.forEach((l, i) => {
      const hit = /console\.(error|warn)\(/.exec(l);
      if (!hit) return;
      if (insideCatch(lines, i)) return;
      const al = PRINT_ALLOWLIST.find(a => a.where.split('|')[0] === f && l.includes(a.where.split('|')[1]));
      if (al) { allowHits.add(al.where); return; }
      prints.push(`${f}:${i + 1}: 正常路径上的 ${hit[1]} —— ${l.trim().slice(0, 56)}`);
    });
  }
  const stale = PRINT_ALLOWLIST.filter(a => !allowHits.has(a.where)).map(a => a.where);
  ok('core/no-unconditional-engine-prints', prints.length === 0 && stale.length === 0,
    `yiqi-core 里 console.log/info/debug/trace 一律禁；console.error/warn 必须在 catch 块内（例外走 allowlist）：`
    + `命中 ${prints.join(' | ') || '0 处'}；扫了 ${yqFiles.length} 个文件`
    + `${stale.length ? '；allowlist 里有已经不存在的打印（该删，留着就等于给下一处开口子）：' + stale.join('、') : ''}`);
  ok('core/allowlist-carries-reasons', PRINT_ALLOWLIST.every(a => a.where.includes('|') && a.reason.length >= 20),
    `每条例外都得写清"档案:片段:为什么放行"（理由不少于 20 字，实得 ${PRINT_ALLOWLIST.length} 条）—— `
    + 'allowlist 没有理由就只是把红灯改成静音');
  // 换日规则只许有一份：crossed.day 与 bazi.ts 的换日必须吃同一个判断，否则两处会各自漂移。
  const baziSrc = strip(readFileSync(join(yqDir, 'bazi.ts'), 'utf8'));
  const tstSrcForRule = strip(readFileSync(join(yqDir, 'true-solar-time.ts'), 'utf8'));
  ok('core/late-zi-rule-is-single-source',
    /export function rollsToNextDay\(/.test(tstSrcForRule)
    && /if \(rollsToNextDay\(hour, mode\)\)/.test(baziSrc)
    && !/hour === 23/.test(baziSrc) && !/console\.error\('\[晚子时处理\]/.test(baziSrc),
    '晚子时换日只剩 true-solar-time.ts 里那一份实现，bazi.ts 改用它（crossed.day 也要按同一口径回答）；'
    + `bazi.ts 里残留的 \`hour === 23\` ${(baziSrc.match(/hour === 23/g) || []).length} 处、晚子时打印 ${/晚子时处理/.test(baziSrc) ? '仍在' : '已删'}`);

  // ── 裁定③（P0 数据造假）：纳音表 60 甲子全覆盖 + 查不到就抛，不再兜一个假值往下游发 ──
  // 金标准按《纳音歌》的甲子顺序手写（引擎那张表是按五行分类排的），所以这是对照不是抄一遍。
  // 歌里"沙中金/砂石金""桑柘木/桑拓木"两种写法都有，这里取引擎用的那种，
  // 因为这条钉的是"60 组一组都不许缺"，不是钉异体字。
  const GAN60 = '甲乙丙丁戊己庚辛壬癸'.split('');
  const ZHI60 = '子丑寅卯辰巳午未申酉戌亥'.split('');
  const NAYIN_GE = [
    '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土', '白蜡金', '杨柳木',
    '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木', '壁上土', '金箔金',
    '覆灯火', '天河水', '大驿土', '钗钏金', '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
  ];
  const jiazi: string[] = [];
  const nayinDiff: string[] = [];
  const wxDiff: string[] = [];
  for (let i = 0; i < 60; i++) {
    const g = GAN60[i % 10], z = ZHI60[i % 12];
    const gold = NAYIN_GE[Math.floor(i / 2)];
    jiazi.push(g + z);
    let got = '';
    try { got = getNaYin(g as never, z as never); } catch { got = '（抛错）'; }
    if (got !== gold) nayinDiff.push(`${g}${z} 歌=${gold} 引擎=${got}`);
    // 纳音名的最后一个字就是它的五行：合盘、场景矩阵都是从这里取五行，中间没有第二份表。
    else if (getNaYinWuXing(got as never) !== gold[gold.length - 1]) wxDiff.push(`${g}${z} ${gold}->${getNaYinWuXing(got as never)}`);
  }
  ok('core/nayin-covers-all-60-jiazi', nayinDiff.length === 0 && wxDiff.length === 0,
    `60 甲子逐组取纳音，与《纳音歌》全等（${jiazi.length} 组，缺任一组都会让排盘直接抛 —— 这是批7 要的效果，`
    + `但前提是一张都不缺）；纳音名末字与 getNaYinWuXing 自洽 ${wxDiff.length} 处不合：`
    + `${nayinDiff.slice(0, 6).join(' | ') || '0 组不合'}${wxDiff.length ? ' | 五行不合 ' + wxDiff.slice(0, 4).join(' | ') : ''}`);
  // 120 个干支对里 60 个是奇偶不同、根本不存在的组合。改抛错之前它们全部安静返回"海中金"（实测 60/60），
  // 合盘拿着这种假值会排出一句完整而错误的「我属金、对方属木，两者是克」。
  const accepted: string[] = [];
  for (const g of GAN60) for (const z of ZHI60) {
    if (GAN60.indexOf(g) % 2 === ZHI60.indexOf(z) % 2) continue;
    try { accepted.push(`${g}${z}=${getNaYin(g as never, z as never)}`); } catch { /* 抛错才算拒了 */ }
  }
  ok('core/nayin-refuses-nonexistent-pair', accepted.length === 0,
    `60 个"天干地支奇偶不同"的非法组合必须全部抛错，实得 ${accepted.length} 个还安静给值`
    + `${accepted.length ? '：' + accepted.slice(0, 4).join(' | ') : ''} —— 查不到与查到是同一回事，就是把事故发往下游`);
  const nayinSrc = strip(readFileSync(join(yqDir, 'nayin.ts'), 'utf8'));
  // 只看"未命中那一支"里写了什么：整档禁 `return '海中金'` 会误伤表里合法的映射
  // （我把 戊辰 改成 海中金 做证伪时，那条粗断言也跟着红，红得没道理）。
  const missBranch = (() => {
    const at = nayinSrc.indexOf('if (!nayin) {');
    if (at < 0) return null;
    const rest = nayinSrc.slice(at);
    const end = rest.indexOf('\n  }');
    return end < 0 ? rest : rest.slice(0, end);
  })();
  ok('core/nayin-has-no-fabricated-default',
    !!missBranch && /throw new Error\(/.test(missBranch) && !/return /.test(missBranch) && !/console\.warn\(/.test(missBranch),
    `钉的是"兜底别再长回来"：未命中那一支里只许 throw，不许 return 一个假纳音、也不许打一行就往下走（注释已剥）。`
    + `实得：${missBranch ? missBranch.trim().replace(/\s+/g, ' ').slice(0, 72) : '找不到 if (!nayin) 那一支（改写法了就重写这条）'}`);
  // ── 通用规则（2026-10-21 裁定）：任何比较代码文本的闸门，先剥注释 ──
  // 这条不是又一条产品断言，是**守闸门的那条闸门**：套件读产品源码做判定时，
  // 反向判据（"不许出现 X"）会被说明性注释喂成假红，正向判据（"必须出现 X"）会被注释喂成假绿 ——
  // 后者更贵：那一格代码早就没了，闸门还在替它说话。一天内咬了两次（tst 的 forbid、引用扫描的 reason）。
  // 判据是"这一处 readFileSync 外面有没有包一层剥注释的调用"，扫每一档前先剥注释，
  // 所以档里写的解释文字不会自己命中自己。被测对象的名字用两段拼出来：
  // 写成一整串的话，本档自己就成了一个假命中点（这正是那条 reason 文案踩过的坑）。
  const CALL_TOKEN = 'readFile' + 'Sync';
  const STRIP_TOKENS = ['strip', 'codeOf'];
  // 三种"已经剥过"的形状，逐一认：
  //  a) 读的那一行外面就包着剥注释的调用；
  //  b) 同一行尾内联 .replace(/\/\*…（census/globals.css 那种，剥注释写在读之后）；
  //  c) 读进一个变量，随后三行内对该变量剥一次（本仓最常见的 `const raw = read…; const code = strip(raw);`）。
  // 再加两条不适用：读 .json/.png/.md 这类无注释工件的行，以及 JSON.parse 包着的结构化数据。
  const READ_SITES_BESIDE_TEXT = /\.(json|png|jpg|svg|md|txt)['"]?\s*[,)]|JSON\.parse\s*\(|\breadData(?:Text|Bytes)\s*\(/;
  // 认不了的形态要写清为什么放行，并且条目对应的读点不见了就判红 —— 与引擎打印那张 allowlist 同一做法。
  const STRIP_ALLOWLIST: { where: string; reason: string }[] = [
    { where: 'receipt-acceptance/acceptance.ts|join(__dirname, \'../..\', p)', reason: '这是本档的读文件小函数 readSrc() 本体，'
      + '剥注释发生在各个使用处（codeOf(await readSrc(...))）；剥在这里会让已剥过的调用处再剥一次，反而看不出谁忘了剥。' },
    { where: 'random-acceptance/acceptance.ts|(file, \'utf8\')', reason: '同上：codeOf() 的取体，判据在使用处剥。' },
    { where: 'scenario-acceptance/acceptance.ts|classicsFiles.map', reason: '读的是 docs/classics/*.md 语料，'
      + 'Markdown 没有"注释"这一层，剥了只会把要对照的原文弄丢。' },
    { where: 'liuyao-ganzhi/make-fixture.ts|OUTS[hit.method]', reason: '读的是自家 fixture 的 .json（按起卦方式取路径），'
      + '不是拿源码文本做判定。' },
    { where: 'kline-acceptance/acceptance.ts|rows = read', reason: '本条闸门自己：它必须按**原始行**扫才报得出人能找到行号，'
      + '剥注释发生在逐行上（strip(raw)），整档先剥会让行号漂 —— 第一版就漂给人看过一个不存在的位置。' },
    { where: 'random-acceptance/acceptance.ts|inComments = liveFiles.filter', reason: '故意读原始文本：'
      + '这一处量的就是"只在注释里提到 Math.random"（那是在解释为什么改，不是在用），剥了注释等于把被测的东西抹掉；'
      + '同一行判断"是否真的在用"走的是 codeOf(f)。' },
    // E2（本命行星位置）四处读的是**数据**而不是产品源码，剥注释只会把要对照的原文弄坏。
    // 逐条登记而不是给整个档开洞：同一档里读 frontend/**.tsx 的每一处仍然必须剥（套件里就是这么写的）。
    { where: 'astro-acceptance/acceptance.ts|REF_FILE', reason: '读 tools/astro-acceptance/cases/*.json 对拍夹具，'
      + '不是源码文本；它自己由 make-reference.ts 生成，没有注释这一层。' },
    { where: "astro-acceptance/acceptance.ts|'horizons', f)", reason: '读的是 JPL Horizons 原始输出 body-*.txt 语料'
      + '（本条要验的就是那份表头自己写着 Center=Earth(399) / DE441 / ObsEcLon 三件事），剥"注释"等于把权威证据删掉。' },
    { where: "astro-acceptance/make-reference.ts|(file, 'utf8')", reason: '同上：parseRaw 读 horizons/*.txt，'
      + '认列靠 $$SOE..$$EOE 与表尾 Column meaning 那几行原文。' },
    { where: 'astro-acceptance/acceptance.ts|binaryPath', reason: '读的是随站点部署的凯龙星历 .bin 二进制工件，'
      + '没有注释这一层；不是拿产品源码文本做判定。' },
    { where: "astro-acceptance/make-reference.ts|(OUT, 'utf8')", reason: '读的是自家刚生成的 .json 夹具（--check 比逐字一致），'
      + '不是拿源码文本做判定。' },
  ];
  // 剥注释的调用要"括到这一读为止"才算数：本行早先出现过 strip(...) 但已经闭合，
  // 说明包的是别的东西，这一读仍然是裸读（判据只看"提到过"就等于没有判据）。
  const wrapsThisRead = (before: string) => {
    const m = [...before.matchAll(/(?:strip\w*|codeOf)\s*\(\s*(?:require\([^)]*\)\s*)?(?:\.)?\s*$/g)];
    if (m.length) return true;
    const viaRequire = /require\([^)]*\)\s*\.\s*$/.test(before) || /\.\s*$/.test(before);
    if (!viaRequire) return false;
    let last = -1;
    for (const w of before.matchAll(/(?:strip\w*|codeOf)\s*\(/g)) last = w.index;
    if (last < 0) return false;
    const tail = before.slice(last);
    let depth = 0;
    for (const ch of tail) { if (ch === '(') depth++; else if (ch === ')') depth--; }
    return depth > 0;
  };

  const verdict = (raw: string, nextRaw: string[]): 'skip' | 'stripped' | 'naked' => {
    if (/^\s*(\/\/|\/\*|\*|\{\/)/.test(raw)) return 'skip';
    const l = strip(raw);
    const at = l.indexOf(CALL_TOKEN + '(');
    if (at < 0) return 'skip';
    if (READ_SITES_BESIDE_TEXT.test(l)) return 'skip';
    const before = l.slice(0, at);
    const inlineAfter = /\.replace\s*\(\s*\/\\\/\\\*/.test(l.slice(at));
    const varName = (l.match(new RegExp('(?:const|let)\\s+(\\w+)\\s*=\\s*' + CALL_TOKEN)) || [])[1];
    const soonStripped = !!varName && nextRaw.slice(0, 3).some(n => {
      const c = strip(n);
      return new RegExp('(?:const|let|var)\\s+\\w+\\s*=\\s*(?:' + STRIP_TOKENS.map(t => t.slice(0, 5) + '\\w*').join('|')
        + ')\\s*\\(\\s*' + varName + '\\b').test(c);
    });
    return (wrapsThisRead(before) || inlineAfter || soonStripped) ? 'stripped' : 'naked';
  };
  // 这条闸门自己的牙齿，喂**假行**（与 crossed-hatch / refusal-teeth 同一做法）：
  // 判据不能只靠"仓库当下恰好都包好了"，那下一个忘了包的人照样过。
  // 假行里的被测量用 CALL_TOKEN 拼出来：写成一整串的话，本档自己就成了一个裸读点。
  const TEETH: [string, string, string[], 'skip' | 'stripped' | 'naked'][] = [
    ['包一层 stripComments', `  const code = stripComments(${CALL_TOKEN}(p, 'utf8'));`, [], 'stripped'],
    ['包一层 codeOf', `  const body = codeOf(${CALL_TOKEN}(p, 'utf8'));`, [], 'stripped'],
    ['经 require 但外层仍包着', '  const body = stripComments(require(\'fs\').' + CALL_TOKEN + '(new URL(p), \'utf8\'));', [], 'stripped'],
    ['同一行内联 .replace(/\\/\\*', `  const css = ${CALL_TOKEN}(f, 'utf8').replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');`, [], 'stripped'],
    ['读进变量后三行内剥', `  const raw = ${CALL_TOKEN}(p, 'utf8');`, ['  const code = strip(raw);', '', ''], 'stripped'],
    ['裸读', `  const src = ${CALL_TOKEN}(p, 'utf8');`, ['', '', ''], 'naked'],
    ['本行早先有个已闭合的 strip，但包的不是这一读', `  const code = strip(x); const src = ${CALL_TOKEN}(p, 'utf8');`, ['', '', ''], 'naked'],
    ['注释行提到被测量', `  // 说明里提到 ${CALL_TOKEN}( 这不算`, [], 'skip'],
    ['JSON.parse 包着（结构化数据，不是源码文本）', `  const c = JSON.parse(${CALL_TOKEN}(cases, 'utf8'));`, [], 'skip'],
    ['读 .png 这类无注释工件（路径写成字面量）', `  const img = ${CALL_TOKEN}('logo.png', 'utf8');`, [], 'skip'],
    ['走数据读专用件（底本/PG 原文这类无注释数据）', '  const raw = readDataText(p);', [], 'skip'],
  ];
  /** 牙齿案例数锁：加一种形状要把这个数一起改（"忘了加牙齿"与"忘了包 strip"是同一类事故）。 */
  const EXPECT_TEETH = 11;
  const teethBad: string[] = [];
  for (const [name, line, next, want] of TEETH) {
    const got = verdict(line, next);
    if (got !== want) teethBad.push(`${name}：期望 ${want}，实得 ${got}`);
  }
  ok('gate/strip-rule-teeth', teethBad.length === 0 && TEETH.length === EXPECT_TEETH,
    `牙齿形状必须恰好 ${EXPECT_TEETH} 种（实得 ${TEETH.length}）且全部判对。`
    + 'readDataText/readDataBytes 是"数据读"这一类（底本 .txt、原始 PG 档）：认类别不认文件名，'
      + '定义处与调用处都靠这个名字标出来；拿它去读源码文本再做判定就是当场撒谎。'
    + '包一层 strip*/codeOf、经 require 但外层仍包着、同一行内联 .replace(/\\/\\*、读进变量后三行内剥 —— 四种都判"已剥"；'
    + '裸读、以及"本行早先有一个已经闭合的 strip(...) 但包的不是这一读"都判裸；注释行与 .json/.png/JSON.parse 不算在读源码。'
    + '判据形状变了会点名是哪一种形状对不上（全过才算绿），先确认形状再改判据，不要改期望。'
    + '豁免只认看得见的扩展名 —— 路径藏在变量里时不算，那种进 STRIP_ALLOWLIST 写原因（条目对应的读点不见了会判红）。'
    + `实得不合：${teethBad.join(' | ') || '无'}`);

  const gateOffenders: string[] = [];
  const gateByFile: Record<string, number> = {};
  const stripHits = new Set<string>();
  const scanDir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) scanDir(join(dir, e.name));
      else if (e.name.endsWith('.ts')) {
        const p = join(dir, e.name);
        const rel = p.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/') + '/', '');
        // 按**原始行**扫（报出来的行号要能在文件里找到 —— 先整档剥注释会让行号漂，
        // 我第一版就这样，指给人看一个不存在的位置），注释形状的行由 verdict 自己跳。
        const rows = readFileSync(p, 'utf8').split('\n');
        rows.forEach((raw, i) => {
          const v = verdict(raw, rows.slice(i + 1, i + 4));
          if (v !== 'naked') return;
          const l = strip(raw);
          const al = STRIP_ALLOWLIST.find(a => rel.endsWith(a.where.split('|')[0]) && l.includes(a.where.split('|')[1]));
          if (al) { stripHits.add(al.where); return; }
          gateOffenders.push(`${rel}:${i + 1} ${l.trim().slice(0, 56)}`);
          gateByFile[rel] = (gateByFile[rel] || 0) + 1;
        });
      }
    }
  };
  scanDir(join(ROOT, 'tools'));
  const staleStripAllow = STRIP_ALLOWLIST.filter(a => !stripHits.has(a.where)).map(a => a.where);
  ok('gate/text-comparing-gates-strip-comments', gateOffenders.length === 0 && staleStripAllow.length === 0,
    `tools/ 下 .ts 里每一处拿产品源码文本做判定的 readFileSync 都必须剥注释（包一层 strip/stripComments/stripLiterals/codeOf，`
    + `或同一行内联 .replace，或读进变量后三行内剥）；读 .json/.png/.md 与 JSON.parse 不算。实得 ${gateOffenders.length} 处裸读`
    + `${gateOffenders.length ? '，按档分布 ' + Object.entries(gateByFile).map(([f, n]) => `${f}=${n}`).join(' | ') + '；例 ' + gateOffenders.slice(0, 3).join(' | ') : ''}。`
    + `${staleStripAllow.length ? ' 另外 allowlist 里有已经不存在的读点（该删）：' + staleStripAllow.join('、') + '。' : ''}`
    + '规则出处见 tools/visual-harness/README.md「通用规则：任何比较代码文本的闸门，先剥注释」。');
}

const fails = lines.filter(l => l.startsWith('FAIL'));

// 断言名直接进摘要那一行：只 tail 一行、或日志只留尾行的人，不该再遇到
// "fail=1 但没捕获是哪一条" —— 一次定位不了的失败，等于一次修不了的失败。
const failNames = fails.map(l => (l.split(/\s+/)[1] || '?'));
const summary = `kline acceptance: segments=${male.段.length} lanes=${male.段[0].泳道.length} marks=${male.段.reduce((n, s) => n + s.泳道.reduce((m, l) => m + l.标注.length, 0), 0)} pass=${pass} fail=${fail}`
  + (skips.length ? ` skip=${skips.length}` : '')
  + (failNames.length ? `  未过：${failNames.join(' , ')}` : '');
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
if (skips.length) console.log('  SKIP（判定不了，不算通过）：' + skips.join(' ; '));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
