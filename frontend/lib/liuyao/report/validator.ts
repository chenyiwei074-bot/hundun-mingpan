// 六爻报告质量检查（2026-10-23 与 bot 端白话骨架对齐后更新）
//
// 检查两件事：
// 1) 该说的内容有没有说到（卦象/世应/用神/动爻/应期/建议）；
// 2) 有没有把内部结构或异常值泄给用户（JSON 括号、字段名、undefined/null、代码块）。

const REQUIRED_KEYWORDS: string[] = [
  '卦象',
  '世应',
  '用神',
  '动爻',
  '应期',
  '建议',
];

// 章节标题别名：新旧模板用词不同，二者都算通过
const KEYWORD_ALIASES: Record<string, string[]> = {
  卦象: ['卦象', '卦象总览', '卦象总断', '总体卦象', '本卦'],
  世应: ['世应', '世爻', '世应关系'],
  用神: ['用神'],
  动爻: ['动爻', '爻动', '变爻'],
  应期: ['应期', '时间与结果', '落定', '信号日'],
  建议: ['建议', '三条实在建议', '行动建议'],
};

export interface ValidateResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/** 检查 AI 生成的报告是否包含必要内容、且没有把技术结构泄给用户 */
export function validateReport(report: string): ValidateResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const kw of REQUIRED_KEYWORDS) {
    const alts = KEYWORD_ALIASES[kw] || [kw];
    if (!alts.some(a => report.includes(a))) missing.push(kw);
  }

  if (report.length < 200) warnings.push('报告内容过短，可能不完整');

  // 技术结构泄漏：JSON 括号/代码块/字段名/异常值
  if (/[{}]/.test(report) || report.includes('```')) warnings.push('报告里出现了 JSON/代码块符号');
  if (/\b(undefined|null|NaN)\b/.test(report)) warnings.push('报告包含异常值');
  const codeWords = ['meta', 'sections', 'summary"', 'liuQin', 'ganZhi', 'JSON'];
  if (codeWords.some(w => report.includes(w))) warnings.push('报告里出现了字段名/英文结构词');

  // 拒绝回答检查
  const rejectPatterns = ['无法', '抱歉', '不能', '没有足够的信息'];
  const rejectCount = rejectPatterns.filter(p => report.includes(p)).length;
  if (rejectCount >= 3) warnings.push('AI 可能拒绝或无法完成分析');

  // 免责话必须有一句（bot 模板要求）
  if (!report.includes('仅供参考')) warnings.push('缺"卦理仅供参考"的免责句');

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
