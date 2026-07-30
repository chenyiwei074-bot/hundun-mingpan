// 增强旺衰分析 — 月建 + 日辰 + 动爻 + 生克综合

import { WX as CORE_WX } from '@/lib/liuyao/core';
import type { NaJiaYao } from '@/types/liuyao';

// ══ 基础常量 ══

const WX_SHENG: Record<string,string> = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
const WX_KE: Record<string,string> = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
const ZHI_WX: Record<string,string> = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水',
};

export type WangShuaiLevel = '旺'|'相'|'休'|'囚'|'死';

export interface WangShuaiDetail {
  position: number;
  zhi: string;
  wuxing: string;
  level: WangShuaiLevel;
  monthInfluence: string;   // 月建影响说明
  dayInfluence: string;     // 日辰影响说明
  dongYaoInfluence: string; // 动爻影响说明
  reasons: string[];        // 综合理由
}

// ══ 月建旺衰 ══
function getMonthLevel(yaoWx: string, monthZhi: string): WangShuaiLevel {
  const moonWx = ZHI_WX[monthZhi] || '土';
  if (yaoWx === moonWx) return '旺';
  if (WX_SHENG[moonWx] === yaoWx) return '相';
  if (WX_SHENG[yaoWx] === moonWx) return '休';
  if (WX_KE[yaoWx] === moonWx) return '囚';
  return '死';
}

function monthExplain(yaoWx: string, monthZhi: string): string {
  const moonWx = ZHI_WX[monthZhi] || '土';
  if (yaoWx === moonWx) return `临月建${monthZhi}，当令而旺`;
  if (WX_SHENG[moonWx] === yaoWx) return `月建${monthZhi}(${moonWx})生${yaoWx}，得月气相`;
  if (WX_SHENG[yaoWx] === moonWx) return `${yaoWx}生月建${monthZhi}(${moonWx})，泄气而休`;
  if (WX_KE[yaoWx] === moonWx) return `${yaoWx}克月建${monthZhi}(${moonWx})，犯上而囚`;
  return `月建${monthZhi}(${moonWx})克${yaoWx}，受克而死`;
}

// ══ 日辰影响 ══
function dayExplain(yaoWx: string, dayZhi: string): string {
  const dayWx = ZHI_WX[dayZhi] || '土';
  if (dayWx === yaoWx) return `日辰${dayZhi}临值，得日建旺助`;
  if (WX_SHENG[dayWx] === yaoWx) return `日辰${dayZhi}(${dayWx})生${yaoWx}，日建相生`;
  if (WX_KE[dayWx] === yaoWx) return `日辰${dayZhi}(${dayWx})克${yaoWx}，受日建克制`;
  if (WX_SHENG[yaoWx] === dayWx) return `${yaoWx}生日辰${dayZhi}(${dayWx})，向日泄气`;
  return `—`;
}

// ══ 动爻影响 ══
function dongYaoExplain(
  pos: number, yaoWx: string, yaoZhi: string,
  allYao: { position:number; isDong:boolean; naZhi:string; liuQin:string }[],
  WX: Record<string,string>
): string {
  const dongList = allYao.filter(y => y.isDong && y.position !== pos);
  if (dongList.length === 0) return '—';

  const influences: string[] = [];
  for (const dy of dongList) {
    const dw = WX[dy.naZhi] || '?';
    if (WX_SHENG[dw] === yaoWx) influences.push(`动爻${dy.position}(${dy.naZhi})生我`);
    else if (WX_KE[dw] === yaoWx) influences.push(`动爻${dy.position}(${dy.naZhi})克我`);
    else if (WX_SHENG[yaoWx] === dw) influences.push(`我生动爻${dy.position}(${dy.naZhi})`);
    else if (WX_KE[yaoWx] === dw) influences.push(`我克动爻${dy.position}(${dy.naZhi})`);
    else influences.push(`动爻${dy.position}(${dy.naZhi})比和`);
  }
  return influences.join('；');
}

// ══ 综合旺衰 ══
export function analyzeWangShuaiEnhanced(
  naJia: (NaJiaYao & { liuQin:string })[],
  monthZhi: string,
  dayZhi: string,
  WX?: Record<string,string>
): WangShuaiDetail[] {
  const wx = WX || (CORE_WX as Record<string,string>);

  return naJia.map(y => {
    const yaoWx = wx[y.naZhi] || '?';
    const mLevel = getMonthLevel(yaoWx, monthZhi);
    const mExp = monthExplain(yaoWx, monthZhi);
    const dExp = dayExplain(yaoWx, dayZhi);
    const dongExp = dongYaoExplain(y.position, yaoWx, y.naZhi, naJia, wx);

    // 综合判断：月建为主，日辰为调
    let level = mLevel;
    const dayWx = ZHI_WX[dayZhi] || '土';
    // 日辰生扶可提升一级
    if (WX_SHENG[dayWx] === yaoWx && (mLevel === '休' || mLevel === '囚')) level = '相';
    if (dayWx === yaoWx && mLevel !== '旺') level = '旺';
    // 日辰克制可降一级
    if (WX_KE[dayWx] === yaoWx && mLevel === '旺') level = '相';

    const reasons = [mExp];
    if (dExp !== '—') reasons.push(dExp);
    if (dongExp !== '—') reasons.push(dongExp);

    return {
      position: y.position,
      zhi: y.naZhi,
      wuxing: yaoWx,
      level,
      monthInfluence: mExp,
      dayInfluence: dExp,
      dongYaoInfluence: dongExp,
      reasons,
    };
  });
}

// ══ 保留兼容旧接口 ══
export function analyzeWangShuai(
  naJia: { naZhi:string }[],
  monthZhi: string,
  dayGZ: { ganIdx:number; zhiIdx:number },
  WX: Record<string,string>
): { wangShuai: WangShuaiLevel; monthInfluence: string; dayInfluence: string }[] {
  const dayZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][dayGZ.zhiIdx] || '子';
  return naJia.map(n => {
    const wx = WX[n.naZhi] || '?';
    return {
      wangShuai: getMonthLevel(wx, monthZhi),
      monthInfluence: '月建' + ZHI_WX[monthZhi] + '·' + getMonthLevel(wx, monthZhi),
      dayInfluence: dayExplain(wx, dayZhi) === '—' ? '—' : dayExplain(wx, dayZhi),
    };
  });
}