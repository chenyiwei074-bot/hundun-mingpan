// 上升点 / 整宫制：只把「出生瞬间 + 经纬度」换成黄道角度。
// 计算在本地完成；不发请求、不落库。
//
// 引擎：astronomy-engine（MIT）给恒星时与真黄赤交角；上升/MC 用标准球面公式。
// 与 Celestine（MIT，Swiss Ephemeris 验证）和 natal-chart-math（MIT）各做过
// 20 组对拍，见 tools/astro-acceptance/fixtures/ascendant-whole-sign-v1.json。
// 口径戳 astro-angles-v1：改公式、改历元或改宫制都必须升戳。

import { MakeTime, SiderealTime, e_tilt } from 'astronomy-engine';
import { SIGNS } from './planets';

export const ANGLE_BASIS = 'astro-angles-v1' as const;
export const ANGLE_TOLERANCE_DEG = 0.05;
export const ANGLE_CROSS_CHECK = {
  authority: 'Celestine（Swiss Ephemeris 验证）+ natal-chart-math',
  from: 1965, to: 2010, toleranceDeg: ANGLE_TOLERANCE_DEG, cases: 20,
} as const;

export interface AnglePlace { kind: 'asc' | 'mc'; lon: number; signIndex: number; 星座: string; signDeg: number; signMin: number }
export interface WholeSignCusp { house: number; lon: number; signIndex: number; 星座: string }
export interface AnglesResult {
  ok: true; basis: typeof ANGLE_BASIS; utcMs: number; latitude: number; longitude: number;
  ascendant: AnglePlace; midheaven: AnglePlace; wholeSignCusps: WholeSignCusp[];
}
export interface AnglesFailed { ok: false; reason: '时刻无效' | '经纬度无效' | '极点无上升点' | '引擎不可用'; detail: string }

const norm360 = (d: number) => ((d % 360) + 360) % 360;
const rad = (d: number) => d * Math.PI / 180;
const deg = (r: number) => r * 180 / Math.PI;

function place(kind: 'asc' | 'mc', lon: number): AnglePlace {
  const l = norm360(lon);
  const signIndex = Math.min(11, Math.floor(l / 30));
  const within = l - signIndex * 30;
  return {
    kind, lon: l, signIndex, 星座: SIGNS[signIndex],
    signDeg: Math.min(29, Math.floor(within)),
    signMin: Math.min(59, Math.floor((within - Math.floor(within)) * 60)),
  };
}

/**
 * utcMs 是绝对时刻；lat/lon 是出生地（东经/北纬为正）。
 * 整宫制：第 1 宫从上升点所在星座的 0° 起，每宫 +30°。
 */
export function computeAngles(utcMs: number, lat: number, lon: number): AnglesResult | AnglesFailed {
  if (!Number.isFinite(utcMs)) return { ok: false, reason: '时刻无效', detail: '没拿到可计算的世界时时刻' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, reason: '经纬度无效', detail: '出生地经纬度不完整或超出范围' };
  }
  if (Math.abs(lat) >= 90) {
    return { ok: false, reason: '极点无上升点', detail: '纬度正好在 ±90° 时，黄道所有度数同时升起，上升点无定义' };
  }
  try {
    const t = MakeTime(new Date(utcMs));
    const eps = e_tilt(t).tobl;
    const lstDeg = norm360(((SiderealTime(t) + lon / 15) % 24) * 15);
    const y = Math.cos(rad(lstDeg));
    const x = -(Math.sin(rad(lstDeg)) * Math.cos(rad(eps)) + Math.tan(rad(lat)) * Math.sin(rad(eps)));
    const ascLon = norm360(deg(Math.atan2(y, x)));
    const mcLon = norm360(deg(Math.atan2(Math.sin(rad(lstDeg)), Math.cos(rad(lstDeg)) * Math.cos(rad(eps)))));
    const start = Math.floor(ascLon / 30) * 30;
    return {
      ok: true, basis: ANGLE_BASIS, utcMs, latitude: lat, longitude: lon,
      ascendant: place('asc', ascLon),
      midheaven: place('mc', mcLon),
      wholeSignCusps: Array.from({ length: 12 }, (_, i) => {
        const l = norm360(start + i * 30);
        const signIndex = Math.min(11, Math.floor(l / 30));
        return { house: i + 1, lon: l, signIndex, 星座: SIGNS[signIndex] };
      }),
    };
  } catch (err) {
    return { ok: false, reason: '引擎不可用', detail: `角度计算没跑通：${err instanceof Error ? err.message : String(err)}` };
  }
}

export const angleText = (p: AnglePlace) => `${p.星座} ${p.signDeg}°${String(p.signMin).padStart(2, '0')}′`;
export const normAngle = norm360;
