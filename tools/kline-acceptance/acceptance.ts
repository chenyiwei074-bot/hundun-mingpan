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
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import { getZhiCangGanFull } from '../../frontend/app/lib/core/yiqi-core/bazi';
import { getShiShen, DIZHI } from '../../frontend/app/lib/core/bazi-enrich/tables';
import { zhiPairRelations } from '../../frontend/app/lib/core/bazi-enrich/zhi-relations';
import { SHISHEN_MAP } from '../../frontend/app/lib/core/yiqi-core/ganzhi';
import type { BaziChart } from '../../frontend/app/lib/core/yiqi-core/types';
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
  const comp = readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8');
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
  const comp = readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8');
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
  const klineSrc = readFileSync(join(ROOT, 'frontend', 'lib', 'bazi', 'kline.ts'), 'utf8');
  const banned = ['LIU_CHONG', 'LIU_HE', 'SAN_HE', 'XIANG_XING', 'LIU_HAI', 'ZHI_CHONG', '地支六冲'];
  const copied = banned.filter(t => klineSrc.includes(t));
  ok('relation/no-copied-table', copied.length === 0,
    `事实层不得自带地支关系表（现有函数只遍历命局四柱，要接落点必须在算法层开导出函数）：命中 ${copied.join('、') || '无'}`);
}

