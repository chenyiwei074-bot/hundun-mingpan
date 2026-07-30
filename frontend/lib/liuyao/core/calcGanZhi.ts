import { GAN, ZHI, YUE_GAN_START } from './constants';

export function getDayGanZhi(date: Date): { gan:string;zhi:string;ganIdx:number;zhiIdx:number } {
  const ref = new Date(2000,0,1);
  const days = Math.floor((date.getTime()-ref.getTime())/86400000);
  const gi = ((0+days)%10+10)%10, zi = ((6+days)%12+12)%12;
  return {gan:GAN[gi],zhi:ZHI[zi],ganIdx:gi,zhiIdx:zi};
}

export function getYearGanZhi(y:number): string { return GAN[(y-4)%10]+ZHI[(y-4)%12]; }

export function getMonthGanZhi(y:number,m:number): string {
  const mz = m%12;
  const yg = (y-4)%10;
  const sg = YUE_GAN_START[yg]??2;
  return GAN[(sg+(mz-2+12)%12)%10]+ZHI[mz];
}

export function getHourGanZhi(dg:number,h:number): string {
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
  const LIUSHEN_NAMES = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];
  return Array.from({length:6},(_,i)=>LIUSHEN_NAMES[(s+i)%6]);
}
