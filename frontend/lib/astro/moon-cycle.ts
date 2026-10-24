import { Body, Illumination, MoonPhase, SearchMoonPhase } from 'astronomy-engine';

export const MOON_CYCLE_BASIS = 'astro-moon-cycle-v1' as const;

const PHASE_NAMES = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'] as const;
const PHASE_SYMBOLS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const;

export interface MoonCycle {
  basis: typeof MOON_CYCLE_BASIS;
  utcMs: number;
  phaseAngle: number;
  illumination: number;
  phaseName: string;
  phaseSymbol: string;
  nextNewMoonUtcMs: number;
  nextFullMoonUtcMs: number;
}

/** 月相角来自日月地心黄经差，照亮比例来自天体光照几何。两者不是同一个数。 */
export function computeMoonCycle(utcMs: number): MoonCycle | null {
  if (!Number.isFinite(utcMs) || Number.isNaN(new Date(utcMs).getTime())) return null;
  try {
    const date = new Date(utcMs);
    const phaseAngle = MoonPhase(date);
    const illumination = Illumination(Body.Moon, date).phase_fraction;
    const nextNewMoon = SearchMoonPhase(0, date, 40);
    const nextFullMoon = SearchMoonPhase(180, date, 40);
    if (!nextNewMoon || !nextFullMoon || !Number.isFinite(phaseAngle) || !Number.isFinite(illumination)) return null;
    const phaseIndex = Math.floor(((phaseAngle + 22.5) % 360) / 45);
    return {
      basis: MOON_CYCLE_BASIS, utcMs, phaseAngle, illumination,
      phaseName: PHASE_NAMES[phaseIndex], phaseSymbol: PHASE_SYMBOLS[phaseIndex],
      nextNewMoonUtcMs: nextNewMoon.date.getTime(),
      nextFullMoonUtcMs: nextFullMoon.date.getTime(),
    };
  } catch {
    return null;
  }
}
