import type { Request, Response } from 'express';
import { rewritePlainLanguage, validatePlainLanguageRequest } from '../services/plain-language.service';

export async function rewrite(req: Request, res: Response) {
  const validated = validatePlainLanguageRequest(req.body);
  if (!validated.ok) return res.status(validated.status).json({ success: false, error: validated.error });
  const parts = await rewritePlainLanguage(validated.data);
  if (!parts) return res.status(503).json({ success: false, error: '大白话改写暂时不可用，原解读仍可查看' });
  return res.status(200).json({ success: true, data: { parts } });
}
