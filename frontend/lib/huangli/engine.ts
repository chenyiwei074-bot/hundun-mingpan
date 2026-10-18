// 黄历宜忌：逐日宜/忌、吉神凶煞、冲煞、彭祖百忌、胎神占方、诸方位、建除十二神、
// 黄黑道时辰神、值日二十八宿、节气与节日。全部由站里唯一的八字引擎 lunar-typescript
// 按《协纪辨方书》一系规则推算 —— 本站不自建宜忌表、不自建吉凶评分，也不取任何同类产品文案。
//
// 历法单源，三条都不许长出第二份：
//   年/月/日干支 → lib/liuyao/core/calcGanZhi（年界立春、月建按节气，口径戳 GANZHI_BASIS）
//   农历↔公历   → app/lib/core/yiqi-core/lunar-input（与命盘换算同一套）
//   值日二十八宿 → lib/xiu/engine（宿表仍是六爻内核那一份 XIU28）
// 这三条同源关系由 tools/huangli-acceptance 逐日钉住（1901-2099 全 72,684 天），
// 顺带钉「同一日宜与忌不重出」「建除十二神与黄黑道六黄道归属合标准表」。
//
// 本页面是无状态的日历查询，不落库、不存档，所以没有口径版本戳的位置：改了上游规则，
// 下一次查询就是新规则，不存在新旧两份数据并存（与盘类功能需要戳的理由不同）。

import { Lunar, Solar } from 'lunar-typescript';
import { getDayGanZhi, getMonthGanZhi, getYearGanZhi, GANZHI_BASIS } from '@/lib/liuyao/core/calcGanZhi';
import { queryBenMingXiu } from '@/lib/xiu/engine';

export interface HuangliPosition {
  /** 喜神方位 */
  xi: string;
  /** 财神方位 */
  cai: string;
  /** 福神方位 */
  fu: string;
  /** 阳贵神方位 */
  yangGui: string;
  /** 阴贵神方位 */
  yinGui: string;
}

export interface HuangliJieQi {
  name: string;
  civil: string;
  /** 相对本日的天数：已过去为负，未来为正，当日为 0 */
  offsetDays: number;
}

export interface HuangliDay {
  civil: string;
  week: string;
  /** 农历记日，如「农历丙午年九月初九」；闰月写作闰。 */
  lunarText: string;
  lunarMonth: string;
  lunarDay: string;
  fromLunar: boolean;
  originalInput: string;
  shengXiao: string;
  ganZhi: { year: string; month: string; day: string };
  /** 年柱所采用的干支口径，与站里四柱同一套，写进盘面便于核对。 */
  ganZhiBasis: string;
  naYin: string;
  xunKong: string;
  yi: string[];
  ji: string[];
  /** 吉神宜趋 */
  jiShen: string[];
  /** 凶煞宜忌 */
  xiongSha: string[];
  /** 冲，如「(己未)羊」 */
  chong: string;
  /** 煞方 */
  sha: string;
  pengZu: { gan: string; zhi: string };
  /** 胎神占方 */
  taiShen: string;
  /** 日禄 */
  lu: string;
  positions: HuangliPosition;
  /** 建除十二神之一 */
  zhiXing: string;
  tianShen: { name: string; dao: string; luck: string };
  xiu: { fullName: string; xiu: string; yao: string; wuxing: string; luck: string; index: number };
  /** 本日恰是节气时给出节气名，否则 null */
  jieQiToday: string | null;
  prevJieQi: HuangliJieQi | null;
  nextJieQi: HuangliJieQi | null;
  /** 公历节日 */
  solarFestivals: string[];
  /** 农历节日 */
  festivals: string[];
  /** 其他传统节日（佛诞、菩萨日一类） */
  otherFestivals: string[];
  steps: string[];
  basis: string[];
}

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/** 黄历只认日历日，一律按正午取数，避开子时换日与夏令时把日柱推移一天。 */
const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0);

const ymdOf = (s: string) => {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return mt ? { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]) } : null;
};

function jieQiOf(q: ReturnType<Lunar['getNextJieQi']>, anchor: { y: number; m: number; d: number }): HuangliJieQi | null {
  if (!q) return null;
  const solar = q.getSolar();
  const ymd = ymdOf(`${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`);
  if (!ymd) return null;
  const offset = Math.round((Number(noon(ymd.y, ymd.m, ymd.d)) - Number(noon(anchor.y, anchor.m, anchor.d))) / 86400000);
  return { name: q.getName(), civil: solar.toYmd(), offsetDays: offset };
}

