import { Solar } from 'lunar-typescript';
import { GAN, ZHI, LIUSHEN_NAMES } from './constants';

// 干支口径与八字页统一：年柱以立春为界，月柱以「节」为界，日柱以 23:00 归次日（夜子时 ZI_HOUR_23）。
// 因此年月都必须由具体日期算出，不能只喂公历年/月数字。
// 六爻时间层只有这一处真相：不要改回吃 app/lib/core/liuyao/constants.ts —— 那份月建按公历月近似，
// 也没有立春年界与节气覆盖入口，换回去等于同时废掉 A2（月建按节气）与 A3（年柱按立春）。
// 起卦结果里带上口径版本，老盘（无此字段）只标注、不重算——重跑覆盖历史等于伪造。
export const GANZHI_BASIS = 'jieqi-lichun-v1';

function lunarOf(date: Date) {
  return Solar.fromYmdHms(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ).getLunar();
}

export function getDayGanZhi(date: Date): { gan:string;zhi:string;ganIdx:number;zhiIdx:number } {
  const gz = lunarOf(date).getDayInGanZhiExact();
  const gan = gz.charAt(0), zhi = gz.charAt(1);
  return { gan, zhi, ganIdx: GAN.indexOf(gan), zhiIdx: ZHI.indexOf(zhi) };
}

export function getYearGanZhi(date: Date): string {
  return lunarOf(date).getYearInGanZhiExact();
}

export function getMonthGanZhi(date: Date): string {
  return lunarOf(date).getMonthInGanZhiExact();
}

export function getHourGanZhi(dg:number,h:number): string {
  // 五鼠遁：甲己日起甲子时。dg 必须已是 23:00 归次日后的日干。
  const hz = Math.floor((h+1)/2)%12;
  return GAN[(dg*2+hz)%10]+ZHI[hz];
}

export function getXunKong(dg:number,dz:number): string {
  const jz = (dz-dg+12)%12;
  return ZHI[(jz+10)%12]+ZHI[(jz+11)%12];
}

export function getLiuShen(dg:number): string[] {
  const sm:Record<number,number>={0:0,1:0,2:1,3:1,4:2,5:3,6:4,7:4,8:5,9:5};
  const s = sm[dg]??0;
  return Array.from({length:6},(_,i)=>LIUSHEN_NAMES[(s+i)%6]);
}
