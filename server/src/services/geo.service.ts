import { CHINA_GEO_V2 } from '../data/china-geo-v2';
import { lookupGeo as lookupGeoV1, type GeoLookup } from '../lib/true-solar/birth-wiring';

export type GeoPrecision = 'district' | 'city' | 'province';
export interface GeoLookupV2 extends GeoLookup {
  precision: GeoPrecision;
  districtMatched: boolean;
}

const SUFFIX = /(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/u;
const canon = (s: string) => s.trim().replace(SUFFIX, '');
const key = (p: string, c: string, d: string) => `${p}|${c}|${d}`;

const exact = new Map<string, { lng: number; lat: number; tz: string }>();
const canonical = new Map<string, { lng: number; lat: number; tz: string }>();
for (const r of CHINA_GEO_V2) {
  const v = { lng: r.lng, lat: r.lat, tz: r.tz };
  exact.set(key(r.province, r.city, r.district), v);
  const k2 = key(canon(r.province), canon(r.city), canon(r.district));
  if (!canonical.has(k2)) canonical.set(k2, v);
}

/**
 * v2 地点查询：区县级优先；区县未命中时回退到 v1 的 382 城数据。
 * 不猜坐标，不把“区县没查到”当成命中；districtMatched 会如实返回 false。
 */
export function lookupGeoV2(place: { province?: string; city?: string; district?: string }): GeoLookupV2 | null {
  const province = String(place.province || '').trim();
  const city = String(place.city || '').trim();
  const district = String(place.district || '').trim();
  if (district) {
    const hit = exact.get(key(province, city, district))
      || canonical.get(key(canon(province), canon(city), canon(district)));
    if (hit) {
      return { ...hit, src: 'county', precision: 'district', districtMatched: true };
    }
  }
  const v1 = lookupGeoV1({ province, city, district });
  if (!v1) return null;
  return {
    ...v1,
    precision: v1.src === 'province' ? 'province' : 'city',
    districtMatched: false,
  };
}
