import { Solar } from 'lunar-typescript';
import type { BaziChart, Dizhi, GanZhi, Tiangan } from '@/app/lib/core/yiqi-core/types';
import { getAccurateMonthGanZhi } from '@/app/lib/core/yiqi-core/jieqi';
import { getZhiCangGanFull } from '@/app/lib/core/yiqi-core/bazi';
import { getShiShen } from '@/app/lib/core/bazi-enrich/tables';
import { zhiPairRelations } from '@/app/lib/core/bazi-enrich/zhi-relations';

/** 节月从立春起，到下一次立春止；第 12 个月的小寒落在下一公历年。 */
const TERMS = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑',
  '立秋', '白露', '寒露', '立冬', '大雪', 'XIAO_HAN', 'LI_CHUN'] as const;
const MONTH_NAMES = ['寅月', '卯月', '辰月', '巳月', '午月', '未月',
  '申月', '酉月', '戌月', '亥月', '子月', '丑月'] as const;
const PILLARS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABEL = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;

export interface LiuYueMonth {
  index: number;
  name: string;
  startTerm: string;
  endTerm: string;
  startBeijing: string;
  endBeijing: string;
  startUtcMs: number;
  endUtcMs: number;
  ganZhi: GanZhi;
  ganShiShen: string;
  cangGan: Array<{ gan: string; shiShen: string }>;
  natalRelations: string[];
  yearRelations: string[];
  dayunRelations: string[];
}

export interface LiuYueYear {
  year: number;
  annualGanZhi: GanZhi;
  dayunGanZhi: GanZhi;
  dayMaster: Tiangan;
  months: LiuYueMonth[];
  basis: 'jieqi-liuyue-v1';
}

type SolarMoment = ReturnType<typeof Solar.fromYmdHms>;

function utcMs(solar: SolarMoment): number {
  return Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(),
    solar.getHour() - 8, solar.getMinute(), solar.getSecond());
}

function beijingLabel(solar: SolarMoment): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())} `
    + `${pad(solar.getHour())}:${pad(solar.getMinute())}`;
}

function midpointSolar(a: SolarMoment, b: SolarMoment): SolarMoment {
  const beijing = new Date(Math.floor((utcMs(a) + utcMs(b)) / 2) + 8 * 3600_000);
  return Solar.fromYmdHms(beijing.getUTCFullYear(), beijing.getUTCMonth() + 1,
    beijing.getUTCDate(), beijing.getUTCHours(), beijing.getUTCMinutes(), beijing.getUTCSeconds());
}

function pairLabels(monthZhi: Dizhi, otherZhi: Dizhi, label: string): string[] {
  return zhiPairRelations(monthZhi, otherZhi).map(relation =>
    `流月支 ${monthZhi} × ${label} ${otherZhi} → ${relation.type}${relation.detail ? `·${relation.detail}` : ''}`);
}

/** 只列命盘已给出的流年，防止月面板脱离既有大运范围。 */
export function availableLiuYueYears(chart: BaziChart | null | undefined): number[] {
  return [...new Set((chart?.dayun ?? []).flatMap(segment =>
    (segment.liuNian ?? []).map(item => item.year)))].filter(year =>
    Number.isInteger(year) && year >= 1900 && year <= 2100).sort((a, b) => a - b);
}

/** 公历一月到立春前仍归上一流年；默认选中真正包含此刻的节月。 */
export function defaultLiuYueYear(chart: BaziChart, nowUtcMs: number): number {
  const years = availableLiuYueYears(chart);
  const current = new Date(nowUtcMs).getUTCFullYear();
  for (const year of [current, current - 1]) {
    if (!years.includes(year)) continue;
    if (buildLiuYueYear(chart, year)?.months.some(month =>
      nowUtcMs >= month.startUtcMs && nowUtcMs < month.endUtcMs)) return year;
  }
  return years.includes(current) ? current : (years[0] ?? current);
}

/**
 * 月柱复用原排盘的精确节气月柱函数；节气时刻取同一 lunar-typescript 库。
 * 同时用库的 exact 月柱、盘面流年干支逐项对照，任何不一致都不展示月运。
 */
export function buildLiuYueYear(chart: BaziChart | null | undefined, year: number): LiuYueYear | null {
  if (!chart?.dayMaster || !chart.siZhu || !availableLiuYueYears(chart).includes(year)) return null;
  if (!PILLARS.every(pillar => chart.siZhu[pillar]?.zhi)) return null;
  const segment = chart.dayun.find(item => item.liuNian?.some(annual => annual.year === year));
  const annual = segment?.liuNian.find(item => item.year === year);
  if (!segment || !annual) return null;

  // 六月中旬的节气表包含本年立春至大雪，以及次年小寒、立春的别名键。
  const table = Solar.fromYmdHms(year, 6, 15, 12, 0, 0).getLunar().getJieQiTable();
  const boundaries = TERMS.map(term => table[term]);
  if (boundaries.some(value => !value)) return null;
  const exact = boundaries as SolarMoment[];
  if (exact.some((boundary, index) => index > 0 && utcMs(boundary) <= utcMs(exact[index - 1]))) return null;

  const months: LiuYueMonth[] = [];
  for (let index = 0; index < 12; index++) {
    const start = exact[index], end = exact[index + 1];
    const middle = midpointSolar(start, end);
    const ganZhi = getAccurateMonthGanZhi(middle);
    const libraryMonth = middle.getLunar().getMonthInGanZhiExact();
    const libraryYear = middle.getLunar().getYearInGanZhiByLiChun();
    if (`${ganZhi.gan}${ganZhi.zhi}` !== libraryMonth
      || `${annual.ganZhi.gan}${annual.ganZhi.zhi}` !== libraryYear
      || ganZhi.zhi !== MONTH_NAMES[index][0]) return null;
    const natalRelations = PILLARS.flatMap(pillar =>
      pairLabels(ganZhi.zhi, chart.siZhu[pillar].zhi, PILLAR_LABEL[pillar]));
    months.push({
      index, name: MONTH_NAMES[index], startTerm: index === 11 ? '小寒' : TERMS[index],
      endTerm: index === 11 ? '立春' : TERMS[index + 1] === 'XIAO_HAN' ? '小寒' : TERMS[index + 1],
      startBeijing: beijingLabel(start), endBeijing: beijingLabel(end),
      startUtcMs: utcMs(start), endUtcMs: utcMs(end), ganZhi,
      ganShiShen: getShiShen(chart.dayMaster, ganZhi.gan),
      cangGan: getZhiCangGanFull(ganZhi.zhi, chart.dayMaster),
      natalRelations,
      yearRelations: pairLabels(ganZhi.zhi, annual.ganZhi.zhi, '流年支'),
      dayunRelations: pairLabels(ganZhi.zhi, segment.ganZhi.zhi, '大运支'),
    });
  }
  return { year, annualGanZhi: annual.ganZhi, dayunGanZhi: segment.ganZhi,
    dayMaster: chart.dayMaster, months, basis: 'jieqi-liuyue-v1' };
}
