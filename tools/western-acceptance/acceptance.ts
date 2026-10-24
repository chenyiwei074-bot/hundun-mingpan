// 西方目录验收（批 D）。
//
// 这一批没有引擎、没有算法，所以这里钉的全是"不许先许诺"：
// 状态词表与东方共用、未开放一律无入口且写清缺什么、今天一项都不开放（开第一项时这条
// 必须连同样例验收一起改）、页面全中文、以及不往依赖里塞任何来历不明的西方引擎
// （AGPL 与 1★ 仓库那两条红线，写在计划里也写在这里）。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/western-acceptance/acceptance.ts --out=.western.txt
import { readFileSync, writeFileSync } from 'node:fs';
// 2026-10-21 裁定：任何拿产品源码文本做判定的闸门先剥注释（tools/_lib/codesrc.ts）。
import { stripComments } from '../_lib/codesrc';
import { VETTED_PINNED } from '../_lib/vettedDeps';
import { join } from 'node:path';
import { INTENTS } from '../../frontend/lib/tools/catalog';
import { WESTERN_CLOSED_TOOLS, WESTERN_INTENTS, WESTERN_LIVE_HREFS, WESTERN_TOOLS } from '../../frontend/lib/tools/western-catalog';
// E2 之后西方有引擎了：目录里的口径戳必须与引擎导出的那一个字面量同源，
// 所以这两个值从出处那边读进来，不在测试里重抄一遍（重抄就是第二个真相）。
import { ASTRO_BASIS } from '../../frontend/lib/astro/planets';
import { MOMENT_BASIS } from '../../frontend/lib/astro/moment';
import { readDataText, readWesternBases, sha256 } from '../_lib/classics';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.western.txt';
const ROOT = join(__dirname, '../..');
/** 底本份数锁：加一本书要把这里和生成器里的登记表一起改。 */
const EXPECT_WEST_BASES = 2;
const 短名 = (f: { 文件: string }) => f.文件;
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

// ── 1. 骨架 ──
{
  ok('west/non-empty', WESTERN_INTENTS.length > 0 && WESTERN_TOOLS.length > 0,
    `西方目录有内容（读不到下面每条都是空过）：${WESTERN_INTENTS.length} 组 / ${WESTERN_TOOLS.length} 项`);
  const badLead = WESTERN_INTENTS.filter(g => !g.lead || g.lead.length < 8 || !g.tools.length);
  ok('west/group-shape', badLead.length === 0,
    `每组都要有 lead 与至少一项（与东方 dir/each-group-nonempty 同一条）：不符 ${badLead.map(g => g.intent).join('、') || '无'}`);
  const dup = WESTERN_TOOLS.map(t => t.slug).filter((s, i, a) => a.indexOf(s) !== i);
  const cross = WESTERN_TOOLS.map(t => t.slug).filter(s => INTENTS.flatMap(g => g.tools).some(t => t.slug === s));
  ok('west/slug-disjoint', dup.length === 0 && cross.length === 0,
    `西方 slug 不得自相重复、也不得与东方撞名（两套目录共用 TOOL_BY_SLUG 做路由键）：重复 ${dup.join('、') || '无'} / 撞名 ${cross.join('、') || '无'}`);
}

