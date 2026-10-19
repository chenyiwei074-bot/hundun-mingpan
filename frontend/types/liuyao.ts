// 六爻统一数据结构

export type DivinationMethod = 'coin' | 'time' | 'number';
export type QuestionType = '财运'|'事业'|'感情'|'婚姻'|'考试'|'健康'|'出行'|'合作'|'其他';

export type CoinFace = '字' | '花';
export interface YaoRecord {
  position: number;
  coins: CoinFace[];
  value: number;
  label: string;
  isDong: boolean;
}

export interface NaJiaYao {
  position: number; value: number; label: string; isDong: boolean;
  naGan: string; naZhi: string; ganZhi: string;
  liuQin: string; shiYing: string; xunKong: boolean;
}

export interface GanZhiInfo {
  year: string; month: string; day: string; hour: string;
}

/** 起卦时刻采用的时间口径，必须随盘存下来，不能靠事后重算 */
export interface QiguaSolarInfo {
  mode: 'standard' | 'true-solar';
  label: string;
  place: string | null;
  longitude: number | null;
  clockText: string;
  solarText: string;
  correctionMinutes: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  crossedHour: boolean;
  crossedDay: boolean;
}

/** 铜钱摇卦的随机承诺（commit-reveal）。整卦只铸一个 seed：首掷之前先公布它的哈希，
 *  六轮面值全部由 seed 的前 18 bit 推出，所以验真方拿到 seed 就能一路重放到盘上爻值。
 *  additive：本批之前的盘没有这个字段，回执对它们标「未承诺」，不判失败。 */
export interface CoinCommitment {
  /** 承诺与派生口径的版本戳。 */
  schema: string;
  /** 32 字节 seed 的十六进制（64 字符），揭晓时公开。 */
  seedHex: string;
  /** 'sha256:' + SHA-256(utf8(seedHex)) —— 揭晓之前唯一公布过的东西。 */
  seedHash: string;
  /** seed 前 18 字节各取 1 bit，写成 18 个 '0'/'1'，让第三方不必重放也能逐位核对。 */
  bits: string;
  /** 锁定时刻的本地文本，只作展示，不进任何摘要（本地时钟不可信，进摘要等于伪造时间）。 */
  committedAtLocal: string;
}

export interface LiuyaoResult {
  id: string;
  method: DivinationMethod;
  question: string;
  questionType: QuestionType;
  date: { year: number; month: number; day: number; hour: number; minute: number };
  ganZhi: GanZhiInfo;
  dayGZ: { gan: string; zhi: string; ganIdx: number; zhiIdx: number };
  monthZhi: string;
  xunKong: string;
  ganzhiBasis?: string;
  /** 纳甲口径版本戳（additive）：老盘无此字段时结果页只标注、不重排。 */
  najiaBasis?: string;
  solar?: QiguaSolarInfo;
  /** 时间/报数起卦专属：与梅花 engine 同源带回的取数过程与起卦口径，随盘存下来，供盘面逐条复算。
   *  version 是取数口径版本戳（additive），本批之前的盘没有这个字段 —— 只标注，不重排。 */
  qiShu?: { steps: string[]; basis: string[]; version?: string };
  /** 随机承诺（commit-reveal）：只有铜钱摇卦有。时间与报数是确定性输入，没有随机过程要承诺。 */
  randomness?: CoinCommitment;
  benGua: { name: string; gong: string; wuxing: string; shangGua: string; xiaGua: string };
  bianGua: { name: string | null; gong: string | null; wuxing: string | null };
  yaoRecords: YaoRecord[];
  naJia: NaJiaYao[];
  bianNaJia: NaJiaYao[];
  dongYao: number[];
  shiYing: { shi: number; ying: number };
  liuShen: string[];
}
