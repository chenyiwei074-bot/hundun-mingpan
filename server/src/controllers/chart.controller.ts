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
      // 排盘数据已就绪：即使 AI 还在跑，也先返回排盘
      if (chart.chartJson) {
        const chartData = JSON.parse(chart.chartJson);
        return res.json({
          success: true,
          data: {
            id: chart.id,
            name: chart.name,
            status: 'processing',
            chartData,
            analysisData: null,
          },
        });
      }
      return res.status(202).json({ success: true, data: { status: 'processing' } });
    }
    // 返回模块化数据
    const chartData = chart.chartJson ? JSON.parse(chart.chartJson) : null;
    const analysisData = chart.analysisJson ? JSON.parse(chart.analysisJson) : null;

    return res.json({
      success: true,
      data: {
        id: chart.id,
        name: chart.name,
        status: 'complete',
        chartData,
        analysisData,
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

// ===== 报告订单 API =====

// POST /api/report/create
export async function createReportOrder(req: Request, res: Response) {
  try {
    const { chartId, email } = req.body;
    if (!chartId || !email) {
      return res.status(400).json({ success: false, error: '缺少参数 chartId 或 email' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: '邮箱格式不正确' });
    }
    // 检查 chart 是否存在
    const chart = await prisma.chart.findUnique({ where: { id: chartId } });
    if (!chart) {
      return res.status(404).json({ success: false, error: '命盘不存在' });
    }
    // 检查是否已有订单
    const existing = await prisma.reportOrder.findFirst({
      where: { chartId, paymentStatus: 'paid' }
    });
    if (existing) {
      return res.json({ success: true, data: { id: existing.id, status: 'already_paid', reportUrl: existing.reportUrl } });
    }
    // 创建订单
    const order = await prisma.reportOrder.create({
      data: { chartId, email, status: 'pending', paymentStatus: 'unpaid' }
    });
    return res.json({ success: true, data: { id: order.id, status: 'pending' } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/report/confirm-payment (预留)
export async function confirmPayment(req: Request, res: Response) {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: '缺少 orderId' });
    }
    const order = await prisma.reportOrder.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    // TODO: 对接真实支付回调
    // 当前直接标记为已支付
    await prisma.reportOrder.update({
      where: { id: orderId },
      data: { paymentStatus: 'paid', status: 'processing' }
    });
    // 异步生成报告
    generateReport(orderId).catch(err => console.error('Generate report error:', err));
    return res.json({ success: true, data: { status: 'processing' } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/report/status/:id
export async function getReportStatus(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const order = await prisma.reportOrder.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    return res.json({
      success: true,
      data: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        reportUrl: order.reportUrl,
        createdAt: order.createdAt,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// 报告生成任务（预留）
async function generateReport(orderId: string): Promise<void> {
  // TODO: 接入 AI 引擎生成完整双盘报告
  // 1. 获取 chart 数据
  // 2. 调用 AI 双盘合参分析
  // 3. 生成 HTML/PDF 报告
  // 4. 存储到 OSS，更新 reportUrl
  // 5. 发送邮件通知
  console.log('[ReportGen] Order:', orderId, '- AI report generation placeholder');
  // 模拟异步生成
  await new Promise(resolve => setTimeout(resolve, 1000));
  await prisma.reportOrder.update({
    where: { id: orderId },
    data: { status: 'completed', reportUrl: '/api/report/download/' + orderId }
  });
}

}
