// 统一报告记录模型 — 八字/紫微/六爻 共用

export type ReportType = 'bazi' | 'ziwei' | 'liuyao';
export type ReportStatus = 'FREE' | 'GENERATING' | 'LOCKED' | 'UNLOCKED' | 'FAILED';

export interface ReportRecord {
  id: string;
  userId: string;
  type: ReportType;
  title: string;
  inputJson: string;       // 原始输入 JSON
  resultJson: string | null;  // 排盘结果 JSON
  analysisJson: string | null; // 分析结果 JSON
  reportText: string | null;   // AI 报告 Markdown
  previewText?: string | null;  // 预览文本（免费可见部分）
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  userId: string;
  type: ReportType;
  title: string;
  inputJson: Record<string, any>;
  resultJson?: Record<string, any>;
  analysisJson?: Record<string, any>;
  reportText?: string;
  status?: ReportStatus;
}

export interface ReportListItem {
  id: string;
  type: ReportType;
  title: string;
  status: ReportStatus;
  createdAt: string;
}

// 类型标签映射
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  bazi: '八字命盘',
  ziwei: '紫微斗数',
  liuyao: '六爻占卜',
};

export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  bazi: '☯',
  ziwei: '⭐',
  liuyao: '🪙',
};
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  FREE: '免费查看',
  GENERATING: '生成中',
  LOCKED: '待解锁',
  UNLOCKED: '已解锁',
  FAILED: '生成失败',
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  FREE: '#4a9e6e',
  GENERATING: '#c9a84c',
  LOCKED: '#86868b',
  UNLOCKED: '#b2955d',
  FAILED: '#d4544a',
};