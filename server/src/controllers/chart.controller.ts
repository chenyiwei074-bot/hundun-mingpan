import { Request, Response } from 'express';
import prisma from '../database';
import { generateChart, extractFreeSummary } from '../services/chart.service';
import { runPipeline } from '../services/pipeline.service';
import { CreateChartSchema } from '../utils/types';

const DAILY_FREE_LIMIT = 3; // 每日免费3次

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

async function checkDailyUsage(visitorId: string): Promise<{ used: number; remaining: number }> {
  const { start, end } = getTodayRange();
  const count = await prisma.usageLog.count({
    where: { visitorId, createdAt: { gte: start, lte: end } },
  });
  return { used: count, remaining: Math.max(0, DAILY_FREE_LIMIT - count) };
}

// POST /api/chart/create
export async function createChart(req: Request, res: Response) {
  try {
    const input = CreateChartSchema.parse(req.body);

    // 序列化 birthData
    const [datePart, timePart] = input.birthday.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const birthData = JSON.stringify({
      year, month, day, hour, minute,
      isLunar: input.calendar === '农历',
      calendar: input.calendar,
    });

    // 创建记录
    const chart = await prisma.chart.create({
      data: {
        visitorId: input.visitor_id,
        name: input.name,
        gender: input.gender,
        birthData,
        birthPlace: input.birthPlace || '',
        currentPlace: input.currentPlace || '',
        status: 'processing',
      },
    });

    // 记录用量
    await prisma.usageLog.create({
      data: { visitorId: input.visitor_id, action: 'chart_create' },
    });

    // 异步流水线
    runPipeline(input, chart.id).catch(err => console.error('Pipeline error:', err));

    return res.json({
      success: true,
      data: {
        id: chart.id,
        status: 'processing',
        quota: { used: 0, remaining: 999, limit: 999 },
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ success: false, error: '参数校验失败', details: error.errors });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/chart/status/:id
export async function getChartStatus(req: Request, res: Response) {
  try {
    const chart = await prisma.chart.findUnique({ where: { id: req.params.id as string } });
    if (!chart) return res.status(404).json({ success: false, error: '命盘不存在' });
    return res.json({
      success: true,
      data: { id: chart.id, status: chart.status, createdAt: chart.createdAt.toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/chart/result/:id
export async function getChartResult(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const chart = await prisma.chart.findUnique({ where: { id } });

    if (!chart) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }

    if (chart.status === 'failed') {
      return res.json({ success: false, data: { status: 'failed' } });
    }

    if (chart.status === 'processing' || chart.status === 'pending') {
      return res.status(202).json({ success: true, data: { status: 'processing' } });
    }

    // 返回完整数据
    return res.json({
      success: true,
      data: {
        id: chart.id,
        name: chart.name,
        status: 'complete',
        freeContent: chart.analysisJson ? JSON.parse(chart.analysisJson) : null,
        posterHtml: chart.posterHtml || null,
      },
    });
  } catch (error) {
    console.error('Get chart result error:', error);
    return res.status(500).json({ success: false, error: '服务器错误' });
  }
}

// GET /api/chart/poster/:id
export async function getPoster(req: Request, res: Response) {
  try {
    const chart = await prisma.chart.findUnique({ where: { id: req.params.id as string } });
    if (!chart?.posterHtml) return res.status(404).json({ success: false, error: '海报不存在' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(chart.posterHtml);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}


// POST /api/event
export async function trackEvent(req: Request, res: Response) {
  try {
    const { event_name, visitor_id, chart_id } = req.body;
    if (!event_name || !visitor_id) {
      return res.status(400).json({ success: false, error: '缺少 event_name 或 visitor_id' });
    }

    await prisma.event.create({
      data: {
        eventName: event_name,
        visitorId: visitor_id,
        chartId: chart_id || null,
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/admin/stats
export async function getStats(req: Request, res: Response) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const eventTypes = ['page_view', 'create_click', 'chart_complete', 'wechat_click'];

    // 今日统计
    const today: Record<string, number> = {};
    for (const ev of eventTypes) {
      today[ev] = await prisma.event.count({
        where: { eventName: ev, createdAt: { gte: todayStart, lte: todayEnd } },
      });
    }

    // 累计统计
    const total: Record<string, number> = {};
    for (const ev of eventTypes) {
      total[ev] = await prisma.event.count({ where: { eventName: ev } });
    }

    // 转化率
    const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%';
    const conversion = {
      visit_to_create: pct(total.create_click, total.page_view),
      create_to_complete: pct(total.chart_complete, total.create_click),
      complete_to_wechat: pct(total.wechat_click, total.chart_complete),
    };

    return res.json({ success: true, data: { today, total, conversion } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/chart/quota?visitor_id=xxx
export async function getQuota(req: Request, res: Response) {
  try {
    const vid = req.query.visitor_id as string;
    if (!vid) return res.status(400).json({ success: false, error: '缺少 visitor_id' });
    return res.json({
    success: true,
    data: { used: 0, remaining: 999, limit: 999 },
  });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
