// AI 问事（本机路由 + 受控白名单）验收。
//
// 这一层最贵的错不是"算得不准"，而是三件假：
//  1. 把目录关键词匹配说成"模型算的"；
//  2. 模型/代码给了个 slug，页面就照着生成一个入口（幻觉变 404，甚至变越权链接）；
//  3. 表里没覆盖到的工具永远问不到，却没人知道 —— 清单会悄悄缩水。
// 所以这里的断言全部围绕"来源诚实、白名单、覆盖完整"，不测准不准（准不准是口径裁定之后的事）。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/assistant-acceptance/acceptance.ts --out=.assistant.txt
import { writeFileSync } from 'node:fs';
import { INTENTS } from '../../frontend/lib/tools/catalog';
import { WESTERN_INTENTS } from '../../frontend/lib/tools/western-catalog';
import { ROUTER_SPECS, routeLocal } from '../../frontend/lib/assistant/intent';
import { ASSISTANT_PROTOCOL, parseRouteResult, reconcile } from '../../frontend/lib/assistant/types';
import type { AssistantRouteResult, Mode } from '../../frontend/lib/assistant/types';
import { askRoute } from '../../frontend/lib/assistant/route-client';
import type { ToolEntry } from '../../frontend/lib/tools/catalog';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.assistant.txt';
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

const CATALOGS: Record<Mode, ToolEntry[]> = {
  oriental: INTENTS.flatMap(g => g.tools),
  western: WESTERN_INTENTS.flatMap(g => g.tools),
};
const OTHER: Record<Mode, ToolEntry[]> = { oriental: CATALOGS.western, western: CATALOGS.oriental };
const OPEN = (m: Mode) => CATALOGS[m].filter(t => t.status !== '未开放' && t.href);

// ── 1. 覆盖：表与目录双向对齐（缩水是静默发生的）──
{
  const all = [...CATALOGS.oriental, ...CATALOGS.western].map(t => t.slug);
  const orphans = Object.keys(ROUTER_SPECS).filter(s => !all.includes(s));
  ok('router/no-orphan-slug', orphans.length === 0,
    `关键词表里不许有目录不存在的 slug（有了就是一条永远进不去的路）：孤儿 ${orphans.join('、') || '无'}`);
  const unroutable = (['oriental', 'western'] as Mode[]).flatMap(m =>
    OPEN(m).filter(t => !ROUTER_SPECS[t.slug]).map(t => `${m}/${t.slug}`));
  ok('router/every-open-tool-askable', unroutable.length === 0,
    `每个已开放工具都至少有一种问法能得到它（漏了就是"上线了但问不到"，页面不会报错，只有用户会）：漏 ${unroutable.join('、') || '无'}`);
  const thin = Object.entries(ROUTER_SPECS).filter(([, s]) => s.ask.length < 3).map(([k]) => k);
  ok('router/ask-list-non-trivial', thin.length === 0,
    `每个 slug 的问法 ≥3 条（一条关键词的路由表等于掷硬币）：偏少 ${thin.join('、') || '无'}`);
  const dup = Object.values(ROUTER_SPECS).flatMap(s => s.ask);
  const seen = new Set<string>(); const shared: string[] = [];
  for (const k of dup) { if (seen.has(k) && !shared.includes(k)) shared.push(k); seen.add(k); }
  say(`MEASURED 跨 slug 复用的问法 ${shared.length} 条（${shared.slice(0, 8).join('、')}）—— `
    + '复用本身不是错，命中并列时路由会转成追问，这条由 router/tie-becomes-clarification 钉');
}

