import { Request, Response } from 'express';
import { prisma } from '../database';

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
    const { visitorId, type } = req.query;

    if (!visitorId) {
      return res.status(400).json({ success: false, error: '缺少 visitorId' });
    }

    const where: any = { visitorId: visitorId as string };
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
    const { id } = req.params;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' });
    }

    res.json({
      success: true,
      data: {
        id: report.id,
        type: report.type,
        title: report.title,
        inputJson: report.inputJson,
        resultJson: report.resultJson,
        analysisJson: report.analysisJson,
        reportText: report.reportText,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
}