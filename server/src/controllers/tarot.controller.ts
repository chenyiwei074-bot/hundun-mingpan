import type { Request, Response } from 'express';
import { buildTarotReading } from '../services/tarot.service';

/** POST /api/tarot/reading — 规则拼装冒烟；AI 综合解读尚未接入。 */
export function createTarotReading(req: Request, res: Response) {
  const result = buildTarotReading(req.body || {});
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error, code: result.code });
  return res.json({ success: true, data: result.data });
}