// ── 6. 立春口径必须写在页面上：公历年与干支年不是同一个轴 ──
{
  ok('basis/lichun-disclosed', male.边界.includes(KLINE_LICHUN_NOTE),
    `流年干支按立春换年，公历轴与干支轴不重合，这句必须在边界里：${KLINE_LICHUN_NOTE}`);
  const comp = readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8');
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
  const src = readFileSync(join(ROOT, 'frontend', 'lib', 'bazi', 'kline.ts'), 'utf8');
  const imports = (src.match(/^import .*$/gm) || []);
  const offside = imports.filter(i => !/core\/yiqi-core|core\/bazi-enrich|@\/app\/lib\/core/.test(i));
  ok('dep/engine-only-imports', offside.length === 0,
    `事实层只能 import 引擎与现成函数：越界 ${offside.join(' | ') || '无'}`);
  const comp = readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'LifeCurve.tsx'), 'utf8');
  ok('dep/no-network', !/fetch\(|XMLHttpRequest|WebSocket|axios/.test(comp) && !/fetch\(|axios/.test(src),
    '本节的取数与标注全程在浏览器本地：不得有任何网络调用');
  // 本地存的纪律：键必须带版本前缀，读写都必须包在 try/catch（隐私模式会直接抛）
  const hasTry = (comp.match(/try\s*\{/g) || []).length >= 2;
  ok('storage/prefixed-and-guarded', /['"]kline-events-v1:/.test(comp) && hasTry,
    `localStorage 键必须带版本前缀且读写都包 try/catch（隐私模式写不进去是常态）：try 块 ${(comp.match(/try\s*\{/g) || []).length} 个`);
  ok('storage/no-visitor-id', !/getVisitorId|visitor_id/.test(comp),
    '标注键只用四柱+日主，不挂 visitorId —— 那是报告归属凭据，不该把本地涂鸦与账号绑起来');
  const mounted = readFileSync(join(ROOT, 'frontend', 'app', 'chart', 'result', '[id]', 'page.tsx'), 'utf8');
  ok('route/mounted-unconditional', /<LifeCurve chart=\{enrichedChartData\.bazi\} \/>/.test(mounted)
    && !/LifeCurve chart=\{[^}]*\}\s*&&/.test(mounted),
    '结果页无条件挂载，降级由组件自己给（与 #40 裁定 6 同一条路）');
  const home = readFileSync(join(ROOT, 'frontend', 'app', 'page.tsx'), 'utf8');
  const catalog = readFileSync(join(ROOT, 'frontend', 'lib', 'tools', 'catalog.ts'), 'utf8');
  ok('route/no-new-entry', !/人生K线/.test(home) && !/人生K线/.test(catalog),
    '首页与目录页都不新增入口 —— 它是命盘的一个读法，不是一件新工具');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8'));
  const basePkg = JSON.parse(execSync('git show origin/main:frontend/package.json',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }));
  const keysOf = (o: { dependencies?: object; devDependencies?: object }) =>
    Object.keys({ ...o.dependencies, ...o.devDependencies }).sort();
  // 2026-10-20：three/@types/three 经批准引入（户型 WebGL 舞台），是本批唯一白名单；
  // 其余任何新依赖仍判红。
  const SANCTIONED_DEPS = new Set(['three', '@types/three']);
  const added = keysOf(pkg).filter(k => !keysOf(basePkg).includes(k) && !SANCTIONED_DEPS.has(k));
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
  skips.push(...(ahead > 0 ? [] : ['批范围三条断言（改动清单 / 算法层范围 / server 不碰）']));
  ok('change-list/is-real', ahead > 0 && touched.length >= 1,
    ahead === 0 ? 'HEAD 相对 merge-base 还没有提交：这几条判定的是"本批交了什么"，先 commit 再跑（现在计 SKIP，不算通过）'
      : `本批提交里能列出改动文件（否则下面"没乱动算法层"是空过）：${ahead} 个提交 / ${touched.length} 个文件`);
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
  const commentOrBlank = (l: string) => /^\s*(\/\/|\/\*|\*|$)/.test(l.slice(1));
  const commentOnlyLines = (d: string[]) => d.length > 0 && d.every(commentOrBlank);
  const crossedFlagLines = (d: string[]) => d.length > 0
    && d.filter(l => !commentOrBlank(l) && !/crossed|ziChenIndex/.test(l)).length === 0;
  const commentOnlyChange = (f: string) => commentOnlyLines(diffOf(f));
  const crossedFlagOnly = (f: string) => crossedFlagLines(diffOf(f));
  // 两道窄门自己的牙齿，喂**假 diff** 给分类器 —— 不依赖仓库当下改了什么。
  // 拿真实文件当反例的那种写法会自己失效：下一个只改了注释的批次会让"反例"变成正例。
  ok('algo/crossed-hatch-is-narrow',
    crossedFlagLines(['-    crossed: { hour: a !== b, day: !s },', '+    crossed: { hour: ziChenIndex(x) !== ziChenIndex(c), day: !s },'])
    && commentOnlyLines(['+  /** 时辰是两小时一格 */'])
    && !crossedFlagLines(['+    const dayGan = getDayGan(x);'])
    && !crossedFlagLines(['-  const solar = Solar.fromYmdHms(a, b, c, 23, 0, 0);', '+  const solar = Solar.fromYmdHms(a, b, c, 0, 0, 0);'])
    && !commentOnlyLines(['+  const a = 1;']) && !commentOnlyLines([]) && !crossedFlagLines([]),
    '窄门只放过"只碰 crossed 那一格"和"纯注释"两种：往分类器里塞一行普通取数代码必须判 false，'
    + '空 diff 两条都判 false（没改动也算通过就是空过）');
  const engineOfflist = engine.filter(f => !inAllow(f));
  ok('algo/only-the-pairwise-export',
    engine.every(f => inAllow(f) || loggingOnlyRemoval(f) || commentOnlyChange(f) || crossedFlagOnly(f)),
    `动到的算法层文件只能是 ${[...ENGINE_ALLOW].join(' / ')}（清单外只放行三种：新增 0 行且删的全是 console.* 语句 / 纯注释空行 / 只碰 crossed 那一格）：实得 ${engine.join(' | ') || '（无）'}；清单外 ${engineOfflist.join(' | ') || '（无）'}${engineOfflist.length ? '；不合规的行 ' + engineOfflist.map(f => {
      const d = execSync(`git diff ${base}..HEAD -- "${f}"`, { cwd: ROOT, encoding: 'utf8' });
      return f.replace(/^frontend\/app\/lib\/core\//, '') + '[' + d.split('\n').filter(l => (l.startsWith('+') && !l.startsWith('+++')) || (l.startsWith('-') && !l.startsWith('---'))).join('').slice(0, 120) + ']';
    }).join(' ') : ''}`);
  // 合盘层不许自带第二份地支/天干关系表 —— 复用算法层导出，是这批允许改算法层的交换条件。
  let hepanCopied: string[] = [];
  try {
    const hepanSrc = ['engine.ts', 'local-store.ts', 'types.ts']
      .map(f => readFileSync(join(ROOT, 'frontend', 'lib', 'hepan', f), 'utf8')).join('\n');
    hepanCopied = ['GAN_HE_PAIRS', 'LIU_CHONG', 'LIU_HE', 'SAN_HE', 'SAN_HUI', 'XIANG_XING', 'LIU_HAI', 'ZHI_CHONG']
      .filter(tok => hepanSrc.includes(tok));
  } catch { /* 合盘文件不存在时这条不适用 */ }
  ok('algo/hepan-no-copied-table', hepanCopied.length === 0,
    `合盘层不得自带关系表（必须复用 bazi-enrich 的导出）：命中 ${hepanCopied.join('、') || '无'}`);
  const server = touched.filter(f => f.startsWith('server/'));
  ok('server/untouched', ahead === 0 || server.length === 0,
    `本批提交里没有 server/ 文件（那份 byte-同拷贝由运维改）：实得 ${server.join(' | ') || '（无）'}`);
  const rel = readFileSync(join(ROOT, 'frontend', 'app', 'lib', 'core', 'bazi-enrich', 'zhi-relations.ts'), 'utf8');
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
  const prints = yqFiles.flatMap(f => {
    const code = strip(readFileSync(join(yqDir, f), 'utf8'));
    const loose = code.match(/console\.(log|info|debug|trace)\(/g) || [];
    const marker = code.match(/console\.\w+\([^)]*(?:🔍|计算结果)[^)]*\)/g) || [];
    return [...loose, ...marker].map(m => `${f}: ${m.slice(0, 48)}`);
  });
  ok('core/no-unconditional-engine-prints', prints.length === 0,
    `yiqi-core 里不许有 console.log/info/debug/trace，也不许有消息体带 🔍 或「计算结果」的调试打印（那两行是这次删掉的）：命中 ${prints.join(' | ') || '0 处'}；扫了 ${yqFiles.length} 个文件`);
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
