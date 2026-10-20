// 户型几何层：多边形、九宫归属、可行走网格。
//
// 这一层只算几何，不给任何断语 —— 断语在 analysis.ts，它吃的是宫位标签。
// 所以本模块的一个出口就是把几何**翻译**成 analysis.ts 已经认识的那个形状
// （FloorInput），规则层一行都不用改。改一行判据都要升口径戳，能不改就不改。
//
// 宫位归属按裁定的"面积重叠最大者"，不按质心：细长房间跨两宫时质心会跳到窄的那半边，
// 而人看图纸第一眼看的是"这间房大部分在哪"。重叠不足六成时把 跨宫 报出来，
// 让下游判定能写"归属仅供参考"，而不是假装归对了。

import type { Palace, RoomKind } from './types';
import { PALACE_GRID } from './types';

/** 图纸坐标：x 向右、y 向下，单位米，与页面 SVG 同向。九宫的第 0 行因此是"图上最上面那一行"
 *  （minY 那侧）。3D 里换成 y 向上时必须在出口处翻一次，不能两边各写一套约定。 */
export interface Pt { x: number; y: number }

export interface Wall {
  id: string;
  /** 折线顶点，米。闭合墙首尾不必重复。 */
  折线: Pt[];
  闭合: boolean;
}

export interface RoomShape {
  id: string;
  名称: string;
  用途: RoomKind;
  /** 逆时针或顺时针都可以，内部不依赖绕向。 */
  外环: Pt[];
}

export interface Opening {
  id: string;
  类型: '门' | '窗';
  /** 挂在第几道墙上。 */
  墙: string;
  /** 该墙折线的第 i 到 i+1 段。 */
  段: number;
  /** 开口中心在该段上的参数位置，0–1。 */
  位: number;
  /** 开口宽度（米）。 */
  宽: number;
  /** 识别置信度；手工标注时为 null。 */
  置信度: number | null;
  /** 用户是否确认过这个开口。没确认的开口不参与通路与气流计算。 */
  已确认: boolean;
}

export interface FloorGeometry {
  墙体: Wall[];
  房间: RoomShape[];
  开口: Opening[];
}

export const WALL_THICKNESS = 0.12;
export const WALL_HEIGHT = 2.6;
export const DOOR_HEIGHT = 2.05;
export const SILL_HEIGHT = 0.9;
export const WINDOW_HEIGHT = 1.2;
export const MAX_SPAN_M = 20;
/** 重叠面积占房间面积低于这个比例时，宫位归属要标"跨宫"。 */
export const PALACE_OVERLAP_MIN = 0.6;

