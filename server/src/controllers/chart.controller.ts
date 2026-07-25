import { Request, Response } from 'express';
import prisma from '../database';
import { generateChart, extractFreeSummary } from '../services/chart.service';
import { runPipeline } from '../services/pipeline.service';
import { CreateChartSchema } from '../utils/types';

const DAILY_FREE_LIMIT = 3;

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

    // 检查每日免费额度
    const usage = await checkDailyUsage(input.visitor_id);
    if (usage.used >= DAILY_FREE_LIMIT) {
      return res.status(429).json({
        success: false,
        error: '今日免费排盘次数已用完',
        tip: '如需继续体验，请添加混沌阁客服微信获取深度解析',
        data: { used: usage.used, limit: DAILY_FREE_LIMIT },
      });
    }

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
        quota: { used: usage.used + 1, remaining: usage.remaining - 1, limit: DAILY_FREE_LIMIT },
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
    const chart = await prisma.chart.findUnique({ where: { id: req.params.id as string } });
    if (!chart) return res.status(404).json({ success: false, error: '命盘不存在' });
    if (chart.status !== 'completed') {
      return res.status(202).json({ success: false, data: { status: chart.status } });
    }

    // 增加免费查看计数
    await prisma.chart.update({
      where: { id: chart.id },
      data: { freeViews: { increment: 1 } },
    });

    // 提取免费内容
    const chartData = JSON.parse(chart.chartJson || '{}');
    const { bazi, ziwei, keywords } = extractFreeSummary(chartData);

    // 提取 marketing 文案
    let unlockDescription = [
      { title: '整体命格解析', desc: '八字格局 + 紫微星曜，全面剖析你的天赋特质' },
      { title: '财富节奏分析', desc: '大运财气走势，精准标注积累期与扩张期' },
      { title: '事业突破方向', desc: '六维度交叉印证，锁定你的职场优势窗口' },
      { title: '感情正缘画像', desc: '八字合盘 + 紫微夫妻宫，解读缘分图谱' },
      { title: '未来五年趋势', desc: '逐年分析关键转折节点与高风险窗口' },
      { title: '风险提醒与趋吉建议', desc: '基于命盘冲突分析，给出可落地的趋吉避凶方案' },
    ];

    if (chart.analysisJson) {
      try {
        const analysis = JSON.parse(chart.analysisJson);
        if (analysis.marketing?.paywall_text) {
          const raw = analysis.marketing.paywall_text;
          unlockDescription = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } catch {}
    }

    return res.json({
      success: true,
      data: {
        id: chart.id,
        name: chart.name,
        posterHtml: chart.posterHtml,
        posterUrl: chart.posterUrl || '/api/chart/poster/' + chart.id,
        freeContent: { bazi, ziwei, keywords },
        unlockDescription,
        freeViews: chart.freeViews,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
    const usage = await checkDailyUsage(vid);
    return res.json({ success: true, data: usage });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
