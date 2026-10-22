// 图上的标号：房间名、九宫宫名、门窗编号。
//
// 为什么单独一个文件：这些串要同时被三处用 —— 俯视图上画、门窗那一排写、
// 规则层的「依据」引用。任何一处自己拼一遍，就会出现"依据说的是 D3、图上标的是 W3"
// 这种对不上的号，而它对得上的那一刻没人会去看。
//
// 编号按 开口 数组的顺序、门与窗各自计数（D1、D2… / W1、W2…）：
// 不用 o.id（那是 w-1 / o-3 这种内部 id，人读不出顺序），也不用墙号（一道墙上可以有两个洞）。

import type { FloorGeometry, Opening } from './geometry';
import { PALACE_GRID } from './types';
import type { Palace } from './types';

/** 每个开口的图上标号（id → D1/W2…）。门与窗各自从 1 开始数。 */
export function openingTags(geom: FloorGeometry): Record<string, string> {
  const n = { 门: 0, 窗: 0 };
  const out: Record<string, string> = {};
  for (const o of geom.开口) {
    n[o.类型] += 1;
    out[o.id] = `${o.类型 === '门' ? 'D' : 'W'}${n[o.类型]}`;
  }
  return out;
}

/** 一个开口在哪一宫（与规则层同一个归属算法的结果一起显示在依据里）。 */
export const tagOf = (tags: Record<string, string>, o: Opening) => tags[o.id] ?? '未编号';

/** 九宫的宫名集合（与 palaceCells 同一张 3×3 表，不另列一份顺序）。 */
export const PALACE_NAMES: Palace[] = PALACE_GRID.flat();

/** 图上会被画出来的全部标号：房间名 + 宫名 + 门窗号。断言拿它当词表。 */
export function labelVocabulary(geom: FloorGeometry, tags: Record<string, string>): string[] {
  return [...geom.房间.map(r => r.名称), ...PALACE_NAMES, ...Object.values(tags)];
}

/** 角点手柄在 SVG 像素空间里的占位（手柄是最后画的、压在标签上面，所以标签要自己让开）。 */
export interface HandleBox { x: number; y: number; r: number }

/** 找一个不压手柄的标签位置：以原点后 8 个方向逐步外推，取第一个空位。
 *  为什么必须让：短墙上的门正好落在墙端点旁边（实测 375 那一档 D2 与手柄重叠 13×13px），
 *  而"标号被手柄盖住"等于依据指回一个看不见的号 —— harness 的 LABELS 探针按矩形相交判，0 容忍。
 *  纯函数、给定同一组输入必得同一个点，所以套件能在没有浏览器的情况下钉它。 */
export function placeTag(
  p: { x: number; y: number }, handles: HandleBox[], box = { w: 20, h: 12 }, steps = [0, 12, 20, 30],
): { x: number; y: number } {
  const dirs = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]];
  const hits = (q: { x: number; y: number }) => handles.some(h => {
    const nx = Math.max(q.x - box.w / 2, Math.min(h.x, q.x + box.w / 2));
    const ny = Math.max(q.y - box.h / 2, Math.min(h.y, q.y + box.h / 2));
    return (nx - h.x) ** 2 + (ny - h.y) ** 2 < h.r * h.r;
  });
  for (const d of steps) for (const [ux, uy] of dirs) {
    const q = { x: p.x + ux * d, y: p.y + uy * d };
    if (!hits(q)) return q;
  }
  return p;                       // 让无可让：留在原点，由探针判红，不假装成功
}
