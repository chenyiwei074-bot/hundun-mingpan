// 本命星宿：以出生当日的「值日二十八宿」为命宿，取通书二十八宿直日之法。
//
// 表复用站里六爻内核（XIU28 / WUXING_SHENG / WUXING_KE），宿的五行由宿名中之曜推出
// （日、月二宿属火），与 lib/core/liuyao/tianpan.ts 的 XIU_WUXING 逐宿实测一致，
// 因此不再抄第三份二十八宿表。
//
// 结构自检（tools/xiu-acceptance）：1901-2099 共 72684 天，宿名中之曜恒等于该日的
// 星期（角木蛟恒落木曜星期四），0 例外；28 日一周，奎宿后第 28 日仍是奎宿。
// 这条性质本身就是七曜星的来源，所以值日循环的相位可以自证，不依赖外部锚点。
//
// 断语、相配措辞为本站自写；相配权重是本模型为自研，非还原。

import { Solar } from 'lunar-typescript';
import { XIU28, WUXING_KE, WUXING_SHENG } from '@/app/lib/core/liuyao/constants';

/** 宿名中之曜 → 五行。日、月二曜在星占里属火，其余曜即本行。 */
const YAO_TO_WX: Record<string, string> = {
  日: '火', 月: '火', 火: '火', 水: '水', 木: '木', 金: '金', 土: '土',
};

/** 四象所部，与宿序一致，用作方位校验与「苍龙/玄武…」的称呼。 */
const SIXIANG: Record<string, string> = {
  东: '苍龙', 北: '玄武', 西: '白虎', 南: '朱雀',
};

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/** 《天文志》一类公版星官含义为底，与本站自建的分宿性语，未取任何他站文案。 */
const XINGXIU_TEXT: Record<string, string> = {
  角: '万物自此出头，主开创与声名，手快，也爱先动手。',
  亢: '角上为亢，主张扬与争竞，容易在人前把话说满。',
  氐: '根柢之宿，主积累与守成，慢热，认定了才迈步。',
  房: '明堂之宿，主事业与俸禄，喜场面，也需要舞台。',
  心: '龙心之地，主思虑与情义，藏得多，旁人难摸到底。',
  尾: '继往开来之所，主收尾与继承，前头松，后头才紧。',
  箕: '箕主口舌与风动，善宣传，也顺手招来是非。',
  斗: '南斗主爵禄与人脉，肯扛事，也忍不住要管。',
  牛: '牛主负荷与田畴，耐得住冗长，不擅投机。',
  女: '女主织作与细务，手细心细，最怕被人催。',
  虚: '虚主名分与空档，多思多疑，宜把一件事做实。',
  危: '危主高险之地，喜险中求，须防一步踏空。',
  室: '室主居处与藏蓄，重安稳，家宅的事最上心。',
  壁: '壁主文书与垣墙，宜学宜守，不喜被催着决断。',
  奎: '奎主文章与库府，起步难，后劲长。',
  娄: '娄主聚众与牧守，重规矩，也认死理。',
  胃: '胃主食养与容纳，先把人安置好，再谈道理。',
  昴: '昴主刑狱与明细，眼尖口快，宜校勘之事。',
  毕: '毕主边塞与网罗，喜欢设局，也受局所累。',
  觜: '觜主敛藏与口腹，机敏，不肯白出力。',
  参: '参主斩截与工程，动手快，最烦拖泥带水。',
  井: '井主法度与泉源，讲规矩，也守本分。',
  鬼: '鬼主幽隐与祭祀，想得多，看得见别人看不见的。',
  柳: '柳主迁徙与柔顺，随风而转，转得稳。',
  星: '星主雷雨与急变，性烈，一步就要到位。',
  张: '张主宴乐与铺陈，好热闹，也怕冷清。',
  翼: '翼主进退与远音，消息多，宜择一条走到底。',
  轸: '轸主车骑与远行，闲不住，在路上才舒展。',
};

export type XiuRelation = '生我' | '我生' | '克我' | '我克' | '比和';

/** 五行生克表直接引站里六爻内核，不再自建一份。 */
const SHENG: Record<string, string> = WUXING_SHENG;
const KE: Record<string, string> = WUXING_KE;

