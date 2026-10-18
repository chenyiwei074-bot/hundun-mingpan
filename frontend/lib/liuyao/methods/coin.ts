import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GANZHI_BASIS, NAJIA_BASIS } from '../core';
import { randomBits } from '@/lib/crypto/random';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType, NaJiaYao } from '@/types/liuyao';

/** 三枚各取 1 bit：1 = 花，0 = 字。站里唯一的掷钱实现，页面不得再自己拼一遍。 */
export function coinToss(): CoinFace[] {
  return randomBits(3).map(b => (b ? '花' : '字') as CoinFace);
}

/** 花数 → 爻值（0 花老阴动、1 少阳、2 少阴、3 花老阳动）。同样只此一份。 */
export function calcYao(coins: CoinFace[]): { value: number; label: string; isDong: boolean } {
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
    // 变卦的上下卦要由同一份 getGua 从变卦爻值推出，不能自己按位串拼：
    // GUA_MAP 的键是「上爻在前」的读法，slice(3) 却是「四爻在前」，两处相反，
    // 64 卦 × 6 动爻里有 288 例把变卦的上下卦认反（对拍见 tools/liuyao-ganzhi/acceptance.ts §8.10）。
    const bg = getGua(bv);
    bianNaJia = getNaJia(gua.bian!, bg.shangGua, bg.xiaGua, bv, xunKong);
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
    najiaBasis: NAJIA_BASIS,
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
