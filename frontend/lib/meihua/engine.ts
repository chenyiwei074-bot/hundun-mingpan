// 梅花易数：时间 / 数字 / 报数 三法起卦，体用生克取断。
//
// 表格全部复用站里已在跑的六爻内核（GUA_MAP / S64 / WX / ZHI），不再抄第四份 64 卦表。
// 线位约定与 lib/liuyao/core/getGua.ts 相同：lines[0] = 初爻 … lines[5] = 上爻，1 阳 0 阴。
// 金标准自检：观梅占（辰年十二月十七日申时）→ 泽火革·初爻动·变泽山咸·互天风姤·体兑用离。

import { Solar } from 'lunar-typescript';
import { GUA_MAP, S64, WX, ZHI } from '@/lib/liuyao/core';

export type MeiHuaMethod = 'time' | 'number' | 'report';

/** 先天八卦数：乾一 兑二 离三 震四 巽五 坎六 艮七 坤八。 */
export const XIANTIAN = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/**
 * 取数口径版本戳（additive）。改本文件里任何一条取法公式（时间 / 数字 / 报数）就升一位：
 * 六爻盘把它写进 `qiShu.version`，缺这个字段的盘就是升位之前起的，结果页只标注不重排（A4 裁定）。
 * 与 `GANZHI_BASIS` / `NAJIA_BASIS` 同一套历史盘处理方式，只是这份跟着取数公式走，所以放在公式旁边。
 */
export const QISHU_BASIS = 'meihua-qishu-v1';

/** 卦名 → [初,中,上]。从 GUA_MAP 的「上中初」键反推，省掉一份手抄表，也抄不错。 */
const TRIGRAM_LINES: Record<string, [number, number, number]> = {};
for (const [bits, name] of Object.entries(GUA_MAP)) {
  TRIGRAM_LINES[name] = [Number(bits[2]), Number(bits[1]), Number(bits[0])];
}

const TRIGRAM_SYMBOL: Record<string, string> = {
  乾: '☰', 兑: '☱', 离: '☲', 震: '☳', 巽: '☴', 坎: '☵', 艮: '☶', 坤: '☷',
};

/** 《说卦传》象义，公版基础概念，不含任何站点的解读文案。 */
const TRIGRAM_IMAGE: Record<string, { nature: string; person: string; direction: string; motion: string }> = {
  乾: { nature: '天', person: '父 / 长者', direction: '西北', motion: '刚而自上' },
  兑: { nature: '泽', person: '少女', direction: '西', motion: '说而外显' },
  离: { nature: '火', person: '中女', direction: '南', motion: '明而急促' },
  震: { nature: '雷', person: '长男', direction: '东', motion: '动而先发' },
  巽: { nature: '风', person: '长女', direction: '东南', motion: '进退不定' },
  坎: { nature: '水', person: '中男', direction: '北', motion: '流转不息' },
  艮: { nature: '山', person: '少男', direction: '东北', motion: '止而难行' },
  坤: { nature: '地', person: '母 / 众', direction: '西南', motion: '载而迟缓' },
};

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

export type Guanxi = '用生体' | '体用比和' | '体克用' | '体生用' | '用克体';

/** 他卦五行相对体卦五行的作用关系。 */
export function relate(tiWx: string, otherWx: string): Guanxi {
  if (tiWx === otherWx) return '体用比和';
  if (SHENG[otherWx] === tiWx) return '用生体';
  if (KE[otherWx] === tiWx) return '用克体';
  if (SHENG[tiWx] === otherWx) return '体生用';
  return '体克用';
}

/**
 * 评分权重：本模型为自研，非还原。
 * 两家站点没有公开它们的评分权重，也没有拿到过它们的任何数值，
 * 这里是一套可读的自定义刻度，只用来排序倾向，不当作结论。
 */
