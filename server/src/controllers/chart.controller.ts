import { Request, Response } from 'express';
import prisma from '../database';
import { generateChart, extractFreeSummary } from '../services/chart.service';
import { runPipeline } from '../services/pipeline.service';
import { CreateChartSchema } from '../utils/types';

const DAILY_FREE_LIMIT = 999; // 测试阶段不限制

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

    // 妫€鏌ユ瘡鏃ュ厤璐归搴?    const usage = await checkDailyUsage(input.visitor_id);
    if (usage.used >= DAILY_FREE_LIMIT) {
      return res.status(429).json({
        success: false,
        error: '浠婃棩鍏嶈垂鎺掔洏娆℃暟宸茬敤瀹?,
        tip: '濡傞渶缁х画浣撻獙锛岃娣诲姞娣锋矊闃佸鏈嶅井淇¤幏鍙栨繁搴﹁В鏋?,
        data: { used: usage.used, limit: DAILY_FREE_LIMIT },
      });
    }

    // 搴忓垪鍖?birthData
    const [datePart, timePart] = input.birthday.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const birthData = JSON.stringify({
      year, month, day, hour, minute,
      isLunar: input.calendar === '鍐滃巻',
      calendar: input.calendar,
    });

    // 鍒涘缓璁板綍
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

    // 璁板綍鐢ㄩ噺
    await prisma.usageLog.create({
      data: { visitorId: input.visitor_id, action: 'chart_create' },
    });

    // 寮傛娴佹按绾?    runPipeline(input, chart.id).catch(err => console.error('Pipeline error:', err));

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
      return res.status(400).json({ success: false, error: '鍙傛暟鏍￠獙澶辫触', details: error.errors });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/chart/status/:id
export async function getChartStatus(req: Request, res: Response) {
  try {
    const chart = await prisma.chart.findUnique({ where: { id: req.params.id as string } });
    if (!chart) return res.status(404).json({ success: false, error: '鍛界洏涓嶅瓨鍦? });
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
    if (!chart) return res.status(404).json({ success: false, error: '鍛界洏涓嶅瓨鍦? });
    if (chart.status !== 'completed') {
      return res.status(202).json({ success: false, data: { status: chart.status } });
    }

    // 澧炲姞鍏嶈垂鏌ョ湅璁℃暟
    await prisma.chart.update({
      where: { id: chart.id },
      data: { freeViews: { increment: 1 } },
    });

    // 鎻愬彇鍏嶈垂鍐呭
    const chartData = JSON.parse(chart.chartJson || '{}');
    const { bazi, ziwei, keywords } = extractFreeSummary(chartData);

    // 鎻愬彇 marketing 鏂囨
    let unlockDescription = [
      { title: '鏁翠綋鍛芥牸瑙ｆ瀽', desc: '鍏瓧鏍煎眬 + 绱井鏄熸洔锛屽叏闈㈠墫鏋愪綘鐨勫ぉ璧嬬壒璐? },
      { title: '璐㈠瘜鑺傚鍒嗘瀽', desc: '澶ц繍璐㈡皵璧板娍锛岀簿鍑嗘爣娉ㄧН绱湡涓庢墿寮犳湡' },
      { title: '浜嬩笟绐佺牬鏂瑰悜', desc: '鍏淮搴︿氦鍙夊嵃璇侊紝閿佸畾浣犵殑鑱屽満浼樺娍绐楀彛' },
      { title: '鎰熸儏姝ｇ紭鐢诲儚', desc: '鍏瓧鍚堢洏 + 绱井澶瀹紝瑙ｈ缂樺垎鍥捐氨' },
      { title: '鏈潵浜斿勾瓒嬪娍', desc: '閫愬勾鍒嗘瀽鍏抽敭杞姌鑺傜偣涓庨珮椋庨櫓绐楀彛' },
      { title: '椋庨櫓鎻愰啋涓庤秼鍚夊缓璁?, desc: '鍩轰簬鍛界洏鍐茬獊鍒嗘瀽锛岀粰鍑哄彲钀藉湴鐨勮秼鍚夐伩鍑舵柟妗? },
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
    if (!chart?.posterHtml) return res.status(404).json({ success: false, error: '娴锋姤涓嶅瓨鍦? });
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
      return res.status(400).json({ success: false, error: '缂哄皯 event_name 鎴?visitor_id' });
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

    // 浠婃棩缁熻
    const today: Record<string, number> = {};
    for (const ev of eventTypes) {
      today[ev] = await prisma.event.count({
        where: { eventName: ev, createdAt: { gte: todayStart, lte: todayEnd } },
      });
    }

    // 绱缁熻
    const total: Record<string, number> = {};
    for (const ev of eventTypes) {
      total[ev] = await prisma.event.count({ where: { eventName: ev } });
    }

    // 杞寲鐜?    const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%';
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
    if (!vid) return res.status(400).json({ success: false, error: '缂哄皯 visitor_id' });
    const usage = await checkDailyUsage(vid);
    return res.json({ success: true, data: usage });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
