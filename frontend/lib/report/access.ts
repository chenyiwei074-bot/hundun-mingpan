// 报告访问控制（2026-10-18 方向修正：站点全免费，无付费墙、无解锁）
// 只有「生成中 / 失败」不可查看，其余一律可看全文。

import type { ReportStatus } from './types';

export interface AccessResult {
  canView: boolean;
  canViewFull: boolean;
  reason: string;
  showUnlockPrompt: boolean; // 保留字段以兼容调用方，恒为 false
}

export function checkReportAccess(status: ReportStatus): AccessResult {
  if (status === 'GENERATING') {
    return { canView: false, canViewFull: false, reason: '报告正在生成中，请稍候', showUnlockPrompt: false };
  }
  if (status === 'FAILED') {
    return { canView: false, canViewFull: false, reason: '报告生成失败，请重新生成', showUnlockPrompt: false };
  }
  return { canView: true, canViewFull: true, reason: '', showUnlockPrompt: false };
}
