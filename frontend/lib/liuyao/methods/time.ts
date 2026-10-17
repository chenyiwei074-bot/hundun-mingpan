import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GANZHI_BASIS } from '../core';
import { qiGuaByTime } from '@/lib/meihua/engine';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType } from '@/types/liuyao';

/**
 * 时间起卦装成六爻盘。取数是梅花易数那一条传统口径：
 * 上卦 =（年支序 + 农历月 + 农历日）mod 8，下卦 = 再加时辰序 mod 8，动爻 = 同一个和 mod 6，余 0 不作 0 按满数计。
 *
 * 公式只有 `lib/meihua/engine.ts` 一份，这里直接调它的 `qiGuaByTime`，
 * 只把 卦 + 动爻 译成六爻要的 6/7/8/9 爻值：动爻那一爻取老（阳→9 阴→6），其余取少（阳→7 阴→8）。
 * 梅花页面同一次调用顺手带回取数过程与口径（`qiShu`），六爻盘面原样列出，两条页面不会各说各话。
 *
 * 年界按**农历年（正月初一）**，2026-10-17 裁定，开关在 `qiGuaByTime` 里那一行；
 * 改立春要与后端 `server/src/core/liuyao/constants.ts` 的 timeQiGua 同改（两处不同改就会出现同一时刻两个盘）。
 * 23 时属晚子时：农历日按次日计，与站点夜子时口径、`calcGanZhi` 的日柱同一条规则。
 * 闰月按本数月计入。时刻若已按真太阳时校正过，进来的就是校正后的 Date，取数跟着走。
 */
export function buildTimeResult(params: {
  question: string;
  questionType: QuestionType;
  date?: Date;
}): LiuyaoResult {
  const now = params.date || new Date();
  const mh = qiGuaByTime(now);
  const vals: number[] = mh.ben.lines.map((line, i) =>
    i + 1 === mh.dongYao ? (line ? 9 : 6) : (line ? 7 : 8));
  const recs: YaoRecord[] = [];
  vals.forEach((v, i) => {
    const hua = v === 7 ? 1 : v === 8 ? 2 : v === 6 ? 0 : 3;
    const faces: CoinFace[] = [];
    for (let j = 0; j < 3; j++) faces.push(j < hua ? '花' : '字' as CoinFace);
    recs.push({ position: i + 1, coins: faces, value: v, label: v === 7 ? '少阳' : v === 8 ? '少阴' : v === 6 ? '老阴' : '老阳', isDong: v === 6 || v === 9 });
  });

  const gua = getGua(vals);
  const { gong } = getPalaceGong(gua.ben);
  const shiYing = getShiYing(gua.ben);
  const dayGZ = getDayGanZhi(now);
  const monthGZ = getMonthGanZhi(now);
  const xunKong = getXunKong(dayGZ.ganIdx, dayGZ.zhiIdx);
  const naJia = getNaJia(gua.ben, gua.shangGua, gua.xiaGua, vals, xunKong);

  // 变卦：时间起卦动爻唯一，翻转那一爻即可。上下卦仍由同一条 getGua 得出，
  // 与卦名同一套位序口径（初爻在 index 0，上卦占 index 3-5）。
  const bv = vals.map(v => (v === 6 ? 7 : v === 9 ? 8 : v));
  const bian = gua.bian ? getGua(bv) : null;
  const bianNaJia = gua.bian && bian
    ? getNaJia(gua.bian, bian.shangGua, bian.xiaGua, bv, xunKong)
    : [];
  const bianPalace = gua.bian ? getPalaceGong(gua.bian) : null;

  return {
    id: 'time_' + Date.now().toString(36),
    method: 'time',
    question: params.question,
    questionType: params.questionType,
    date: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() },
    ganZhi: {
      year: getYearGanZhi(now),
      month: monthGZ,
      day: dayGZ.gan + dayGZ.zhi,
      hour: getHourGanZhi(dayGZ.ganIdx, now.getHours()),
    },
    dayGZ,
    monthZhi: monthGZ.slice(-1),
    xunKong,
    ganzhiBasis: GANZHI_BASIS,
    qiShu: { steps: mh.steps, basis: mh.qiShuBasis },
    benGua: { name: gua.ben, gong, wuxing: WX[gong], shangGua: gua.shangGua, xiaGua: gua.xiaGua },
    bianGua: gua.bian && bianPalace
      ? { name: gua.bian, gong: bianPalace.gong, wuxing: WX[bianPalace.gong] }
      : { name: null, gong: null, wuxing: null },
    yaoRecords: recs,
    naJia,
    bianNaJia,
    dongYao: gua.dong,
    shiYing,
    liuShen: getLiuShen(dayGZ.ganIdx),
  };
}
