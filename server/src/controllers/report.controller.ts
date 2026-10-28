import { Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import prisma from '../database';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const liveSince = () => new Date(Date.now() - RETENTION_MS);
const REPORT_TYPES = ['bazi', 'ziwei', 'liuyao', 'tarot'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const jsonObject = (maxBytes: number) => z.record(z.unknown()).superRefine((value, ctx) => {
  let bytes = 0;
  try { bytes = Buffer.byteLength(JSON.stringify(value)); } catch { bytes = maxBytes + 1; }
  if (bytes > maxBytes) ctx.addIssue({ code: 'custom', message: 'JSON 字段过大' });
});

const writeSchema = z.object({
  visitorId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/),
  type: z.enum(REPORT_TYPES),
  title: z.string().trim().min(1).max(120),
  inputJson: jsonObject(20_000),
  resultJson: jsonObject(300_000).optional().nullable(),
  analysisJson: jsonObject(100_000).optional().nullable(),
  reportText: z.string().trim().min(1).max(200_000).optional().nullable(),
  sourceKey: z.string().trim().min(1).max(160).optional(),
}).strict();

const publicStatus = (status: unknown): 'FREE' | 'GENERATING' | 'UNLOCKED' | 'FAILED' | 'UNKNOWN' => {
  switch (String(status || '').toLowerCase()) {
    case 'free': return 'FREE';
    case 'generating': return 'GENERATING';
    case 'unlocked':
    case 'paid':
    case 'generated': return 'UNLOCKED';
    case 'failed': return 'FAILED';
    default: return 'UNKNOWN';
  }
};

const fullStatus = (status: unknown) => ['free', 'unlocked', 'paid', 'generated'].includes(String(status || '').toLowerCase());

function stableReportId(visitorId: string, type: ReportType, sourceKey: string): string {
  return 'rpt_' + createHash('sha256').update(`${visitorId}|${type}|${sourceKey}`).digest('hex').slice(0, 24);
}

async function writeReport(body: unknown, withUser: boolean, res: Response) {
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ success: false, error: '报告字段不符合要求或内容过大' });
  const data = parsed.data;
  // 有正文才算报告；空记录不能进入“我的报告”并显示成免费可读。
  if (!data.reportText && data.type !== 'tarot') {
    return res.status(400).json({ success: false, error: '报告正文不能为空' });
  }
  // 非塔罗报告必须有稳定来源键，服务端据此 upsert，刷新/重开不会新增重复记录。
  if (data.type !== 'tarot' && !data.sourceKey) {
    return res.status(400).json({ success: false, error: '缺少报告来源标识' });
  }
  let user: { id: string } | null = null;
  if (withUser) {
    user = await prisma.user.findUnique({ where: { visitorId: data.visitorId } });
    if (!user) user = await prisma.user.create({ data: { visitorId: data.visitorId } });
  }
  const record = {
    visitorId: data.visitorId,
    userId: user?.id ?? null,
    type: data.type,
    title: data.title,
    inputJson: JSON.stringify(data.inputJson),
    resultJson: data.resultJson ? JSON.stringify(data.resultJson) : null,
    analysisJson: data.analysisJson ? JSON.stringify(data.analysisJson) : null,
    reportText: data.reportText || null,
    status: 'free',
  };
  if (data.sourceKey) {
    const id = stableReportId(data.visitorId, data.type, data.sourceKey);
    const saved = await prisma.report.upsert({
      where: { id },
      update: record,
      create: { id, ...record },
    });
    return res.json({ success: true, data: { id: saved.id } });
  }
  const saved = await prisma.report.create({ data: record });
  return res.json({ success: true, data: { id: saved.id } });
}

// POST /api/reports — 保存报告（游客直连）
export async function saveReport(req: Request, res: Response) {
  try {
    return await writeReport(req.body, true, res);
  } catch (error) {
    console.error('[reports] save failed:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '保存失败，请稍后重试' });
  }
}

// POST /api/reports/guest — 纯游客保存（不需要 user 关联）
export async function saveGuestReport(req: Request, res: Response) {
  try {
    return await writeReport(req.body, false, res);
  } catch (error) {
    console.error('[reports] guest save failed:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '保存失败，请稍后重试' });
  }
}

// GET /api/reports?type=... — 获取报告列表（归属走 x-visitor-id；query 仅过渡兼容）
export async function listReports(req: Request, res: Response) {
  try {
    const visitorId = String(req.header('x-visitor-id') || req.query.visitorId || '').trim();
    const type = req.query.type;
    if (!visitorId) return res.status(400).json({ success: false, error: '缺少本人标识' });

    const where: any = { visitorId, createdAt: { gte: liveSince() }, reportText: { not: null } };
    if (type && REPORT_TYPES.includes(String(type) as ReportType)) where.type = String(type);

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, title: true, status: true, createdAt: true },
      take: 50,
    });

    res.json({ success: true, data: reports.map(r => ({ ...r, status: publicStatus(r.status) })) });
  } catch (error) {
    console.error('[reports] list failed:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '查询失败，请稍后重试' });
  }
}

// GET /api/reports/:id — 获取报告详情
export async function getReport(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const visitorId = String(req.header('x-visitor-id') || req.query.visitorId || '').trim();
    const report = await prisma.report.findUnique({ where: { id } });

    // 隐私：不确认报告是否存在，避免枚举。
    if (!report || !visitorId || report.visitorId !== visitorId || report.createdAt < liveSince()
      || (report.type !== 'tarot' && !report.reportText)) {
      return res.status(404).json({ success: false, error: '报告不存在或无权访问' });
    }

    let chartId: string | null = null;
    try {
      const input = JSON.parse(report.inputJson || '{}');
      if (typeof input?.chartId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(input.chartId)) chartId = input.chartId;
    } catch {}

    res.json({
      success: true,
      data: {
        id: report.id,
        type: report.type,
        title: report.title,
        status: publicStatus(report.status),
        createdAt: report.createdAt.toISOString(),
        reportText: fullStatus(report.status) ? report.reportText : null,
        previewText: null,
        chartId,
      },
    });
  } catch (error) {
    console.error('[reports] detail failed:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ success: false, error: '查询失败，请稍后重试' });
  }
}
