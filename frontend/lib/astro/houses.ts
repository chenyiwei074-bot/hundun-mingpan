// 本命宫头的前端计算层：整宫、等宫、三分宫、Placidus、Koch、Regiomontanus 与 Campanus。
// 不调用网络、不依赖后端，也不改变行星位置或东方排盘算法。
// 球面计算以本项目现有上升点/天顶和 astronomy-engine 的时刻、黄赤交角为输入；
// 等宫、三分、Placidus 与 Koch 的 20 组逐宫对拍见
// tools/astro-acceptance/fixtures/house-systems-v1.json；新增两制尚待独立对拍夹具。

import { MakeTime, SiderealTime, e_tilt } from 'astronomy-engine';
import type { AnglesResult } from './angles';
import { SIGNS } from './planets';
import { normAngle } from './angles';

export const HOUSE_BASIS = 'astro-houses-v1' as const;
export const HOUSE_CROSS_CHECK = {
  toleranceDeg: 0.05,
  cases: 20,
  fixtureSystems: 4,
  verifiedSystems: 4,
  implementedSystems: 7,
  implementedNonWholeSystems: 6,
  pendingReferenceSystems: ['regiomontanus', 'campanus'] as const,
  references: ['Swiss Ephemeris', 'Celestine'] as const,
} as const;

export const HOUSE_SYSTEMS = [
  { id: 'whole-sign', label: '整宫制' },
  { id: 'equal', label: '等宫制 · Equal' },
  { id: 'porphyry', label: '三分宫制 · Porphyry' },
  { id: 'placidus', label: '普拉西德制 · Placidus' },
  { id: 'koch', label: '科赫制 · Koch' },
  { id: 'regiomontanus', label: '雷吉奥蒙塔努斯制 · Regiomontanus' },
  { id: 'campanus', label: '坎帕纳斯制 · Campanus' },
] as const;

export type HouseSystem = (typeof HOUSE_SYSTEMS)[number]['id'];
export type HouseCusp = { house: number; lon: number; signIndex: number; 星座: string; signDeg: number; signMin: number };
export type HouseCalculation = { ok: true; basis: typeof HOUSE_BASIS; system: HouseSystem; cusps: HouseCusp[] };
export type HouseFailure = { ok: false; reason: '极区不适用' | '宫制计算失败'; detail: string };