const SCORE_BASE: Record<Guanxi, number> = { 用生体: 26, 体用比和: 18, 体克用: 8, 体生用: -8, 用克体: -24 };
const SCORE_ADJ: Record<Guanxi, number> = { 用生体: 6, 体用比和: 3, 体克用: 2, 体生用: -3, 用克体: -8 };

const GUAXIANG_TEXT: Record<Guanxi, string> = {
  用生体: '外来之势向我，宜主动承接，不必一个人硬扛。',
  体用比和: '两卦同气，谋事少阻，同路人能搭把手。',
  体克用: '事可为，但得自己着力去拿，不是坐收。',
  体生用: '精力往外输，先耗后成，投入要设个上限。',
  用克体: '压力来自外面，硬顶不如先避让，另择时机。',
};

export interface TrigramInfo {
  name: string;
  symbol: string;
  wuxing: string;
  nature: string;
  person: string;
  direction: string;
  motion: string;
}

export interface HexagramInfo {
  name: string;
  shangGua: string;
  xiaGua: string;
  lines: number[];
}

export interface MeiHuaResult {
  method: MeiHuaMethod;
  /** 动爻位次，自下数 1..6。 */
  dongYao: number;
  ben: HexagramInfo;
  hu: HexagramInfo;
  bian: HexagramInfo;
  ti: TrigramInfo;
  yong: TrigramInfo;
  relation: Guanxi;
  huRelation: Guanxi;
  bianRelation: Guanxi;
  /** 互卦两元卦之名。与体卦同位者为体互（断法为主），另一位为用互。 */
  huTi: string;
  huYong: string;
  score: number;
  level: string;
  /** 取数过程，逐条可复算。 */
  steps: string[];
  /** 口径声明，页面上原样列出（含断卦通则）。 */
  basis: string[];
  /** 只有起卦取数那几条口径，不含断卦通则 —— 六爻盘面引用这份，不会把梅花体用规则带过去。 */
  qiShuBasis: string[];
  readings: { label: string; text: string }[];
  when?: {
    civil: string;
    lunar: string;
    nianZhi: string;
    shiZhi: string;
    advancedForLateZi: boolean;
  };
}

export function trigramInfo(name: string): TrigramInfo {
  const image = TRIGRAM_IMAGE[name] || { nature: '', person: '', direction: '', motion: '' };
  return {
    name,
    symbol: TRIGRAM_SYMBOL[name] || '?',
    wuxing: WX[name] || '?',
    ...image,
  };
}

/** 起卦取数：余数为 0 不作 0，按满数计（卦 8、爻 6）。 */
const mod = (n: number, m: number) => {
  const r = n % m;
  return r === 0 ? m : r;
};
const mod8 = (n: number) => mod(n, 8);
const mod6 = (n: number) => mod(n, 6);
/** 余数为 0 时按满数计（卦作 8、爻作 6），写进过程时要把这条规则显示出来。 */
const remainder = (n: number, m: number) => `${n % m}${n % m === 0 ? `（整除作 ${m}）` : ''}`;

function buildFromTrigrams(
  shangGua: string,
  xiaGua: string,
  dongYao: number,
): { ben: HexagramInfo; hu: HexagramInfo; bian: HexagramInfo } {
  const lines = [...TRIGRAM_LINES[xiaGua], ...TRIGRAM_LINES[shangGua]];
  const nameOf = (ls: number[]): HexagramInfo => {
    const s = GUA_MAP[`${ls[5]}${ls[4]}${ls[3]}`] || '?';
    const x = GUA_MAP[`${ls[2]}${ls[1]}${ls[0]}`] || '?';
    return { name: S64[s + x] || s + x, shangGua: s, xiaGua: x, lines: ls };
  };
  const ben = nameOf(lines);
  // 互卦：2/3/4 爻作下卦，3/4/5 爻作上卦。
  const hu = nameOf([lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]]);
  const bianLines = [...lines];
  bianLines[dongYao - 1] ^= 1;
  return { ben, hu, bian: nameOf(bianLines) };
}