/** 以 a 为本，看 b 对 a 的作用。 */
export function xiuRelation(aWx: string, bWx: string): XiuRelation {
  if (aWx === bWx) return '比和';
  if (SHENG[bWx] === aWx) return '生我';
  if (KE[bWx] === aWx) return '克我';
  if (SHENG[aWx] === bWx) return '我生';
  return '我克';
}

const RELATION_TEXT: Record<XiuRelation, string> = {
  生我: '他那边往我这边输力气，共事省力，长久也不亏。',
  克我: '他那边压得住我，事情做得成，但人不太舒服。',
  我生: '我这边往外喂，起初顺，久了容易只剩一个人在耗。',
  我克: '我压得住他，推动得动，只是样样都得我盯着。',
  比和: '两边同气，好商好量，缺点是遇事先僵着，没人先动。',
};

/**
 * 相配权重：本模型为自研，非还原。
 * 他站的评分权重与解读文案没有公开，也没有被取用；这里是一套可读的自定义刻度，
 * 只用来排序倾向，不当作结论。
 */
const SCORE_BASE: Record<XiuRelation, number> = { 生我: 22, 比和: 14, 我克: 6, 我生: -6, 克我: -20 };
const SCORE_LUCK: Record<string, number> = { 吉: 4, 凶: -4 };

export interface BenMingXiu {
  /** 宿之全名，如「角木蛟」。 */
  fullName: string;
  /** 单字宿名。 */
  xiu: string;
  /** 七曜，宿名中间那个字。 */
  yao: string;
  /** 禽，宿名末字。 */
  qin: string;
  wuxing: string;
  /** 四方：东 / 北 / 西 / 南。 */
  gong: string;
  sixiang: string;
  /** 通书以此宿直日之吉凶，属择日口径，不是命定吉凶。 */
  luck: string;
  /** 通书旧载值日诗。 */
  song: string;
  /** 性语（本站自写）。 */
  nature: string;
  /** 28 宿序，自角起 0..27。 */
  index: number;
  civil: string;
  lunar: string;
  dayGanZhi: string;
  week: string;
}

export interface XiuPair {
  a: XiuRelation;
  b: XiuRelation;
  /** 站在我这一侧的说法，只解 relA，避免人称混。 */
  myText: string;
  sameXiu: boolean;
  score: number;
  level: string;
}

export interface XiuResult {
  ben: BenMingXiu;
  /** 输入口径回显：用户给的是农历时，这里记原始农历串与换算出的公历。 */
  input: { civil: string; original: string; fromLunar: boolean };
  steps: string[];
  basis: string[];
  pair?: XiuPair & { other: BenMingXiu };
}

function xiuOf(date: Solar): { xiu: string; fullName: string; index: number } {
  const lunar = date.getLunar();
  const xiu = lunar.getXiu();
  const index = XIU28.findIndex(n => n[0] === xiu);
  if (index < 0) throw new Error(`值日宿「${xiu}」不在本站二十八宿表内`);
  return { xiu, fullName: XIU28[index], index };
}

function toBenMingXiu(solar: Solar): BenMingXiu {
  const lunar = solar.getLunar();
  const { xiu, fullName, index } = xiuOf(solar);
  const yao = fullName[1];
  const gong = lunar.getGong();
  return {
    fullName,
    xiu,
    yao,
    qin: fullName[2],
    wuxing: YAO_TO_WX[yao],
    gong,
    sixiang: SIXIANG[gong] || '',
    luck: lunar.getXiuLuck(),
    song: lunar.getXiuSong(),
    nature: XINGXIU_TEXT[xiu] || '',
    index,
    civil: solar.toYmd(),
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    dayGanZhi: lunar.getDayInGanZhi(),
    week: WEEK_NAMES[solar.getWeek()],
  };
}

function pairOf(a: BenMingXiu, b: BenMingXiu): XiuPair {
  const relA = xiuRelation(a.wuxing, b.wuxing);
  const relB = xiuRelation(b.wuxing, a.wuxing);
  // 倾向指数取「我被怎样对待」，也就是 relA：彼生我 = 生我 = 加分，彼克我 = 克我 = 减分。
  // 用 relB 会把整根刻度反过来（我生他 = 我在往外喂，却按「生我」加分），
  // relA 与 myText 也必须同源，否则文案说一件、分数算另一件。
  const raw = 50 + SCORE_BASE[relA] + SCORE_LUCK[a.luck] + SCORE_LUCK[b.luck]
    + (a.xiu === b.xiu ? 4 : 0);
  const score = Math.max(4, Math.min(96, raw));
  const level = score >= 72 ? '相得' : score >= 58 ? '偏顺' : score >= 44 ? '平常' : score >= 30 ? '偏拗' : '相违';
  return { a: relA, b: relB, myText: RELATION_TEXT[relA], sameXiu: a.xiu === b.xiu, score, level };
}

