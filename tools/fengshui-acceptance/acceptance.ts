// 户型规则层验收（东方 · 批 C）。
//
// 这一层最像"能算"，也最容易滑成"编一套方位说法冒充传统"。所以钉四件事：
//  可复现（同输入同输出）、输入不足时明确不判、判据只有几何四类、
//  输出里不许出现吉凶/化煞那类词，也不许出现任何"古籍怎么说"。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/fengshui-acceptance/acceptance.ts --out=.fengshui.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeFloor, FENGSHUI_BASIS } from '../../frontend/lib/fengshui/analysis';
import { WESTERN_INTENTS } from '../../frontend/lib/tools/western-catalog';
import { INTENTS } from '../../frontend/lib/tools/catalog';
import type { FloorInput, Palace, Room } from '../../frontend/lib/fengshui/types';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.fengshui.txt';
const ROOT = join(__dirname, '../..');
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

const room = (id: string, 名称: string, 用途: Room['用途'], 宫位: Palace): Room => ({ id, 名称, 用途, 宫位 });
const base: FloorInput = {
  朝向: '南', 入户门: ['离'], 主窗: ['坎'],
  房间: [room('r1', '客厅', '客厅', '离'), room('r2', '主卧', '卧室', '坎')],
  已确认: true,
};

// ── 1. 前提：规则层真的出得来东西（否则下面每条都是空过）──
{
  const r = analyzeFloor(base);
  ok('premise/non-empty', r.判定.length > 0 && r.未判定.length === 0,
    `默认输入必须推出判定：实得 ${r.判定.length} 条 / 未判定 ${r.未判定.length} 条（样例「${r.判定[0]?.规则 || '无'}」）`);
  ok('premise/stamp', r.口径戳 === FENGSHUI_BASIS && /^fengshui-geometry-v\d+$/.test(FENGSHUI_BASIS),
    `口径戳 ${FENGSHUI_BASIS} 随结果一起出，改判据必须升它`);
}

// ── 2. 可复现：同一组输入两次调用逐字节相同 ──
{
  const a = JSON.stringify(analyzeFloor(base));
  const b = JSON.stringify(analyzeFloor(JSON.parse(JSON.stringify(base)) as FloorInput));
  ok('rule/deterministic', a === b, `同一组标注必须得到同一份输出（这是"规则层"三个字的全部含义）：${a.length} 字符${a === b ? ' 相同' : ' 不同'}`);
}

// ── 3. 四类几何关系：每条都是照 GRID 邻接人工推出来的 ──
{
  const rulesOf = (f: FloorInput) => analyzeFloor(f).判定.map(n => n.规则).sort();
  const cases: { name: string; input: FloorInput; want: string[] }[] = [
    { name: '门与窗对宫', input: { ...base, 入户门: ['离'], 主窗: ['坎'] }, want: ['门与窗在一条通路上'] },
    {
      name: '厨卫同宫相邻',
      input: { ...base, 房间: [room('r1', '厨房', '厨房', '震'), room('r2', '卫', '卫生间', '艮')], 主窗: ['震'] },
      want: ['厨房与卫生间相邻或同宫'],
    },
    {
      // 坎(1,2) 的三个邻格 中/艮/乾 全是私密区 → 从离出发进不去。
      // （第一次推这条时我以为"绕开中"就够了 —— 3×3 上绕开一格中心几乎总能走通，
      //  所以钉的是"三面被围"这一种，改的是期望，不是判据。）
      name: '去客厅要穿过私密区',
      input: {
        ...base, 入户门: ['离'], 主窗: ['离'],
        房间: [room('r1', '门厅', '玄关', '离'), room('r2', '主卧', '卧室', '中'),
          room('r3', '次卧', '卧室', '艮'), room('r4', '厨房', '厨房', '乾'),
          room('r5', '客厅', '客厅', '坎')],
      },
      want: ['到达该房间需穿过私密区', '中宫被固定功能占用'],
    },
    {
      name: '起居间离窗远',
      input: { ...base, 主窗: ['乾'], 房间: [room('r1', '书房', '书房', '巽')] },
      want: ['起居房间离采光面远'],
    },
  ];
  const bad: string[] = [];
  for (const c of cases) {
    const got = rulesOf(c.input);
    const missing = c.want.filter(w => !got.includes(w));
    if (missing.length) bad.push(`${c.name} 缺「${missing.join('、')}」（实得 ${JSON.stringify(got)}）`);
  }
  ok('rule/four-geometry-rules', bad.length === 0,
    `四类几何判据各有一条人工推的输入钉着：不符 ${bad.length} 条${bad.length ? ' — ' + bad.join(' | ') : ''}`);
}

