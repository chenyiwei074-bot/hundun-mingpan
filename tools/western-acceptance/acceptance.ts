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
import { join } from 'node:path';
import { INTENTS } from '../../frontend/lib/tools/catalog';
import { WESTERN_CLOSED_TOOLS, WESTERN_INTENTS, WESTERN_LIVE_HREFS, WESTERN_TOOLS } from '../../frontend/lib/tools/western-catalog';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.western.txt';
const ROOT = join(__dirname, '../..');
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
  // 这一条钉的是"今天"，不是永久不变量：开第一项时它必须连同样例验收一起被改。
  ok('west/nothing-open-yet', WESTERN_LIVE_HREFS.length === 0 && WESTERN_CLOSED_TOOLS.length === WESTERN_TOOLS.length,
    `本批西方一项都不开放（实得已开放 ${WESTERN_LIVE_HREFS.length} 项）。开第一项时，这条要和"该项的公开样例盘 + 算法口径裁定"一起进来，不能只把它改成 1。`);
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
  const banned = ['caelus', 'astronomy-engine', 'tyme4ts', 'iztro', 'astrology', 'ephemeris', 'tarot'];
  const hit = deps.filter(d => banned.some(b => d.toLowerCase().includes(b)));
  ok('west/no-unvetted-engine', hit.length === 0,
    `本批不给前端加任何西方天文/占卜依赖（AGPL 与 1★ 仓库那两条红线要单独裁定，见计划 B 线）：新增命中 ${hit.join('、') || '无'}`);
  const ws = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'western', 'WesternWorkspace.tsx'), 'utf8'));
  // 批A：双闸门从各页自己写一遍，改成 lib/tools/status.ts 的 isLiveEntry 一份。
  // 原来这条钉的是"页面里出现那句 status !== '未开放' && href"，于是每多一个页面就多一份
  // 同一条判据（三处三份），现在钉的是"这一页吃的是那一份"——判据仍然在，只是只有一个出处。
  ok('west/page-renders-from-catalog', /WESTERN_INTENTS\.map/.test(ws)
    && /isLiveEntry/.test(ws) && /from '@\/lib\/tools\/status'/.test(ws)
    && !/status\s*!==\s*'未开放'\s*&&\s*t\.href/.test(ws),
    '西方工作页必须渲染自目录，入口判定吃 lib/tools/status.ts 的 isLiveEntry（页面里再写一遍双闸门 = 第二份真相）');
  const landing = stripComments(readFileSync(join(ROOT, 'frontend', 'app', 'page.tsx'), 'utf8'));
  ok('west/gate-count-derived', /WESTERN_INTENTS/.test(landing) && /statusCounts|statusTally/.test(landing)
    && !/已开放\s*[0-9]/.test(landing) && !/(可用|未开放)\s*[0-9]/.test(landing),
    '门廊上西方那张卡的数也是现算的（走 status.ts），旧写法「已开放 N」与新写法「可用 N」都不许写死');
}

const summary = `western acceptance: tools=${WESTERN_TOOLS.length} open=${WESTERN_LIVE_HREFS.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