// ── 2. 状态诚实 ──
{
  const bad = WESTERN_TOOLS.filter(t => !['可用', '部分可用', '未开放'].includes(t.status));
  ok('west/status-vocabulary', bad.length === 0,
    `状态词表与东方共用同一三个值，不另立：越界 ${bad.map(t => `${t.slug}:${t.status}`).join('、') || '无'}`);
  const withEntry = WESTERN_TOOLS.filter(t => t.status === '未开放' && t.href);
  ok('west/closed-no-entry', withEntry.length === 0,
    `未开放一律无 href：违规 ${withEntry.map(t => t.slug).join('、') || '无'}`);
  const thin = WESTERN_TOOLS.filter(t => t.status === '未开放' && ((t.note || '').length < 8 || !t.basis.includes('缺')));
  ok('west/closed-explains-what-is-missing', thin.length === 0,
    `未开放的每一项都要在 basis 里写"缺什么"、在 note 里给读者一句解释：不符 ${thin.map(t => t.slug).join('、') || '无'}`);
  // 占星与塔罗各自实现了可核对的部分链路。不要强行要求两种独立体系共享一个引擎戳：
  // 占星戳由天文引擎验，塔罗抽取由其自身的种子复算测试验。
  const open = WESTERN_TOOLS.filter(t => t.status !== '未开放');
  ok('west/open-items-have-scoped-evidence', open.length === 5 && open.every(t => !!t.href
    && (t.status !== '部分可用' || ((t.done?.length ?? 0) > 0 && (t.notDone?.length ?? 0) > 0))),
    `五个开放条目都有入口；标「部分可用」的逐项写明已做/未做：${open.map(t => t.slug).join('、') || '无开放项'}`);
  const astroLive = open.find(t => t.slug === 'astro-natal');
  const tarotLive = open.find(t => t.slug === 'tarot-draw');
  ok('west/astro-open-item-states-public-basis', !!astroLive && /地心观察/.test(astroLive.basis)
    && /回归黄道/.test(astroLive.basis) && !/astro-planets-v1|astro-moment-iana-v1|astronomy-engine|DE441/.test(astroLive.basis),
    '本命行星项说明采用的观察体系，不显示内部版本号或实现库');
  ok('west/tarot-open-item-stays-honest', !!tarotLive && tarotLive.href === '/tarot'
    && /正位与逆位/.test(tarotLive.method) && /韦特 1910/.test([tarotLive.reading, ...(tarotLive.done || [])].join(' '))
    && /跨传统牌义比较/.test(tarotLive.notDone?.join(' ') || ''),
    `塔罗目录指向真实抽牌页面，标明正逆位、逐牌历史译述，并如实列出尚未完成的跨传统比较：${tarotLive?.href || '无入口'}`);
  const openStamps = [...new Set(open.flatMap(t => (t.basis || '').match(/[a-z]+(?:-[a-z]+)+-v\d+/g) || []))];
  ok('west/open-stamp-has-engine', openStamps.every(s => s === ASTRO_BASIS || s === MOMENT_BASIS),
    `目录里凡是长得像口径戳的字串，必须是引擎真的导出的那一个（写一个不存在的版本号 = 假出处）：实得 ${openStamps.join('、') || '无'}`);
}

// ── 3. 全中文，且不往依赖里塞来历不明的西方引擎 ──
{
  const fields = WESTERN_TOOLS.flatMap(t => [t.name, t.question, t.method, t.basis, t.reading, t.note || '']);
  const english = fields.filter(s => /[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(s));
  ok('west/all-chinese', english.length === 0,
    `"西方"指体系不指界面：目录里不许出现整句英文（术语可以夹，整句不行）：命中 ${english.length} 条`);
  const pkg = JSON.parse(readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8')) as
    { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  // 批D 把 astronomy-engine 也列在禁表里，理由是"引擎与口径尚未裁定"。裁定①（2026-10-23）之后
  // 这一条改成**裁定过的白名单**，不是删掉：禁表仍然抓 caelus / tyme4ts / iztro / astrology /
  // ephemeris / tarot（AGPL、1★ 仓库、没出处的那几类），而唯一放行的那一个必须同时满足
  // 名字、精确版本（不许 ^ ~）、MIT 三件事 —— 对拍的可复现性就挂在这一行版本号上。
  const banned = ['caelus', 'tyme4ts', 'iztro', 'astrology', 'ephemeris', 'tarot'];
  const hit = deps.filter(d => banned.some(b => d.toLowerCase().includes(b)));
  ok('west/no-unvetted-engine', hit.length === 0,
    `除裁定过的白名单之外，前端不许有别的西方天文/占卜依赖（AGPL 与 1★ 仓库那两条红线）：新增命中 ${hit.join('、') || '无'}`);
  const astroDep = (pkg.dependencies || {})['astronomy-engine'] || (pkg.devDependencies || {})['astronomy-engine'];
  let astroLicense = '';
  try {
    astroLicense = JSON.parse(readFileSync(join(ROOT, 'frontend', 'node_modules', 'astronomy-engine', 'package.json'), 'utf8')).license;
  } catch { /* 没装 —— 下面那两条会红，说清是没装还是license不对 */ }
  ok('west/vetted-engine-is-exact-mit', astroDep === VETTED_PINNED['astronomy-engine'] && astroLicense === 'MIT',
    `放行的那一个必须按裁定钉死：astronomy-engine 期望 ${VETTED_PINNED['astronomy-engine']} + MIT，实得 ${astroDep || '不在依赖里'} / ${astroLicense || '读不到 license'}`);
  const ws = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'WesternWorkspace.tsx'), 'utf8'));
  const card = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'tools', 'ToolCatalog.tsx'), 'utf8'));
  // 批A：双闸门从各页自己写一遍，改成 lib/tools/status.ts 的 isLiveEntry 一份。
  // 批F ①：卡片渲染也从"每页一份"收成 components/tools/ToolCatalog 一份（/tools 与 /western 共用）。
  // 这条因此往上挪一层：钉的是"这一页吃共用渲染器、且不自己写判定"，判据本身仍在那一份里。
  ok('west/page-renders-from-catalog', /WESTERN_INTENTS/.test(ws) && /<ToolCatalog/.test(ws)
    && /from '@\/components\/tools\/ToolCatalog'/.test(ws)
    && !/FIELDS|isLiveEntry|qn-btn--block/.test(ws),
    '西方工作页必须把卡片交给共用的 ToolCatalog 渲染，自己不再留一份字段表、一份入口判定（那两份都会与目录漂移）');
  ok('west/card-renders-single-gate', /isLiveEntry/.test(card) && /from '@\/lib\/tools\/status'/.test(card)
    && !/status\s*!==\s*'未开放'\s*&&\s*t\.href/.test(card),
    '共用的目录卡片必须吃 lib/tools/status.ts 的 isLiveEntry（页面里再写一遍双闸门 = 第二份真相）');
  const landing = stripComments(readFileSync(join(ROOT, 'frontend', 'app', 'page.tsx'), 'utf8'));
  ok('west/gate-count-derived', /WESTERN_INTENTS/.test(landing) && /statusCounts|statusTally/.test(landing)
    && !/已开放\s*[0-9]/.test(landing) && !/(可用|未开放)\s*[0-9]/.test(landing),
    '门廊上西方那张卡的数也是现算的（走 status.ts），旧写法「已开放 N」与新写法「可用 N」都不许写死');
  // 批F②：眉标改成按目录现算之后，还剩一件会被悄悄做错的事 —— 分隔符。
  // 条目名自己就带「 · 」（「西洋占星 · 合盘」「二十八宿 · 本命宿」），拿「 · 」当列表分隔符
  // 会把三个名字切成四个：分隔符不许出现在被分隔的数据里。首屏读的是渲染出来的那一行，
  // 这条读的是写法，两侧都钉才咬得住（harness 的 GATE 那段按名字逐个复核）。
  const withDot = WESTERN_TOOLS.filter(t => t.name.includes(' · ')).map(t => t.name);
  ok('west/gate-eyebrow-from-catalog', /eyebrowLine\(e\.groups\)/.test(landing)
    && !/eyebrow:\s*'/.test(landing) && /join\('、'\)/.test(landing) && !/join\(' · '\)/.test(landing),
    `门廊眉标必须由目录现算、并用「、」分隔：名字里带「 · 」的已有 ${withDot.length} 项`
    + `（${withDot.join('、') || '无'}），用「 · 」当分隔符就会把名字切错`);
}

