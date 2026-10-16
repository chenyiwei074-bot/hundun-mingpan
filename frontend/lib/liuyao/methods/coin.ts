import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GUA_MAP, GANZHI_BASIS } from '../core';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType, NaJiaYao } from '@/types/liuyao';

export function coinToss(): CoinFace[] {
  return [Math.random()>.5?'字':'花', Math.random()>.5?'字':'花', Math.random()>.5?'字':'花'];
}

function calcYao(coins: CoinFace[]): { value: number; label: string; isDong: boolean } {
  const hua = coins.filter(c => c === '花').length;
  if (hua === 0) return { value: 6, label: '老阴', isDong: true };
  if (hua === 1) return { value: 7, label: '少阳', isDong: false };
  if (hua === 2) return { value: 8, label: '少阴', isDong: false };
  return { value: 9, label: '老阳', isDong: true };
}

export function buildCoinResult(params: {
  question: string;
  questionType: QuestionType;
  records: YaoRecord[];
  now: Date;
}): LiuyaoResult {
  const { question, questionType, records, now } = params;
  const values = records.map(r => r.value);
  const gua = getGua(values);
  const { gong } = getPalaceGong(gua.ben);
  const shiYing = getShiYing(gua.ben);
  const dayGZ = getDayGanZhi(now);
  const monthGZ = getMonthGanZhi(now);
  const xunKong = getXunKong(dayGZ.ganIdx, dayGZ.zhiIdx);
  const naJia = getNaJia(gua.ben, gua.shangGua, gua.xiaGua, values, xunKong);
  let bianNaJia: NaJiaYao[] = [];
  if (gua.bian) {
    const bv = records.map(r => r.isDong ? (r.value === 6 ? 7 : 8) : r.value);
    const bsBits = bv.slice(3).map(v => v===7||v===9?'1':'0').join('');
    const bxBits = bv.slice(0,3).map(v => v===7||v===9?'1':'0').join('');
    const bs = GUA_MAP[bsBits]||'?', bx = GUA_MAP[bxBits]||'?';
    bianNaJia = getNaJia(gua.bian!, bs, bx, bv, xunKong);
  }
  const bianGong = gua.bian ? getPalaceGong(gua.bian) : null;

  return {
    id: 'coin_'+Date.now().toString(36),
    method: 'coin',
    question,
    questionType,
    date: { year:now.getFullYear(), month:now.getMonth()+1, day:now.getDate(), hour:now.getHours(), minute:now.getMinutes() },
    ganZhi: {
      year: getYearGanZhi(now),
      month: monthGZ,
      day: dayGZ.gan+dayGZ.zhi,
      hour: getHourGanZhi(dayGZ.ganIdx, now.getHours()),
    },
    dayGZ,
    monthZhi: monthGZ.slice(-1),
    xunKong,
    ganzhiBasis: GANZHI_BASIS,
    benGua: { name: gua.ben, gong, wuxing: WX[gong], shangGua: gua.shangGua, xiaGua: gua.xiaGua },
    bianGua: gua.bian ? { name: gua.bian, gong: bianGong?.gong||null, wuxing: bianGong ? WX[bianGong.gong] : null } : { name:null, gong:null, wuxing:null },
    yaoRecords: records,
    naJia,
    bianNaJia,
    dongYao: gua.dong,
    shiYing,
    liuShen: getLiuShen(dayGZ.ganIdx),
  };
}