export function boundingBox(ring: Pt[]) {
  const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function polygonArea(ring: Pt[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    s += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  return Math.abs(s) / 2;
}

/** 整户包围盒切成 3×3。用包围盒而不是房间并集：九宫本来就是"以宅为框"的粗格子。 */
export function palaceCells(geom: FloorGeometry) {
  const all = [...geom.房间.map(r => r.外环), ...geom.墙体.map(w => w.折线)].filter(p => p.length);
  if (!all.length) return null;
  const flat = all.flat();
  const b = boundingBox(flat);
  const w = (b.maxX - b.minX) / 3, h = (b.maxY - b.minY) / 3;
  if (!(w > 0 && h > 0)) return null;
  const cells: { 宫: Palace; minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      cells.push({
        宫: PALACE_GRID[row][col],
        minX: b.minX + col * w, minY: b.minY + row * h,
        maxX: b.minX + (col + 1) * w, maxY: b.minY + (row + 1) * h,
      });
  return cells;
}

/** Sutherland–Hodgman：用轴对齐矩形裁任意多边形。矩形是凸的，所以结果精确。 */
export function clipToRect(ring: Pt[], r: { minX: number; minY: number; maxX: number; maxY: number }): Pt[] {
  const inside = (p: Pt) => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  const intersect = (a: Pt, b: Pt, edge: 'l' | 'r' | 't' | 'b'): Pt => {
    const t = edge === 'l' ? (r.minX - a.x) / (b.x - a.x) : edge === 'r' ? (r.maxX - a.x) / (b.x - a.x)
      : edge === 't' ? (r.minY - a.y) / (b.y - a.y) : (r.maxY - a.y) / (b.y - a.y);
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  };
  let out = ring;
  for (const edge of ['l', 'r', 't', 'b'] as const) {
    const keep = (p: Pt) => edge === 'l' ? p.x >= r.minX : edge === 'r' ? p.x <= r.maxX
      : edge === 't' ? p.y >= r.minY : p.y <= r.maxY;
    const next: Pt[] = [];
    for (let i = 0, j = out.length - 1; i < out.length; j = i++) {
      const a = out[j], b = out[i], ai = keep(a), bi = keep(b);
      if (bi) { if (!ai) next.push(intersect(a, b, edge)); next.push(b); }
      else if (ai) next.push(intersect(a, b, edge));
    }
    out = next;
    if (!out.length) return [];
  }
  return out;
}

export interface PalaceAssignment {
  宫: Palace;
  /** 该房间落在这一宫里的面积占房间总面积的比例。 */
  占比: number;
  /** 跨宫：最大重叠不足 PALACE_OVERLACE_MIN。 */
  跨宫: boolean;
  涉及宫: Palace[];
}

/** 面积重叠最大者。并列时按九宫固定顺序取先，保证同一份输入永远算出同一个结果。 */
export function assignPalace(ring: Pt[], cells: NonNullable<ReturnType<typeof palaceCells>>): PalaceAssignment | null {
  const area = polygonArea(ring);
  if (!(area > 0)) return null;
  const parts: { 宫: Palace; 占比: number }[] = [];
  for (const c of cells) {
    const a = polygonArea(clipToRect(ring, c));
    if (a > 1e-9) parts.push({ 宫: c.宫, 占比: a / area });
  }
  if (!parts.length) return null;
  const order = PALACE_GRID.flat();
  // 先按面积，差不到万分之一就视为并列、改按九宫固定顺序判。
  // 不写这个容差的话，"两半正好等积"会由浮点末位决定归属 —— 同一间房换个顶点起点就可能换宫。
  parts.sort((x, y) => (x.占比 - y.占比 > 1e-9 ? -1 : y.占比 - x.占比 > 1e-9 ? 1
    : order.indexOf(x.宫) - order.indexOf(y.宫)));
  const top = parts[0];
  return { 宫: top.宫, 占比: Math.round(top.占比 * 1000) / 1000, 跨宫: top.占比 < PALACE_OVERLAP_MIN, 涉及宫: parts.map(p => p.宫) };
}

/** (墙, 段) → 该段的两端点。**全站只有这一处解释这个坐标对。**
 *  闭合墙的第 n-1 段是"末点→首点"那一跨。之前这件事有四处各自实现、三种行为：
 *  等轴图与 crossesWall 是对的；openingPalace 把最后一段夹回倒数第二段（于是那个开口
 *  被归到隔壁宫的墙中点上）；3D 直接取到 undefined 就把洞口整个画没了。
 *  读的是同一份 FloorGeometry，就必须只有一个人负责回答"这段墙从哪到哪"。 */
export function openingSegment(op: Opening, wall: Wall): [Pt, Pt] | null {
  const n = wall.折线.length;
  if (n < 2) return null;
  const 段数 = wall.闭合 ? n : n - 1;
  if (op.段 < 0 || op.段 >= 段数) return null;
  return [wall.折线[op.段], wall.折线[(op.段 + 1) % n]];
}

/** 开口中心落在哪一宫：取该段的中点参数位置，再按点归属。 */
export function openingPalace(op: Opening, geom: FloorGeometry,
  cells: NonNullable<ReturnType<typeof palaceCells>>): Palace | null {
  const wall = geom.墙体.find(w => w.id === op.墙);
  if (!wall) return null;
  const seg = openingSegment(op, wall);
  if (!seg) return null;
  const [a, b] = seg;
  const p = { x: a.x + (b.x - a.x) * op.位, y: a.y + (b.y - a.y) * op.位 };
  const hit = cells.find(c => p.x >= c.minX && p.x <= c.maxX && p.y >= c.minY && p.y <= c.maxY);
  return hit ? hit.宫 : null;
}

export function pointInPalace(p: Pt, c: { minX: number; minY: number; maxX: number; maxY: number }) {
  return p.x >= c.minX && p.x <= c.maxX && p.y >= c.minY && p.y <= c.maxY;
}

/**
 * 把几何翻译成规则层已经认识的那个形状。规则层一行不改，靠的就是这个出口。
 * 跨宫的房间会在 不确定项 里被点名，不静默归一个宫就完事。
 */
export function toFloorInput(geom: FloorGeometry, 朝向: string, 已确认: boolean) {
  const cells = palaceCells(geom);
  const 归属 = new Map<string, PalaceAssignment>();
  const 房间 = (cells ? geom.房间 : []).map(r => {
    const a = assignPalace(r.外环, cells!)!;
    归属.set(r.id, a);
    return { id: r.id, 名称: r.名称, 用途: r.用途, 宫位: a.宫 };
  });
  const 入户门 = geom.开口.filter(o => o.类型 === '门' && o.已确认 && cells)
    .map(o => openingPalace(o, geom, cells!)).filter(Boolean) as Palace[];
  const 主窗 = geom.开口.filter(o => o.类型 === '窗' && o.已确认 && cells)
    .map(o => openingPalace(o, geom, cells!)).filter(Boolean) as Palace[];
  const 跨宫 = [...归属.values()].filter(a => a.跨宫).map(a => a.宫);
  return {
    输入: { 朝向: 朝向 as never, 入户门: [...new Set(入户门)], 主窗: [...new Set(主窗)], 房间, 已确认 },
    归属,
    跨宫,
  };
}

// ── 可行走网格：粒子只能在格子内移动，所以"撞墙不穿墙"是结构保证，不是补救出来的 ──

export interface WalkGrid {
  步长: number;
  列: number;
  行: number;
  minX: number;
  minY: number;
  /** true = 可走。 */
  通: boolean[];
  /** 每格属于哪间房（-1 = 墙或房外）。 */
  房: number[];
}

function segDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function pointInRing(p: Pt, ring: Pt[]) {
  let inSide = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inSide = !inSide;
  }
  return inSide;
}

/** 开口在这一段墙上实际覆盖的参数区间。宽度按米换算成段上的比例，短墙也不会算歪。 */
function openingInterval(op: Opening, a: Pt, b: Pt): [number, number] {
  const half = (op.宽 / 2) / Math.hypot(b.x - a.x, b.y - a.y);
  return [op.位 - half, op.位 + half];
}

/** 这一格中心是否落在某个房间内部（且不在墙带上）。 */
export function buildWalkGrid(geom: FloorGeometry, 步长 = 0.25): WalkGrid | null {
  const cells = palaceCells(geom);
  if (!cells) return null;
  const c0 = cells[0];
  const minX = c0.minX, minY = c0.minY;
  const maxX = Math.max(...cells.map(c => c.maxX)), maxY = Math.max(...cells.map(c => c.maxY));
  const 列 = Math.max(1, Math.ceil((maxX - minX) / 步长));
  const 行 = Math.max(1, Math.ceil((maxY - minY) / 步长));
  const 通 = new Array<boolean>(列 * 行).fill(false);
  const 房 = new Array<number>(列 * 行).fill(-1);
  const 半厚 = WALL_THICKNESS / 2;

  for (let gy = 0; gy < 行; gy++) {
    for (let gx = 0; gx < 列; gx++) {
      const p = { x: minX + (gx + 0.5) * 步长, y: minY + (gy + 0.5) * 步长 };
      const roomIdx = geom.房间.findIndex(r => pointInRing(p, r.外环));
      if (roomIdx < 0) continue;
      const onWall = geom.墙体.some(w => wallDistance(p, w) <= 半厚);
      if (!onWall) { 通[gy * 列 + gx] = true; 房[gy * 列 + gx] = roomIdx; }
    }
  }
  return { 步长, 列, 行, minX, minY, 通, 房 };
}

function wallDistance(p: Pt, w: Wall) {
  let best = Infinity;
  const n = w.闭合 ? w.折线.length : w.折线.length - 1;
  for (let i = 0; i < n; i++) best = Math.min(best, segDistance(p, w.折线[i], w.折线[(i + 1) % w.折线.length]));
  return best;
}

/**
 * 相邻两格之间走不走得通 —— 判据在**边上**，不在格子中心。
 * 这件事必须说清楚，因为它是一个真实踩过的坑：墙厚 0.12m、格子 0.25m，
 * 用"格子中心是否落在墙带上"当阻挡的话，没有任何一个中心会正好落进那条 0.12m 的带子里，
 * 于是墙在网格上根本不存在，两间房直接连通，整套通路与气流结论全反。
 */
export function passable(g: WalkGrid, geom: FloorGeometry, i: number, j: number, memo = new Map<number, boolean>()): boolean {
  if (!g.通[i] || !g.通[j]) return false;
  if (g.房[i] >= 0 && g.房[i] === g.房[j]) return true;          // 同一间房里不必过墙
  const key = i < j ? i * g.列 * g.行 + j : j * g.列 * g.行 + i;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const a = cellCenter(g, i % g.列, Math.floor(i / g.列));
  const b = cellCenter(g, j % g.列, Math.floor(j / g.列));
  const r = !crossesWall(a, b, geom);
  memo.set(key, r);
  return r;
}

/** 线段 a→b 是否穿过某道墙。判据是"跨过墙的中线"，并从交点处判断它是否正好落在开口宽度内。 */
function crossesWall(a: Pt, b: Pt, geom: FloorGeometry): boolean {
  for (const w of geom.墙体) {
    const n = w.闭合 ? w.折线.length : w.折线.length - 1;
    for (let i = 0; i < n; i++) {
      const t = intersectT(a, b, w.折线[i], w.折线[(i + 1) % w.折线.length]);
      if (t === null) continue;
      const through = geom.开口.some(op => {
        if (op.墙 !== w.id || op.段 !== i || !op.已确认) return false;
        const [lo, hi] = openingInterval(op, w.折线[i], w.折线[(i + 1) % w.折线.length]);
        return t >= lo && t <= hi;
      });
      if (!through) return true;
    }
  }
  return false;
}

/** 两线段是否相交；相交时返回交点在墙段 p→q 上的参数（0–1），用于对开口宽度。 */
function intersectT(a: Pt, b: Pt, p: Pt, q: Pt): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: q.x - p.x, y: q.y - p.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p.x - a.x) * s.y - (p.y - a.y) * s.x) / den;
  const u = ((p.x - a.x) * r.y - (p.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : null;
}

export function cellCenter(g: WalkGrid, gx: number, gy: number): Pt {
  return { x: g.minX + (gx + 0.5) * g.步长, y: g.minY + (gy + 0.5) * g.步长 };
}

/** 从一组起点出发的 BFS 可达集（四邻，且逐条边问 passable）。粒子只在这集合里走，所以不可能穿墙。 */
export function reachableFrom(g: WalkGrid, geom: FloorGeometry, starts: number[]): Set<number> {
  const seen = new Set<number>();
  const q: number[] = [];
  const memo = new Map<number, boolean>();
  const N = g.列 * g.行;
  for (const i of starts) {
    if (i == null || i < 0 || i >= N || !g.通[i] || seen.has(i)) continue;
    seen.add(i); q.push(i);
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % g.列, y = (i - x) / g.列;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.列 || ny >= g.行) continue;
      const j = ny * g.列 + nx;
      if (seen.has(j) || !passable(g, geom, i, j, memo)) continue;
      seen.add(j); q.push(j);
    }
  }
  return seen;
}

/** 离某格最近的可行走格（开口中心常常压在墙带上，需要先落到路上）。 */
export function nearestWalkable(g: WalkGrid, p: Pt): number | null {
  const gx = Math.floor((p.x - g.minX) / g.步长), gy = Math.floor((p.y - g.minY) / g.步长);
  for (let r = 0; r < Math.max(g.列, g.行); r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= g.列 || y >= g.行) continue;
        if (g.通[y * g.列 + x]) return y * g.列 + x;
      }
  return null;
}