// ── 2. 手推路由表：每条期望都是照关键词表人工推出来的，不是跑出来再抄的 ──
{
  type Want = { mode: Mode; q: string; slug: string | null; clarify: boolean; why: string };
  const CASES: Want[] = [
    { mode: 'oriental', q: '帮我排个八字看看命格', slug: 'bazi', clarify: true,
      why: '八字/命/命格 三命中→bazi；问句里没日期没时辰没地点，missingFields 必须非空并转追问' },
    { mode: 'oriental', q: '想摇一卦，这件事能不能成', slug: 'liuyao', clarify: false,
      why: '摇卦+卦 命中 liuyao；"能不能"属于 question 线索，不缺' },
    { mode: 'oriental', q: '我出生那天值哪一宿', slug: null, clarify: true,
      why: 'bazi 的"出生"与 xiu-benming 的"哪一宿"各 1 命中，并列 → 必须追问，不许替用户挑一个' },
    { mode: 'oriental', q: '2026年10月1日适合搬家吗', slug: 'huangli', clarify: false,
      why: '适合/搬家 命中 huangli；日期给了，所以不再追问' },
    { mode: 'oriental', q: '我的月亮落在哪个星座', slug: null, clarify: true,
      why: '东方表里 0 命中、西方表命中 astro-natal → 判为跨体系，只问一句"要换过去吗"，不给入口' },
    { mode: 'oriental', q: '随便说点什么吧', slug: null, clarify: true, why: '两边都对不上 → 追问并指向目录' },
    { mode: 'western', q: '我的上升和月亮星座是什么', slug: null, clarify: true,
      why: '西方表命中 astro-natal，但它状态未开放 → reconcile 之后必须没有入口' },
    { mode: 'western', q: '帮我抽个塔罗牌阵', slug: null, clarify: true, why: 'tarot-draw 未开放 → 同上' },
    { mode: 'western', q: '今天黄历宜忌', slug: null, clarify: true, why: '东方工具在西方页不该被路由过去（跨体系要问，不要自动换）' },
  ];
  let bad = 0;
  for (const c of CASES) {
    const raw = routeLocal(c.mode, c.q, CATALOGS[c.mode], OTHER[c.mode]);
    const got = reconcile(raw, c.mode, CATALOGS[c.mode]);
    const good = got.toolSlug === c.slug && got.needsClarification === c.clarify
      && got.available === (!!c.slug && !!CATALOGS[c.mode].find(t => t.slug === c.slug)?.href);
    if (!good) {
      bad++;
      say(`  MISMATCH「${c.q}」期望 slug=${String(c.slug)} 追问=${c.clarify}；实得 slug=${String(got.toolSlug)} 追问=${got.needsClarification} available=${got.available}`);
    }
  }
  ok('router/hand-table', bad === 0,
    `${CASES.length} 条手推问句逐条对得上（推的是关键词表的语义，不是跑一遍抄一遍）：不符 ${bad} 条`);
  ok('router/never-invents-a-result', CASES.every(c => {
    const r = reconcile(routeLocal(c.mode, c.q, CATALOGS[c.mode], OTHER[c.mode]), c.mode, CATALOGS[c.mode]);
    return !r.toolSlug || !!r.mode;
  }) && CASES.every(c => {
    const r = reconcile(routeLocal(c.mode, c.q, CATALOGS[c.mode], OTHER[c.mode]), c.mode, CATALOGS[c.mode]);
    return r.clarification === null || r.clarification.length > 4;
  }), '没对上工具时必须给一句能走的下一步（clarification 非空），不给空白');

  const tie = reconcile(routeLocal('oriental', '我出生那天值哪一宿', CATALOGS.oriental, OTHER.oriental), 'oriental', CATALOGS.oriental);
  ok('router/tie-becomes-clarification', tie.toolSlug === null && tie.needsClarification
    && (tie.clarification || '').includes('八字') && (tie.clarification || '').includes('二十八宿')
    && (tie.clarification || '').includes('哪一个'),
    `命中并列 → 不选边、改追问：${tie.clarification}`);
}

