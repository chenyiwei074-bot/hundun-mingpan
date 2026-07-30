// 报告访问权限控制

import type { ReportStatus } from './types';

const FREE_STATUSES: ReportStatus[] = ['FREE', 'UNLOCKED'];
const BLOCKED_STATUSES: ReportStatus[] = ['LOCKED'];
const PREVIEW_STATUSES: ReportStatus[] = ['LOCKED'];

export interface AccessResult {
  canView: boolean;         // 是否可查看
  canViewFull: boolean;     // 是否可看完整版
  reason: string;           // 不可查看的原因
  showUnlockPrompt: boolean; // 是否显示解锁入口
}

export function checkReportAccess(status: ReportStatus): AccessResult {
  if (status === 'FREE' || status === 'UNLOCKED') {
    return { canView: true, canViewFull: true, reason: '', showUnlockPrompt: false };
  }
  if (status === 'LOCKED') {
    return { canView: true, canViewFull: false, reason: '本报告需要解锁后查看完整内容', showUnlockPrompt: true };
  }
  if (status === 'GENERATING') {
    return { canView: false, canViewFull: false, reason: '报告正在生成中，请稍候', showUnlockPrompt: false };
  }
  if (status === 'FAILED') {
    return { canView: false, canViewFull: false, reason: '报告生成失败，请重新生成', showUnlockPrompt: false };
  }
  return { canView: false, canViewFull: false, reason: '未知状态', showUnlockPrompt: false };
}