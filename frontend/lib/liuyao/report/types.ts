// 六爻报告类型定义

import type { QuestionType } from '@/types/liuyao';

// ══ 报告上下文 ══

export interface ReportGanZhi {
  year: string; month: string; day: string; hour: string;
}

export interface ReportGuaInfo {
  name: string; gong: string; wuxing: string;
  shangGua: string; xiaGua: string;
}

export interface ReportShiYing {
  shiPosition: number; shiLabel: string;
  shiLiuQin: string; shiWuxing: string; shiGanZhi: string;
  yingPosition: number; yingLabel: string;
  yingLiuQin: string; yingWuxing: string; yingGanZhi: string;
  relation: string;
  chongHe: string;
}

export interface ReportYongShen {
  name: string; found: boolean;
  positions: {
    position: number; label: string; liuQin: string;
    ganZhi: string; wuxing: string; wangShuai: string;
    isShi: boolean; isYing: boolean; isDong: boolean;
    assessment: string;
  }[];
}

export interface ReportDongYaoItem {
  position: number; label: string; yaoLabel: string;
  from: { liuQin: string; ganZhi: string; wuxing: string };
  to: { liuQin: string; ganZhi: string; wuxing: string } | null;
  impact: string;
}

export interface ReportWangShuaiItem {
  position: number; label: string; liuQin: string;
  zhi: string; wuxing: string; level: string;
  monthInfluence: string; dayInfluence: string;
}

export interface ReportRelationSummary {
  liuHeCount: number; liuChongCount: number; sanHeCount: number;
  details: string[];
}

export interface FuShenSummary {
  exist: boolean;
  items: { position: number; label: string; flying: string; hidden: string; hiddenGanZhi: string }[];
}

export interface LiuyaoReportContext {
  question: string;
  questionType: QuestionType;
  method: string;
  dateTime: string;
  ganZhi: ReportGanZhi;
  xunKong: string;
  benGua: ReportGuaInfo;
  bianGua: ReportGuaInfo | null;
  shiYing: ReportShiYing;
  yongShen: ReportYongShen;
  dongYao: ReportDongYaoItem[];
  wangShuai: ReportWangShuaiItem[];
  relations: ReportRelationSummary;
  fuShen: FuShenSummary;
}

export type SectionId = 'overview'|'shiying'|'yongshen'|'dongyao'|'wangshuai'|'trend'|'advice';

export interface ReportSection {
  id: SectionId;
  title: string;
  order: number;
  description: string;
  keyPoints: string[];
  dataPaths: string[];
}