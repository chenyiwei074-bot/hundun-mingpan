import { Request, Response } from 'express';
import { calculateDirectPillars, parseDirectPillars } from '../services/bazi-pillars.service';

/** POST /api/bazi/pillars/calculate — 纯四柱增强计算，不持久化。 */
export async function calculatePillars(req: Request, res: Response) {
  const parsed = parseDirectPillars(req.body);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ success: false, code: parsed.code, error: parsed.error });
  }
  try {
    const enrichment = calculateDirectPillars(parsed.siZhu);
    return res.json({ success: true, data: { siZhu: parsed.siZhu, enrichment } });
  } catch {
    // 不回显请求、四柱或堆栈。
    return res.status(500).json({ success: false, code: 'calculation_unavailable', error: '四柱结构暂时无法计算，请稍后重试。' });
  }
}
