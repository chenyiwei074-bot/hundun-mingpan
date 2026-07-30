import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX } from '../core';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType } from '@/types/liuyao';

export function buildTimeResult(params: {
  question: string;
  questionType: QuestionType;
  date?: Date;
}): LiuyaoResult {
  const now = params.date || new Date();
  const y2=now.getFullYear()%100, m2=now.getMonth()+1, d2=now.getDate(), h2=now.getHours();
  const vals: number[] = [];
  for(let i=0;i<6;i++){ const s=(y2+m2+d2+h2+i*7+13)%4; vals.push(s===0?6:s===1?7:s===2?8:9); }
  const recs: YaoRecord[] = [];
  vals.forEach((v,i)=>{
    const hua=v===7?1:v===8?2:v===6?0:3;
    const fakes: CoinFace[]=[];
    for(let j=0;j<3;j++)fakes.push(j<hua?'花':'字' as CoinFace);
    recs.push({position:i+1,coins:fakes,value:v,label:v===7?'少阳':v===8?'少阴':v===6?'老阴':'老阳',isDong:v===6||v===9});
  });

  const gua = getGua(vals);
  const { gong } = getPalaceGong(gua.ben);
  const shiYing = getShiYing(gua.ben);
  const dayGZ = getDayGanZhi(now);
  const naJia = getNaJia(gua.ben, gua.shangGua, gua.xiaGua, vals);

  return {
    id: 'time_'+Date.now().toString(36),
    method: 'time',
    question: params.question,
    questionType: params.questionType,
    date: { year:now.getFullYear(), month:now.getMonth()+1, day:now.getDate(), hour:now.getHours(), minute:now.getMinutes() },
    ganZhi: {
      year: getYearGanZhi(now.getFullYear()),
      month: getMonthGanZhi(now.getFullYear(), now.getMonth()+1),
      day: dayGZ.gan+dayGZ.zhi,
      hour: getHourGanZhi(dayGZ.ganIdx, now.getHours()),
    },
    dayGZ,
    monthZhi: getMonthGanZhi(now.getFullYear(), now.getMonth()+1).slice(-1),
    xunKong: getXunKong(dayGZ.ganIdx, dayGZ.zhiIdx),
    benGua: { name: gua.ben, gong, wuxing: WX[gong], shangGua: gua.shangGua, xiaGua: gua.xiaGua },
    bianGua: { name:null, gong:null, wuxing:null },
    yaoRecords: recs,
    naJia,
    bianNaJia: [],
    dongYao: gua.dong,
    shiYing,
    liuShen: getLiuShen(dayGZ.ganIdx),
  };
}
