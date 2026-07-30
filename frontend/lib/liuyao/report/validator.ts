// 六爻报告质量检查

const REQUIRED_KEYWORDS: string[] = [
  '整体卦象',
  '世应',
  '用神',
  '动爻',
  '趋势',
  '建议',
];

export interface ValidateResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/** 检查 AI 生成的报告是否包含所有必要章节 */
export function validateReport(report: string): ValidateResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const kw of REQUIRED_KEYWORDS) {
    if (!report.includes(kw)) {
      missing.push(kw);
    }
  }

  // 长度检查
  if (report.length < 200) {
    warnings.push('报告内容过短，可能不完整');
  }

  // 乱码检查
  if (report.includes('undefined') || report.includes('null')) {
    warnings.push('报告包含异常值');
  }

  // 拒绝回答检查
  const rejectPatterns = ['无法', '抱歉', '不能', '没有足够的信息'];
  const rejectCount = rejectPatterns.filter(p => report.includes(p)).length;
  if (rejectCount >= 3) {
    warnings.push('AI 可能拒绝或无法完成分析');
  }

  return {
    valid: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
  };
}

/** 快速检查 — 只判断是否可接受 */
export function isReportAcceptable(report: string): boolean {
  const r = validateReport(report);
  return r.missing.length <= 1 && r.warnings.length === 0;
}