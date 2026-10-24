/**
 * 起卦时刻的口径。
 *
 * 六爻的时柱/日柱直接取决于「起卦算哪一刻」，所以这里必须把话说清：
 *   · 默认按北京时间原样取 moment，不做经度校正（120°E 标准经线）；
 *   · 用户选了起卦地点，则按该地经度 + 均时差校正为真太阳时后再取 moment。
 * 校正一律复用八字页那套（app/lib/true-solar + yiqi-core/true-solar-time），
 * 不再新增第二份真太阳时实现。
 */

import { lookupGeo, buildTrueSolarWiring, type GeoLookup } from '@/app/lib/true-solar/birth-wiring';
import { calculateTrueSolarTime } from '@/app/lib/core/yiqi-core/true-solar-time';
import type { QiguaSolarInfo } from '@/types/liuyao';

export interface QiguaPlace {
  province?: string;
  city?: string;
}

export interface QiguaMoment {
  /** 传给起卦方法的时刻：已按所选口径校正 */
  date: Date;
  info: QiguaSolarInfo;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function resolveQiguaMoment(now: Date, place?: QiguaPlace | null, geoOverride?: GeoLookup | null): QiguaMoment {
  const city = place?.city?.trim();
  const province = place?.province?.trim();
  const geo = geoOverride ?? (city || province ? lookupGeo({ province, city }) : null);

  if (!geo) {
    return {
      date: now,
      info: {
        mode: 'standard', label: '北京时间 · 120°E 标准经线（不校正）',
        place: null, longitude: null,
        clockText: hhmm(now), solarText: hhmm(now),
        correctionMinutes: 0, longitudeCorrectionMinutes: 0, equationOfTimeMinutes: 0,
        crossedHour: false, crossedDay: false,
      },
    };
  }

  const wiring = buildTrueSolarWiring({ province, city }, {
    year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
    hour: now.getHours(), minute: now.getMinutes(),
  }, geoOverride ? { geoOverride } : {});
  const tst = calculateTrueSolarTime({
    year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
    hour: now.getHours(), minute: now.getMinutes(), second: 0,
    longitude: wiring.longitude, timezone: wiring.timeZone, dstOffset: wiring.dstOffset,
  });
  const c = tst.trueSolarDateTime;
  const date = new Date(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);

  return {
    date,
    info: {
      mode: 'true-solar',
      label: `真太阳时 · ${geo.lng.toFixed(2)}°E（均时差 + 经度时差）`,
      place: [province, city].filter(Boolean).join(' '),
      longitude: +geo.lng.toFixed(4),
      clockText: hhmm(now),
      solarText: `${pad(c.hour)}:${pad(c.minute)}`,
      correctionMinutes: +tst.totalCorrectionMinutes.toFixed(1),
      longitudeCorrectionMinutes: +tst.longitudeCorrectionMinutes.toFixed(1),
      equationOfTimeMinutes: +tst.equationOfTimeMinutes.toFixed(1),
      crossedHour: tst.crossed.hour,
      crossedDay: tst.crossed.day,
    },
  };
}
