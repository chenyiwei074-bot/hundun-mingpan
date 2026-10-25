import { Ecliptic, GeoMoonState, MakeTime, Vector, e_tilt } from 'astronomy-engine';
import { SIGNS, type PlanetPlace } from './planets';

export const ASTRO_EXTENSIONS_BASIS = 'astro-extensions-v1' as const;
export const CHIRON_EPHEMERIS = {
  url: '/ephemeris/chiron-jpl-1900-2100-v1.bin',
  fromUtcMs: Date.UTC(1900, 0, 1),
  throughUtcMs: Date.UTC(2100, 0, 1),
  samples: 73_050,
  authority: 'NASA/JPL Horizons · DE441 + SB441-N16',
} as const;

export type ZodiacFrame = 'tropical' | 'sidereal-lahiri';
export type LunarNodeMode = 'true' | 'mean';

export interface ChironEphemerisData {
  longitudes: Float32Array;
  latitudes: Float32Array;
  startUtcMs: number;
  count: number;
}

let chironLoad: Promise<ChironEphemerisData> | null = null;

export async function loadChironEphemeris(): Promise<ChironEphemerisData> {
  if (!chironLoad) {
    chironLoad = fetch(CHIRON_EPHEMERIS.url, { cache: 'force-cache' })
      .then(async response => {
        if (!response.ok) throw new Error(`凯龙星历表读取失败（${response.status}）。`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 16) throw new Error('凯龙星历表文件不完整。');
        const view = new DataView(buffer);
        const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
        const version = view.getUint32(4, true);
        const count = view.getUint32(8, true);
        const stride = view.getUint32(12, true);
        if (magic !== 'CHRN' || version !== 1 || stride !== 2 || buffer.byteLength !== 16 + count * 8) {
          throw new Error('凯龙星历表格式不匹配。');
        }
        const longitudes = new Float32Array(count);
        const latitudes = new Float32Array(count);
        for (let index = 0; index < count; index += 1) {
          longitudes[index] = view.getFloat32(16 + index * 8, true);
          latitudes[index] = view.getFloat32(20 + index * 8, true);
        }
        return { longitudes, latitudes, startUtcMs: CHIRON_EPHEMERIS.fromUtcMs, count };
      })
      .catch(error => {
        chironLoad = null;
        throw error;
      });
  }
  return chironLoad;
}

function position(key: PlanetPlace['key'], name: string, lonValue: number, lat: number): PlanetPlace {
  const lon = ((lonValue % 360) + 360) % 360;
  const signIndex = Math.min(11, Math.floor(lon / 30));
  const within = lon - signIndex * 30;
  const wholeDegree = Math.floor(within);
  return {
    key, 名称: name, lon, lat, signIndex, 星座: SIGNS[signIndex],
    signDeg: Math.min(29, wholeDegree),
    signMin: Math.min(59, Math.floor((within - wholeDegree) * 60)),
  };
}

export function computeChironPosition(utcMs: number, data: ChironEphemerisData): PlanetPlace | null {
  if (!Number.isFinite(utcMs)) return null;
  const sample = (utcMs - data.startUtcMs) / 86_400_000;
  if (sample < 0 || sample > data.count - 1) return null;
  const left = Math.floor(sample);
  const right = Math.min(data.count - 1, left + 1);
  const fraction = sample - left;
  const lonLeft = data.longitudes[left];
  let lonDelta = data.longitudes[right] - lonLeft;
  if (lonDelta > 180) lonDelta -= 360;
  if (lonDelta < -180) lonDelta += 360;
  const lon = lonLeft + lonDelta * fraction;
  const lat = data.latitudes[left] + (data.latitudes[right] - data.latitudes[left]) * fraction;
  return position('chiron', '凯龙星', lon, lat);
}

function meanNodeLongitude(utcMs: number): number {
  const time = MakeTime(new Date(utcMs));
  const t = time.tt / 36_525;
  return 125.0445479 - 1934.1362891 * t + 0.0020754 * t ** 2
    + t ** 3 / 467441 - t ** 4 / 60616000;
}

