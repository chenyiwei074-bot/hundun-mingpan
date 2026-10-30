import type { Request, Response } from 'express';
import { buildAvatarBrief } from '../services/avatar.service';

const VISITOR_RE = /^[A-Za-z0-9_-]{8,128}$/;
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

/** 进程内限流：不写库、不记请求体。Map 有界清理，避免访客标识无限增长。 */
function allow(visitorId: string): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
  }
  const current = buckets.get(visitorId);
  if (!current || current.resetAt <= now) {
    buckets.set(visitorId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT) return false;
  current.count += 1;
  return true;
}

function fail(res: Response, status: number, code: string, error: string) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ success: false, code, error });
}

/** POST /api/avatar/brief —— 只返回主题参数和白话说明；不画图、不调用模型、不落库。 */
export async function avatarBrief(req: Request, res: Response) {
  try {
    const visitorId = String(req.header('x-visitor-id') || '').trim();
    if (!VISITOR_RE.test(visitorId)) return fail(res, 401, 'invalid_visitor', '当前设备身份不可用，请刷新页面后重试。');
    if (!allow(visitorId)) return fail(res, 429, 'rate_limited', '请求有些频繁，请稍等片刻再试。');

    const result = buildAvatarBrief(req.body);
    if (!result.ok) return fail(res, result.status, result.code, result.error);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      data: {
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        concept: result.data.concept,
        chartSummary: result.data.chartSummary,
      },
    });
  } catch {
    // 不记录出生资料、职业或请求体；公开响应不含内部异常。
    console.error('[avatar] brief failed code=calculation_unavailable');
    return fail(res, 503, 'calculation_unavailable', '头像主题暂时无法生成，请稍后再试。');
  }
}
