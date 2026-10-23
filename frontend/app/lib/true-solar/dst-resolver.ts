/**
 * 历史夏令时 / 时区偏移解析（零依赖，用内置 Intl 的 IANA 时区数据）
 *
 * 为什么需要它
 * ------------
 * `true-solar-time.ts` 要求调用方显式传入 `dstOffset`，因为前端不打包 IANA 时区库。
 * 但「1986–1991 年中国实行过夏令时」这件事必须自动处理，否则这些年份的盘会整体差 1 小时：
 *   1988-07-15 15:20 上海：标准时 +8 → 真太阳时 13:59:42（正确）
 *   若漏掉夏令时：当天实际是 +9，真太阳时会算成 12:59:42 → 时柱错一位。
 *
 * 做法
 * ----
 * 不引入时区库，改用浏览器/Node 都内置的 `Intl.DateTimeFormat(..., { timeZoneName: 'longOffset' })`
 * 取任意 UTC 瞬间的偏移量（ICU 里就是完整的 IANA tzdb，含历史规则）。
 *   1. 由「当地钟表时间」反解 UTC 瞬间：先猜一次偏移，再迭代两次收敛（跨 DST 边界时必要）；
 *   2. 标准偏移 = 该年 12 个月采样里的**最小偏移**（比只看 1 月更稳，能覆盖年中调整标准时的地区）；
 *   3. 夏令时偏移 = 当前瞬间偏移 − 标准偏移。
 *
 * 边界与已知限制
 * --------------
 * - 对**中国 1986–1991** 与常见欧美时区，ICU 数据准确；已用 openfate 公开验证集回归（见 test-dst.cjs）。
 * - 极少数历史区间（如某地年中改标准时 + 同日又切夏令时）本启发式可能取错标准偏移，属已知限制。
 * - `disambiguation` 采用 ICU 默认（重叠时段取较早的一次）；中国夏令时切换在凌晨 2 点，与排盘无关。
 */

/** 取某 UTC 瞬间在指定 IANA 时区的偏移（分钟，东为正） */
export function offsetMinutesAt(timeZoneId: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZoneId,
    timeZoneName: 'longOffset',
  });
  const name = dtf.formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName')?.value ?? '';
  const m = name.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) {
    // 'GMT' / 'UTC' 之类 = 0；未知时区名会抛 RangeError，交由调用方兜底
    return 0;
  }
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0));
}

export interface CivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

export interface ZoneResolution {
  /** IANA 时区名 */
  timeZoneId: string;
  /** 该瞬间的实际偏移（小时，含夏令时） */
  offsetHours: number;
  /** 标准偏移（小时，不含夏令时）—— 真太阳时的标准经线应基于它 */
  standardOffsetHours: number;
  /** 夏令时偏移（小时，0 表示未实行） */
  dstOffsetHours: number;
  /** 该瞬间的 UTC 毫秒 */
  utcMs: number;
  /** 是否落在重叠/跳变的不确定区间（尽力而为，供 UI 提示） */
  ambiguous: boolean;
}

/** 反解出的三种情况必须分得开：一个根=唯一解；两个根=墙钟读了两遍（回拨）；
 *  零个根=那个墙钟从来没出现（跳表）。civilToInstant 历史上把后两种都压成 ambiguous:true，
 *  对真太阳时够用（它总得有一个时刻可用），但要说"这个时间不存在"或"出现了两次"就不够用。
 *  E2 之前 lib/astro/moment.ts 为此自己写了一遍同样的枚举 —— 那就是第二份"哪儿几点是什么"的
 *  真相；现在枚举只住在这里，两边都读它。 */
export type CivilSolve =
  | { kind: 'ok'; utcMs: number; offsetMinutes: number }
  | { kind: 'ambiguous'; roots: Array<{ utcMs: number; offsetMinutes: number }> }
  | { kind: 'nonexistent'; naive: number };

