// AI 解读等待状态机验收。210 秒这件事不该靠真等来测，所以 decideAiWait 是纯函数、
// 时钟由调用方注入：这里用假时钟把整条时间线跑完，再断言真实页面上那些文案与间隔。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/ai-wait-acceptance/acceptance.ts --out=.ai-wait.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_DEADLINE_MS, AI_POLL_MS, aiWaitMessage, decideAiWait } from '../../frontend/lib/chart/ai-wait';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.ai-wait.txt';
const ROOT = join(__dirname, '../..');

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

const PLATE = { chartData: { bazi: { pillars: 'x' } } };

// ── 1. 盘面先出（这条链上真正被修掉的东西）──
{
  const d = decideAiWait({ httpStatus: 200, status: 'processing', ...PLATE, aiAnalysis: null }, 1200);
  ok('plate-first/renders-while-processing', d.showPlate && d.state === 'ai-waiting' && d.keepPolling,
    `status=processing 且 chartData 已落库 → 立刻画盘面并继续等 AI（改前这里是直接 return，盘面要等 AI 跑完）：${d.state}/showPlate=${d.showPlate}`);
  const p = decideAiWait({ httpStatus: 202, status: 'processing' }, 500);
  ok('plate-first/not-before-chartjson', !p.showPlate && p.state === 'chart-pending' && p.keepPolling,
    '后端还没落 chartJson 时不假装盘面就绪（202 走等待，不提前收尾）');
}

// ── 2. 间隔与截止（裁定 6 的 ①②）──
{
  ok('timing/interval-floor', AI_POLL_MS >= 1500, `轮询间隔 ${AI_POLL_MS}ms ≥ 1500ms（验收标准）`);
  ok('timing/deadline-is-210s', AI_DEADLINE_MS === 210_000, `轮询截止 ${AI_DEADLINE_MS / 1000}s（要求 210s 停）`);
  const before = decideAiWait({ httpStatus: 200, status: 'processing', ...PLATE }, AI_DEADLINE_MS - 1);
  const at = decideAiWait({ httpStatus: 200, status: 'processing', ...PLATE }, AI_DEADLINE_MS);
  ok('timing/stops-at-deadline', before.keepPolling && !at.keepPolling && at.state === 'ai-timeout',
    `209.999s 仍在轮询、210.000s 停：${before.state}(keep=${before.keepPolling}) → ${at.state}(keep=${at.keepPolling})`);
  ok('timing/plate-survives-timeout', at.showPlate, '超时只停轮询，盘面必须留着（裁定 6 第 ① 条：不无限等、也不清空）');
}

// ── 3. 自动替换与刷新（④⑤）──
{
  const ready = decideAiWait({ httpStatus: 200, status: 'completed', ...PLATE, aiAnalysis: { s: '解读' } }, 95_000);
  ok('replace/auto-no-reload', ready.state === 'ai-ready' && ready.showPlate && !ready.keepPolling,
    'AI 一出现就终态并停轮询，页面靠同一次 setState 替换（不需要用户刷新）');
  const fresh = decideAiWait({ httpStatus: 200, status: 'completed', ...PLATE, aiAnalysis: { s: '解读' } }, 0);
  ok('replace/refresh-shows-immediately', fresh.state === 'ai-ready',
    '刷新后第一次响应就带 aiAnalysis → 直接显示，不再走一遍等待（裁定 6 第 ⑤ 条）');
  const none = decideAiWait({ httpStatus: 200, status: 'completed', ...PLATE, aiAnalysis: null }, 3000);
  ok('terminal/no-ai-stops-early', none.state === 'ai-none' && !none.keepPolling && none.showPlate,
    '后端已终态却没有 AI 解读（成本闸/异常）→ 立刻收摊，不让人白等 210 秒');
  const bad = decideAiWait({ httpStatus: 200, status: 'failed' }, 1000);
  ok('terminal/failed-stops', bad.state === 'chart-failed' && !bad.keepPolling, '后端明确 failed 就停，不装成还在生成');
}

// ── 4. 整条时间线用假时钟跑完（动画覆盖 0–210s）──
{
  let t = 0;
  let ticks = 0;
  let plateAt = -1;
  let state = '';
  const seen = new Set<string>();
  while (true) {
    const d = decideAiWait({ httpStatus: 200, status: 'processing', ...PLATE }, t);
    seen.add(d.state);
    if (d.showPlate && plateAt < 0) plateAt = t;
    state = d.state;
    if (!d.keepPolling) break;
    t += d.nextDelayMs;
    ticks++;
    if (ticks > 500) break;
  }
  ok('timeline/plate-appears-first-tick', plateAt === 0,
    `盘面在第 0 秒就出（验收要求 <3s）：实测 plateAt=${plateAt}s`);
  ok('timeline/covers-zero-to-deadline', seen.has('ai-waiting') && state === 'ai-timeout' && t === AI_DEADLINE_MS,
    `假时钟从 0 跑到 ${t / 1000}s 才停，共 ${ticks} 次轮询（动画区间即 0–210s）：经过状态 ${[...seen].join('→')}`);
  ok('timeline/poll-count-bounded', ticks <= Math.ceil(AI_DEADLINE_MS / AI_POLL_MS),
    `轮询次数 ${ticks} ≤ ${Math.ceil(AI_DEADLINE_MS / AI_POLL_MS)}（间隔不小于 ${AI_POLL_MS}ms，不会退化成打爆后端）`);
}

// ── 5. 文案不许撒谎（③）──
{
  const src = readFileSync(join(ROOT, 'frontend/lib/chart/ai-wait.ts'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok('honesty/no-fake-progress', !/%|progress|percent|预计|进度/.test(code),
    '状态机里不出现百分比、进度、预计用时（我们真的不知道免费模型什么时候回）');
  const timeout = aiWaitMessage('ai-timeout');
  ok('honesty/timeout-message', timeout.includes('还在生成中') && timeout.includes('我的报告') && timeout.includes('刷新'),
    `超时文案按裁定原样给出口：${timeout}`);
  ok('honesty/waiting-message-not-empty', aiWaitMessage('ai-waiting').length > 12 && aiWaitMessage('ai-ready') === '',
    '等待中有话、就绪时无话（就绪后不该再挂一条状态行）');
  const page = readFileSync(join(ROOT, 'frontend/app/chart/result/[id]/page.tsx'), 'utf8');
  ok('honesty/page-uses-the-single-source', /aiWaitMessage/.test(page) && /decideAiWait/.test(page) &&
    !/width:\s*`\$\{[^}]*\}%`/.test(page),
    '页面必须用这套判定与文案，且 AI 卡里不得出现按时间算出来的宽度百分比（假进度条）');
}

const summary = `ai-wait acceptance: pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
