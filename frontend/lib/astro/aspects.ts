import type { PlanetPlace } from './planets';

export const ASPECT_BASIS = 'astro-aspects-v1' as const;

export const MAJOR_ASPECTS = [
  { name: '合相', glyph: '☌', angle: 0 },
  { name: '六分相', glyph: '⚹', angle: 60 },
  { name: '四分相', glyph: '□', angle: 90 },
  { name: '三分相', glyph: '△', angle: 120 },
  { name: '对分相', glyph: '☍', angle: 180 },
] as const;

export interface PlanetAspect {
  first: PlanetPlace;
  second: PlanetPlace;
  name: string;
  glyph: string;
  exactAngle: number;
  separation: number;
  orb: number;
  allowedOrb: number;
}

/**
 * 两颗行星在回归黄道上的最小角距。容许度是本站公开的现代实现选择：
 * 合相/对分相或涉及日月时 ±8°，其余 ±6°。不推断吉凶或关系成败。
 */
export function computeAspects(first: readonly PlanetPlace[], second?: readonly PlanetPlace[]): PlanetAspect[] {
  const crossChart = second !== undefined;
  const other = second ?? first;
  const found: PlanetAspect[] = [];
  for (let i = 0; i < first.length; i += 1) {
    for (let j = crossChart ? 0 : i + 1; j < other.length; j += 1) {
      const a = first[i];
      const b = other[j];
      if (!Number.isFinite(a.lon) || !Number.isFinite(b.lon)) continue;
      const difference = Math.abs(a.lon - b.lon) % 360;
      const separation = Math.min(difference, 360 - difference);
      const luminary = a.key === 'sun' || a.key === 'moon' || b.key === 'sun' || b.key === 'moon';
      for (const aspect of MAJOR_ASPECTS) {
        const allowedOrb = aspect.angle === 0 || aspect.angle === 180 || luminary ? 8 : 6;
        const orb = Math.abs(separation - aspect.angle);
        if (orb <= allowedOrb) {
          found.push({ first: a, second: b, name: aspect.name, glyph: aspect.glyph,
            exactAngle: aspect.angle, separation, orb, allowedOrb });
          break;
        }
      }
    }
  }
  return found.sort((a, b) => a.orb - b.orb || a.separation - b.separation
    || a.first.名称.localeCompare(b.first.名称, 'zh-CN')
    || a.second.名称.localeCompare(b.second.名称, 'zh-CN'));
}
