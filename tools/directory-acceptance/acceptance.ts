// 百宝箱目录验收：目录页唯一的价值是「说的和做的一致」，所以这里不测样式，只测三件事——
// 入口指向的页面真的存在、口径字符串等于引擎当前导出的常量、没做的功能没有拿到入口。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/directory-acceptance/acceptance.ts --out=.directory.txt
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GANZHI_BASIS, NAJIA_BASIS } from '../../frontend/lib/liuyao/core';
import { QISHU_BASIS } from '../../frontend/lib/meihua/engine';
import { COIN_COMMIT_SCHEMA } from '../../frontend/lib/receipt/receipt';
import { CATALOG_STAMPS, CLOSED_TOOLS, HOME_FEATURED_SLUGS, INTENT_ENTRIES, INTENTS, LAUNCHER_SLUGS, LIUYAO_BASIS_TEXT, LIVE_HREFS, TOOLS_INDEX, TOOL_BY_SLUG, homeCard } from '../../frontend/lib/tools/catalog';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.directory.txt';
const APP = join(__dirname, '../../frontend/app');

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
  };
  const engine = { ganzhi: GANZHI_BASIS, najia: NAJIA_BASIS, qishu: QISHU_BASIS, commit: COIN_COMMIT_SCHEMA };
  const drift = (Object.keys(CATALOG_STAMPS) as (keyof typeof CATALOG_STAMPS)[])
    .map(k => `${k}: 目录 ${CATALOG_STAMPS[k]} vs 引擎 ${engine[k]}`)
    .filter(line => {
      const [a, b] = line.split(' vs ');
      return a.split('目录 ')[1] !== b.split('引擎 ')[1];
    });
  ok('dir/stamps-equal-engine', drift.length === 0,
    `目录写死的 ${Object.keys(CATALOG_STAMPS).length} 项口径戳必须逐字等于引擎导出值，引擎改戳而目录没跟上就在这里红：${drift.join(' | ') || `四项一致（${GANZHI_BASIS} / ${NAJIA_BASIS} / ${QISHU_BASIS} / ${COIN_COMMIT_SCHEMA}）`}`);
  const STAMP = /[a-z]+-[a-z]+-v\d+/g;
  const corpus = ALL_TOOLS.map(t => `${t.name} ${t.basis} ${t.note || ''}`).join('\n') + '\n' + LIUYAO_BASIS_TEXT;
  const found = Array.from(new Set(corpus.match(STAMP) || []));
  const stale = found.filter(v => !truth[v]);
  ok('dir/stamps-match-engine', found.length >= 4 && stale.length === 0,
    `目录里出现的口径戳 ${JSON.stringify(found.sort())} 必须全部等于引擎当前导出值（含新加的随机承诺戳）：写歪或残留旧戳 ${stale.join('、') || '0 个'}`);
  ok('dir/liuyao-basis-carries-three', LIUYAO_BASIS_TEXT.includes(GANZHI_BASIS) && LIUYAO_BASIS_TEXT.includes(NAJIA_BASIS) && LIUYAO_BASIS_TEXT.includes(QISHU_BASIS),
    `六爻条目的口径串三项齐备（戳是目录里的字面量，其正确性由 dir/stamps-equal-engine 钉住）：${LIUYAO_BASIS_TEXT}`);
}

