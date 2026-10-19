import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GANZHI_BASIS, NAJIA_BASIS } from '../core';
import type { LiuyaoResult, YaoRecord, CoinCommitment, QuestionType, NaJiaYao } from '@/types/liuyao';

export function buildCoinResult(params: {
  question: string;
  questionType: QuestionType;
  records: YaoRecord[];
  now: Date;
  /** 这一卦用的随机承诺。缺它就没有承诺（老页面或未锁定路径），不猜、不补。 */
  randomness?: CoinCommitment;
}): LiuyaoResult {
  const { question, questionType, records, now, randomness } = params;
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
    ...(randomness ? { randomness } : {}),
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
