/**
 * 出生地 → 真太阳时参数（经度 + 时区标准偏移 + 历史夏令时）
 *
 * 这是「真太阳时」在业务侧的最后一公里：
 *   · `true-solar-time.ts` 负责「给定经度与偏移，算真太阳时」；
 *   · 本模块负责「从用户选的出生地，得出该给它的经度与偏移」。
 *
 * 为什么必须分开：排盘核心里没有行政区划数据，也不该打包 IANA 时区库；
 * 而出生地是表单层的信息。本模块把两者接上，且**零依赖**（时区来自内置 Intl）。
 *
 * 关键约束：传给排盘引擎的是 `timezone: 标准偏移` + `dstOffset: 夏令时偏移`，
 * **不能把含夏令时的总偏移当 timezone**——否则标准经线会变成 135°E，经度时差整体偏掉。
 */

import { CITY_GEO, PROVINCE_GEO, DEFAULT_TZ, type CityGeo } from './city-geo';
import { resolveZoneInfo } from './dst-resolver';

export interface BirthPlaceInput {
  province?: string;
  city?: string;
  district?: string;
}

export interface GeoLookup {
  lng: number;
  lat: number;
  tz: string;
  /** 精度来源：city=地级市/直辖市，county=区县级（省直辖县级市等），province=省级兜底 */
  src: CityGeo['src'] | 'none';
}

/** 名称归一化：去掉行政级别后缀，便于「北京」与「北京市」互相匹配 */
function normalizeRegionName(name: string): string {
  return name
    .replace(/(特别行政区|自治区|自治州|自治县|林区|地区|省|市|盟|县|区)$/u, '')
    .replace(/(回族|维吾尔|壮族|藏族|蒙古族|苗族|彝族|布依族|朝鲜族|满族|侗族|瑶族|白族|土家族|哈尼族|哈萨克|傣族|黎族|傈僳族|佤族|畲族|高山族|拉祜族|水族|东乡族|纳西族|景颇族|柯尔克孜|土族|达斡尔族|仫佬族|羌族|布朗族|撒拉族|毛南族|仡佬族|锡伯族|阿昌族|普米族|塔吉克族|怒族|乌孜别克族|俄罗斯族|鄂温克族|德昂族|保安族|裕固族|京族|塔塔尔族|独龙族|鄂伦春族|赫哲族|门巴族|珞巴族|基诺族)/u, '');
}

/** 归一化索引（惰性构建，只建一次） */
let cityIndex: Map<string, CityGeo> | null = null;
let provinceIndex: Map<string, [number, number]> | null = null;

function ensureIndex(): void {
  if (cityIndex && provinceIndex) return;
  cityIndex = new Map();
  for (const [name, geo] of Object.entries(CITY_GEO)) {
    const n = normalizeRegionName(name);
    if (!cityIndex.has(n)) cityIndex.set(n, geo);
  }
  provinceIndex = new Map();
  for (const [name, geo] of Object.entries(PROVINCE_GEO)) {
    const n = normalizeRegionName(name);
    if (!provinceIndex.has(n)) provinceIndex.set(n, geo as [number, number]);
  }
}

/** 由省/市查经纬度与时区；城市缺失时回退到省级；都缺则返回 null（不校正） */
export function lookupGeo(place: BirthPlaceInput): GeoLookup | null {
  const { province, city } = place;
  ensureIndex();

  const findCity = (name?: string): GeoLookup | null => {
    if (!name) return null;
    const g = CITY_GEO[name] || cityIndex!.get(normalizeRegionName(name));
    return g ? { lng: g.lng, lat: g.lat, tz: g.tz, src: g.src } : null;
  };
  const findProvince = (name?: string): GeoLookup | null => {
    if (!name) return null;
    const [lng, lat] = PROVINCE_GEO[name] || provinceIndex!.get(normalizeRegionName(name)) || [];
    return (lng !== undefined && lat !== undefined) ? { lng, lat, tz: DEFAULT_TZ, src: 'province' } : null;
  };

  return findCity(city) || findCity(province) || findProvince(province);
}

export interface CivilClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface TrueSolarWiring {
  /** 给排盘引擎：出生地经度 */
  longitude?: number;
  /** 给排盘引擎：时区标准偏移（小时） */
  timeZone: number;
  /** 给排盘引擎：历史夏令时偏移（小时） */
  dstOffset: number;
  /** 供 UI 展示与排错 */
  geo: GeoLookup | null;
  /** 该时刻处于夏令时回拨的重叠区间（同一钟表读数出现两次） */
  ambiguousDst: boolean;
  /** 经度精度较低（用了省级兜底）时的提示文案 */
  warning?: string;
}

const SRC_LABEL: Record<string, string> = { city: '地级市', county: '区县级', province: '省级' };

/**
 * 组装排盘所需的真太阳时参数。
 * `fallbackTimeZone` 在查不到出生地时使用（默认 8 = 东八区）。
 */
export function buildTrueSolarWiring(
  place: BirthPlaceInput,
  clock: CivilClock,
  options: { fallbackTimeZone?: number; enable?: boolean } = {},
): TrueSolarWiring {
  const fallbackTimeZone = options.fallbackTimeZone ?? 8;
  const enable = options.enable !== false;
  const geo = enable ? lookupGeo(place) : null;

  if (!geo) {
    return { timeZone: fallbackTimeZone, dstOffset: 0, geo: null, ambiguousDst: false };
  }

  let zone;
  try {
    zone = resolveZoneInfo(clock, geo.tz);
  } catch {
    // 未知时区名等异常：退回固定偏移，不阻断排盘
    return { longitude: geo.lng, timeZone: fallbackTimeZone, dstOffset: 0, geo, ambiguousDst: false,
      warning: `时区 ${geo.tz} 无法解析，已按东八区处理` };
  }

  const warning = geo.src === 'province'
    ? `出生地已按${SRC_LABEL.province}坐标近似（更精确可填具体城市），经度时差可能有十余分钟误差`
    : undefined;

  return {
    longitude: geo.lng,
    timeZone: zone.standardOffsetHours,
    dstOffset: zone.dstOffsetHours,
    geo,
    ambiguousDst: zone.ambiguous,
    warning,
  };
}
