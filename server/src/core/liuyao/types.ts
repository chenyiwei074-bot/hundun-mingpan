// 混沌六爻 TypeScript 类型定义
// Ported from 混沌六爻 skill v1.3.0

/** 天干 */
export type TianGan = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';

/** 地支 */
export type DiZhi = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';

/** 五行 */
export type WuXing = '木' | '火' | '土' | '金' | '水';

/** 八卦 */
export type GuaName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

/** 六亲 */
export type LiuQin = '兄弟' | '父母' | '官鬼' | '妻财' | '子孙';

/** 六神 */
export type LiuShen = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武';

/** 爻值: 6=老阴 7=少阳 8=少阴 9=老阳 */
export type YaoValue = 6 | 7 | 8 | 9;

/** 起卦方式 */
export type QiGuaMethod = 'coin' | 'time' | 'random' | 'manual';

/** 六爻数据 */
export type LiuYaoData = [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue];

export interface YaoInfo {
  position: number;
  value: YaoValue;
  yinYang: '阳' | '阴';
  isDong: boolean;
  naGan: TianGan;
  naZhi: DiZhi;
  liuQin: LiuQin;
  liuShen: LiuShen;
  shiYing: '世' | '应' | null;
  xunKong: boolean;
  yuePo: boolean;
  xiu: string;
}

export interface GuaInfo {
  name: string;
  shangGua: GuaName;
  xiaGua: GuaName;
  gongWei: GuaName;
  gongWuXing: WuXing;
  shiYao: number;
  yingYao: number;
  guaType: '本宫' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';
}

export interface LiuYaoPan {
  benGua: GuaInfo;
  bianGua: GuaInfo | null;
  yaoList: YaoInfo[];
  yaoListBian: YaoInfo[];
  riChen: { gan: TianGan; zhi: DiZhi };
  yueJian: DiZhi;
  xunKongZhi: DiZhi[];
  yuePoZhi: DiZhi[];
  tianXiu: string[];
}

export interface QiGuaInput {
  method: QiGuaMethod;
  manualData?: LiuYaoData;
  question?: string;
  date?: Date;
}

export interface QiGuaResult {
  yaoData: LiuYaoData;
  method: QiGuaMethod;
  shangGuaNum: number;
  xiaGuaNum: number;
  dongYaoPositions: number[];
}

export interface LiuYaoResult {
  question: string;
  qiGua: QiGuaResult;
  pan: LiuYaoPan;
  analysis: string;
  advice: string;
}