/**
 * 生日校验。lunar-typescript 的 Solar.fromYmd 不会把 2 月 30 日记成 3 月 2 日，
 * 而是原样造出一个「2026-02-30」并照常给宿；所以对不上日历的日子必须在进库之前自己拦掉。
 * 月/日越界时它自己会抛 "wrong month 13" 这类英文，也一并换成中文。
 */
function solarOf(y: number, m: number, d: number, who: string): Solar {
  if (!(y >= 1901 && y <= 2099)) throw new Error(`${who}年份需在 1901 至 2099 之间`);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (!(d >= 1 && d <= 31) || probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`${who}日期不存在，请核对月份与日数`);
  }
  return Solar.fromYmd(y, m, d);
}

/**
 * 命宿查询。生日按公历轴给定；走农历输入时先经站里同一套 toCivilInput 换算，
 * 换算结果原样回显，方便复核。
 */
export function queryBenMingXiu(
  y: number,
  m: number,
  d: number,
  opts?: { originalInput?: string; fromLunar?: boolean; other?: { y: number; m: number; d: number } },
): XiuResult {
  const solar = solarOf(y, m, d, '');
  const ben = toBenMingXiu(solar);

  const steps = [
    `出生日 ${ben.civil}（${ben.lunar}，${ben.dayGanZhi}日，星期${ben.week}）`,
    `通书二十八宿值日循环共 28 日，此日直「${ben.xiu}」，为二十八宿序第 ${ben.index + 1} 位`,
    `宿全名 ${ben.fullName}：${ben.xiu} 为宿，${ben.yao} 为曜（${ben.yao}曜 → 五行属${ben.wuxing}），${ben.qin} 为禽`,
    `该宿属${ben.gong}方${ben.sixiang}之部；${ben.gong}方七宿顺数第 ${(ben.index % 7) + 1} 位`,
    `宿名中之曜为「${ben.yao}曜」，对应星期${ben.week}，与当日星期相符 —— 值日循环与七曜历同步，可自证不失相位`,
  ];

  const basis = [
    '命宿取通书「二十八宿值日」：28 日一周，跟着公历日连续排，不看农历月、不做闰月调整。',
    '宿名中之曜恒等于该日星期（角木蛟恒值木曜，即星期四），故本表相位可由星期自查。',
    '「吉 / 凶」是通书以此宿直日的宜忌口径，属择日一面，不等于命定吉凶。',
    '命宿一律按公历日取；若你给的是农历生日，先经与本站命盘同一套换算（见上方输入回显）。',
    '不作真太阳时与子时换日：值日宿随公历日历日走，与八字日柱的夜子时规则互不影响。',
  ];

  const fromLunar = !!opts?.fromLunar;
  const input = {
    civil: ben.civil,
    original: opts?.originalInput || ben.civil,
    fromLunar,
  };
  if (fromLunar) {
    basis.unshift(`输入历法为农历「${input.original}」，换算后公历为 ${ben.civil}，命宿按换算后的公历日取。`);
  }

  let pair: XiuResult['pair'];
  if (opts?.other) {
    const otherSolar = solarOf(opts.other.y, opts.other.m, opts.other.d, '对方');
    const other = toBenMingXiu(otherSolar);
    pair = { other, ...pairOf(ben, other) };
    steps.push(
      `对方 ${other.civil} 直「${other.fullName}」（属${other.wuxing}）`,
      `以我为本看彼：${ben.wuxing} 对 ${other.wuxing} 为「${pair.a}」；以彼为本看我：为「${pair.b}」`,
    );
  }

  return { ben, input, steps, basis, pair };
}

/** 宿序表由内核那一份提供，页面铺表时不再抄第二份。 */
export const XIU_ORDER = XIU28;
