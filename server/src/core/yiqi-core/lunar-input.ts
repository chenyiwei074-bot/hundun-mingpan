// 农历输入归一化。
//
// 引擎（八字与紫微）的排盘入口一律是公历时刻，因为四柱的年月日界分别挂在
// 立春 / 十二节 / 干支纪日连续序列上，这些都是公历轴上的事件。所以农历输入
// 必须先换算成公历再排盘，而不是把农历的数字当公历用。
//
// isLunar 为假时原样返回，盘面与旧版逐字节一致。

import { Lunar, LunarMonth, LunarYear } from 'lunar-typescript';
import type { BirthInfo, CalendarConversion } from './types';

export interface CivilInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  conversion?: CalendarConversion;
}

/** lunar-typescript 用负数月表示闰月，这里负责加这个符号。 */
function signedMonth(month: number, isLeapMonth?: boolean): number {
  return isLeapMonth ? -month : month;
}

/** 换算只需要日期时间这几个字段，表单可以单独调用它而不必先拼一个 BirthInfo。 */
type LunarInputFields = Pick<BirthInfo, 'year' | 'month' | 'day' | 'hour' | 'minute' | 'isLunar' | 'isLeapMonth'>;

export function toCivilInput(birthInfo: LunarInputFields): CivilInput {
  if (!birthInfo.isLunar) {
    return {
      year: birthInfo.year,
      month: birthInfo.month,
      day: birthInfo.day,
      hour: birthInfo.hour,
      minute: birthInfo.minute,
    };
  }
  const lunar = Lunar.fromYmdHms(
    birthInfo.year,
    signedMonth(birthInfo.month, birthInfo.isLeapMonth),
    birthInfo.day,
    birthInfo.hour,
    birthInfo.minute,
    0
  );
  const solar = lunar.getSolar();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    hour: solar.getHour(),
    minute: solar.getMinute(),
    conversion: {
      inputType: 'lunar',
      lunar: `${birthInfo.year}-${pad(birthInfo.month)}-${pad(birthInfo.day)} ${pad(birthInfo.hour)}:${pad(birthInfo.minute)}`,
      isLeapMonth: !!birthInfo.isLeapMonth,
      civilSolar: solar.toYmdHms().slice(0, 16),
    },
  };
}

/** 该农历年是否有闰月，返回闰的是几月，无闰月返回 0。 */
export function leapMonthOfYear(lunarYear: number): number {
  return LunarYear.fromYear(lunarYear).getLeapMonth();
}

/** 农历某月（含闰月）的实际天数，29 或 30。月越界时返回 0，供表单拦截。 */
export function lunarDayCount(lunarYear: number, lunarMonth: number, isLeapMonth?: boolean): number {
  const m = LunarMonth.fromYm(lunarYear, signedMonth(lunarMonth, isLeapMonth));
  return m ? m.getDayCount() : 0;
}