function finish(
  method: MeiHuaMethod,
  shangGua: string,
  xiaGua: string,
  dongYao: number,
  steps: string[],
  basis: string[],
  when?: MeiHuaResult['when'],
): MeiHuaResult {
  const { ben, hu, bian } = buildFromTrigrams(shangGua, xiaGua, dongYao);
  // 动爻在下卦（1..3）则下卦为用、上卦为体；在上卦（4..6）反之。
  const tiName = dongYao <= 3 ? shangGua : xiaGua;
  const yongName = dongYao <= 3 ? xiaGua : shangGua;
  const ti = trigramInfo(tiName);
  const yong = trigramInfo(yongName);
  const relation = relate(ti.wuxing, yong.wuxing);
  // 互卦分体互/用互：体卦在内（下卦）则二三四爻之下互为体互，体卦在外（上卦）则三四五爻之上互为体互，断法以体互为主。
  const huTi = dongYao <= 3 ? hu.shangGua : hu.xiaGua;
  const huYong = dongYao <= 3 ? hu.xiaGua : hu.shangGua;
  // 变卦取用卦因动爻变出之卦。
  const bianYong = dongYao <= 3 ? bian.xiaGua : bian.shangGua;
  const huRelation = relate(ti.wuxing, WX[huTi] || '?');
  const huYongRelation = relate(ti.wuxing, WX[huYong] || '?');
  const bianRelation = relate(ti.wuxing, WX[bianYong] || '?');
  const raw = 50 + SCORE_BASE[relation] + SCORE_ADJ[huRelation] + SCORE_ADJ[bianRelation];
  const score = Math.max(4, Math.min(96, raw));
  const level = score >= 72 ? '顺' : score >= 58 ? '偏顺' : score >= 44 ? '平稳' : score >= 30 ? '偏逆' : '逆';

  const huImg = trigramInfo(huTi);
  const readings = [
    { label: `体用｜${relation}`, text: GUAXIANG_TEXT[relation] },
    {
      label: `互卦｜${hu.name}`,
      text: `事之中段以体互${huTi}（${WX[huTi]}）为主，与体卦成${huRelation}；用互${huYong}（${WX[huYong]}）与体卦成${huYongRelation}。${huImg.nature}主${huImg.motion}。`,
    },
    {
      label: `变卦｜${bian.name}`,
      text: `动爻既变，${yong.name}化为${bianYong}（${WX[bianYong]}），与体卦成${bianRelation}，是这件事的归结处。`,
    },
    {
      label: `体卦｜${ti.name}${ti.symbol}`,
      text: `体为自身，属${ti.wuxing}，象${ti.nature}，于人${ti.person}，方位${ti.direction}。`,
    },
    {
      label: `用卦｜${yong.name}${yong.symbol}`,
      text: `用为所对之事与外来力量，属${yong.wuxing}，象${yong.nature}，于人${yong.person}，方位${yong.direction}。`,
    },
  ];

  // 断卦口径三种起卦法共用，在这里追加，三条路径不会各说各话。
  const ruledBasis = basis.concat(
    '体用按动爻定：动爻所在之卦为用，另一卦为体。',
    '互卦以体互为主 —— 体卦在内取二三四爻之下互，体卦在外取三四五爻之上互；变卦取用卦因动爻变出之卦。',
  );

  return {
    method, dongYao, ben, hu, bian, ti, yong,
    relation, huRelation, bianRelation, huTi, huYong, score, level,
    steps, basis: ruledBasis, qiShuBasis: basis, readings, when,
  };
}

/** 地支序数：子 1 … 亥 12，起卦取数用。 */
const zhiNumber = (zhi: string) => ZHI.indexOf(zhi) + 1;

/** 时间起卦的年界口径：农历正月初一，或交立春时刻。 */
export type YearBasis = 'lunar-new-year' | 'lichun';

