// 户型几何的编辑操作（纯函数）。
//
// 为什么单独成文件、不写在组件里：这三条判据必须在 node 里跑得动 ——
// 与 upload.ts / recognize.ts 同一个理由（组件里的 TypeScript 抠不出来 eval）。
// 更重要的是"删一道墙会不会留下挂在它上面的门窗"这种不变式，
// 只有把删除写成一个能单独跑的函数，才有地方钉它。
//
// 三条口径：
//  1. 手工画的开口 置信度=null（这个类型里 null 就是"手工标注"）且 已确认=true ——
//     用户自己画的没有"模型的猜测"要确认；识别回来的仍然是 false，由人工逐条放行。
//  2. 任何 mutator 都不许留下指向不存在的墙/段的开口。删墙就把它名下的开口一起带走，
//     并把带走了几条报回去，让 UI 能说"顺手删了 2 个门窗"而不是让人自己发现。
//  3. 宽度按类型夹在真实尺度里：切换门↔窗时必须重新夹，
//     否则一道 4m 的"门"会既画得出来又算得进去。

import type { FloorGeometry, Opening, Pt, Wall } from './geometry';
import type { RoomKind } from './types';

/** 开口宽度的真实尺度（米）。上限不是画布上限，是"这个洞还像不像门/窗"。 */
export const OPENING_LIMITS: Record<Opening['类型'], { min: number; max: number; step: number; 默认: number }> = {
  门: { min: 0.5, max: 2.4, step: 0.1, 默认: 0.9 },
  窗: { min: 0.4, max: 4.0, step: 0.2, 默认: 1.4 },
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const bboxOf = (g: FloorGeometry) => {
  const pts = g.房间.flatMap(r => r.外环).concat(g.墙体.flatMap(w => w.折线));
  if (!pts.length) return { minX: 0, minY: 0, maxX: 9, maxY: 6 };
  return {
    minX: Math.min(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)),
    maxX: Math.max(...pts.map(p => p.x)), maxY: Math.max(...pts.map(p => p.y)),
  };
};

// ───────────────────────────────────────────────────────────── 房间

export function setRoomKind(g: FloorGeometry, id: string, 用途: RoomKind): FloorGeometry {
  return { ...g, 房间: g.房间.map(r => (r.id === id ? { ...r, 用途 } : r)) };
}

export function setRoomName(g: FloorGeometry, id: string, 名称: string): FloorGeometry {
  return { ...g, 房间: g.房间.map(r => (r.id === id ? { ...r, 名称 } : r)) };
}

export function moveRoomVertex(g: FloorGeometry, id: string, idx: number, p: Pt): FloorGeometry {
  return {
    ...g,
    房间: g.房间.map(r => (r.id === id ? { ...r, 外环: r.外环.map((q, i) => (i === idx ? p : q)) } : r)),
  };
}

// ───────────────────────────────────────────────────────────── 墙体

/** 加一道贯通包围盒的隔墙，落在水平中点：这是"手工画"最短的下一步，
 *  而不是在原点上再放一条 3m 的线段让用户自己拖半天。 */
export function addWall(g: FloorGeometry, id: string): FloorGeometry {
  const b = bboxOf(g);
  const x = r2((b.minX + b.maxX) / 2);
  const w: Wall = { id, 折线: [{ x, y: r2(b.minY) }, { x, y: r2(b.maxY) }], 闭合: false };
  return { ...g, 墙体: [...g.墙体, w] };
}

/** 删墙并把挂在其上的开口一起带走。返回带走了几条，UI 要把它说出来。 */
export function deleteWall(g: FloorGeometry, id: string): { 几何: FloorGeometry; 连带删掉开口数: number } {
  const 连带 = g.开口.filter(o => o.墙 === id).length;
  return {
    几何: { 墙体: g.墙体.filter(w => w.id !== id), 房间: g.房间, 开口: g.开口.filter(o => o.墙 !== id) },
    连带删掉开口数: 连带,
  };
}

export function moveWallVertex(g: FloorGeometry, id: string, idx: number, p: Pt): FloorGeometry {
  return {
    ...g,
    墙体: g.墙体.map(w => (w.id === id ? { ...w, 折线: w.折线.map((q, i) => (i === idx ? p : q)) } : w)),
  };
}

/** 段数会随折线变化（删点、拖点），所以开口上的 (墙, 段) 有可能失效。
 *  这条不是防御性检查：它是"mutator 不许留下悬空引用"那个不变式的可执行形式。 */
export function danglingOpenings(g: FloorGeometry): Opening[] {
  return g.开口.filter(o => {
    const w = g.墙体.find(x => x.id === o.墙);
    if (!w) return true;
    const 段数 = w.闭合 ? w.折线.length : w.折线.length - 1;
    return o.段 < 0 || o.段 >= 段数;
  });
}

// ───────────────────────────────────────────────────────────── 门窗

/** 挂到指定墙上：默认取该墙最长的那一段的中点 —— 最短段往往是门垛，
 *  把默认落点放在那儿会让人一上来就把它拖走。 */
export function addOpening(g: FloorGeometry, id: string, wallId: string, 类型: Opening['类型']): FloorGeometry {
  const w = g.墙体.find(x => x.id === wallId);
  if (!w || w.折线.length < 2) return g;
  let best = 0, bestLen = -1;
  const 段数 = w.闭合 ? w.折线.length : w.折线.length - 1;
  for (let i = 0; i < 段数; i++) {
    const a = w.折线[i], b = w.折线[(i + 1) % w.折线.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) { bestLen = len; best = i; }
  }
  const o: Opening = {
    id, 类型, 墙: wallId, 段: best, 位: 0.5, 宽: OPENING_LIMITS[类型].默认,
    置信度: null, 已确认: true,
  };
  return { ...g, 开口: [...g.开口, o] };
}

export function deleteOpening(g: FloorGeometry, id: string): FloorGeometry {
  return { ...g, 开口: g.开口.filter(o => o.id !== id) };
}

export function setOpeningConfirmed(g: FloorGeometry, id: string, 值: boolean): FloorGeometry {
  return { ...g, 开口: g.开口.map(o => (o.id === id ? { ...o, 已确认: 值 } : o)) };
}

/** 门↔窗切换后必须按新类型重新夹宽度。 */
export function toggleOpeningKind(g: FloorGeometry, id: string): FloorGeometry {
  return {
    ...g,
    开口: g.开口.map(o => {
      if (o.id !== id) return o;
      const 类型: Opening['类型'] = o.类型 === '门' ? '窗' : '门';
      const lim = OPENING_LIMITS[类型];
      return { ...o, 类型, 宽: r2(clamp(o.宽, lim.min, lim.max)) };
    }),
  };
}

/** 宽度按类型的步长调，并夹在真实尺度内。 */
export function resizeOpening(g: FloorGeometry, id: string, 方向: 1 | -1): FloorGeometry {
  return {
    ...g,
    开口: g.开口.map(o => {
      if (o.id !== id) return o;
      const lim = OPENING_LIMITS[o.类型];
      return { ...o, 宽: r2(clamp(o.宽 + 方向 * lim.step, lim.min, lim.max)) };
    }),
  };
}

/** 沿墙挪一段。位始终留在 [0,1]：渲染层按 位±宽/2 取端点，出界会画到墙外去。 */
export function shiftOpening(g: FloorGeometry, id: string, 方向: 1 | -1): FloorGeometry {
  return {
    ...g,
    开口: g.开口.map(o => (o.id === id ? { ...o, 位: r2(clamp(o.位 + 方向 * 0.05, 0, 1)) } : o)),
  };
}
