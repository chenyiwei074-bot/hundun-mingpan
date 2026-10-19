import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GANZHI_BASIS, NAJIA_BASIS } from '../core';
import { qiGuaByNumbers, QISHU_BASIS } from '@/lib/meihua/engine';
import { randomToken } from '@/lib/crypto/random';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType } from '@/types/liuyao';

/**
 * 报数起卦装成六爻盘。取数只有 `lib/meihua/engine.ts` 的 `qiGuaByNumbers` 一份：
 * 上卦 = 第一个数 mod 8、下卦 = 第二个数 mod 8、动爻 = 两数之和 mod 6，余 0 不作 0 按满数计（乾一 兑二 … 坤八）。
 *
 * 2026-10-18 裁定与梅花同源。修前本文件把「先天数序号的二进制」当爻象（乾 idx0→000、坤 idx7→111），
 * 卦名却按上下卦查表，于是 64 张盘报名一套、画出来的爻另一套 —— 名与象必须同源，不许名一套象一套。
 * 现在这里只把梅花那份 0/1 爻象 + 动爻译成六爻要的 6/7/8/9（动爻取老 阳→9 阴→6，静爻取少 阳→7 阴→8），
 * 卦名 / 上下卦 / 变卦 / 纳甲 / 世应 / 宫 全部由这一份爻象经 `getGua` 推出，不再另查一次 S64。
 * 取数过程与口径同 `qiGuaByTime` 一样随盘带回（`qiShu`），六爻盘面与梅花页面不会各说各话；
 * 若朋友另有取法，改 engine 那一处即可，本文件跟着一起变。
 *
 * 老盘不重排（A4）：修前的报数盘留在用户会话里，爻象是错的那一份，本批不回填、不重算，
 * 只由 `qiShu.version` 认出口径，结果页标「本盘按起卦时口径生成」。
 * 报数是两数之和定动爻，所以对同一组上下卦，可达的动爻只有与 (n1+n2) 同奇偶的那三个 ——
 * 六个动爻全覆盖由摇卦那条路径负责。
 */
export function buildNumberResult(params: {
  question: string;
  questionType: QuestionType;
  nums: number[];
  now?: Date;
}): LiuyaoResult {
  const now = params.now || new Date();
  const mh = qiGuaByNumbers(params.nums, 'number');
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

  // 变卦：报数动爻唯一，翻转那一爻即可。上下卦仍由同一条 getGua 得出，
  // 与卦名同一套位序口径（初爻在 index 0，上卦占 index 3-5）。
  const bv = vals.map(v => (v === 6 ? 7 : v === 9 ? 8 : v));
  const bian = gua.bian ? getGua(bv) : null;
  const bianNaJia = gua.bian && bian
    ? getNaJia(gua.bian, bian.shangGua, bian.xiaGua, bv, xunKong)
    : [];
  const bianPalace = gua.bian ? getPalaceGong(gua.bian) : null;

  return {
    id: 'num_' + Date.now().toString(36) + randomToken(6),
    method: 'number',
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
    najiaBasis: NAJIA_BASIS,
    qiShu: { steps: mh.steps, basis: mh.qiShuBasis, version: QISHU_BASIS },
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
