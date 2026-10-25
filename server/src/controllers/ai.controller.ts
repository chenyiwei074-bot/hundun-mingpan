import { Request, Response } from 'express';
import { interpretTool, validateAiRequest } from '../services/tool-interpretation.service';

export async function interpret(req: Request, res: Response) {
  const v = validateAiRequest(req.body);
  if (!v.ok) return res.status(v.status).json({ success: false, error: v.error });
  const result = await interpretTool({ tool: v.tool, payload: v.payload, question: v.question });
  return res.status(result.mode === 'ai' ? 200 : 200).json({ success: true, data: result });
}