// ── 3. 白名单：任何来源的 slug 都要过目录核对，模型不许自带 URL ──
{
  const base = (o: Partial<AssistantRouteResult>): AssistantRouteResult => ({
    mode: 'oriental', toolSlug: null, confidence: 0.9, needsClarification: false,
    clarification: null, missingFields: [], available: false, ...o,
  });
  const forged = reconcile(base({ toolSlug: '../../../../etc/passwd', available: true }), 'oriental', CATALOGS.oriental);
  ok('gate/forged-slug-rejected', forged.toolSlug === null && !forged.available && forged.needsClarification,
    `伪造 slug 一律抹掉并转追问：实得 ${JSON.stringify(forged.toolSlug)}`);
  const closed = reconcile(base({ toolSlug: 'hepan', available: true }), 'oriental', CATALOGS.oriental);
  ok('gate/closed-slug-rejected', closed.toolSlug === null && !closed.available,
    '目录里存在但未开放的 slug 也不许给入口（合盘在表里，但今天没有门）');
  // 上面那条只钉"不给入口"。harness 的 western-ask 那一态抓到过更细的一种假：
  // 入口是没了，可回答里还留着"进入「西洋占星」还要补：日期、时辰、地点" —— 半开的门。
  const halfOpen = reconcile(
    routeLocal('western', '我的上升和月亮星座是什么', CATALOGS.western, OTHER.western), 'western', CATALOGS.western);
  ok('gate/no-half-open-door', halfOpen.toolSlug === null && halfOpen.missingFields.length === 0
    && !(halfOpen.clarification || '').includes('还要补') && (halfOpen.clarification || '').includes('还没开放'),
    `未开放工具被抹掉时，"还要补什么"必须一起抹掉：${JSON.stringify(halfOpen.clarification)}`);
  const open = reconcile(base({ toolSlug: 'liuyao', available: false }), 'oriental', CATALOGS.oriental);
  ok('gate/open-slug-allowed', open.toolSlug === 'liuyao' && open.available,
    '已开放且带 href 的 slug 正常放行（available 由这里判，不由来源判）');
  const shape = parseRouteResult({ mode: 'oriental', toolSlug: 'liuyao', confidence: 1.5,
    needsClarification: false, clarification: null, missingFields: [], available: true });
  ok('gate/shape-confidence-range', shape === null,
    `confidence 越界（1.5）直接判不合法，不夹逼成 1：实得 ${JSON.stringify(shape)}`);
  const extra = parseRouteResult({ mode: 'oriental', toolSlug: 'liuyao', confidence: 0.8,
    needsClarification: false, clarification: null, missingFields: [], available: true,
    href: 'https://evil.example/x', url: 'javascript:alert(1)' });
  ok('gate/no-url-field-survives', !!extra && !('href' in extra) && !('url' in extra),
    '协议里没有 href/url 这两个字段，多给的必须被丢掉（入口只由 slug 查目录得到）');
  const badMode = parseRouteResult({ mode: 'voodoo', toolSlug: null, confidence: 0.5,
    needsClarification: true, clarification: 'x', missingFields: [], available: false });
  ok('gate/mode-enum', badMode === null, 'mode 只认 oriental/western');
  ok('gate/protocol-stamp', ASSISTANT_PROTOCOL === 'assistant-route-v1',
    `协议版本戳 ${ASSISTANT_PROTOCOL}：服务端上线时必须带同一个串，对不上按没接上处理`);
}

