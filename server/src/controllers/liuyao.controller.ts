import { Request, Response } from 'express';
import { runLiuYao } from '../core/liuyao';
import { QiGuaInput, QiGuaMethod } from '../core/liuyao/types';

// POST /api/liuyao/create
export async function createLiuYao(req: Request, res: Response) {
  try {
    const { question, method, manualData } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请填写占问事项' });
    }
    
    const input: QiGuaInput = {
      method: (method as QiGuaMethod) || 'random',
      question: question.trim(),
      manualData: manualData || undefined,
      date: new Date(),
    };
    
    const result = runLiuYao(input);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '六爻推演失败' });
  }
}