/**
 * Date → 时间起卦的四个取数（年支序 / 农历月 / 农历日 / 时辰序）。
 * 梅花 `qiGuaByTime` 与六爻 `methods/time.ts` 共用这一份，两条页面的取数不会各说各话，
 * 年界要改也只改传进来的 `yearBasis`。
 *
 * 实测 lunar-typescript@1.8.6：
 * - 'lichun' 走 getYearInGanZhiExact()（精确到交立春时刻，与八字页年柱同口径）；
 *   'lunar-new-year' 走 getYearInGanZhi()（正月初一为界）。两个口径只在「立春已过、正月初一未到」那段日子差一支，
 *   例：2026-02-05 正午 → 'lichun' 取午，'lunar-new-year' 取巳（2026 立春 2-04，春节 2-17）。
 * - 23 时按晚子时换日，与 bazi.ts 的 ZI_HOUR_23 同一条规则，取次日的农历月日；时支本身已是子。
 * - 闰月 `getMonth()` 返回负数，按本数月计入（取绝对值），不另作加减。
 * - 不作真太阳时校正：取的是问事当下的钟表时刻；调用方若已按地点校正过，传进来的就是校正后的时刻。
 */
export function lunarQiShu(date: Date, yearBasis: YearBasis = 'lunar-new-year') {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = date.getHours();
  const mi = date.getMinutes();

  const solar = Solar.fromYmdHms(y, m, d, hh, mi, 0);
  const lunar = solar.getLunar();
  const nianZhi = (yearBasis === 'lichun' ? lunar.getYearInGanZhiExact() : lunar.getYearInGanZhi()).charAt(1);
  const shiZhi = lunar.getTimeZhi();
  const lateZi = hh === 23;
  const dayLunar = lateZi ? solar.next(1).getLunar() : lunar;

  return {
    nianZhi,
    shiZhi,
    lateZi,
    nianZhiNum: zhiNumber(nianZhi),
    shiZhiNum: zhiNumber(shiZhi),
    yue: Math.abs(dayLunar.getMonth()),
    ri: dayLunar.getDay(),
    lunarText: `${dayLunar.getMonthInChinese()}月${dayLunar.getDayInChinese()}`,
    civil: { y, m, d, hh, mi },
  };
}

/**
 * 时间起卦：年支数 + 农历月 + 农历日 定上卦，再加时支数定下卦与动爻。
 * 取数见 `lunarQiShu`；年界按**农历年（正月初一）**，2026-10-17 裁定 ——
 * 梅花时间起卦、六爻时间起卦、紫微斗数同属农历体系，立春年界只属四柱/八字。
 * 要改回立春只改下面这一行的 `yearBasis`，并与 `lib/liuyao/methods/time.ts` 同改。
 */
export function qiGuaByTime(date: Date): MeiHuaResult {
  const q = lunarQiShu(date, 'lunar-new-year');
  const { y, m, d, hh, mi } = q.civil;
  const nianZhi = q.nianZhi, shiZhi = q.shiZhi, lateZi = q.lateZi;
  const nZ = q.nianZhiNum, yue = q.yue, ri = q.ri, hZ = q.shiZhiNum;

  const upper = nZ + yue + ri;
  const total = upper + hZ;
  const shangNum = mod8(upper);
  const xiaNum = mod8(total);
  const dongYao = mod6(total);

  const pad = (n: number) => String(n).padStart(2, '0');
  return finish(
    'time',
    XIANTIAN[shangNum - 1],
    XIANTIAN[xiaNum - 1],
    dongYao,
    [
      `年支${nianZhi}取${nZ}，农历${yue}月取${yue}，日取${ri}，相加 = ${upper}`,
      `${upper} ÷ 8 余 ${remainder(upper, 8)} → 上卦取${shangNum} = ${XIANTIAN[shangNum - 1]}`,
      `再加时支${shiZhi}${hZ}，得 ${total}；÷ 8 余 ${remainder(total, 8)} → 下卦取${xiaNum} = ${XIANTIAN[xiaNum - 1]}`,
      `${total} ÷ 6 余 ${remainder(total, 6)} → 动爻在第${dongYao}爻`,
      `问事时刻 ${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mi)}，农历${q.lunarText}${lateZi ? '（晚子时按次日计）' : ''}`,
    ],
    [
      '年界=农历年（正月初一）：年支以农历正月初一换年，与六爻时间起卦、紫微斗数同一口径；四柱/八字的年柱另按立春，两者互不影响。',
      '农历月日为问事当时的农历；23 时属晚子时，日按次日计。',
      '闰月按本数月计入，不另作加减。',
      '不作真太阳时校正：起卦取的是问事当下的钟表时刻。',
    ],
    {
      civil: `${y}-${pad(m)}-${pad(d)} ${pad(hh)}:${pad(mi)}`,
      lunar: q.lunarText,
      nianZhi,
      shiZhi,
      advancedForLateZi: lateZi,
    },
  );
}

