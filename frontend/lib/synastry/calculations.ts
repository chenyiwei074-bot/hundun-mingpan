import { SIGNS, type PlanetPlace } from '../astro/planets';
import { normAngle } from '../astro/angles';
import type { HouseCusp } from '../astro/houses';

export type HouseOverlay = {
  key: PlanetPlace['key'];
  name: string;
  sign: string;
  longitude: number;
  house: number | null;
};

export type CompositeMidpoint = {
  key: PlanetPlace['key'];
  name: string;
  longitude: number | null;
  sign: string | null;
  ambiguous: boolean;
};

/** 把行星黄经放入按黄经顺序排列的十二宫；宫头边界归入新宫。 */
export function mapPlanetsToHouses(planets: PlanetPlace[], cusps: HouseCusp[]): HouseOverlay[] {
  if (cusps.length !== 12) return planets.map(planet => ({
    key: planet.key, name: planet.名称, sign: planet.星座, longitude: planet.lon, house: null,
  }));

  return planets.map(planet => {
    let house: number | null = null;
    for (let index = 0; index < cusps.length; index += 1) {
      const start = normAngle(cusps[index].lon);
      const end = normAngle(cusps[(index + 1) % cusps.length].lon);
      const span = normAngle(end - start);
      const offset = normAngle(planet.lon - start);
      if (span > 0 && offset < span) {
        house = index + 1;
        break;
      }
    }
    return { key: planet.key, name: planet.名称, sign: planet.星座, longitude: planet.lon, house };
  });
}

/**
 * 逐颗行星取甲乙黄经的短弧中点。恰好相差 180° 时存在两个同样短的中点，
 * 因而明确返回 ambiguous，而不任意挑一个方向。
 */
export function calculateCompositeMidpoints(first: PlanetPlace[], second: PlanetPlace[]): CompositeMidpoint[] {
  const secondByKey = new Map(second.map(planet => [planet.key, planet]));
  const rows: CompositeMidpoint[] = [];
  for (const planet of first) {
    const counterpart = secondByKey.get(planet.key);
    if (!counterpart) continue;
    const forward = normAngle(counterpart.lon - planet.lon);
    if (Math.abs(forward - 180) < 1e-8) {
      rows.push({
      key: planet.key, name: planet.名称, longitude: null, sign: null, ambiguous: true,
      });
      continue;
    }
    const signedArc = forward > 180 ? forward - 360 : forward;
    const longitude = normAngle(planet.lon + signedArc / 2);
    rows.push({
      key: planet.key, name: planet.名称, longitude,
      sign: SIGNS[Math.floor(longitude / 30)], ambiguous: false,
    });
  }
  return rows;
}