/** 取某一日的黄历。农历输入请先经 toCivilInput 换算，本函数只认公历。 */
export function queryHuangli(y: number, m: number, d: number, opts?: { originalInput?: string; fromLunar?: boolean }): HuangliDay {
  const date = noon(y, m, d);
  const lunar = Lunar.fromDate(date);
  const solar = Solar.fromDate(date);
  const civil = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const ben = queryBenMingXiu(y, m, d).ben;

  const dayGz = getDayGanZhi(date);
  const dayGanZhi = `${dayGz.gan}${dayGz.zhi}`;
  const week = WEEK_NAMES[solar.getWeek()];
  const festivals = lunar.getFestivals();
  const solarFestivals = solar.getFestivals();

  const steps = [
    `公历 ${civil}（星期${week}）即农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}${lunar.getMonth() < 0 ? '（该年有闰月，此日在闰月内）' : ''}`,
    `日柱按本站唯一干支层取得 ${dayGanZhi}（年${getYearGanZhi(date)}、月${getMonthGanZhi(date)}，口径 ${GANZHI_BASIS}）`,
    `宜 ${lunar.getDayYi().join('、') || '无'}；忌 ${lunar.getDayJi().join('、') || '无'}（通书逐日推算，非人工拟定）`,
    `吉神宜趋 ${lunar.getDayJiShen().join('、') || '无'}；凶煞宜忌 ${lunar.getDayXiongSha().join('、') || '无'}`,
    `日建${lunar.getZhiXing()}，值${lunar.getDayTianShen()}（${lunar.getDayTianShenType()}，${lunar.getDayTianShenLuck()}）`,
    `值日二十八宿「${ben.fullName}」，通书以此宿直日判${ben.luck}`,
    `冲${lunar.getDayChongDesc()} 煞${lunar.getDaySha()}；胎神占方「${lunar.getDayPositionTai()}」；日禄「${lunar.getDayLu()}」`,
  ];

  const basis = [
    '宜忌、吉神凶煞、冲煞、彭祖百忌、胎神、方位、建除、黄黑道全部由本站唯一的八字引擎 lunar-typescript 按《协纪辨方书》一系规则推算，页面只是把它们排出来，不做人定取舍。',
    `年柱按立春、月柱按节气切换，与本站八字盘同一套口径（${GANZHI_BASIS}），且同样按交节「瞬时」而非整日切换。这一页没有出生时刻，一律以当日正午代表该日：凡交节落在正午之后，年柱/月柱当天仍属上一柱。1901 至 2099 年的 199 个立春日里有 100 天如此，2388 个节日里有 1191 天如此 —— 与按「立春当天即换」印通的历书在这几天会不同。本站不静默换成印本口径，也不给同一天出两份年月柱。`,
    '日柱按公历日历日取（正午锚定），不做夜子时换日：夜子时是排盘功能的口径，日历页若引入它，同一天会长出两份宜忌。',
    '农历输入先经与命盘同一套换算得到公历日，再按公历日取数；闰月由该农历年实际有无决定，不自动补闰。',
    '「诸事不宜」「馀事勿取」是通书原话，不是本站的改写：前者多见于岁破、月破之日，后者意为除此之外不宜再举他事。',
    '吉神、凶煞、值宿的「吉 / 凶」是择日口径，属宜忌一面，不构成对个人命运的判断。',
    '各地通书印本在神煞取舍与宜忌词条上存在版本差异。本页只报这一套规则的结果，与某一本印本不一致时，以印本为准自行参照，本站不做调和。',
  ];
  if (opts?.fromLunar) {
    basis.unshift(`输入历法为农历「${opts.originalInput || ''}」，换算后公历为 ${civil}，以下各条按此公历日取数。`);
  }

  return {
    civil,
    week,
    lunarText: `农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    lunarMonth: `${lunar.getMonthInChinese()}月`,
    lunarDay: lunar.getDayInChinese(),
    fromLunar: !!opts?.fromLunar,
    originalInput: opts?.originalInput || civil,
    shengXiao: lunar.getDayShengXiao(),
    ganZhi: { year: getYearGanZhi(date), month: getMonthGanZhi(date), day: dayGanZhi },
    ganZhiBasis: GANZHI_BASIS,
    naYin: lunar.getDayNaYin(),
    xunKong: lunar.getDayXunKong(),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    jiShen: lunar.getDayJiShen(),
    xiongSha: lunar.getDayXiongSha(),
    chong: lunar.getDayChongDesc(),
    sha: lunar.getDaySha(),
    pengZu: { gan: lunar.getPengZuGan(), zhi: lunar.getPengZuZhi() },
    taiShen: lunar.getDayPositionTai(),
    lu: lunar.getDayLu(),
    positions: {
      xi: lunar.getPositionXiDesc(),
      cai: lunar.getPositionCaiDesc(),
      fu: lunar.getPositionFuDesc(),
      yangGui: lunar.getPositionYangGuiDesc(),
      yinGui: lunar.getPositionYinGuiDesc(),
    },
    zhiXing: lunar.getZhiXing(),
    tianShen: { name: lunar.getDayTianShen(), dao: lunar.getDayTianShenType(), luck: lunar.getDayTianShenLuck() },
    xiu: { fullName: ben.fullName, xiu: ben.xiu, yao: ben.yao, wuxing: ben.wuxing, luck: ben.luck, index: ben.index },
    jieQiToday: lunar.getJieQi() || null,
    prevJieQi: jieQiOf(lunar.getPrevJieQi(), { y, m, d }),
    nextJieQi: jieQiOf(lunar.getNextJieQi(), { y, m, d }),
    solarFestivals,
    festivals,
    otherFestivals: lunar.getOtherFestivals(),
    steps,
    basis,
  };
}

/** 本日前 after 天、后 before 天的连续日历，用于速览条。 */
export function queryHuangliRange(center: { y: number; m: number; d: number }, before: number, after: number): HuangliDay[] {
  const start = noon(center.y, center.m, center.d);
  start.setDate(start.getDate() - before);
  const days: HuangliDay[] = [];
  for (let i = 0; i <= before + after; i++) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12, 0);
    days.push(queryHuangli(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
  }
  return days;
}