/**
 * 数字起卦（报两个数）：第一个数定上卦，第二个数定下卦，两数之和定动爻。
 * 报数起卦（报三个数）：顺次定上卦、下卦、动爻。
 */
export function qiGuaByNumbers(nums: number[], method: Exclude<MeiHuaMethod, 'time'>): MeiHuaResult {
  const clean = nums.map(n => Math.trunc(n));
  if (clean.some(n => !Number.isFinite(n) || n <= 0)) {
    throw new Error('起卦数字需为正整数');
  }
  if (method === 'number' && clean.length !== 2) throw new Error('数字起卦需要 2 个数');
  if (method === 'report' && clean.length !== 3) throw new Error('报数起卦需要 3 个数');

  const [n1, n2, n3] = clean;
  const shangNum = mod8(n1);
  const xiaNum = mod8(n2);
  const dongSum = method === 'number' ? n1 + n2 : n3;
  const dongYao = mod6(dongSum);

  return finish(
    method,
    XIANTIAN[shangNum - 1],
    XIANTIAN[xiaNum - 1],
    dongYao,
    [
      `${n1} ÷ 8 余 ${remainder(n1, 8)} → 上卦取${shangNum} = ${XIANTIAN[shangNum - 1]}`,
      `${n2} ÷ 8 余 ${remainder(n2, 8)} → 下卦取${xiaNum} = ${XIANTIAN[xiaNum - 1]}`,
      method === 'number'
        ? `${n1} + ${n2} = ${dongSum}；÷ 6 余 ${remainder(dongSum, 6)} → 动爻在第${dongYao}爻`
        : `${n3} ÷ 6 余 ${remainder(n3, 6)} → 动爻在第${dongYao}爻`,
    ],
    [
      '先天八卦数取数：乾一 兑二 离三 震四 巽五 坎六 艮七 坤八。',
      '除尽（余数为 0）按满数计，卦作 8、爻作 6。',
      '数法不看农历、不看时刻，只看报进来的数。',
    ],
  );
}

/** 供验收脚本直接复算经典卦例，绕开日期换算这一层。 */
export function qiGuaByLunarNumbers(
  nianZhi: number,
  yue: number,
  ri: number,
  shiZhi: number,
): MeiHuaResult {
  const upper = nianZhi + yue + ri;
  const total = upper + shiZhi;
  return finish(
    'time',
    XIANTIAN[mod8(upper) - 1],
    XIANTIAN[mod8(total) - 1],
    mod6(total),
    [`年支数${nianZhi} + ${yue}月 + ${ri}日 = ${upper}，÷8 取${mod8(upper)} 为上卦`,
      `${upper} + 时支数${shiZhi} = ${total}，÷8 取${mod8(total)} 为下卦，÷6 取${mod6(total)} 为动爻`],
    ['由农历数字直接起卦，用于复算古籍卦例。'],
  );
}
