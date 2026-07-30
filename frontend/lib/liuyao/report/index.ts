// 六爻报告引擎 — 统一入口

export type {
  LiuyaoReportContext,
  ReportGanZhi,
  ReportGuaInfo,
  ReportShiYing,
  ReportYongShen,
  ReportDongYaoItem,
  ReportWangShuaiItem,
  ReportRelationSummary,
  FuShenSummary,
  ReportSection,
  SectionId,
} from './types';

export { buildReportContext } from './contextBuilder';
export { REPORT_SECTIONS, getSectionsByDataPath, getSectionById } from './sections';
export { buildReportPrompt, buildSummaryPrompt } from './promptBuilder';
export { validateReport, isReportAcceptable } from './validator';
export type { ValidateResult } from './validator';