// ── 5. 首页与导航：入口位不许指向不存在的路由 ──
{
  const home = readFileSync(join(APP, 'page.tsx'), 'utf8');
  const nav = readFileSync(join(APP, '..', 'components', 'Nav.tsx'), 'utf8');
  const literals = Array.from(new Set([
    ...home.match(/href\s*[:=]\s*"\/[^"]*"/g) || [],
    ...home.match(/href\s*[:=]\s*'\/[^']*'/g) || [],
    ...nav.match(/href\s*[:=]\s*'\/[^']*'/g) || [],
    ...nav.match(/href\s*[:=]\s*"\/[^"]*"/g) || [],
  ].map(s => s.replace(/^.*[:=]\s*["']/, '').replace(/["']$/, ''))));
  const broken = literals.filter(h => !routeExists(h));
  ok('shell/no-broken-entry', broken.length === 0,
    `首页与导航的 ${literals.length} 个字面 href 全部可达（${literals.sort().join(' ')}）：断链 ${broken.join(' | ') || '0 个'}`);
  const hashEntries = (home.match(/href\s*:\s*["']#["']/g) || []).length;
  ok('shell/no-hash-placeholder', hashEntries === 0,
    `首页与导航不得留 href="#" 的占位入口（未开放一律走「无 href + 无按钮 + 写明原因」，与目录页同一做法）：残留 ${hashEntries} 处`);
  ok('shell/tools-entry-linked', /href\s*=\s*["']\/tools["']/.test(home) || /href\s*:\s*['"]\/tools['"]/.test(home),
    '目录页必须从首页可达（否则「二级页面按术数查找」落不到实处）');
}

// ── 6. 目录页自身：未开放条目不渲染链接 ──
{
  const page = readFileSync(join(APP, 'tools', 'page.tsx'), 'utf8');
  ok('dir/page-gates-link', /t\.status\s*!==\s*'未开放'\s*&&\s*t\.href\s*\?/.test(page),
    '目录页渲染入口的条件必须是「非未开放 且 有 href」双闸门，单靠数据正确不够');
  const statusLabels = ['可用', '部分可用', '未开放'];
  ok('dir/status-vocabulary', statusLabels.every(s => page.includes(s) || ALL_TOOLS.some(t => t.status === s)),
    `状态只允许 ${statusLabels.join('/')} 三档，且页面给出定义（读者能据此判断标签含义）`);
}

// ── 7. 首屏四类意图与游客 id 单源（裁定 ① 的数据侧；视觉侧由 harness 的 first-screen 探针测）──
{
  const want = ['认识自己', '问一件事', '择时看周期', '看关系'];
  const got = INTENT_ENTRIES.map(e => e.intent);
  ok('home/intent-entries-complete', JSON.stringify(got) === JSON.stringify(want) && INTENT_ENTRIES.every(e => routeExists(e.href)),
    `首页首屏的四类意图入口齐备且可达：${INTENT_ENTRIES.map(e => `${e.intent}→${e.href}`).join('  ')}`);
  const home = readFileSync(join(APP, 'page.tsx'), 'utf8');
  ok('home/intents-come-from-catalog', /import\s*\{[^}]*\bINTENT_ENTRIES\b[^}]*\}\s*from '@\/lib\/tools\/catalog'/.test(home) &&
    /INTENT_ENTRIES\.map/.test(home),
    '首屏四类入口必须渲染自 catalog 的 INTENT_ENTRIES（不是首页里再抄一份）；import 里允许并列其它 catalog 名字，@/lib/tools/catalog 之外不许再有第二个来源');
  const visitor = readFileSync(join(APP, '..', 'lib', 'auth', 'visitor.ts'), 'utf8');
  const create = readFileSync(join(APP, 'create', 'page.tsx'), 'utf8');
  ok('visitor/id-single-source', /export function getVisitorId/.test(visitor) &&
    /import\s*\{\s*getVisitorId\s*\}\s*from '@\/lib\/auth\/visitor'/.test(create) &&
    !/function getVisitorId/.test(create) && !/hundun_visitor_id/.test(create),
    '游客 id 只有 lib/auth/visitor 一份生成器，create 页 import 它（它是报告归属凭据，不该有两个出处）');
}

// ── 8. 首页三份清单合成一份（裁定 (a)）：核心引擎区与启动器轨道只准按 slug 引用目录 ──
{
  const raw = readFileSync(join(APP, 'page.tsx'), 'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

  ok('home/lists-import-catalog',
    /import\s*\{[^}]*HOME_FEATURED_SLUGS[^}]*LAUNCHER_SLUGS[^}]*homeCard[^}]*\}\s*from '@\/lib\/tools\/catalog'/.test(code) &&
    /HOME_FEATURED_SLUGS\s*\n?\s*\.map/.test(code) && /LAUNCHER_SLUGS\s*\n?\s*\.map/.test(code),
    '首页两份清单必须是「slug 列表 → homeCard(slug)」的形状，名字/说明/入口不能自己写');

  const hrefLits = code.match(/href\s*:\s*['"]\/[^'"]*['"]/g) || [];
  const titleLits = code.match(/title\s*:\s*['"][^'"]*['"]/g) || [];
  const descLits = code.match(/desc\s*:\s*['"][^'"]*['"]/g) || [];
  ok('home/no-second-tool-list', hrefLits.length === 0 && titleLits.length === 0 && descLits.length === 0,
    `首页不留第二份工具清单：硬编码的 href/title/desc 字段必须为 0 处（实得 ${[...hrefLits, ...titleLits, ...descLits].length} 处：${[...hrefLits, ...titleLits, ...descLits].join(' | ') || '无'}）`);

  const slugs = ALL_TOOLS.map(t => t.slug);
  ok('catalog/slug-unique', new Set(slugs).size === slugs.length && slugs.every(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s)) && !slugs.includes(TOOLS_INDEX.slug),
    `slug 是首页引用条目的唯一 key，必须齐备、小写连字符、互不重复，且不与目录页那一格（${TOOLS_INDEX.slug}）撞名：${slugs.join(' ')}`);

  const cards = [...new Set([...HOME_FEATURED_SLUGS, ...LAUNCHER_SLUGS])].map(s => [s, homeCard(s)] as const);
  const unresolved = cards.filter(([, c]) => c === null).map(([s]) => s);
  ok('home/slug-lists-resolve', unresolved.length === 0 && HOME_FEATURED_SLUGS.length > 0 && LAUNCHER_SLUGS.length > 0,
    `首页两份 slug 清单逐条解析得到卡片（解析不到的会被 .filter 静默丢掉，页面只是少一张卡，所以只能在这里红）：解析失败 ${unresolved.join('、') || '0 个'}；核心 ${HOME_FEATURED_SLUGS.length} 行 / 启动器 ${LAUNCHER_SLUGS.length} 格`);

  const badHref = cards.filter(([, c]) => c && c.href && !routeExists(c.href)).map(([s, c]) => `${s}→${c!.href}`);
  ok('home/cards-route', badHref.length === 0,
    `首页每一张卡的入口都指向 app/**/page.tsx 真实存在的路由：断链 ${badHref.join(' | ') || '0 个'}`);

  const leaked = HOME_FEATURED_SLUGS.filter(s => homeCard(s)?.href && TOOL_BY_SLUG[s]?.status === '未开放')
    .concat(LAUNCHER_SLUGS.filter(s => homeCard(s)?.href && TOOL_BY_SLUG[s]?.status === '未开放'));
  ok('home/unopen-never-linked', leaked.length === 0,
    `未开放条目经 homeCard 之后一律拿不到 href（首页的「无链接、无按钮」靠的是这一道闸门，不是页面里再判一次状态）：违规 ${leaked.join('、') || '0 个'}`);

  const thin = cards.filter(([, c]) => c && (c.title.length > 10 || c.teaser.length < 12 || c.teaser.length > 64))
    .map(([s, c]) => `${s}(题 ${c!.title.length} 字 / 说 ${c!.teaser.length} 字)`);
  ok('home/short-fields-fit', thin.length === 0,
    `标题 ≤10 字、说明 12–64 字：卡片标题位与 375px 窄屏放不下目录页那种全名，超限会把行折坏 —— 该用短名，不是把字号调小：${thin.join(' | ') || '全部合格'}`);

  const skinStart = raw.indexOf('const SKIN');
  const skinBlock = skinStart < 0 ? '' : raw.slice(skinStart, raw.indexOf('};', skinStart));
  const skins: Record<string, string> = {};
  for (const m of skinBlock.matchAll(/['"]([a-z0-9-]+)['"]\s*:\s*\{([^}]*)\}/g)) skins[m[1]] = m[2];
  const noZi = [...new Set([...HOME_FEATURED_SLUGS, ...LAUNCHER_SLUGS])].filter(s => !/zi\s*:/.test(skins[s] || ''));
  const openFeatured = HOME_FEATURED_SLUGS.filter(s => homeCard(s)?.href);
  const noGo = openFeatured.filter(s => !/go\s*:/.test(skins[s] || ''));
  ok('home/skin-covers-lists', noZi.length === 0 && noGo.length === 0,
    `展示层每个被引用的 slug 都要有刻字，已开放的核心行还要有按钮文案（缺了会渲染成空格子或空链接文字）：缺字 ${noZi.join('、') || '0 个'} / 缺按钮文案 ${noGo.join('、') || '0 个'}`);

  const soonNames = (code.match(/\{\s*t:\s*["']([^"']+)["']/g) || []).map(s => s.replace(/.*t:\s*["']/, '').replace(/["']$/, ''));
  const overlap = soonNames.filter(n => ALL_TOOLS.some(t => t.name.includes(n) || t.title === n));
  ok('home/soon-no-overlap', soonNames.length > 0 && overlap.length === 0,
    `「更多即将上线」只能预告目录里没有的东西：目录只描述已实现，未开放的术数不许在这里当预告卖，已开放的也不许在这里再列一遍（重叠 ${overlap.join('、') || '0 个'}；预告 ${soonNames.join('、')}）`);
  say(`MEASURED 「即将上线」那一格（${soonNames.join('、')}）仍是首页自己写的路线声明，不属于本批统一范围 —— ` +
    `它不与任何目录条目重叠，所以既不会与目录漂移，也不会给未做的功能留假入口`);
}

const summary = `directory acceptance: tools=${ALL_TOOLS.length} open=${OPEN.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