// ── 4. 输入不足就不判，而且要说清缺什么 ──
{
  const unconfirmed = analyzeFloor({ ...base, 已确认: false });
  ok('input/needs-confirmation', unconfirmed.判定.length === 0 && unconfirmed.未判定.length === 1,
    `没勾"我确认过"就一条都不判：实得判定 ${unconfirmed.判定.length} 条`);
  const noFacing = analyzeFloor({ ...base, 朝向: '未确认' as const });
  ok('input/facing-unknown-degrades', noFacing.未判定.some(x => x.includes('朝向未确认')),
    `朝向未确认必须显式出现在"没判定的部分"，不许静默按南算：${noFacing.未判定.join(' | ') || '（空）'}`);
  const noRooms = analyzeFloor({ ...base, 房间: [] });
  ok('input/empty-plate', noRooms.判定.length === 0 && noRooms.未判定.length > 0,
    '空户型不出判定，也不报错');
  const noWindows = analyzeFloor({ ...base, 主窗: [] });
  ok('input/missing-window-says-so', noWindows.未判定.some(x => x.includes('主窗')),
    '缺主窗时说"缺输入"，而不是给一条"该房间无采光"的结论');
}

// ── 5. 话术边界：几何可以，吉凶与冒充古籍不行 ──
{
  const runs = [analyzeFloor(base), analyzeFloor({ ...base, 朝向: '未确认' }), analyzeFloor({ ...base, 入户门: [], 主窗: [] })];
  // 只扫"判定"那三段：未判定那一栏正是用来写"这一层本站不做"的，把 disclosure 也禁掉
  // 就等于逼页面把"不做八宅"这句话删了 —— 那才是更坏的结果。
  const judgments = JSON.stringify(runs.map(r => r.判定));
  const taboo = ['吉', '凶', '煞', '旺', '化解', '招财', '开运', '健康', '投资', '宅经', '古籍', '原典', '八宅', '玄空', '曰', '记载'].filter(w => judgments.includes(w));
  ok('copy/no-metaphysics-words', taboo.length === 0,
    `判定里不许出现方位吉凶或冒充古籍的字（八宅/玄空那一层是"明写不做"，不是换个词讲）：命中 ${taboo.join('、') || '无'}`);
  const undirected = analyzeFloor({ ...base, 朝向: '未确认' }).未判定;
  ok('copy/undone-is-declared', undirected.some(x => x.includes('不做')),
    `"没做的那一层"要出现在未判定栏里，而不是悄悄少几条：${undirected.join(' | ') || '（空）'}`);
  const page = readFileSync(join(ROOT, 'frontend', 'app', 'fengshui', 'page.tsx'), 'utf8');
  const form = readFileSync(join(ROOT, 'frontend', 'components', 'fengshui', 'FloorPlanForm.tsx'), 'utf8');
  ok('copy/declares-what-is-not-done', page.includes('不上传户型图') && form.includes('原典之外不发明'),
    '页面上要写明两件事：不上传图、传统方位那一层不做（不做的东西不写出来，用户会以为藏在某处）');
  ok('comp/no-upload-no-network', !/type=["']file["']|FileReader|fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(form),
    '这一版没有上传控件、没有网络调用、没有本地存储：标注只活在页面内存里');
}

// ── 6. 归属：户型只属于东方 ──
{
  const west = WESTERN_INTENTS.flatMap(g => g.tools);
  ok('domain/oriental-only', !west.some(t => t.slug === 'fengshui' || /户型|风水/.test(t.name))
    && INTENTS.flatMap(g => g.tools).some(t => t.slug === 'fengshui' && t.href === '/fengshui'),
    '东方目录里有它且入口是 /fengshui，西方目录里不许出现（两套体系不互相代收）');
  const westSrc = readFileSync(join(ROOT, 'frontend', 'components', 'western', 'WesternWorkspace.tsx'), 'utf8');
  ok('domain/western-page-clean', !/户型|fengshui/i.test(westSrc), '西方工作台组件源码里也不许出现户型字样');
}

const summary = `fengshui acceptance: notes=${analyzeFloor(base).判定.length} stamp=${FENGSHUI_BASIS} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
