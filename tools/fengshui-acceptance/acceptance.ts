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
import {
  assignPalace, buildWalkGrid, nearestWalkable, palaceCells, passable, reachableFrom, toFloorInput,
} from '../../frontend/lib/fengshui/geometry';
import type { FloorGeometry, Opening, Wall } from '../../frontend/lib/fengshui/geometry';
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

// ── 7. 几何层：宫位按面积重叠最大者归属，粒子通路按可行走网格算 ──
{
  type Cell = NonNullable<ReturnType<typeof palaceCells>>[number];
  const cells: Cell[] = [
    { 宫: '乾', minX: 0, minY: 0, maxX: 3, maxY: 3 }, { 宫: '坎', minX: 3, minY: 0, maxX: 6, maxY: 3 },
    { 宫: '艮', minX: 6, minY: 0, maxX: 9, maxY: 3 }, { 宫: '兑', minX: 0, minY: 3, maxX: 3, maxY: 6 },
    { 宫: '中', minX: 3, minY: 3, maxX: 6, maxY: 6 }, { 宫: '震', minX: 6, minY: 3, maxX: 9, maxY: 6 },
    { 宫: '坤', minX: 0, minY: 6, maxX: 3, maxY: 9 }, { 宫: '离', minX: 3, minY: 6, maxX: 6, maxY: 9 },
    { 宫: '巽', minX: 6, minY: 6, maxX: 9, maxY: 9 },
  ];
  const centroid = (ring: { x: number; y: number }[]) => {
    let a = 0, cx = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j].x * ring[i].y - ring[i].x * ring[j].y;
      a += f; cx += (ring[j].x + ring[i].x) * f;
    }
    return cx / (3 * a);
  };

  // A. L 形：主体（71.4% 面积）在 乾，但一条细长的走廊臂把**质心**甩进了 坎。
  //    手算：顶条 x[2,9]×y[0,0.2]=1.4 形心 x=5.5；竖块 x[2,3]×y[0.2,3]=2.8 形心 x=2.5
  //    → 质心 x=(1.4*5.5+2.8*2.5)/4.2=3.5 落在 坎；而 乾 占 3.0/4.2=0.714。
  //    这一条存在的唯一理由：如果哪天有人把归属改回质心，这里必须红，而不是"看起来也对"。
  const L = [{ x: 2, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 0.2 }, { x: 3, y: 0.2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
  const aL = assignPalace(L, cells)!;
  ok('geo/area-not-centroid', aL.宫 === '乾' && centroid(L) > 3 && Math.abs(aL.占比 - 0.714) < 0.002,
    `L 形房间：面积多数在 ${aL.宫}（占 ${aL.占比}），质心 x=${Math.round(centroid(L) * 100) / 100} 却在 坎 —— 两个答案不一致时选面积，这是裁定`);
  ok('geo/long-room-flagged-across', aL.跨宫 === false && aL.涉及宫.join('') === '乾坎艮',
    `占比 71.4% ≥ 六成所以不标跨宫，但三条宫都碰到 ${JSON.stringify(aL.涉及宫)}：等积的两条要按九宫顺序排（浮点末位不该决定 坎 和 艮 谁在前），`
    + '而跨宫标记只在归属不稳时才亮');
  // 同一间房换个顶点起点（几何完全一样，浮点求和路径不同）→ 归属与并列次序都不能变
  const L2 = [L[3], L[4], L[5], L[0], L[1], L[2]];
  const aL2 = assignPalace(L2, cells)!;
  ok('geo/vertex-order-invariant', aL2.宫 === aL.宫 && aL2.涉及宫.join('') === aL.涉及宫.join('')
    && Math.abs(aL2.占比 - aL.占比) < 1e-6,
    `同一间房顶点轮换后仍归 ${aL2.宫}、次序仍 ${aL2.涉及宫.join('')}（占比 ${aL2.占比}）—— 并列靠九宫顺序判，不靠浮点末位`);

  // B. 正好对半 → 归属要确定（并列按九宫顺序），且必须亮"跨宫"
  const half = [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 1, y: 3 }];
  const aH = assignPalace(half, cells)!;
  const aH2 = assignPalace(half, cells)!;
  ok('geo/tie-deterministic', aH.宫 === '乾' && aH2.宫 === aH.宫 && aH.占比 === 0.5,
    `乾坎各半时按九宫固定顺序取 ${aH.宫}（占 ${aH.占比}），两次调用同结果 —— 同一份图纸不能今天算乾明天算坎`);
  ok('geo/across-flag', aH.跨宫 === true, '占比不足六成的对半房间必须标跨宫，下游要写"归属仅供参考"');

  // C. 六成是"不足"才亮，等于不亮 —— 钉住比较号的方向
  const edge = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 0, y: 3 }];
  const aE = assignPalace(edge, cells)!;
  ok('geo/sixty-percent-boundary', aE.占比 === 0.6 && aE.跨宫 === false,
    `恰好 60% 不算跨宫（判据是"不足六成"）：${aE.占比} / 跨宫=${aE.跨宫}`);

  // D. 可行走网格：墙挡住就是挡住，开口要"已确认"才算洞，而且只放行自己宽度那一段。
  //    图纸 9×9，隔墙在 x=4.5（y 0→3），两间房都在最上面一行的带里 → A 落 乾、B 落 艮。
  const wall = (id: string, 折线: { x: number; y: number }[], 闭合 = false): Wall => ({ id, 折线, 闭合 });
  const twoRooms = (openings: Opening[]): FloorGeometry => ({
    墙体: [
      wall('外', [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }, { x: 0, y: 9 }], true),
      wall('隔', [{ x: 4.5, y: 0 }, { x: 4.5, y: 3 }]),
    ],
    房间: [
      { id: 'A', 名称: '客厅', 用途: '客厅', 外环: [{ x: 0.06, y: 0.06 }, { x: 4.44, y: 0.06 }, { x: 4.44, y: 2.94 }, { x: 0.06, y: 2.94 }] },
      { id: 'B', 名称: '主卧', 用途: '卧室', 外环: [{ x: 4.56, y: 0.06 }, { x: 8.94, y: 0.06 }, { x: 8.94, y: 2.94 }, { x: 4.56, y: 2.94 }] },
    ],
    开口: openings,
  });
  const doorAt = (已确认: boolean): Opening => ({
    id: 'd1', 类型: '门', 墙: '隔', 段: 0, 位: 0.5, 宽: 0.9, 置信度: null, 已确认,
  });
  const winAt = (已确认: boolean): Opening => ({
    id: 'w1', 类型: '窗', 墙: '外', 段: 0, 位: 0.75, 宽: 1.2, 置信度: 0.82, 已确认,
  });
  const crossable = (g: FloorGeometry) => {
    const grid = buildWalkGrid(g, 0.25)!;
    const from = nearestWalkable(grid, { x: 2, y: 1.5 })!;
    const to = nearestWalkable(grid, { x: 7, y: 1.5 })!;
    return reachableFrom(grid, g, [from]).has(to);
  };
  ok('geo/wall-blocks', crossable(twoRooms([])) === false, '没有门洞时，两间房在可行走网格上必须不连通');
  ok('geo/confirmed-door-passes', crossable(twoRooms([doorAt(true)])) === true, '已确认的门洞打开后必须连通');
  ok('geo/unconfirmed-door-solid', crossable(twoRooms([doorAt(false)])) === false,
    '没被人工确认的开口在几何上仍然是墙 —— 识别错了也不该算出一条穿墙通路');

  // E. 门宽 0.9m 开在 y=1.5：同一道墙上离门 1m 远的两格必须仍然过不去。
  //    这条是"整段墙因为旁边开了扇门就全部放行"那个写法专门准备的 —— 那样粒子和判定都会穿墙。
  {
    const g = twoRooms([doorAt(true)]);
    const grid = buildWalkGrid(g, 0.25)!;
    const pairAt = (y: number) => {
      const i = nearestWalkable(grid, { x: 4.375, y })!, j = nearestWalkable(grid, { x: 4.625, y })!;
      return passable(grid, g, i, j);
    };
    ok('geo/door-width-respected', pairAt(1.5) === true && pairAt(0.4) === false,
      `门上沿 y=1.5±0.45 放行、y=0.4 处仍挡：实测 门口=${pairAt(1.5)} 离门 1.1m=${pairAt(0.4)}`);
  }

  // F. 翻译出口：规则层一行不改就能吃几何
  const translated = toFloorInput(twoRooms([doorAt(true), winAt(true)]), '南', true);
  const rep = analyzeFloor(translated.输入 as never);
  ok('geo/feeds-rule-layer', translated.输入.房间.length === 2 && rep.判定.length > 0 && rep.口径戳 === FENGSHUI_BASIS,
    `几何翻译成宫位后 analyzeFloor 出得来 ${rep.判定.length} 条判定（${rep.判定.map(n => n.规则).join('、') || '无'}），口径戳没变（规则层一行不改）`);
  ok('geo/palace-translation-sane', translated.输入.房间[0].宫位 === '乾' && translated.输入.房间[1].宫位 === '艮'
    && translated.输入.入户门.join('') === '坎' && translated.输入.主窗.join('') === '艮',
    `左半落 ${translated.输入.房间[0].宫位}、右半落 ${translated.输入.房间[1].宫位}，门落 ${translated.输入.入户门}、窗落 ${translated.输入.主窗}`);
  ok('geo/unconfirmed-opening-not-counted', toFloorInput(twoRooms([doorAt(false), winAt(false)]), '南', true).输入.入户门.length === 0,
    '未确认的开口不翻译成宫位输入：门没确认，动线判定就该说"没标入户门位置"，而不是拿猜的位置去判');

  // G. 九宫排法只许有一份
  const form = readFileSync(join(ROOT, 'frontend', 'components', 'fengshui', 'FloorPlanForm.tsx'), 'utf8');
  ok('geo/palace-grid-single-source', !/const LAYOUT[^=]*=\s*\[\[/.test(form) && /PALACE_GRID/.test(form),
    '表单不再自带第二份九宫字面量，改读 types.ts 里的 PALACE_GRID（两处各写一遍 = 图上看到的宫和算出来的宫会分家）');

  // H. 坐标约定：第 0 行必须是"图上最上面那一行"（minY 侧）。这条翻错了一套判定会整体上下颠倒，
  //    而面积、连通性全都照样"对"，所以只能单独钉。
  const pc = palaceCells(twoRooms([]))!;
  const top = pc.filter(c => c.minY === 0).map(c => c.宫).join('');
  ok('geo/row0-is-top', top === '乾坎艮', `九宫第 0 行取 minY 那一侧（图纸 y 向下）：实得 ${top}`);
  ok('geo/cells-cover-bbox', Math.min(...pc.map(c => c.minX)) === 0 && Math.max(...pc.map(c => c.maxX)) === 9
    && pc.length === 9, '九宫切的是整户包围盒，三行三列不留缝（用房间并集切会让 L 形宅的宫格随标注漂移）');
}

const summary = `fengshui acceptance: notes=${analyzeFloor(base).判定.length} stamp=${FENGSHUI_BASIS} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
