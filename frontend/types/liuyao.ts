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
  benGua: { name: string; gong: string; wuxing: string; shangGua: string; xiaGua: string };
  bianGua: { name: string | null; gong: string | null; wuxing: string | null };
  yaoRecords: YaoRecord[];
  naJia: NaJiaYao[];
  bianNaJia: NaJiaYao[];
  dongYao: number[];
  shiYing: { shi: number; ying: number };
  liuShen: string[];
}
