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
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import { getZhiCangGanFull } from '../../frontend/app/lib/core/yiqi-core/bazi';
import { getShiShen } from '../../frontend/app/lib/core/bazi-enrich/tables';
import { SHISHEN_MAP } from '../../frontend/app/lib/core/yiqi-core/ganzhi';
import type { BaziChart } from '../../frontend/app/lib/core/yiqi-core/types';
import {
  buildKline, eventLabel, KLINE_BASIS, KLINE_LANES, KLINE_GROUPS,
  KLINE_NO_SCORE, KLINE_LICHUN_NOTE, KLINE_RELATION_NOTE,
} from '../../frontend/lib/bazi/kline';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.kline.txt';
const ROOT = join(__dirname, '../..');
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
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
  ok('relation/declared-unbuilt', male.边界.includes(KLINE_RELATION_NOTE)
    && /未接|待裁/.test(KLINE_RELATION_NOTE),
    `落点必须显式声明本批未接、而不是留白：${KLINE_RELATION_NOTE}`);
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
  ok('basis/lichun-on-page', comp.includes('KLINE_LICHUN_NOTE') && comp.includes('流年干支按立春换年')
    || comp.includes('{KLINE_LICHUN_NOTE}'),
    '这句不能只活在模块里，页面必须渲染它');
  ok('basis/stamp', male.口径戳 === KLINE_BASIS && KLINE_BASIS === 'kline-category-v1',
    `口径戳 ${KLINE_BASIS}（盘面输出里带的也是它）：改摆法必须升它，否则老截图无法区分`);
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
  const added = keysOf(pkg).filter(k => !keysOf(basePkg).includes(k));
  ok('dep/no-new-package', added.length === 0, `零新依赖：实得新增 ${added.join('、') || '无'}`);
  // 改动清单要真的能列出来：只看 origin/main..HEAD 的话，提交之前的工作区一个文件都不算，
  // 这条就会空过（本项目"前提断言"第四次用上）。所以已跟踪的 diff 与未跟踪的新文件一起数。
  const tracked = execSync('git diff --name-only origin/main', { cwd: ROOT, encoding: 'utf8' });
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
  const touched = (tracked + '\n' + untracked).split('\n').map(s => s.trim()).filter(Boolean);
  ok('change-list/is-real', touched.length >= 3,
    `本批的改动清单必须列得出来（否则下面这条"没动算法层"是空过）：实得 ${touched.length} 个文件`);
  const engine = touched.filter(f => /app\/lib\/core\/(yiqi-core|bazi-enrich)\//.test(f));
  ok('algo/layer-untouched', engine.length === 0,
    `本批不许动命理算法层（落点要接就得单开一批、前后端两份同源拷贝一起改）：命中 ${engine.join(' | ') || '无'}`);
}

const summary = `kline acceptance: segments=${male.段.length} lanes=${male.段[0].泳道.length} marks=${male.段.reduce((n, s) => n + s.泳道.reduce((m, l) => m + l.标注.length, 0), 0)} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
