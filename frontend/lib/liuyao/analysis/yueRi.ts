// 日月建分析 — 月建、日辰对各爻的详细影响

import type { NaJiaYao } from '@/types/liuyao';

const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ZHI_WX: Record<string,string> = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水',
};

const WX_SHENG: Record<string,string> = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
const WX_KE: Record<string,string> = { '木':'土','土':'水','水':'火','火':'金','金':'木' };

export interface YaoMonthDayRelation {
  position: number;
  zhi: string;
  wuxing: string;
  monthZhi: string;
  monthWx: string;
  monthRelation: '临'|'生'|'泄'|'耗'|'克'|'—';
  monthDetail: string;
  dayZhi: string;
  dayWx: string;
  dayRelation: '值'|'生'|'泄'|'克'|'—';
  dayDetail: string;
}

function getMonthRelation(yaoWx: string, monthWx: string): YaoMonthDayRelation['monthRelation'] {
  if (yaoWx === monthWx) return '临';
  if (WX_SHENG[monthWx] === yaoWx) return '生';
  if (WX_SHENG[yaoWx] === monthWx) return '泄';
  if (WX_KE[yaoWx] === monthWx) return '耗';
  if (WX_KE[monthWx] === yaoWx) return '克';
  return '—';
}

function getDayRelation(yaoWx: string, dayWx: string): YaoMonthDayRelation['dayRelation'] {
  if (yaoWx === dayWx) return '值';
  if (WX_SHENG[dayWx] === yaoWx) return '生';
  if (WX_SHENG[yaoWx] === dayWx) return '泄';
  if (WX_KE[dayWx] === yaoWx) return '克';
  return '—';
}

export function analyzeMonthDayRelation(
  naJia: NaJiaYao[],
  monthZhi: string,
  dayZhiIdx: number
): YaoMonthDayRelation[] {
  const dayZhi = ZHI[dayZhiIdx] || '子';
  const monthWx = ZHI_WX[monthZhi] || '土';
  const dayWx = ZHI_WX[dayZhi] || '土';

  return naJia.map(y => {
    const yaoWx = ZHI_WX[y.naZhi] || '?';
    const mRel = getMonthRelation(yaoWx, monthWx);
    const dRel = getDayRelation(yaoWx, dayWx);

    const mDetailMap: Record<string,string> = {
      '临': `临月建${monthZhi}，当令最旺`,
      '生': `月建${monthZhi}(${monthWx})生${yaoWx}，得气相`,
      '泄': `${yaoWx}生月建${monthZhi}(${monthWx})，泄气体`,
      '耗': `${yaoWx}耗月建土气，囚`,
      '克': `月建${monthZhi}(${monthWx})克${yaoWx}，受克死`,
      '—': '—',
    };

    const dDetailMap: Record<string,string> = {
      '值': `临日辰${dayZhi}，得日建旺助`,
      '生': `日辰${dayZhi}(${dayWx})生${yaoWx}`,
      '泄': `${yaoWx}生日辰${dayZhi}(${dayWx})，泄气`,
      '克': `日辰${dayZhi}(${dayWx})克${yaoWx}，受克`,
      '—': '—',
    };

    return {
      position: y.position,
      zhi: y.naZhi,
      wuxing: yaoWx,
      monthZhi,
      monthWx,
      monthRelation: mRel,
      monthDetail: mDetailMap[mRel],
      dayZhi,
      dayWx,
      dayRelation: dRel,
      dayDetail: dDetailMap[dRel],
    };
  });
}