const EPS = 1 / 360000;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const sind = (d: number) => Math.sin(d * RAD);
const cosd = (d: number) => Math.cos(d * RAD);
const tand = (d: number) => Math.tan(d * RAD);
const asind = (x: number) => Math.asin(Math.max(-1, Math.min(1, x))) * DEG;
const atand = (x: number) => Math.atan(x) * DEG;
const signedDiff = (a: number, b: number) => {
  let diff = a - b;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

function cuspRows(longitudes: number[]): HouseCusp[] {
  return longitudes.map((raw, index) => {
    const lon = normAngle(raw);
    const signIndex = Math.min(11, Math.floor(lon / 30));
    const signDegree = lon - signIndex * 30;
    const degree = Math.floor(signDegree);
    return {
      house: index + 1,
      lon,
      signIndex,
      星座: SIGNS[signIndex],
      signDeg: Math.min(29, degree),
      signMin: Math.min(59, Math.floor((signDegree - degree) * 60)),
    };
  });
}

function equalCusps(ascendant: number): number[] {
  return Array.from({ length: 12 }, (_, index) => normAngle(ascendant + 30 * index));
}

function porphyryCusps(ascendant: number, midheaven: number): number[] {
  const asc = normAngle(ascendant);
  const mc = normAngle(midheaven);
  const dsc = normAngle(asc + 180);
  const ic = normAngle(mc + 180);
  const forward = (from: number, to: number) => normAngle(to - from);
  const third = (from: number, to: number, part: number) => normAngle(from + forward(from, to) * part / 3);
  return [asc, third(asc, ic, 1), third(asc, ic, 2), ic,
    third(ic, dsc, 1), third(ic, dsc, 2), dsc,
    third(dsc, mc, 1), third(dsc, mc, 2), mc,
    third(mc, asc, 1), third(mc, asc, 2)];
}

// 球面上求黄道与给定大圆的交点；象限处理单独展开，避免 atan 丢失方向信息。
function eclipticCrossing(rightAscension: number, poleHeight: number, sinE: number, cosE: number): number {
  const quadrantAngle = normAngle(rightAscension);
  const quadrant = Math.floor(quadrantAngle / 90) + 1;
  const crossing90 = (x: number, pole: number) => {
    let denominator = -tand(pole) * sinE + cosE * cosd(x);
    if (Math.abs(denominator) < EPS) denominator = 0;
    let numerator = sind(x);
    if (Math.abs(numerator) < EPS) numerator = 0;
    if (numerator === 0) denominator = denominator < 0 ? -EPS : EPS;
    else if (denominator === 0) denominator = numerator < 0 ? -90 : 90;
    else denominator = atand(numerator / denominator);
    return denominator < 0 ? denominator + 180 : denominator;
  };

  let longitude: number;
  if (Math.abs(90 - poleHeight) < EPS) return 180;
  if (Math.abs(90 + poleHeight) < EPS) return 0;
  switch (quadrant) {
    case 1: longitude = crossing90(quadrantAngle, poleHeight,); break;
    case 2: longitude = 180 - crossing90(180 - quadrantAngle, -poleHeight,); break;
    case 3: longitude = 180 + crossing90(quadrantAngle - 180, -poleHeight,); break;
    default: longitude = 360 - crossing90(360 - quadrantAngle, poleHeight,); break;
  }
  longitude = normAngle(longitude);
  for (const cardinal of [90, 180, 270, 360]) if (Math.abs(longitude - cardinal) < EPS) return cardinal === 360 ? 0 : cardinal;
  return longitude;
}

function placidusCusps(asc: number, mc: number, armc: number, latitude: number, obliquity: number): number[] | null {
  const sinE = sind(obliquity);
  const cosE = cosd(obliquity);
  const tanE = tand(obliquity);
  const tanLat = tand(latitude);
  const semiArc = asind(tanLat * tanE);
  const poleOneThird = atand(sind(semiArc / 3) / tanE);
  const poleTwoThirds = atand(sind(semiArc * 2 / 3) / tanE);
  const cusps = new Array<number>(12);
  cusps[0] = asc;
  cusps[9] = mc;

  const entries = [
    { house: 10, rightAscension: 30, pole: poleOneThird, divisor: 3 },
    { house: 11, rightAscension: 60, pole: poleTwoThirds, divisor: 1.5 },
    { house: 1, rightAscension: 120, pole: poleTwoThirds, divisor: 1.5 },
    { house: 2, rightAscension: 150, pole: poleOneThird, divisor: 3 },
  ];
  for (const entry of entries) {
    const ra = normAngle(armc + entry.rightAscension);
    const index = entry.house;
    let tangentArc = tand(asind(sinE * sind(eclipticCrossing(ra, entry.pole, sinE, cosE))));
    if (Math.abs(tangentArc) < EPS) {
      cusps[index] = ra;
      continue;
    }
    const poleFor = (tangent: number) => atand(sind(asind(tanLat * tangent) / entry.divisor) / tangent);
    let cusp = eclipticCrossing(ra, poleFor(tangentArc), sinE, cosE);
    let previous = 0;
    let converged = false;
    for (let iteration = 1; iteration <= 100; iteration++) {
      tangentArc = tand(asind(sinE * sind(cusp)));
      if (Math.abs(tangentArc) < EPS) { cusp = ra; converged = true; break; }
      cusp = eclipticCrossing(ra, poleFor(tangentArc), sinE, cosE);
      if (iteration > 1 && Math.abs(signedDiff(cusp, previous)) < EPS) { converged = true; break; }
      previous = cusp;
    }
    if (!converged) return null;
    cusps[index] = cusp;
  }

  return [asc, cusps[1], cusps[2], normAngle(mc + 180), normAngle(cusps[10] + 180),
    normAngle(cusps[11] + 180), normAngle(asc + 180), normAngle(cusps[1] + 180),
    normAngle(cusps[2] + 180), mc, cusps[10], cusps[11]];
}

function kochCusps(asc: number, mc: number, armc: number, latitude: number, obliquity: number): number[] {
  const sinE = sind(obliquity);
  const cosE = cosd(obliquity);
  const sinA = Math.max(-1, Math.min(1, sind(mc) * sinE / cosd(latitude)));
  const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
  const c = atand(tand(latitude) / cosA);
  const adjustThird = asind(sind(c) * sinA) / 3;
  const cusp11 = eclipticCrossing(armc + 30 - 2 * adjustThird, latitude, sinE, cosE);
  const cusp12 = eclipticCrossing(armc + 60 - adjustThird, latitude, sinE, cosE);
  const cusp2 = eclipticCrossing(armc + 120 + adjustThird, latitude, sinE, cosE);
  const cusp3 = eclipticCrossing(armc + 150 + 2 * adjustThird, latitude, sinE, cosE);
  return [asc, cusp2, cusp3, normAngle(mc + 180), normAngle(cusp11 + 180), normAngle(cusp12 + 180),
    normAngle(asc + 180), normAngle(cusp2 + 180), normAngle(cusp3 + 180), mc, cusp11, cusp12];
}

function regiomontanusCusps(asc: number, mc: number, armc: number, latitude: number, sinE: number, cosE: number): number[] {
  const pole30 = atand(tand(latitude) * 0.5);
  const pole60 = atand(tand(latitude) * cosd(30));
  const cusp11 = eclipticCrossing(armc + 30, pole30, sinE, cosE);
  const cusp12 = eclipticCrossing(armc + 60, pole60, sinE, cosE);
  const cusp2 = eclipticCrossing(armc + 120, pole60, sinE, cosE);
  const cusp3 = eclipticCrossing(armc + 150, pole30, sinE, cosE);
  return [asc, cusp2, cusp3, normAngle(mc + 180), normAngle(cusp11 + 180), normAngle(cusp12 + 180),
    normAngle(asc + 180), normAngle(cusp2 + 180), normAngle(cusp3 + 180), mc, cusp11, cusp12];
}

function campanusCusps(asc: number, mc: number, armc: number, latitude: number, sinE: number, cosE: number): number[] {
  const pole30 = asind(sind(latitude) / 2);
  const pole60 = asind((Math.sqrt(3) / 2) * sind(latitude));
  const cosineLatitude = cosd(latitude);
  if (Math.abs(cosineLatitude) < EPS) throw new Error('坎帕纳斯制在当前纬度无法稳定计算。');
  const equatorOffset60 = atand(Math.sqrt(3) / cosineLatitude);
  const equatorOffset30 = atand(1 / (Math.sqrt(3) * cosineLatitude));
  const cusp11 = eclipticCrossing(armc + 90 - equatorOffset60, pole30, sinE, cosE);
  const cusp12 = eclipticCrossing(armc + 90 - equatorOffset30, pole60, sinE, cosE);
  const cusp2 = eclipticCrossing(armc + 90 + equatorOffset30, pole60, sinE, cosE);
  const cusp3 = eclipticCrossing(armc + 90 + equatorOffset60, pole30, sinE, cosE);
  return [asc, cusp2, cusp3, normAngle(mc + 180), normAngle(cusp11 + 180), normAngle(cusp12 + 180),
    normAngle(asc + 180), normAngle(cusp2 + 180), normAngle(cusp3 + 180), mc, cusp11, cusp12];
}

export function computeHouseCusps(angles: AnglesResult, system: HouseSystem): HouseCalculation | HouseFailure {
  if (system === 'whole-sign') return {
    ok: true, basis: HOUSE_BASIS, system,
    cusps: cuspRows(angles.wholeSignCusps.map(c => c.lon)),
  };
  if (system === 'equal') return { ok: true, basis: HOUSE_BASIS, system, cusps: cuspRows(equalCusps(angles.ascendant.lon)) };
  if (system === 'porphyry') return {
    ok: true, basis: HOUSE_BASIS, system,
    cusps: cuspRows(porphyryCusps(angles.ascendant.lon, angles.midheaven.lon)),
  };

  try {
    const instant = MakeTime(new Date(angles.utcMs));
    const obliquity = e_tilt(instant).tobl;
    const armc = normAngle((SiderealTime(instant) + angles.longitude / 15) * 15);
    if (Math.abs(angles.latitude) >= 90 - obliquity) {
      const systemName = HOUSE_SYSTEMS.find(item => item.id === system)?.label ?? system;
      return {
        ok: false, reason: '极区不适用',
        detail: `${systemName} 在纬度 ${angles.latitude.toFixed(2)}° 附近无法按本站定义稳定划分宫头；请改用整宫、等宫或三分宫制。`,
      };
    }
    const sinE = sind(obliquity);
    const cosE = cosd(obliquity);
    const cusps = system === 'placidus'
      ? placidusCusps(angles.ascendant.lon, angles.midheaven.lon, armc, angles.latitude, obliquity)
      : system === 'koch'
        ? kochCusps(angles.ascendant.lon, angles.midheaven.lon, armc, angles.latitude, obliquity)
        : system === 'regiomontanus'
          ? regiomontanusCusps(angles.ascendant.lon, angles.midheaven.lon, armc, angles.latitude, sinE, cosE)
          : campanusCusps(angles.ascendant.lon, angles.midheaven.lon, armc, angles.latitude, sinE, cosE);
    if (!cusps || cusps.length !== 12 || cusps.some(value => !Number.isFinite(value))) {
      return { ok: false, reason: '宫制计算失败', detail: '当前时刻无法稳定求出全部十二宫宫头，请切换其他宫制后重试。' };
    }
    return { ok: true, basis: HOUSE_BASIS, system, cusps: cuspRows(cusps) };
  } catch (error) {
    return {
      ok: false, reason: '宫制计算失败',
      detail: `宫头计算暂时失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