export function resolveCivil(civil: CivilParts, timeZoneId: string): CivilSolve {
  const naive = Date.UTC(
    civil.year, civil.month - 1, civil.day,
    civil.hour, civil.minute, civil.second ?? 0,
  );

  // 附近 48 小时观测到的候选偏移
  const candidates = new Set<number>();
  for (let h = -24; h <= 24; h += 3) {
    candidates.add(offsetMinutesAt(timeZoneId, naive + h * 3600000));
  }
  // 自洽的候选：用该偏移反解出的瞬间，其实际偏移必须与假设一致
  const roots: Array<{ utcMs: number; offsetMinutes: number }> = [];
  for (const off of candidates) {
    const utc = naive - off * 60000;
    if (offsetMinutesAt(timeZoneId, utc) === off) roots.push({ utcMs: utc, offsetMinutes: off });
  }
  if (roots.length === 0) return { kind: 'nonexistent', naive };
  // 较早的一次 = 偏移较大的一次
  roots.sort((a, b) => b.offsetMinutes - a.offsetMinutes);
  if (roots.length === 1) return { kind: 'ok', utcMs: roots[0].utcMs, offsetMinutes: roots[0].offsetMinutes };
  return { kind: 'ambiguous', roots };
}

/**
 * 由当地钟表时间 + IANA 时区反解 UTC 瞬间。
 * 重叠时段（夏令时回拨，同一读数出现两次）按 ICU 惯例**取较早的一次**（即偏移较大者），
 * 并把该情形暴露为 `ambiguous`，由 UI 决定是否提示用户。
 */
export function civilToInstant(civil: CivilParts, timeZoneId: string): { utcMs: number; offsetMinutes: number; ambiguous: boolean } {
  const s = resolveCivil(civil, timeZoneId);
  if (s.kind === 'ok') return { utcMs: s.utcMs, offsetMinutes: s.offsetMinutes, ambiguous: false };
  // 旧行为逐字保留：两种不确定都返回 ambiguous，且仍给得出一个时刻。
  // 跳表那一支本来就是"不存在的墙钟"，这里退回单次迭代值 —— 真太阳时至少要有一个数可用，
  // 而界面要能说"这个时间不存在"的话，读 resolveCivil 的 kind，别在这一层猜。
  if (s.kind === 'ambiguous') return { utcMs: s.roots[0].utcMs, offsetMinutes: s.roots[0].offsetMinutes, ambiguous: true };
  const off = offsetMinutesAt(timeZoneId, s.naive);
  return { utcMs: s.naive - off * 60000, offsetMinutes: off, ambiguous: true };
}

/** 某年的标准偏移 = 12 个月采样的最小偏移（小时） */
function standardOffsetHoursOfYear(timeZoneId: string, year: number): number {
  let min = Infinity;
  for (let m = 0; m < 12; m++) {
    const v = offsetMinutesAt(timeZoneId, Date.UTC(year, m, 1, 12, 0, 0));
    if (v < min) min = v;
  }
  return min / 60;
}

/**
 * 解析某个出生时刻的时区信息。
 * 排盘时应把 `standardOffsetHours` 作为 `timezone`、`dstOffsetHours` 作为 `dstOffset`
 * 传给 `calculateTrueSolarTime`——**不要用含夏令时的总偏移当 timezone**，
 * 否则标准经线会被算成 135°E，经度时差整体偏移。
 */
export function resolveZoneInfo(civil: CivilParts, timeZoneId: string): ZoneResolution {
  const { utcMs, offsetMinutes, ambiguous: ambiguousFromInstant } = civilToInstant(civil, timeZoneId);
  const standardOffsetHours = standardOffsetHoursOfYear(timeZoneId, civil.year);
  const offsetHours = offsetMinutes / 60;
  return {
    timeZoneId,
    offsetHours,
    standardOffsetHours,
    dstOffsetHours: +(offsetHours - standardOffsetHours).toFixed(4),
    utcMs,
    ambiguous: ambiguousFromInstant,
  };
}

/** 便捷函数：只要夏令时偏移（小时） */
export function resolveDstOffsetHours(civil: CivilParts, timeZoneId: string): number {
  return resolveZoneInfo(civil, timeZoneId).dstOffsetHours;
}
