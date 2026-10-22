// 百宝箱目录验收：目录页唯一的价值是「说的和做的一致」，所以这里不测样式，只测三件事——
// 入口指向的页面真的存在、口径字符串等于引擎当前导出的常量、没做的功能没有拿到入口。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/directory-acceptance/acceptance.ts --out=.directory.txt
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
// 2026-10-21 裁定：任何拿产品源码文本做判定的闸门先剥注释（见 tools/_lib/codesrc.ts）。
import { stripComments } from '../_lib/codesrc';
import { join } from 'node:path';
import { GANZHI_BASIS, NAJIA_BASIS } from '../../frontend/lib/liuyao/core';
import { QISHU_BASIS } from '../../frontend/lib/meihua/engine';
import { COIN_COMMIT_SCHEMA } from '../../frontend/lib/receipt/receipt';
import { FENGSHUI_BASIS } from '../../frontend/lib/fengshui/analysis';
import { HEPAN_BASIS } from '../../frontend/lib/hepan/types';
import { CATALOG_STAMPS, CLOSED_TOOLS, HOME_FEATURED_SLUGS, INTENT_ENTRIES, INTENTS, LAUNCHER_SLUGS, LIUYAO_BASIS_TEXT, LIVE_HREFS, TOOLS_INDEX, TOOL_BY_SLUG, homeCard } from '../../frontend/lib/tools/catalog';
import { WESTERN_CLOSED_TOOLS, WESTERN_INTENTS, WESTERN_LIVE_HREFS } from '../../frontend/lib/tools/western-catalog';
import { statusCounts, statusTally } from '../../frontend/lib/tools/status';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.directory.txt';
const APP = join(__dirname, '../../frontend/app');
const FE = join(__dirname, '../../frontend');
// #双体系：/ 收成"选体系"的门廊，原来那张首页整体搬到 components/home/OrientalBody.tsx。
// 因此下面每条钉"首页"的断言都必须明确自己钉的是哪一个文件 —— 指错了要么空过
// （门廊里当然没有工具清单），要么永远红（内容搬走了但断言还蹲在老位置）。
const GATE = join(FE, 'app', 'page.tsx');
const ORIENTAL = join(FE, 'components', 'home', 'OrientalBody.tsx');

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

/** 路由是否存在：/chart/result/[id] 这类动态段按通配处理。 */
function routeExists(href: string): boolean {
  const clean = href.replace(/^\/+|\/+$/g, '');
  const segs = clean === '' ? [] : clean.split('/');
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) return existsSync(join(dir, 'page.tsx'));
    const [head, ...tail] = rest;
    if (!existsSync(join(dir, head))) {
      // 动态段：[id] / [id2] 之类，任意一个都能匹配
      const dyn = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [];
      const hit = dyn.filter(d => d.isDirectory() && /^\[[^/]+\]$/.test(d.name)).map(d => join(dir, d.name));
      return hit.some(h => walk(h, tail));
    }
    return walk(join(dir, head), tail);
  };
  return walk(APP, segs);
}

const ALL_TOOLS = INTENTS.flatMap(g => g.tools);
const OPEN = ALL_TOOLS.filter(t => t.status !== '未开放');

// ── 1. 骨架：四类意图固定，条目不重名 ──
{
  const want = ['认识自己', '问一件事', '择时看周期', '看关系'];
  const got = INTENTS.map(g => g.intent);
  const names = ALL_TOOLS.map(t => t.name);
  ok('dir/intents-fixed', JSON.stringify(got) === JSON.stringify(want),
    `目录必须按这四类组织（顺序即首页引导顺序）：实得 ${got.join('/')}，应为 ${want.join('/')}`);
  ok('dir/no-duplicate-tool', new Set(names).size === names.length,
    `条目名不得重复（重复会让「按术数查找」出现两份口径）：${names.length} 条 / 去重 ${new Set(names).size}`);
  ok('dir/each-group-nonempty', INTENTS.every(g => g.tools.length > 0 && g.lead.length > 8),
    `每一类都要有条目与一句话导语：${INTENTS.map(g => `${g.intent}=${g.tools.length}`).join(' ')}`);
}

// ── 2. 入口诚实：可用条目指向真实路由，未开放条目不许有入口 ──
{
  const badOpen = OPEN.filter(t => !t.href || !routeExists(t.href)).map(t => `${t.name}→${t.href || '无'}`);
  ok('dir/open-hrefs-resolve', badOpen.length === 0,
    `${OPEN.length} 个已开放条目的 href 全部对应 app/**/page.tsx 真实存在：不存在的 ${badOpen.join(' | ') || '0 个'}`);
  const closedWithLink = ALL_TOOLS.filter(t => t.status === '未开放' && !!t.href).map(t => `${t.name}→${t.href}`);
  ok('dir/closed-has-no-entry', closedWithLink.length === 0 && CLOSED_TOOLS.length > 0,
    `未开放条目（${CLOSED_TOOLS.length} 个：${CLOSED_TOOLS.join('、')}）一律不得带 href：违规 ${closedWithLink.join(' | ') || '0 个'}`);
  const liveOk = LIVE_HREFS.every(routeExists);
  ok('dir/live-hrefs-dedup', liveOk && LIVE_HREFS.length > 0,
    `去重后的入口清单 ${LIVE_HREFS.length} 条全部可达：${LIVE_HREFS.join(' ')}`);
}

// ── 3. 内容不空壳：四段都有实质文字 ──
{
  const thin = ALL_TOOLS.filter(t =>
    !(t.question.length >= 8 && t.method.length >= 4 && t.basis.length >= 2 && t.reading.length >= 2)).map(t => t.name);
  const missingNote = ALL_TOOLS.filter(t => t.status === '未开放' && !t.note).map(t => t.name);
  ok('dir/four-fields-nonempty', thin.length === 0,
    `每条都要有「适用问题 / 方法 / 计算口径 / 结果怎么读」四段实义文字：空壳 ${thin.join('、') || '0 条'}`);
  ok('dir/closed-explains-why', missingNote.length === 0,
    `未开放条目必须写明为什么没做（否则读者无法区分「没做」与「忘了写」）：缺说明 ${missingNote.join('、') || '0 个'}`);
}

