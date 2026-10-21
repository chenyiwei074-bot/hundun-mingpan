/**
 * 真太阳时（True Solar Time）校正
 *
 * 为什么需要它
 * ------------
 * 八字排盘用的是出生地的**真太阳时**（太阳实际过中天的位置），而用户填的是**钟表时间**
 * （时区行政时间）。两者差值有两项：
 *
 *   1. 经度时差 = 4 分钟 × (出生地经度 − 时区标准经线)
 *      时区标准经线 = 时区偏移(小时) × 15°。中国统一用东八区(120°E)，
 *      但喀什(75.99°E)与上海(121.47°E)相差 45.5°，即 **约 182 分钟**。
 *   2. 均时差(Equation of Time)：地球轨道偏心率与黄赤交角造成的 ±16 分钟季节性偏差，
 *      用 Meeus《Astronomical Algorithms》第 28 章的公式计算。
 *
 * 两项相加在中国境内最大可超过 3 小时 —— 足以跨越 1–2 个时辰，
 * 直接改变时柱，进而改变整个命盘。
 *
 * 设计约束
 * --------
 * - **零依赖、纯 TypeScript**：本项目的排盘跑在浏览器端（`app/lib/core/`），
 *   不能为了 IANA 时区库(`@tubular/time` 约 1–2 MB)把客户端包撑大。
 * - 历史夏令时因此**不做自动推断**，改为显式 `dstOffset` 输入（默认 0）。
 *   需要自动推断时，应在服务端用 IANA tzdb 解析后把结果传进来。
 * - 本实现的均时差已用 openfate 的 MIT 引擎(`@openfate/true-solar-time`, Meeus 算法)
 *   逐输入比对验证，误差在秒级以内。验证脚本见仓库 `fate-reverse/reproduce/`。
 */

export interface TrueSolarTimeInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  /** 出生地经度（东经为正）。缺省则不校正。 */
  longitude?: number;
  /** 时区偏移（小时），默认 8（东八区）。 */
  timezone?: number;
  /** 夏令时偏移（小时），默认 0。需调用方显式给出。 */
  dstOffset?: number;
  /** 是否启用校正，默认 true；false 时原样返回民用时间。 */
  enable?: boolean;
}

export interface CorrectedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface TrueSolarTimeResult {
  /** 是否实际做了校正 */
  applied: boolean;
  /** 输入的钟表时间 */
  civilDateTime: CorrectedDateTime;
  /** 校正后的真太阳时 */
  trueSolarDateTime: CorrectedDateTime;
  /** 校正后的时刻字符串 HH:mm:ss */
  trueSolarTime: string;
  civilTime: string;
  /** 经度时差（分钟，东偏为正） */
  longitudeCorrectionMinutes: number;
  /** 均时差（分钟） */
  equationOfTimeMinutes: number;
  /** 夏令时偏移（分钟） */
  dstOffsetMinutes: number;
  /** 总校正量（分钟）= 经度时差 + 均时差 */
  totalCorrectionMinutes: number;
  /** 时区标准经线（度） */
  standardMeridian: number;
  /** 实际使用的经度 */
  longitude: number | null;
  /** 时区基准（小时） */
  timezone: number;
  /**
   * 校正之后时柱/日柱所在的那一格有没有真的换掉。
   * hour 按**时辰**（两小时一格）比，参照是 civilDateTime ↔ trueSolarDateTime，
   * 也就是卡片上印着的那两串字；不是整点小时数，也不是 standard。
   */
  crossed: { hour: boolean; day: boolean };
  algorithm: 'meeus-simplified' | 'none';
}

const MINUTES_PER_DEGREE = 4;

/** 儒略日（Gregorian，Meeus 第 7 章） */
export function julianDay(year: number, month: number, day: number,
                          hour = 0, minute = 0, second = 0): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const dayFrac = (hour + minute / 60 + second / 3600) / 24;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1))
       + day + dayFrac + b - 1524.5;
}

/**
 * 均时差（分钟）—— Meeus《Astronomical Algorithms》第 28 章简化式。
 *
 * EoT = 4 × [ y·sin(2L₀) − 2e·sin(M) + 4e·y·sin(M)·cos(2L₀)
 *             − 0.5y²·sin(4L₀) − 1.25e²·sin(2M) ]   （y = tan²(ε/2)，角度制，结果乘 4 化为分钟）
 *
 * 精度约 ±0.5 秒，对分钟级的排盘需求远超足够。
 */
export function equationOfTimeMinutes(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const deg = (x: number) => (x * Math.PI) / 180;

  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;   // 太阳平黄经
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;    // 太阳平近点角
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T; // 轨道偏心率
  const eps = 23.439291 - 0.0130042 * T
            - 1.64e-7 * T * T + 5.04e-7 * T * T * T;            // 黄赤交角

  const y = Math.tan(deg(eps / 2)) ** 2;
  const E = y * Math.sin(2 * deg(L0))
          - 2 * e * Math.sin(deg(M))
          + 4 * e * y * Math.sin(deg(M)) * Math.cos(2 * deg(L0))
          - 0.5 * y * y * Math.sin(4 * deg(L0))
          - 1.25 * e * e * Math.sin(2 * deg(M));
  return (E * 180) / Math.PI * MINUTES_PER_DEGREE;
}

