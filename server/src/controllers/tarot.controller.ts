import type { Request, Response } from 'express';
import { generateTarotReading } from '../services/tarot.service';

/** POST /api/tarot/reading — 规则拼装冒烟；AI 综合解读尚未接入。 */
export async function createTarotReading(req: Request, res: Response) {
  const result = await generateTarotReading(req.body || {});
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error, code: result.code });
  // 公开响应不暴露内部 model 字段；只保留 mode/aiReady。
  const { model: _model, ...publicData } = result.data;
  return res.json({ success: true, data: publicData });
}
