import { Request, Response } from 'express';
import prisma from '../database';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const liveSince = () => new Date(Date.now() - RETENTION_MS);

// POST /api/reports — 保存报告（游客直连）
export async function saveReport(req: Request, res: Response) {
  try {
    const { visitorId, type, title, inputJson, resultJson, analysisJson, reportText } = req.body;

    if (!visitorId || !type || !title) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    // 确保 User 存在（懒创建）
    let user = await prisma.user.findUnique({ where: { visitorId } });
    if (!user) {
      user = await prisma.user.create({ data: { visitorId } });
    }

    const report = await prisma.report.create({
      data: {
        visitorId,
        userId: user.id,
        type,
        title,
        inputJson: JSON.stringify(inputJson),
        resultJson: resultJson ? JSON.stringify(resultJson) : null,
        analysisJson: analysisJson ? JSON.stringify(analysisJson) : null,
        reportText: reportText || null,
        status: 'free',
      },
    });

    res.json({ success: true, data: { id: report.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '保存失败' });
  }
}

// POST /api/reports/guest — 纯游客保存（不需要 user 关联）
export async function saveGuestReport(req: Request, res: Response) {
  try {
    const { visitorId, type, title, inputJson, resultJson, analysisJson, reportText } = req.body;

    if (!visitorId || !type || !title) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const report = await prisma.report.create({
      data: {
        visitorId,
        userId: null,
        type,
        title,
        inputJson: JSON.stringify(inputJson),
        resultJson: resultJson ? JSON.stringify(resultJson) : null,
        analysisJson: analysisJson ? JSON.stringify(analysisJson) : null,
        reportText: reportText || null,
        status: 'free',
      },
    });

    res.json({ success: true, data: { id: report.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '保存失败' });
  }
}

// GET /api/reports?visitorId=xxx — 获取报告列表
export async function listReports(req: Request, res: Response) {
  try {
    const visitorId = String(req.header('x-visitor-id') || req.query.visitorId || '').trim();
    const type = req.query.type;

    if (!visitorId) {
      return res.status(400).json({ success: false, error: '缺少 visitorId' });
    }

    const where: any = { visitorId: visitorId as string, createdAt: { gte: liveSince() } };
    if (type) where.type = type as string;

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, title: true, status: true, createdAt: true },
      take: 50,
    });

    res.json({ success: true, data: reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
}

// GET /api/reports/:id — 获取报告详情
export async function getReport(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const visitorId = String((req.query.visitorId as string) || req.header('x-visitor-id') || '').trim();

    const report = await prisma.report.findUnique({ where: { id } });

    // 隐私修复（2026-10-18）：报告含姓名/生辰/分析原文，必须校验归属。
    // 用 404 而非 403：不确认报告是否存在，避免被枚举。
    if (!report || !visitorId || report.visitorId !== visitorId || report.createdAt < liveSince()) {
      return res.status(404).json({ success: false, error: '报告不存在或无权访问' });
    }

    // 只下发页面需要的字段；inputJson / resultJson / analysisJson 一律不下发
    const FULL_STATUSES = ['free', 'unlocked', 'paid', 'generated'];
    const canViewFull = FULL_STATUSES.includes(String(report.status || '').toLowerCase());

    res.json({
      success: true,
      data: {
        id: report.id,
        type: report.type,
        title: report.title,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        reportText: canViewFull ? report.reportText : null,
        previewText: null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
}