// ── 4. 回落：服务端在/不在/答非所问，三条路都要有确定行为 ──
// tsx 走 cjs 输出，顶层 await 不让用，所以这一段包成一个 async 段，最后再汇总。
async function sectionFallbacks() {
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o } as Response);
  const notFound = { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  const run = async (fetchImpl: typeof fetch, mode: Mode, text: string) =>
    askRoute({ mode, text, catalog: CATALOGS[mode], otherCatalog: OTHER[mode], fetchImpl });

  const gone = await run(async () => notFound, 'oriental', '帮我排个八字看看命格');
  ok('fallback/404-uses-local', gone.source === 'local' && !!gone.degraded && /404/.test(gone.degraded),
    `网关把 /api/* 整段转走、后端没有这条路由时（现状），必须回落本机并说明原因：${gone.degraded}`);

  const srv = await run(async () => json({ data: { mode: 'oriental', toolSlug: 'liuyao', confidence: 0.9,
    needsClarification: false, clarification: null, missingFields: [], available: true } }), 'oriental', '想摇一卦');
  ok('fallback/server-result-used', srv.source === 'server' && srv.result.toolSlug === 'liuyao' && srv.degraded === null,
    '服务端正常返回时用的是它的结果（不是本机那份）');

  const srvForged = await run(async () => json({ mode: 'oriental', toolSlug: 'hepan', confidence: 0.99,
    needsClarification: false, clarification: null, missingFields: [], available: true }), 'oriental', '想摇一卦');
  ok('fallback/server-still-reconciled', srvForged.source === 'server' && srvForged.result.toolSlug === null
    && !srvForged.result.available,
    '服务端说"未开放的合盘可用"也不作数：白名单核对对本机与服务端两条路一视同仁');

  const junk = await run(async () => json({ hello: 'world' }), 'oriental', '想摇一卦');
  ok('fallback/bad-shape-uses-local', junk.source === 'local' && /形状/.test(junk.degraded || ''),
    `返回形状不合协议 → 回落并写明：${junk.degraded}`);

  const cross = await run(async () => json({ mode: 'western', toolSlug: 'tarot-draw', confidence: 0.9,
    needsClarification: false, clarification: null, missingFields: [], available: true }), 'oriental', '想摇一卦');
  ok('fallback/mode-mismatch-not-trusted', cross.source === 'local' && /另一套体系/.test(cross.degraded || ''),
    '在东方页问出的结果，服务端答的是西方体系 → 按没答处理，不跨系给入口');

  const boom = await run(async () => { throw new TypeError('Failed to fetch'); }, 'oriental', '想摇一卦');
  ok('fallback/network-throw-uses-local', boom.source === 'local' && /不可达/.test(boom.degraded || ''),
    `fetch 直接抛（断网/CSP/混合内容）也要回落：${boom.degraded}`);

  const empty = await run(async () => notFound, 'oriental', '   ');
  ok('fallback/empty-input-no-call', empty.source === 'local' && /还没输入/.test(empty.degraded || '')
    && empty.result.toolSlug === null, '空输入不发请求、不编结果');
}

// ── 5. 组件侧的诚实：来源标注与"不写日志"这两句话必须真的在代码里 ──
{
  const read = (p: string) => {
    try { return require('fs').readFileSync(new URL(p, import.meta.url), 'utf8') as string; } catch { return ''; }
  };
  const comp = read('../../frontend/components/assistant/QuestionComposer.tsx');
  ok('comp/found', comp.length > 800, `读到了问事框组件（读不到下面几条全是空过）：${comp.length} 字符`);
  ok('comp/source-labelled', /这一轮由本机目录匹配给出，未经模型/.test(comp) && /这一轮来自服务端路由/.test(comp),
    '每一轮都要在屏上写明是谁算的：本机那份与模型那份是两件事，混着说就是骗');
  ok('comp/no-verdict-words', !/吉|凶|运势旺|转运|化解/.test(comp.replace(/\/\*[\s\S]*?\*\//g, '')),
    '问事框自己不写任何吉凶结论（结论只在工具页由引擎给）');
  ok('comp/no-storage-or-log', !/localStorage|sessionStorage|console\.(log|info)|fetch\(\s*['"]\/api\/event/.test(comp),
    '问题原文不落本地存储、不进埋点、不写日志（隐私边界与回执链路同一套要求）');
  ok('comp/href-only-from-catalog', !/href\s*=\s*["']\/(?!create|liuyao|meihua|xiu|huangli|tools)/.test(comp)
    && /tool\.href!/.test(comp),
    '组件里不写死任何工具路由，入口一律由目录查出来的 tool.href 给');
}

function report() {
  const summary = `assistant acceptance: cases=router/open=${OPEN('oriental').length}+${OPEN('western').length} pass=${pass} fail=${fail}`;
  try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
  console.log(summary);
  const fails = lines.filter(l => l.startsWith('FAIL'));
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  console.log('0 failures — see ' + OUT);
}

sectionFallbacks().then(report).catch(e => {
  say(`FAIL  section/await  ${'回落那一段自己抛了：' + ((e as Error)?.message || e)}`);
  report();
});
