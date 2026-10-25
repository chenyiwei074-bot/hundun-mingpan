import { Request, Response } from 'express';
import prisma from '../database';
import { TAROT_CARDS, TAROT_SPREADS, type TarotSpread } from '../data/tarot';

/**
 * 塔罗账号内保存（游客 visitorId 归属，7 天保留）。
 * 复用 reports 表：type='tarot'，不新增表，不碰 Prisma schema。
 * 只保存前端提交的已生成 reading；不在这里重算 AI，不伪造来源。
 */
const BY_ID = new Map(TAROT_CARDS.map(c => [c.id, c]));
const ORIENTATIONS = new Set(['正位', '逆位']);

export interface TarotSavePayload {
  visitorId: string;
  question?: string;
  reading: Record<string, unknown>;
}

export type TarotSaveValidation = { ok: true; value: { visitorId: string; question: string; reading: Record<string, unknown>; spread: TarotSpread; title: string } } | { ok: false; status: number; error: string };

export function validateTarotSaveInput(body: unknown): TarotSaveValidation {
  const b = (body || {}) as Record<string, unknown>;
  const visitorId = String(b.visitorId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(visitorId)) return { ok: false, status: 400, error: '缺少有效的本人标识' };
  const question = String(b.question || '').trim().slice(0, 300);
  const reading = b.reading as Record<string, unknown> | undefined;
  if (!reading || typeof reading !== 'object' || Array.isArray(reading)) return { ok: false, status: 400, error: '缺少塔罗结果' };
  const spread = String(reading.spread || '') as TarotSpread;
  const def = TAROT_SPREADS[spread];
  if (!def) return { ok: false, status: 400, error: '牌阵不在支持列表' };
  const cards = reading.cards;
  if (!Array.isArray(cards) || cards.length !== def.positions.length) return { ok: false, status: 400, error: '牌面数量与牌阵不符' };
  const seen = new Set<string>();
  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i] as Record<string, unknown>;
    if (!c || String(c.position) !== def.positions[i]) return { ok: false, status: 400, error: `第 ${i + 1} 张牌的位置不符` };
    if (!BY_ID.has(String(c.cardId))) return { ok: false, status: 400, error: '牌面不在牌组中' };
    if (!ORIENTATIONS.has(String(c.orientation))) return { ok: false, status: 400, error: '牌面方向不合法' };
    if (seen.has(String(c.cardId))) return { ok: false, status: 400, error: '同一张牌不能重复出现' };
    seen.add(String(c.cardId));
  }
  const summary = String(reading.summary || '').trim();
  if (!summary || summary.length > 6000) return { ok: false, status: 400, error: '解读摘要缺失或过长' };
  const raw = JSON.stringify({ question, reading });
  if (raw.length > 200_000) return { ok: false, status: 413, error: '保存内容过大' };
  const title = (question || `塔罗占卜 · ${def.label}`).slice(0, 80);
  return { ok: true, value: { visitorId, question, reading, spread, title } };
}

// POST /api/tarot/readings — 保存一条塔罗结果
export async function saveTarotReading(req: Request, res: Response) {
  try {
    const v = validateTarotSaveInput(req.body);
    if (!v.ok) return res.status(v.status).json({ success: false, error: v.error });
    const r = await prisma.report.create({
      data: {
        visitorId: v.value.visitorId,
        userId: null,
        type: 'tarot',
        title: v.value.title,
        inputJson: JSON.stringify({ question: v.value.question, spread: v.value.spread }),
        resultJson: JSON.stringify(v.value.reading),
        status: 'free',
      },
      select: { id: true, createdAt: true },
    });
    return res.status(201).json({ success: true, data: { id: r.id, createdAt: r.createdAt.toISOString() } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || '保存失败' });
  }
}

// GET /api/tarot/readings?visitorId=xxx — 本人列表
export async function listTarotReadings(req: Request, res: Response) {
  try {
    const visitorId = String(req.query.visitorId || req.header('x-visitor-id') || '').trim();
    if (!visitorId) return res.status(400).json({ success: false, error: '缺少本人标识' });
    const rows = await prisma.report.findMany({
      where: { visitorId, type: 'tarot' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true },
    });
    return res.json({ success: true, data: rows.map(r => ({ id: r.id, title: r.title, createdAt: r.createdAt.toISOString() })) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
}

// GET /api/tarot/readings/:id?visitorId=xxx — 本人详情
export async function getTarotReading(req: Request, res: Response) {
  try {
    const visitorId = String(req.query.visitorId || req.header('x-visitor-id') || '').trim();
    if (!visitorId) return res.status(400).json({ success: false, error: '缺少本人标识' });
    const row = await prisma.report.findFirst({ where: { id: String(req.params.id), visitorId, type: 'tarot' } });
    if (!row) return res.status(404).json({ success: false, error: '记录不存在或无权访问' });
    let reading: unknown = null;
    try { reading = row.resultJson ? JSON.parse(row.resultJson) : null; } catch { reading = null; }
    return res.json({ success: true, data: { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), reading } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
}

// DELETE /api/tarot/readings/:id?visitorId=xxx — 本人删除
export async function deleteTarotReading(req: Request, res: Response) {
  try {
    const visitorId = String(req.query.visitorId || req.header('x-visitor-id') || '').trim();
    if (!visitorId) return res.status(400).json({ success: false, error: '缺少本人标识' });
    const r = await prisma.report.deleteMany({ where: { id: String(req.params.id), visitorId, type: 'tarot' } });
    if (!r.count) return res.status(404).json({ success: false, error: '记录不存在或无权访问' });
    return res.json({ success: true, data: { deleted: true } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || '删除失败' });
  }
}