function trueNodeLongitude(utcMs: number): number {
  const state = GeoMoonState(new Date(utcMs));
  // Form the orbital normal in the inertial EQJ frame first. Transforming
  // position and velocity independently to a rotating-of-date frame would
  // omit the frame-rotation term and bias the osculating node.
  const hxEqj = state.y * state.vz - state.z * state.vy;
  const hyEqj = state.z * state.vx - state.x * state.vz;
  const hzEqj = state.x * state.vy - state.y * state.vx;
  const normal = Ecliptic(new Vector(hxEqj, hyEqj, hzEqj, state.t)).vec;
  const hx = normal.x;
  const hy = normal.y;
  if (!Number.isFinite(hx) || !Number.isFinite(hy) || Math.hypot(hx, hy) < 1e-12) {
    throw new Error('无法从月球轨道状态确定真交点。');
  }
  // The ascending node is the line where the osculating lunar orbit crosses
  // the ecliptic from negative to positive latitude: n = z × (r × v).
  return Math.atan2(hx, -hy) * 180 / Math.PI;
}

export function computeLunarNodes(utcMs: number, mode: LunarNodeMode): PlanetPlace[] {
  const northLongitude = mode === 'mean' ? meanNodeLongitude(utcMs) : trueNodeLongitude(utcMs);
  return [
    position('north-node', mode === 'mean' ? '北交点（平均）' : '北交点（真）', northLongitude, 0),
    position('south-node', mode === 'mean' ? '南交点（平均）' : '南交点（真）', northLongitude + 180, 0),
  ];
}

function p03PrecessionLongitudeArcsec(t: number): number {
  return 5028.796195 * t + 1.1054348 * t ** 2 + 0.00007964 * t ** 3
    - 0.000023857 * t ** 4 - 0.0000000383 * t ** 5;
}

const TT_DAY = 86_400_000;
export const LAHIRI_ICRC_EPOCH_UTC_MS = (() => {
  const ttMidnightAsUtc = Date.UTC(1956, 2, 21);
  const nominalTime = MakeTime(new Date(ttMidnightAsUtc));
  return ttMidnightAsUtc - (nominalTime.tt - nominalTime.ut) * TT_DAY;
})();
const LAHIRI_EPOCH_TIME = MakeTime(new Date(LAHIRI_ICRC_EPOCH_UTC_MS));
const LAHIRI_EPOCH_TRUE_DEG = 23.25; // ICRC zero point: 1956-03-21 00:00 TT.
const LAHIRI_MEAN_AT_EPOCH_DEG = LAHIRI_EPOCH_TRUE_DEG - e_tilt(LAHIRI_EPOCH_TIME).dpsi / 3600;
const LAHIRI_EPOCH_T = LAHIRI_EPOCH_TIME.tt / 36_525;

/**
 * Lahiri ICRC (23°15′ true at 1956-03-21 00:00 TT), advanced with IAU 2006 P03
 * precession. The mean zero point is derived from this engine's nutation model,
 * then apparent longitude is restored to match this app's ecliptic-of-date coordinates.
 */
export function lahiriAyanamsha(utcMs: number): number {
  const time = MakeTime(new Date(utcMs));
  const t = time.tt / 36_525;
  const mean = LAHIRI_MEAN_AT_EPOCH_DEG
    + (p03PrecessionLongitudeArcsec(t) - p03PrecessionLongitudeArcsec(LAHIRI_EPOCH_T)) / 3600;
  return mean + e_tilt(time).dpsi / 3600;
}

export function applyZodiacFrame<T extends PlanetPlace>(placeValue: T, frame: ZodiacFrame, ayanamsha: number): T {
  return position(placeValue.key, placeValue.名称,
    placeValue.lon - (frame === 'sidereal-lahiri' ? ayanamsha : 0), placeValue.lat) as T;
}

export function convertLongitude(lon: number, frame: ZodiacFrame, ayanamsha: number): number {
  return normalizeLongitude(lon - (frame === 'sidereal-lahiri' ? ayanamsha : 0));
}

export function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}
