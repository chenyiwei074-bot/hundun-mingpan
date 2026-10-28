import type { Request, Response } from 'express';
import prisma from '../database';
import { readVisitorId } from '../utils/visitor';
import {
  hashShareToken, isChartComplete, isShareActive, isValidShareToken, newShareToken, sanitizeSharedChart, shareExpiry,
} from '../services/share.service';

/** 读回执/结果时用的 AI 解读原始列（与 chart.controller 同一条 SQL，避免改 prisma schema）。 */
async function readAiAnalysis(chartId: string): Promise<unknown> {
  try {
    const rows = await prisma.$queryRaw<any[]>`SELECT ai_analysis FROM charts WHERE id = ${chartId}`;
    const raw = rows?.[0]?.ai_analysis ?? null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** GET /api/chart/:id/share-links —— 所有者查看现存链接状态；不返回原始 token。 */
export async function listShareLinks(req: Request, res: Response) {
  try {
    const visitorId = readVisitorId(req);
    if (!visitorId) return res.status(401).json({ success: false, error: '缺少本人标识' });
    const chart = await prisma.chart.findUnique({ where: { id: String(req.params.id || '') } });
    if (!chart || chart.visitorId !== visitorId) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }
    const shares = await prisma.chartShare.findMany({
      where: { chartId: chart.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, revokedAt: true },
    });
    return res.json({ success: true, data: shares.map(share => ({
      shareId: share.id,
      createdAt: share.createdAt.toISOString(),
      expiresAt: share.expiresAt.toISOString(),
      revokedAt: share.revokedAt ? share.revokedAt.toISOString() : null,
      active: !share.revokedAt && share.expiresAt.getTime() > Date.now(),
    })) });
  } catch (error) {
    console.error('[chart/share] 列表失败:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/** DELETE /api/chart/:id/share-links —— 撤回该命盘全部尚未撤回的链接。 */
export async function revokeAllShareLinks(req: Request, res: Response) {
  try {
    const visitorId = readVisitorId(req);
    if (!visitorId) return res.status(401).json({ success: false, error: '缺少本人标识' });
    const chart = await prisma.chart.findUnique({ where: { id: String(req.params.id || '') } });
    if (!chart || chart.visitorId !== visitorId) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }
    const result = await prisma.chartShare.updateMany({
      where: { chartId: chart.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    return res.json({ success: true, data: { revoked: result.count } });
  } catch (error) {
    console.error('[chart/share] 全部撤回失败:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/** POST /api/chart/:id/share-links —— 所有者生成 7 天只读分享链接。 */
export async function createShareLink(req: Request, res: Response) {
  try {
    const visitorId = readVisitorId(req);
    if (!visitorId) return res.status(401).json({ success: false, error: '缺少本人标识' });
    const chart = await prisma.chart.findUnique({ where: { id: String(req.params.id || '') } });
    if (!chart || chart.visitorId !== visitorId) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }
    if (!isChartComplete(chart.status)) {
      return res.status(409).json({ success: false, error: '命盘尚未生成完成，暂不能分享' });
    }
    const token = newShareToken();
    const expiresAt = shareExpiry();
    const share = await prisma.chartShare.create({
      data: { chartId: chart.id, tokenHash: hashShareToken(token), expiresAt },
    });
    return res.status(201).json({
      success: true,
      data: { shareId: share.id, token, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    console.error('[chart/share] 创建失败:', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/** GET /api/chart/share/:token —— 凭令牌读只读结果；无效/撤回/过期/命盘删除统一 404。 */
export async function getSharedChart(req: Request, res: Response) {
  try {
    const token = String(req.params.token || '');
    if (!isValidShareToken(token)) return notFound(res);
    const share = await prisma.chartShare.findUnique({ where: { tokenHash: hashShareToken(token) } });
    if (!share || !isShareActive(share)) return notFound(res);
    const chart = await prisma.chart.findUnique({ where: { id: share.chartId } });
    if (!chart || !isChartComplete(chart.status)) return notFound(res);

    const chartData = chart.chartJson ? JSON.parse(chart.chartJson) : null;
    const analysisData = chart.analysisJson ? JSON.parse(chart.analysisJson) : null;
    const aiAnalysis = await readAiAnalysis(chart.id);
    const safe = sanitizeSharedChart({
      chartData, analysisData, aiAnalysis, name: chart.name, visitorId: chart.visitorId,
    });
    return res.json({
      success: true,
      data: { ...safe, expiresAt: new Date(share.expiresAt).toISOString() },
    });
  } catch (error) {
    console.error('[chart/share] 读取失败:', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

/** DELETE /api/chart/:id/share-links/:shareId —— 仅所有者可撤回，撤回后立即失效。 */
export async function revokeShareLink(req: Request, res: Response) {
  try {
    const visitorId = readVisitorId(req);
    if (!visitorId) return res.status(401).json({ success: false, error: '缺少本人标识' });
    const chart = await prisma.chart.findUnique({ where: { id: String(req.params.id || '') } });
    if (!chart || chart.visitorId !== visitorId) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }
    const share = await prisma.chartShare.findFirst({
      where: { id: String(req.params.shareId || ''), chartId: chart.id },
    });
    if (!share) return res.status(404).json({ success: false, error: '分享链接不存在' });
    if (!share.revokedAt) {
      await prisma.chartShare.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
    }
    return res.json({ success: true, data: { shareId: share.id, revoked: true } });
  } catch (error) {
    console.error('[chart/share] 撤回失败:', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

function notFound(res: Response) {
  return res.status(404).json({ success: false, error: '分享链接不存在或已失效' });
}