function pad(n: number, w = 2): string {
  return String(Math.floor(Math.abs(n))).padStart(w, '0');
}

function toDateTime(ms: number): CorrectedDateTime {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
  };
}

/** 时辰下标：23–01 子、01–03 丑 …… 与 ziwei-standard.ts 的 getHourZhiIndex 同一格法。 */
function ziChenIndex(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12;
}

/** 从当地时间分量 + 时区/夏令时偏移求 UTC 毫秒（不依赖本地时区） */
export function toUtcMs(y: number, mo: number, d: number,
                        h: number, mi: number, s: number,
                        tzHours: number, dstHours: number): number {
  return Date.UTC(y, mo - 1, d, h, mi, s) - (tzHours + dstHours) * 3600000;
}

/**
 * 计算真太阳时。
 *
 * 顺序很重要：**先做真太阳时校正，再做晚子时(23:00 换日)调整**。
 * 反过来的话，换日会基于错误的钟表时间，导致日柱错位。
 */
export function calculateTrueSolarTime(input: TrueSolarTimeInput): TrueSolarTimeResult {
  const y = input.year, mo = input.month, d = input.day;
  const h = input.hour ?? 0, mi = input.minute ?? 0, s = input.second ?? 0;
  const tz = input.timezone ?? 8;
  const dstH = input.dstOffset ?? 0;
  const lon = input.longitude;
  const enable = input.enable !== false;

  const civil: CorrectedDateTime = { year: y, month: mo, day: d, hour: h, minute: mi, second: s };
  const civilStr = `${pad(h)}:${pad(mi)}:${pad(s)}`;

  // 未给经度 或 关闭校正 -> 原样返回
  if (!enable || lon === undefined || lon === null || Number.isNaN(lon)) {
    return {
      applied: false, civilDateTime: civil, trueSolarDateTime: civil,
      trueSolarTime: civilStr, civilTime: civilStr,
      longitudeCorrectionMinutes: 0, equationOfTimeMinutes: 0,
      dstOffsetMinutes: dstH * 60, totalCorrectionMinutes: 0,
      standardMeridian: tz * 15, longitude: lon ?? null, timezone: tz,
      crossed: { hour: false, day: false }, algorithm: 'none',
    };
  }

  // ── 严格按三段时间轴来算，避免时区被重复计入 ──
  //   ① 民用钟表时间 civil        （用户填的）
  //   ② 标准时 standard = civil − 夏令时   （仍是当地钟表读数）
  //   ③ UTC 瞬间 instant = civil − (时区 + 夏令时)   ← 均时差必须在这个真实瞬间上求值
  //
  // 早期版本把 ③ 误当成 ②，结果时区被减了两次，跨日判定也错了。
  const civilMs = Date.UTC(y, mo - 1, d, h, mi, s);   // 把"钟表读数"当作 ms 载体
  const dstMs = dstH * 3600000;
  const standardMs = civilMs - dstMs;                  // ②
  const instantMs = standardMs - tz * 3600000;         // ③

  const inst = new Date(instantMs);
  const jd = julianDay(inst.getUTCFullYear(), inst.getUTCMonth() + 1, inst.getUTCDate(),
                       inst.getUTCHours(), inst.getUTCMinutes(), inst.getUTCSeconds());

  const standardMeridian = tz * 15;
  const lonCorr = (lon - standardMeridian) * MINUTES_PER_DEGREE;
  const eot = equationOfTimeMinutes(jd);
  const total = lonCorr + eot;

  const correctedMs = standardMs + total * 60000;      // ② + 校正量
  const corrected = toDateTime(correctedMs);
  const stdLocal = toDateTime(standardMs);

  const sameDay = corrected.year === stdLocal.year
    && corrected.month === stdLocal.month && corrected.day === stdLocal.day;

  return {
    applied: true, civilDateTime: civil, trueSolarDateTime: corrected,
    trueSolarTime: `${pad(corrected.hour)}:${pad(corrected.minute)}:${pad(corrected.second)}`,
    civilTime: civilStr,
    longitudeCorrectionMinutes: +lonCorr.toFixed(4),
    equationOfTimeMinutes: +eot.toFixed(4),
    dstOffsetMinutes: dstH * 60,
    totalCorrectionMinutes: +total.toFixed(4),
    standardMeridian, longitude: lon, timezone: tz,
    // 时辰两小时一格，"跨没跨"只能按格比。参照取 civil（用户填的、卡片上印着的那串钟表时间），
    // 不是 standard：按整点小时数比会在同一格内误报（1728 个采样 72 个假"已跨"），
    // 而按 standard 比会把夏令时那一步造成的跨格判成没跨（同批采样漏报 240 个，全是夏令时盘）。
    // day 仍按 standard 参照，本批没被授权改它 —— 夏令时且生于 00:00–01:00 那一档两者不等价（36 个采样），已记进交接文档待裁。
    crossed: { hour: ziChenIndex(corrected.hour) !== ziChenIndex(civil.hour), day: !sameDay },
    algorithm: 'meeus-simplified',
  };
}