// ── 5. 西方底本层（批H-W）：载体窄路、元数据齐、段哈希自洽 ──
{
  const files = readWesternBases(ROOT);
  const HEAD = ['载体', '版本与译者', '抓取日期', '原始文件 sha256', '规范化整档 sha256', '规范化脚本'];
  const missHead = files.flatMap(f => HEAD.filter(k => !f.头[k]).map(k => `${短名(f)} 缺「${k}」`));
  const missPass = files.flatMap(f => f.passages.filter(p => !p.该版位置 || !p.偏移 || !/^[0-9a-f]{64}$/.test(p.段sha256))
    .map(p => `${p.id} 的 该版位置/偏移/段sha256 不全`));
  ok('west/bases-registered', files.length === EXPECT_WEST_BASES
    && files.every(f => f.passages.length >= 2) && missHead.length === 0 && missPass.length === 0,
    `底本必须恰好 ${EXPECT_WEST_BASES} 份在册、每份至少两段、头部元数据齐（${HEAD.join('/')}）且每段带 该版位置/偏移/段sha256：`
    + `实得 ${files.length} 份（${files.map(f => 短名(f)).join('、') || '无'}）；缺项 ${[...missHead, ...missPass].join('；') || '无'}`);

  // 离线唯一能查的"这层没被手改过"：把段内容重新哈希，与文件里记的那条比。
  // 手改一个字母就红，且红的是底本本身而不是"引文找不到"。
  const badSha = files.flatMap(f => f.passages.filter(p => sha256(p.text) !== p.段sha256)
    .map(p => `${短名(f)}/${p.id}`));
  ok('west/base-hashes-immutable', files.length > 0 && badSha.length === 0,
    `每段记录的 sha256 必须与段内容自洽（改了底本就要重跑生成器并升 pgnorm 版本，不能手改）：不合 ${badSha.join('、') || '无'}`);

  // 窄路：底本只能来自 Project Gutenberg。写进机检，防止下一次有人把 IA 的 OCR 粘进来。
  const offPath = files.filter(f => !/# 载体: Project Gutenberg #\d+ · https:\/\/www\.gutenberg\.org\//.test(readDataText(f.abs)));
  ok('west/bases-are-gutenberg-only', offPath.length === 0,
    `载体窄路（业主 2026-10-23 裁定）：底本只能来自 PG 键入本，archive.org 的 OCR 只作定位 —— 非 PG 载体 ${(offPath.map(短名).join('、')) || '无'}`);
}

const summary = `western acceptance: tools=${WESTERN_TOOLS.length} open=${WESTERN_LIVE_HREFS.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