// ── 4. 口径戳不许手写残留：目录里出现的版本戳必须等于引擎当前导出的常量 ──
{
  const truth: Record<string, string> = {
    [GANZHI_BASIS]: 'GANZHI_BASIS',
    [NAJIA_BASIS]: 'NAJIA_BASIS',
    [QISHU_BASIS]: 'QISHU_BASIS',
    [COIN_COMMIT_SCHEMA]: 'COIN_COMMIT_SCHEMA',
    [FENGSHUI_BASIS]: 'FENGSHUI_BASIS',
    [HEPAN_BASIS]: 'HEPAN_BASIS',
  };
  const engine = { ganzhi: GANZHI_BASIS, najia: NAJIA_BASIS, qishu: QISHU_BASIS, commit: COIN_COMMIT_SCHEMA, fengshui: FENGSHUI_BASIS, hepan: HEPAN_BASIS };
  const drift = (Object.keys(CATALOG_STAMPS) as (keyof typeof CATALOG_STAMPS)[])
    .map(k => `${k}: 目录 ${CATALOG_STAMPS[k]} vs 引擎 ${engine[k]}`)
    .filter(line => {
      const [a, b] = line.split(' vs ');
      return a.split('目录 ')[1] !== b.split('引擎 ')[1];
    });
  ok('dir/stamps-equal-engine', drift.length === 0,
    `目录写死的 ${Object.keys(CATALOG_STAMPS).length} 项口径戳必须逐字等于引擎导出值，引擎改戳而目录没跟上就在这里红：${drift.join(' | ') || `${Object.keys(engine).length} 项一致（${Object.values(engine).join(' / ')}）`}`);
  const STAMP = /[a-z]+-[a-z]+-v\d+/g;
  const corpus = ALL_TOOLS.map(t => `${t.name} ${t.basis} ${t.note || ''}`).join('\n') + '\n' + LIUYAO_BASIS_TEXT;
  const found = Array.from(new Set(corpus.match(STAMP) || []));
  const stale = found.filter(v => !truth[v]);
  ok('dir/stamps-match-engine', found.length >= 4 && stale.length === 0,
    `目录里出现的口径戳 ${JSON.stringify(found.sort())} 必须全部等于引擎当前导出值（含新加的随机承诺戳）：写歪或残留旧戳 ${stale.join('、') || '0 个'}`);
  ok('dir/liuyao-basis-carries-three', LIUYAO_BASIS_TEXT.includes(GANZHI_BASIS) && LIUYAO_BASIS_TEXT.includes(NAJIA_BASIS) && LIUYAO_BASIS_TEXT.includes(QISHU_BASIS),
    `六爻条目的口径串三项齐备（戳是目录里的字面量，其正确性由 dir/stamps-equal-engine 钉住）：${LIUYAO_BASIS_TEXT}`);
}

