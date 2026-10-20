// 几何 → SVG 的投影层。
//
// 两个消费者共用这一份：2D 确认编辑器用 plan（正交俯视，拖点要准），
// WebGL 不可用时的降级图用 iso（等轴测，看得出土体关系）。
// 让它们共用同一个 FloorGeometry 是刻意的 —— 降级图和 3D 长得不一样、
// 结论却来自同一套几何，是最容易骗过眼睛也骗过测试的那种错。

import type { FloorGeometry, Pt } from './geometry';
import { WALL_HEIGHT, boundingBox } from './geometry';

export interface Projected { x: number; y: number }
export interface Frame { ox: number; oy: number; scale: number }

const ISO_COS = Math.cos(Math.PI / 6);      // 30°
const ISO_SIN = Math.sin(Math.PI / 6);

/** 把图纸包围盒铺进 w×h 的画布，留 padding。plan 与 iso 共用同一个 scale 口径。 */
export function fitFrame(geom: FloorGeometry, w: number, h: number, pad = 24): Frame {
  const all = [...geom.房间.flatMap(r => r.外环), ...geom.墙体.flatMap(l => l.折线)];
  if (!all.length) return { ox: w / 2, oy: h / 2, scale: 1 };
  const b = boundingBox(all);
  const spanX = Math.max(1e-6, b.maxX - b.minX), spanY = Math.max(1e-6, b.maxY - b.minY);
  // iso 的横向跨度是 (spanX+spanY)、纵向是 (spanX+spanY)/2 + 墙高，按这个算才不会溢出画布
  const needX = spanX + spanY, needY = (spanX + spanY) * ISO_SIN + WALL_HEIGHT * ISO_COS;
  const scale = Math.min((w - pad * 2) / needX, (h - pad * 2) / needY);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return { ox: w / 2 - (cx - cy) * ISO_COS * scale, oy: h / 2 - (cx + cy) * ISO_SIN * scale + (WALL_HEIGHT * ISO_COS * scale) / 2, scale };
}

/** 俯视：图纸坐标原样映射，y 向下与页面同向。 */
export function planProject(p: Pt, f: Frame, b: { minX: number; minY: number }): Projected {
  return { x: (p.x - b.minX) * f.scale, y: (p.y - b.minY) * f.scale };
}

/** 等轴测：z 是离地高度（米），墙顶就是 z=WALL_HEIGHT。 */
export function isoProject(p: Pt, z: number, f: Frame): Projected {
  return {
    x: f.ox + (p.x - p.y) * ISO_COS * f.scale,
    y: f.oy + (p.x + p.y) * ISO_SIN * f.scale - z * ISO_COS * f.scale,
  };
}

export const pts = (list: Projected[]) => list.map(q => `${Math.round(q.x * 10) / 10},${Math.round(q.y * 10) / 10}`).join(' ');

export interface PlanRoom { id: string; points: string; 名称: string; cx: number; cy: number }
export interface PlanWall { id: string; points: string }

export function planSvg(geom: FloorGeometry, w: number, h: number) {
  const all = [...geom.房间.flatMap(r => r.外环), ...geom.墙体.flatMap(l => l.折线)];
  if (!all.length) return { 房间: [] as PlanRoom[], 墙: [] as PlanWall[], frame: fitFrame(geom, w, h), box: { minX: 0, minY: 0 } };
  const frame = fitFrame(geom, w, h);
  const box = boundingBox(all);
  const 房间 = geom.房间.map(r => {
    const p = r.外环.map(q => planProject(q, frame, box));
    const cx = p.reduce((s, q) => s + q.x, 0) / p.length, cy = p.reduce((s, q) => s + q.y, 0) / p.length;
    return { id: r.id, points: pts(p), 名称: r.名称, cx, cy };
  });
  const 墙 = geom.墙体.map(l => ({ id: l.id, points: pts(l.折线.map(q => planProject(q, frame, box))) }));
  return { 房间, 墙, frame, box };
}

export interface IsoFace { id: string; points: string; kind: 'wall' | 'room' | 'opening'; 高?: number }

/**
 * 等轴测降级图。开口不靠"在墙上挖洞"（SVG 多边形挖洞要 clipPath，浏览器差异大），
 * 而是把开口那一块用底色重新盖上去 —— 几何仍然是同一份 FloorGeometry 推出来的，
 * 盖的位置由 openingInterval 决定，所以它与 3D 里那个洞同源同位。
 */
export function isoSvg(geom: FloorGeometry, w: number, h: number) {
  const frame = fitFrame(geom, w, h);
  const faces: IsoFace[] = [];
  for (const r of geom.房间)
    faces.push({ id: `floor-${r.id}`, kind: 'room', points: pts(r.外环.map(p => isoProject(p, 0, frame))) });

  for (const wall of geom.墙体) {
    const n = wall.闭合 ? wall.折线.length : wall.折线.length - 1;
    for (let i = 0; i < n; i++) {
      const a = wall.折线[i], b = wall.折线[(i + 1) % wall.折线.length];
      faces.push({
        id: `${wall.id}-${i}`, kind: 'wall',
        points: pts([isoProject(a, 0, frame), isoProject(b, 0, frame), isoProject(b, WALL_HEIGHT, frame), isoProject(a, WALL_HEIGHT, frame)]),
      });
      for (const op of geom.开口) {
        if (op.墙 !== wall.id || op.段 !== i || !op.已确认) continue;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const half = len ? (op.宽 / 2) / len : 0;
        const lo = Math.max(0, op.位 - half), hi = Math.min(1, op.位 + half);
        const p0 = { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo };
        const p1 = { x: a.x + (b.x - a.x) * hi, y: a.y + (b.y - a.y) * hi };
        const z0 = op.类型 === '门' ? 0 : 0.9;
        const z1 = op.类型 === '门' ? 2.05 : 2.1;
        faces.push({
          id: `${op.id}`, kind: 'opening',
          points: pts([isoProject(p0, z0, frame), isoProject(p1, z0, frame), isoProject(p1, z1, frame), isoProject(p0, z1, frame)]),
        });
      }
    }
  }
  return { faces, frame };
}