// ── 5. 门廊、东方工作页与导航：入口位不许指向不存在的路由 ──
{
  const home = [GATE, ORIENTAL].map(f => stripComments(readFileSync(f, 'utf8'))).join('\n');
  const nav = stripComments(readFileSync(join(APP, '..', 'components', 'Nav.tsx'), 'utf8'));
  const literals = Array.from(new Set([
    ...home.match(/href\s*[:=]\s*"\/[^"]*"/g) || [],
    ...home.match(/href\s*[:=]\s*'\/[^']*'/g) || [],
    ...nav.match(/href\s*[:=]\s*'\/[^']*'/g) || [],
    ...nav.match(/href\s*[:=]\s*"\/[^"]*"/g) || [],
  ].map(s => s.replace(/^.*[:=]\s*["']/, '').replace(/["']$/, ''))));
  const broken = literals.filter(h => !routeExists(h));
  ok('shell/no-broken-entry', broken.length === 0,
    `门廊 + 东方工作页 + 导航的 ${literals.length} 个字面 href 全部可达（${literals.sort().join(' ')}）：断链 ${broken.join(' | ') || '0 个'}`);
  const hashEntries = (home.match(/href\s*:\s*["']#["']/g) || []).length;
  ok('shell/no-hash-placeholder', hashEntries === 0,
    `门廊与工作页不得留 href="#" 的占位入口（未开放一律走「无 href + 无按钮 + 写明原因」，与目录页同一做法）：残留 ${hashEntries} 处`);
  // 裁定 ①（批10）：/tools 从门廊搬走，挂在两页工作页的页脚。这条不是删掉而是改指 ——
  // 它防的是"目录页变成孤儿"（从任何工作页都进不去），搬位置照样要有人钉。
  // 门廊那侧反过来钉"不许再出现"：门廊一旦留一条聚合入口，它就又开始当第三个地方。
  const gateSrc = stripComments(readFileSync(GATE, 'utf8'));
  const workFiles: Array<[string, string]> = [
    ['东方 OrientalBody', ORIENTAL],
    ['共用框架 ModeLanding', join(FE, 'components', 'home', 'ModeLanding.tsx')],
  ].map(([name, f]) => [name, stripComments(readFileSync(f, 'utf8'))] as [string, string]);
  const missing = workFiles.filter(([, src]) => !/href\s*=\s*["']\/tools["']/.test(src)).map(([name]) => name);
  ok('shell/tools-entry-linked', !/href\s*[:=]\s*["']\/tools["']/.test(gateSrc) && missing.length === 0,
    '门廊上不许再有 /tools；两页工作页各自都要有一条 /tools（东方在正文底部、西方在共用页脚）—— 目录页要从工作页可达，缺的是：'
    + `${missing.join('、') || '无'}`);
  // ① 的另一半：两栏各是一个 <a>，栏内不许嵌套第二个可点元素。
  // 嵌套一次，键盘就要在同一块地方走两遍，读屏报出来的层级也是假的。
  const anchors = (gateSrc.match(/<Link\b/g) || []).length;
  const nested = (gateSrc.match(/<(button|input|select|textarea|a)\b/g) || []).length;
  // 源码里只该有 1 个 <Link>：它在 ENTRIES.map 里，运行时渲染成两栏。
  // "两栏"这个数是 harness 从 DOM 数的（a.domain-card 恰好 2），这里钉的是另一件事：
  // 栏内不许有第二种可点元素，也不许有人再往门廊上加第三个入口。
  ok('gate/panel-is-single-anchor', anchors === 1 && nested === 0,
    `门廊源码只许有一个 <Link>（两栏由同一个 map 产出）且没有任何 <button>/<a>/表单元素：实得 Link ${anchors} 个 / 其它可点 ${nested} 处`);
  ok('gate/no-in-page-back-link', !/domain-back/.test(gateSrc) && !/domain-back/.test(stripComments(readFileSync(ORIENTAL, 'utf8'))),
    '换体系这条路只走导航（工作页导航里有「返回选择」），正文里再来一条就是同一个动作的两个出处');
}

// ── 6. 目录页自身 + 状态单源（裁定 ⑤）──
{
  const page = stripComments(readFileSync(join(APP, 'tools', 'page.tsx'), 'utf8'));
  const statusSrc = stripComments(readFileSync(join(APP, '..', 'lib', 'tools', 'status.ts'), 'utf8'));
  // 双闸门本身仍在，只是从"每个页面各写一遍"收成一份；这条因此改钉两件事：
  // 判据在 status.ts 里存在，而消费它的页面不许再自己写第二份。
  ok('dir/page-gates-link', /status\s*!==\s*'未开放'\s*&&\s*!!t\.href/.test(statusSrc)
    && /isLiveEntry/.test(page) && !/status\s*!==\s*'未开放'\s*&&\s*t\.href/.test(page),
    '「非未开放 且 有 href」这道双闸门只许存在于 lib/tools/status.ts 一份，目录页吃它而不是重写一遍');
  const statusLabels = ['可用', '部分可用', '未开放'];
  ok('dir/status-vocabulary', statusLabels.every(s => statusSrc.includes(s)) && page.includes('「可用」') && page.includes('「未开放」'),
    `状态只允许 ${statusLabels.join('/')} 三档（定义在 status.ts），且目录页给出每一档是什么意思（读者能据此判断标签含义）`);

  // ⑤ 的牙齿：状态表全站只有一份，且没有任何 var() 指向一支并不存在的令牌。
  // 缺陷③的形状就是 `var(--color-border-strong, rgba(0,0,0,.22))` —— 全站从来没定义过那支令牌，
  // 回退值在 #241a3d 上等于没画，而带 fallback 的 var() 让这件事**看起来**是有意的。
  const srcFiles: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) walk(join(dir, e.name)); }
      else if (/\.(ts|tsx)$/.test(e.name)) srcFiles.push([join(dir, e.name).replace(/\\/g, '/'), stripComments(readFileSync(join(dir, e.name), 'utf8'))]);
    }
  };
  walk(FE);
  const tables = srcFiles.filter(([, src]) => /const STATUS_DOT\b/.test(src)).map(([f]) => f.replace(FE.replace(/\\/g, '/') + '/', ''));
  ok('dir/status-dot-single-source', tables.length === 1 && tables[0] === 'lib/tools/status.ts',
    `STATUS_DOT 这张表全站只许有一份（在 lib/tools/status.ts），别处再写一份就会各配各的：实得 ${tables.join('、') || '0 份'}`);
  const dotUsers = srcFiles.filter(([, src]) => /STATUS_DOT\[/.test(src) && !/from '@\/lib\/tools\/status'/.test(src)).map(([f]) => f);
  ok('dir/status-dot-imported', dotUsers.length === 0,
    `用圆点表就必须 import 那一份，不许在页面里另起：违规 ${dotUsers.join('、') || '无'}`);
  const css = stripComments(readFileSync(join(APP, 'globals.css'), 'utf8'));
  // 范围：--color-* 与 --qn-*（令牌只有这两个前缀是"定义在 globals.css、由 var() 消费"的）。
  // 本批第一次跑，这条就咬到了我自己刚写的一行 —— 计数行那档字号我写成了
  // var(--qn-fs-sub)，全站没有那支令牌，字号会安静地继承成 15px，屏上看着"还行"、
  // 阶梯却已经不在它那一档。这正是这类 var() 拼错最典型的落地形状。
  const defined = new Set([...css.matchAll(/(--(?:color|qn)-[\w-]+)\s*:/g)].map(m => m[1]));
  const usedVars = new Map<string, Array<{ file: string; fallback: boolean }>>();
  const relOf = (f: string) => f.replace(FE.replace(/\\/g, '/') + '/', '');
  for (const [f, src] of [...srcFiles, ['app/globals.css', css]] as Array<[string, string]>) {
    for (const m of src.matchAll(/var\((--(?:color|qn)-[\w-]+)(\s*,)?/g)) {
      const list = usedVars.get(m[1]) || [];
      list.push({ file: relOf(f), fallback: !!m[2] });
      usedVars.set(m[1], list);
    }
  }
  const undefinedVars = [...usedVars.entries()].filter(([name]) => !defined.has(name));
  // 量出来 4 支未定义令牌、共 5 处使用（缺陷③同一类，只是还没咬到人）：
  // 带 fallback 的那三支现在渲染的就是 fallback —— 看着对、名字是假的，而且写错永远不会红；
  // FloorPlanStudio 那两处**不带** fallback：属性按 invalid-at-computed-value 处理，
  // 于是"未确认"那一档的描边退回继承值 = 没有颜色，那是看得见的缺陷。
  // 本批不顺手改（分别归回执卡与批C 户型），但用带理由 + 失配判红的清单钉住：不许新增，也不许长在地基里。
  const UNDEFINED_ALLOWLIST: Array<{ name: string; file: string; why: string }> = [
    { name: '--color-border', file: 'app/liuyao/result/[id]/ReceiptPanel.tsx', why: '带 fallback，渲染的是 fallback；改它要单独排（回执卡）' },
    { name: '--color-border-subtle', file: 'components/bazi/LifeCurve.tsx', why: '带 fallback；与 --color-hairline 同义不同名' },
    { name: '--color-border-subtle', file: 'components/bazi/ScenarioMatrix.tsx', why: '带 fallback；场景矩阵两处' },
  ];
  const keyOf = (n: string, f: string) => `${n}@${f}`;
  const gotKeys = new Set(undefinedVars.flatMap(([n, us]) => us.map(u => keyOf(n, u.file))));
  const listedKeys = new Set(UNDEFINED_ALLOWLIST.map(e => keyOf(e.name, e.file)));
  const fresh = [...gotKeys].filter(k => !listedKeys.has(k));
  const stale = UNDEFINED_ALLOWLIST.filter(e => !gotKeys.has(keyOf(e.name, e.file)));
  ok('dir/no-undefined-css-var', fresh.length === 0 && stale.length === 0,
    `var() 引用的 --color-* / --qn-* 必须在 globals.css 里有定义（带 fallback 的名字写错永远不会红，只是安静画成回退值；不带的那种属性直接失效）。`
    + `清单外新增 ${fresh.join(' | ') || '0 处'}；清单里已不成立 ${stale.map(e => keyOf(e.name, e.file)).join(' | ') || '0 处'}（成立就报"已不成立"，那是要从清单删掉的信号，不是好消息该留着）`);
  for (const e of UNDEFINED_ALLOWLIST) say(`MEASURED 未定义令牌 ${e.name} @ ${e.file} —— ${e.why}`);
  // 组件里写出来的自有 class，globals.css 必须有对应选择器。
  // 逼出这条的那次事故：批C 把步条的 DOM 提交了，样式落在同一个提交之外 ——
  // 分支上那份"有 .fp-steps 这个类名、没有任何 .fp-steps 规则"，画面是裸的，
  // 而宽度/命中区/对比度/CLS 全都照样绿（没样式的块也是块）。
  // 只从 className 的取值里取词（不扫全部字符串字面量）：id="fp-notice" 不是类，
  // 把它算进来会逼着给每个 id 写一条假选择器。
  const cssSel = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const OWN = /^(?:qn|qa|fp|gate|domain)-[a-z0-9_-]*[a-z0-9]$/;
  const classUses = new Map<string, string>();
  for (const [f, src] of [...srcFiles] as Array<[string, string]>) {
    for (let i = src.indexOf('className='); i >= 0; i = src.indexOf('className=', i + 1)) {
      const at = src[i + 10];
      let raw = '';
      if (at === '"' || at === "'") { const end = src.indexOf(at, i + 11); raw = src.slice(i + 11, end); i = end; }
      else if (at === '{') {                                   // 平衡大括号取整个表达式
        let d = 0, j = i + 10;
        for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
        raw = src.slice(i + 11, j);
      }
      // 直接按"非类名字符"切：模板串里的 ${...} 会把引号切得七零八落，
      // 先抠字符串字面量反而漏掉 `qn-chip`（我第一版就是这么写的，扫到 3 个类名 = 近乎空跑）。
      for (const tok of raw.split(/[^A-Za-z0-9_-]+/)) if (OWN.test(tok) && !classUses.has(tok)) classUses.set(tok, relOf(f));
    }
  }
  const orphan = [...classUses.entries()].filter(([t]) => {
    const esc = t.replace(/-/g, '\\-');
    return !new RegExp('\\.' + esc + '(?![\\w-])').test(cssSel);
  });
  // 量到 8 个没有规则的类名，逐个分两类处理（清单带失配判红，不许长在地基里）：
  //  · 探针钩子 / 惰性标记：类名是给 census 或语义用的，样式由 .qn-card 那一层给 —— 留着，写明；
  //  · 真的漏了：fp-steps__name（批C 我自己写的）已经补了规则，不在清单里。
  const HOOK_ONLY: Array<{ cls: string; why: string }> = [
    { cls: 'qa-turn', why: 'census 的问答卡选择器（12 处），样式走 .qn-card' },
    { cls: 'qa-degraded', why: '降级理由那一行的语义标记，样式同 .qn-note' },
    { cls: 'qn-kline', why: 'census 的 K 线探针选择器，格子样式全是内联（SVG 属性）' },
    { cls: 'qn-kline--empty', why: '空态标记，同上' },
    { cls: 'qn-kline-grid', why: '网格层标记，SVG 里没有 CSS 类样式' },
    { cls: 'qn-scenario', why: 'census 的场景矩阵探针，样式走 .qn-card 与内联' },
    { cls: 'qn-scenario--empty', why: '空态标记，同上' },
  ];
  const hookKeys = new Set(HOOK_ONLY.map(e => e.cls));
  const freshOrphans = orphan.filter(([t]) => !hookKeys.has(t));
  const staleHooks = HOOK_ONLY.filter(e => !orphan.some(([t]) => t === e.cls)).map(e => e.cls);
  ok('dir/class-has-selector', classUses.size >= 40 && freshOrphans.length === 0 && staleHooks.length === 0,
    `组件 className 里写出来的自有类名（qn-/qa-/fp-/gate-/domain-）必须在 globals.css 有选择器；`
    + `扫到 ${classUses.size} 个（少于 40 = 扫描器自己坏了，判红不判过 —— 空跑的绿最骗人）。`
    + `清单外孤儿 ${freshOrphans.map(([t, f]) => `${t}@${f}`).join(' | ') || '0 处'} / `
    + `清单里已不成立 ${staleHooks.join(' | ') || '0 支'}`);
  // 批C 裁定（2026-10-22）：**var() 要么带 fallback，要么这支令牌在两种主题里都解得出。**
  // "都解得出"的机器形状 = 在西方令牌块之前就声明过（@theme 或 :root，两种底都吃得到）；
  // 只在 [data-mode="western"] 里声明的那支，浅底上等于未定义 —— 不带 fallback 就是安静失效。
  // 这一条以前不判：usedVars 早就算好了每处带不带 fallback，只是没人读那个字段。
  const wStart = css.indexOf('\n[data-mode="western"] {');
  ok('dir/var-western-block-found', wStart > 0, `globals.css 里得能定位到西方令牌块（找不到就没法判"两主题都有"）：实得 ${wStart}`);
  const baseDefined = new Set([...css.slice(0, wStart).matchAll(/(--(?:color|qn)-[\w-]+)\s*:/g)].map(m => m[1]));
  const westernDefined = new Set([...css.slice(wStart).matchAll(/(--(?:color|qn)-[\w-]+)\s*:/g)].map(m => m[1]));
  const naked = [...usedVars.entries()].flatMap(([name, us]) =>
    us.filter(u => !u.fallback && !baseDefined.has(name)).map(u => `${name}@${u.file}`));
  ok('dir/var-fallback-or-both-themes', naked.length === 0,
    `不带 fallback 的 var() 必须在两种主题里都解得出（= 在西方令牌块之前声明过）。`
    + `只活在西方块里的话，浅底上那一条属性直接失效而且永远不会红：${naked.join(' | ') || '0 处'}`);
  // 两支按裁定单独钉：danger 必须两主题各有取值（浅 #b23a2e / 墨 #e88f80），
  // 舞台未确认那一支必须在基础块里声明（舞台自己永远是深底）。
  ok('dir/danger-token-both-themes', baseDefined.has('--color-danger') && westernDefined.has('--color-danger'),
    `--color-danger 两主题都要声明（浅底一支、墨底另一支）：基础块 ${baseDefined.has('--color-danger') ? '有' : '无'} / 西方块 ${westernDefined.has('--color-danger') ? '有' : '无'}`);
  ok('dir/fp-stage-open-token', baseDefined.has('--color-fp-stage-open'),
    '--color-fp-stage-open（户型舞台上"还没确认"那一格）必须有定义 —— 批A 量到它被等轴测图引用却没声明，那一格一直没有颜色');
  ok('dir/status-tokens-defined', ['--color-status-open', '--color-status-partial', '--color-status-closed']
    .every(t => css.includes(t + ':')) && /\[data-mode="western"\][\s\S]*?--color-status-open/.test(css),
    '三个状态点各有令牌，且西方作用域真的重指向过（只定义浅底那一份 = 深底上那一档从没被量过）');
  // 三数相加必须等于总数：门廊那行、目录页那行都靠它说话，缺一个状态词就是少报一类。
  const oriental = statusCounts(INTENTS);
  const western = statusCounts(WESTERN_INTENTS);
  ok('dir/status-counts-add-up', [oriental, western].every(c => c.open + c.partial + c.closed === c.total)
    && oriental.live === oriental.open + oriental.partial,
    `三档相加必须等于总项数，且"有入口的"= 可用 + 部分可用：东方 ${oriental.open}+${oriental.partial}+${oriental.closed}=${oriental.total}（live ${oriental.live}）/ 西方 ${western.open}+${western.partial}+${western.closed}=${western.total}（live ${western.live}）`);
  say(`MEASURED 门廊栏底那两行实际会印：「${statusTally(oriental)}」与「${statusTally(western)}」—— `
    + `这是 lib/tools/status.ts 现算的，harness 从屏上读回来对同一份（旧写法「已开放 9 / 10」把部分可用混进分子）`);
}

// ── 7. 首屏四类意图与游客 id 单源（裁定 ① 的数据侧；视觉侧由 harness 的 first-screen 探针测）──
{
  const want = ['认识自己', '问一件事', '择时看周期', '看关系'];
  const got = INTENT_ENTRIES.map(e => e.intent);
  ok('oriental/intent-entries-complete', JSON.stringify(got) === JSON.stringify(want) && INTENT_ENTRIES.every(e => routeExists(e.href)),
    `首页首屏的四类意图入口齐备且可达：${INTENT_ENTRIES.map(e => `${e.intent}→${e.href}`).join('  ')}`);
  const home = stripComments(readFileSync(ORIENTAL, 'utf8'));
  ok('oriental/intents-come-from-catalog', /import\s*\{[^}]*\bINTENT_ENTRIES\b[^}]*\}\s*from '@\/lib\/tools\/catalog'/.test(home) &&
    /INTENT_ENTRIES\.map/.test(home),
    '东方工作页首屏四类入口必须渲染自 catalog 的 INTENT_ENTRIES（不是页面里再抄一份）；import 里允许并列其它 catalog 名字，@/lib/tools/catalog 之外不许再有第二个来源');
  const visitor = stripComments(readFileSync(join(APP, '..', 'lib', 'auth', 'visitor.ts'), 'utf8'));
  const create = stripComments(readFileSync(join(APP, 'create', 'page.tsx'), 'utf8'));
  ok('visitor/id-single-source', /export function getVisitorId/.test(visitor) &&
    /import\s*\{\s*getVisitorId\s*\}\s*from '@\/lib\/auth\/visitor'/.test(create) &&
    !/function getVisitorId/.test(create) && !/hundun_visitor_id/.test(create),
    '游客 id 只有 lib/auth/visitor 一份生成器，create 页 import 它（它是报告归属凭据，不该有两个出处）');
}

// ── 8. 东方工作页三份清单合成一份（裁定 (a)）：核心引擎区与启动器轨道只准按 slug 引用目录 ──
// 这批断言原本钉 app/page.tsx；#双体系 把那张页面搬到 OrientalBody.tsx，读的文件跟着换，
// 断言内容一条没删（清单合成这一条与页面在哪个路由下无关）。
{
  const raw = stripComments(readFileSync(ORIENTAL, 'utf8'));
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

  ok('oriental/lists-import-catalog',
    /import\s*\{[^}]*HOME_FEATURED_SLUGS[^}]*LAUNCHER_SLUGS[^}]*homeCard[^}]*\}\s*from '@\/lib\/tools\/catalog'/.test(code) &&
    /HOME_FEATURED_SLUGS\s*\n?\s*\.map/.test(code) && /LAUNCHER_SLUGS\s*\n?\s*\.map/.test(code),
    '首页两份清单必须是「slug 列表 → homeCard(slug)」的形状，名字/说明/入口不能自己写');

  const hrefLits = code.match(/href\s*:\s*['"]\/[^'"]*['"]/g) || [];
  const titleLits = code.match(/title\s*:\s*['"][^'"]*['"]/g) || [];
  const descLits = code.match(/desc\s*:\s*['"][^'"]*['"]/g) || [];
  ok('oriental/no-second-tool-list', hrefLits.length === 0 && titleLits.length === 0 && descLits.length === 0,
    `首页不留第二份工具清单：硬编码的 href/title/desc 字段必须为 0 处（实得 ${[...hrefLits, ...titleLits, ...descLits].length} 处：${[...hrefLits, ...titleLits, ...descLits].join(' | ') || '无'}）`);

  const slugs = ALL_TOOLS.map(t => t.slug);
  ok('catalog/slug-unique', new Set(slugs).size === slugs.length && slugs.every(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s)) && !slugs.includes(TOOLS_INDEX.slug),
    `slug 是首页引用条目的唯一 key，必须齐备、小写连字符、互不重复，且不与目录页那一格（${TOOLS_INDEX.slug}）撞名：${slugs.join(' ')}`);

  const cards = [...new Set([...HOME_FEATURED_SLUGS, ...LAUNCHER_SLUGS])].map(s => [s, homeCard(s)] as const);
  const unresolved = cards.filter(([, c]) => c === null).map(([s]) => s);
  ok('oriental/slug-lists-resolve', unresolved.length === 0 && HOME_FEATURED_SLUGS.length > 0 && LAUNCHER_SLUGS.length > 0,
    `首页两份 slug 清单逐条解析得到卡片（解析不到的会被 .filter 静默丢掉，页面只是少一张卡，所以只能在这里红）：解析失败 ${unresolved.join('、') || '0 个'}；核心 ${HOME_FEATURED_SLUGS.length} 行 / 启动器 ${LAUNCHER_SLUGS.length} 格`);

  const badHref = cards.filter(([, c]) => c && c.href && !routeExists(c.href)).map(([s, c]) => `${s}→${c!.href}`);
  ok('oriental/cards-route', badHref.length === 0,
    `首页每一张卡的入口都指向 app/**/page.tsx 真实存在的路由：断链 ${badHref.join(' | ') || '0 个'}`);

  const leaked = HOME_FEATURED_SLUGS.filter(s => homeCard(s)?.href && TOOL_BY_SLUG[s]?.status === '未开放')
    .concat(LAUNCHER_SLUGS.filter(s => homeCard(s)?.href && TOOL_BY_SLUG[s]?.status === '未开放'));
  ok('oriental/unopen-never-linked', leaked.length === 0,
    `未开放条目经 homeCard 之后一律拿不到 href（首页的「无链接、无按钮」靠的是这一道闸门，不是页面里再判一次状态）：违规 ${leaked.join('、') || '0 个'}`);

  const thin = cards.filter(([, c]) => c && (c.title.length > 10 || c.teaser.length < 12 || c.teaser.length > 64))
    .map(([s, c]) => `${s}(题 ${c!.title.length} 字 / 说 ${c!.teaser.length} 字)`);
  ok('oriental/short-fields-fit', thin.length === 0,
    `标题 ≤10 字、说明 12–64 字：卡片标题位与 375px 窄屏放不下目录页那种全名，超限会把行折坏 —— 该用短名，不是把字号调小：${thin.join(' | ') || '全部合格'}`);

  // 皮肤表也从**剥过注释**的那一份里切：整段 slice 用 raw 的话，一条被注释掉的
  // `'slug': { zi: ... }` 也算"有刻字"，这正好是这条断言要挡的东西。
  const skinStart = code.indexOf('const SKIN');
  const skinBlock = skinStart < 0 ? '' : code.slice(skinStart, code.indexOf('};', skinStart));
  const skins: Record<string, string> = {};
  for (const m of skinBlock.matchAll(/['"]([a-z0-9-]+)['"]\s*:\s*\{([^}]*)\}/g)) skins[m[1]] = m[2];
  const noZi = [...new Set([...HOME_FEATURED_SLUGS, ...LAUNCHER_SLUGS])].filter(s => !/zi\s*:/.test(skins[s] || ''));
  const openFeatured = HOME_FEATURED_SLUGS.filter(s => homeCard(s)?.href);
  const noGo = openFeatured.filter(s => !/go\s*:/.test(skins[s] || ''));
  ok('oriental/skin-covers-lists', noZi.length === 0 && noGo.length === 0,
    `展示层每个被引用的 slug 都要有刻字，已开放的核心行还要有按钮文案（缺了会渲染成空格子或空链接文字）：缺字 ${noZi.join('、') || '0 个'} / 缺按钮文案 ${noGo.join('、') || '0 个'}`);

  const soonNames = (code.match(/\{\s*t:\s*["']([^"']+)["']/g) || []).map(s => s.replace(/.*t:\s*["']/, '').replace(/["']$/, ''));
  const overlap = soonNames.filter(n => ALL_TOOLS.some(t => t.name.includes(n) || t.title === n));
  ok('oriental/soon-no-overlap', soonNames.length > 0 && overlap.length === 0,
    `「更多即将上线」只能预告目录里没有的东西：目录只描述已实现，未开放的术数不许在这里当预告卖，已开放的也不许在这里再列一遍（重叠 ${overlap.join('、') || '0 个'}；预告 ${soonNames.join('、')}）`);
  say(`MEASURED 「即将上线」那一格（${soonNames.join('、')}）仍是首页自己写的路线声明，不属于本批统一范围 —— ` +
    `它不与任何目录条目重叠，所以既不会与目录漂移，也不会给未做的功能留假入口`);
}

// ── 9. 门廊与西方目录（#双体系）：门廊只准有两个入口，数字必须现算 ──
{
  const raw = stripComments(readFileSync(GATE, 'utf8'));
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const hrefs = [...new Set([
    ...(code.match(/href\s*=\s*["']\/[^"']*["']/g) || []),
    ...(code.match(/href\s*:\s*['"]\/[^'"]*['"]/g) || []),
  ].map(s => s.replace(/^.*[:=]\s*["']/, '').replace(/["']$/, '')))];
  const allowed = ['/oriental', '/western'];
  const offside = hrefs.filter(h => !allowed.includes(h));
  ok('gate/only-two-entries', hrefs.filter(h => h === '/oriental' || h === '/western').length === 2 && offside.length === 0,
    `门廊上只准出现 /oriental、/western 两个体系入口（裁定 ① 之后连 /tools 也不在这里，它归两页工作页的页脚）：实得 ${hrefs.sort().join(' ')}，越界 ${offside.join(' | ') || '无'}`);
  ok('gate/entries-resolve', ['/oriental', '/western'].every(h => routeExists(h)),
    '两个体系入口都必须有真的 page.tsx（门廊是全站第一跳，这里断链等于整站进不去）');
  ok('gate/no-second-tool-list', !/HOME_FEATURED_SLUGS|LAUNCHER_SLUGS|homeCard|TOOL_BY_SLUG/.test(code)
    && !/title\s*:\s*['"]/.test(code) && !/desc\s*:\s*['"]/.test(code),
    '门廊不许维护第二份工具清单（一份抄本就会与目录漂移）：目录符号引用命中 '
    + `${['HOME_FEATURED_SLUGS', 'LAUNCHER_SLUGS', 'homeCard', 'TOOL_BY_SLUG'].filter(s => code.includes(s)).join('、') || '无'}`);
  ok('gate/counts-derived-from-catalogs',
    /import\s*\{[^}]*INTENTS[^}]*\}\s*from '@\/lib\/tools\/catalog'/.test(code)
    && /import\s*\{[^}]*WESTERN_INTENTS[^}]*\}\s*from '@\/lib\/tools\/western-catalog'/.test(code)
    && /import\s*\{[^}]*statusTally[^}]*\}\s*from '@\/lib\/tools\/status'/.test(code)
    && !/已开放\s*[0-9]/.test(code) && !/(可用|未开放|共)\s*[0-9]/.test(code),
    '门廊栏底那三个数必须由两套目录现算、并且走 lib/tools/status.ts 那一份计数（写死一个数字，目录一改它就开始说谎）：硬编码计数命中 '
    + `${(code.match(/(已开放|可用|未开放|共)\s*[0-9]+/g) || []).join('、') || '无'}`);

  const wTools = WESTERN_INTENTS.flatMap(g => g.tools);
  ok('west/status-vocabulary', wTools.every(t => ['可用', '部分可用', '未开放'].includes(t.status)),
    `西方目录与东方共用同一套状态词，不另立枚举：越界 ${wTools.filter(t => !['可用', '部分可用', '未开放'].includes(t.status)).map(t => `${t.slug}:${t.status}`).join('、') || '无'}`);
  ok('west/closed-has-no-entry', wTools.every(t => t.status === '未开放' ? !t.href : !!t.href),
    '未开放的西方条目一律不许带 href（带了就等于给了一条走不通的门）');
  ok('west/closed-explains-why', wTools.filter(t => t.status === '未开放').every(t => (t.note || '').length >= 8
    && (t.basis || '').includes('缺')),
    '西方每一项未开放都要在 basis 里写"缺什么"、在 note 里给读者一句解释（与东方 dir/closed-explains-why 同一条纪律）');
  ok('west/live-hrefs-resolve', WESTERN_LIVE_HREFS.every(h => routeExists(h)),
    `西方已开放项的入口都要存在：断链 ${WESTERN_LIVE_HREFS.filter(h => !routeExists(h)).join(' | ') || '0 个'}`);
  const collide = wTools.map(t => t.slug).filter(s => TOOL_BY_SLUG[s]);
  ok('west/slug-no-collision', new Set(wTools.map(t => t.slug)).size === wTools.length && collide.length === 0
    && wTools.every(t => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(t.slug)),
    `两套目录共用 slug 空间做路由键，撞名会让 TOOL_BY_SLUG 查错表：撞名 ${collide.join('、') || '无'}`);
  // 版本戳形状：东方那套靠"目录里的戳 == 引擎导出的戳"钉住。西方现在一个引擎都没有，
  // 所以这里钉的是"不许先写一个看起来像版本戳的东西"——写了就必须在某处真的导出它。
  const wStamps = [...new Set((wTools.flatMap(t => [t.name, t.basis, t.note ?? '']).join(' ')
    .match(/[a-z]+-[a-z]+-v\d+/g) || []))];
  ok('west/no-stamp-without-engine', wStamps.length === 0,
    `西方目录里出现了引擎并不存在的版本戳形状（${wStamps.join('、') || '无'}）：口径没裁定就不该有版本号，`
    + '有了就得同时有导出它的引擎与 dir/stamps-equal-engine 那一类对拍');
  say(`MEASURED 西方目录：${wTools.length} 项，已开放 ${WESTERN_LIVE_HREFS.length} 项，未开放 ${WESTERN_CLOSED_TOOLS.length} 项`
    + `（${WESTERN_CLOSED_TOOLS.join('、')}）—— 门廊卡片上那个数就是从这里现算的`);

  // 缺陷6（批10 报、运维 2026-10-21 裁"改目录那侧"）：目录里那句「不上传户型图」与实装相反，
  // 而这句由 /tools 页原样渲染 —— 用户在同一个站里读到两句相反的话。
  // 钉双向：note 不许再有"不上传"这类话，而工作室真的有 file input 时 note 必须说清"可选上传"。
  {
    const fsNote = TOOL_BY_SLUG['fengshui']?.note || '';
    const studio = stripComments(readFileSync(join(FE, 'components', 'fengshui', 'FloorPlanStudio.tsx'), 'utf8'));
    const uploadLib = stripComments(readFileSync(join(FE, 'lib', 'fengshui', 'upload.ts'), 'utf8'));
    const hasPicker = /type="file"/.test(studio) && /ACCEPT_MIME/.test(studio);
    const deniesUpload = /不上传户型图|图片不落地|不上传/.test(fsNote);
    ok('dir/fengshui-note-matches-upload', hasPicker && !deniesUpload
      && /上传可选/.test(fsNote) && /7 天/.test(fsNote) && /不进入报告|不进.*回执/.test(fsNote),
      `户型的隐私声明必须与实装一致（实装：有选图入口 = ${hasPicker}；note 里还有"不上传"= ${deniesUpload}）：${fsNote}`);
    // 「可随时移除」双向钉：note 说了，页面就必须真有出口，而且出口带二次确认
    // （毁掉用户画过的几何不该是一个单击）；反过来控件被删掉时，note 也得跟着改回去。
    const hasRemove = /id="fp-remove-image"/.test(studio) && /确认移除/.test(studio);
    const claimsRemovable = /可随时移除/.test(fsNote);
    ok('dir/fengshui-note-removal-is-real', hasRemove && claimsRemovable,
      `「可随时移除」必须与实装同进同退（移除控件在 = ${hasRemove} / note 说了 = ${claimsRemovable}）`
      + ' —— 一边动了另一边没动，就是又造出一句做不到的承诺（缺陷6 的原形状）');
    // note 里写的格式与上限不许是第二个事实源 —— 与 lib/fengshui/upload.ts 现读值对齐。
    const mimes = (uploadLib.match(/ACCEPT_MIME\s*=\s*\[([^\]]*)\]/) || ['', ''])[1];
    const maxMb = Number((uploadLib.match(/MAX_BYTES\s*=\s*([0-9]+)\s*\*\s*1024\s*\*\s*1024/) || ['', '0'])[1]);
    const claimed = ['jpg', 'png', 'webp'].filter(k => fsNote.includes(k));
    const claimedMb = Number((fsNote.match(/≤\s*([0-9]+)MB/) || ['', '0'])[1]);
    ok('dir/fengshui-note-claims-are-true', claimed.length === 3 && /jpeg/.test(mimes) && /png/.test(mimes) && /webp/.test(mimes)
      && claimedMb > 0 && claimedMb === maxMb,
      `note 里承诺的格式与体积上限必须等于 upload.ts 的实际闸门（声明 ${claimed.join('/')} ≤${claimedMb}MB，闸门 ${maxMb}MB、MIME ${mimes.replace(/\s+/g, '')}）`);
  }

  // 死文件守卫（运维 2026-10-21 裁的范围：两份 qingnang CSS + frontend/app 下的 *_bak*）。
  // 量过的删除理由要说清：这两份 300KB 的样式表在源码里零引用，构建产物里也没有它们的
  // [data-theme=zen] —— 它们的问题不是"把包弄大"，而是挂在生产域上可被 /qingnang.css 直链下载，
  // 并且在 Tailwind 的扫描目录里留着两份与 globals.css 冲突的令牌源。
  {
    const gone = ['app/qingnang-full.css', 'public/qingnang.css'].filter(rel => existsSync(join(FE, rel)));
    const baks = readdirSync(APP).filter(n => /_bak|\.bak|_backup|_old/i.test(n));
    ok('dir/no-dead-vendored-files', gone.length === 0 && baks.length === 0,
      `已裁掉的死文件不许回来（回来就等于多一份令牌源 + 一条能被直链下载的死样式表）：仍在 ${[...gone, ...baks.map(n => 'app/' + n)].join('、') || '0 个'}`);
    // 产物侧的守卫要能被真的执行到，所以 `.next` 不在时是 SKIP 并说明，而不是默默通过。
    const cssFiles: string[] = [];
    const walkBuild = (dir: string) => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walkBuild(p);
        else if (e.name.endsWith('.css')) cssFiles.push(p);
      }
    };
    walkBuild(join(FE, '.next', 'static'));
    // ── 产物新鲜度（运维 2026-10-22 裁定）：读产物的闸门必须先确认"产物比源码新"。──
    // 起因：合进 main 后首跑就是 2 红，读到的却是合并前那份 .next —— 红得像产品坏了，
    // 真因是产物陈旧。这与"3018 实例发旧 chunk"是同一类错误：量具读的不是被测物。
    // 所以这里用 .next/BUILD_ID 的写入时间对上"最新源文件"的时间，比源码旧就判红。
    // 注意 git 会改写 mtime：checkout / merge 之后源码时间变成"现在"，旧产物一律算陈旧 ——
    // 这是一个偏保守的假红（重新 build 一次就好），不会反过来放走真陈旧。
    const buildIdPath = join(FE, '.next', 'BUILD_ID');
    let newestSrc = 0;
    let newestSrcFile = '';
    const touch = (p: string) => {
      const m = statSync(p).mtimeMs;
      if (m > newestSrc) { newestSrc = m; newestSrcFile = p.replace(/\\/g, '/').replace(FE.replace(/\\/g, '/') + '/', ''); }
    };
    const walkFresh = (dir: string) => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.next') continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walkFresh(p);
        else if (/\.(ts|tsx|css|json|js|mjs)$/.test(e.name)) touch(p);
      }
    };
    walkFresh(FE);
    const builtAt = existsSync(buildIdPath) ? statSync(buildIdPath).mtimeMs : 0;
    // 有 CSS 却没有 BUILD_ID：这份产物的来历已经不可考了（手工塞的、半截构建、别处拷来的），
    // 一律算"无法证明新鲜"。这一支如果留成绿，正好是"判据没想到的那一类放过去了"。
    const noStamp = cssFiles.length > 0 && builtAt === 0;
    const stale = cssFiles.length > 0 && (noStamp || builtAt < newestSrc);
    const lag = Math.round((newestSrc - builtAt) / 1000);
    if (stale) {
      ok('dir/bundle-is-fresh', false,
        noStamp
          ? `frontend/.next 里有 ${cssFiles.length} 个 CSS 产物却没有 BUILD_ID：无法证明它比源码新，`
            + '读产物的三条闸门（dead-styles / danger-token-in-bundle / referenced-tokens-survive-bundle）不作数。重新 build。'
          : `.next 比源码旧 ${lag}s（BUILD_ID 早于最新源文件 ${newestSrcFile}）—— 读产物的三条闸门`
            + '（dead-styles / danger-token-in-bundle / referenced-tokens-survive-bundle）现在读到的是上一版构建，'
            + '它们报的红或绿都不作数。先 build 再跑。');
      say('SKIP(陈旧) 三条读产物的闸门不作数 —— 判红的是 dir/bundle-is-fresh，不是产品');
    } else if (cssFiles.length) {
      ok('dir/bundle-is-fresh', true,
        `产物比源码新（BUILD_ID 晚于 ${newestSrcFile}，余量 ${Math.round((builtAt - newestSrc) / 1000)}s）—— 读产物的闸门这次作数`);
      // 产物也走同一把刀：将来若打包器留下注释，注释里那句选择器不能算"包里有 zen"，
      // 反过来也不能让一条被注释掉的选择器冒充"已经清干净"。
      const bundle = cssFiles.map(f => stripComments(readFileSync(f, 'utf8'))).join('\n');
      ok('dir/bundle-free-of-dead-styles', !/\[data-theme=zen\]/.test(bundle) && !/\.mk-[a-z]/.test(bundle),
        `构建产物里不许有 zen 主题选择器或静态稿的 mk- 类（静态稿在 docs/ 下、不在扫描范围内，这条钉的是"别把它请进生产"）：包 ${cssFiles.length} 个 / ${(bundle.length / 1024).toFixed(0)}KB`);
      // 只被 JSX 内联样式消费的令牌，Tailwind v4 会当成"没人用"从 @theme 里摇掉 ——
      // 源码看着两主题都声明了，产物里浅底那一份根本不存在。所以这条读的是产物。
      const lightIn = /--color-danger\s*:\s*#b23a2e/.test(bundle);
      const inkIn = /--color-danger\s*:\s*var\(--color-western-danger\)/.test(bundle);
      const stageIn = /--color-fp-stage-open\s*:\s*#e3cd96/.test(bundle);
      ok('dir/danger-token-in-bundle', lightIn && inkIn && stageIn,
        '产物 CSS 里必须真的留着 --color-danger 的浅底/墨底两份与 --color-fp-stage-open 一份'
        + '（@theme 会摇掉没有 CSS 规则 var() 它的令牌，而这几支只被 JSX 内联样式用：'
        + `浅底 ${lightIn ? '在' : '不在'} / 墨底 ${inkIn ? '在' : '不在'} / 舞台 ${stageIn ? '在' : '不在'}）`);
      // 上一条的推广：凡是"源码里定义了、又被某处 var() 引用"的 --color-*，产物里必须还在。
      // Tailwind 的摇树只认 CSS 里的消费者，JSX 内联样式它看不见 —— 所以"源码写了"不等于"浏览器拿得到"。
      // 引用集自己走一遍 frontend/（这一节与令牌那一节不在同一个作用域）。
      const refs = new Set<string>();
      const walkSrc = (dir: string) => {
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.next') continue;
          const p = join(dir, e.name);
          if (e.isDirectory()) walkSrc(p);
          else if (/\.(ts|tsx|css)$/.test(e.name)) {
            const body = stripComments(readFileSync(p, 'utf8'));
            for (const m of body.matchAll(/var\((--color-[\w-]+)/g)) refs.add(m[1]);
          }
        }
      };
      walkSrc(FE);
      const definedHere = [...new Set([...stripComments(readFileSync(join(FE, 'app', 'globals.css'), 'utf8'))
        .matchAll(/(--color-[\w-]+)\s*:/g)].map(m => m[1]))];
      const missingFromBundle = definedHere.filter(t => refs.has(t)
        && !bundle.includes(t + ':') && !bundle.includes(t + ' '));
      ok('dir/referenced-tokens-survive-bundle', missingFromBundle.length === 0,
        `被引用且在 globals.css 里声明过的 --color-*，产物里必须仍有定义（摇树掉的那支在浏览器里等于未定义，`
        + `而源码侧闸门全绿）：缺 ${missingFromBundle.join('、') || '0 支'}（比对 ${definedHere.length} 支声明 / ${refs.size} 支引用）`);
    } else if (process.env.QN_ALLOW_NO_BUILD === '1') {
      // 放行不等于达标：这条不计 PASS，只打一行 SKIP。否则"没 build 的跑法"读起来
      // 跟"build 过且全绿"一模一样，正是运维禁止的"拿豁免过关"。
      say('SKIP  dir/bundle-present  frontend/.next 里没有 CSS 产物可读，读产物的三条闸门（dead-styles / '
        + 'danger-token-in-bundle / referenced-tokens-survive-bundle）等于没跑 —— 这一条默认判红，'
        + '是 QN_ALLOW_NO_BUILD=1 显式放行才降级的，不计通过');
    } else {
      // 运维这次要求"不许 SKIP"：没有产物时这三条什么都没测，静默打一行 SKIP 会被读成过了。
      // 默认判红；确实要在无产物的环境（干净 clone）跑，必须显式设 QN_ALLOW_NO_BUILD=1，
      // 那时才降级成一句 SKIP —— 豁免要留名，不能是默认路径。
      ok('dir/bundle-present', false,
        `frontend/.next 里没有 CSS 产物可读，读产物的三条闸门（dead-styles / danger-token-in-bundle / `
        + `referenced-tokens-survive-bundle）等于没跑。先 build；`
        + `干净 clone 这类场景请显式设 QN_ALLOW_NO_BUILD=1（当前未设，判红）`);
    }
  }
}

const summary = `directory acceptance: tools=${ALL_TOOLS.length} open=${OPEN.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
