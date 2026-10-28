import { NextResponse } from 'next/server';
import { analyzeLiuyao } from '@/lib/liuyao/analysis';
import fs from 'fs';
import { buildReportContext, buildReportPrompt, validateReport } from '@/lib/liuyao/report';
import type { LiuyaoResult } from '@/types/liuyao';

const AI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const AI_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const USAGE_LOG = '/srv/chaos/logs/ai-usage.jsonl';

type CallResult = { report: string; tokens: unknown };

/** 调一次模型；失败直接抛，由外层决定是否降级。 */
async function callModel(prompt: string): Promise<CallResult> {
  const aiRes = await fetch(`${AI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
      // DeepSeek 默认 thinking：4096 token 会被思考占满导致 content 为空（实测 completion=4094、report=""）。
      ...(/deepseek/i.test(AI_MODEL) ? { thinking: { type: 'disabled' } } : {}),
    }),
  });
  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`AI 调用失败: ${aiRes.status} ${err.slice(0, 200)}`);
  }
  const data = await aiRes.json();
  const report = data.choices?.[0]?.message?.content || '';
  // 成本护栏记账；失败不影响返回
  try {
    fs.appendFileSync(USAGE_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      model: AI_MODEL,
      purpose: 'liuyao-report-route',
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      totalTokens: data.usage?.total_tokens ?? null,
    }) + '\n');
  } catch {}
  return { report, tokens: data.usage?.total_tokens ?? null };
}

/** 不合格时的重试指令：把缺什么、犯了什么说清楚，只要求重写正文。 */
function correctionPrompt(validation: { missing: string[]; warnings: string[] }): string {
  const parts: string[] = [];
  if (validation.missing.length) parts.push('缺内容：' + validation.missing.join('、'));
  if (validation.warnings.length) parts.push('问题：' + validation.warnings.join('、'));
  return '\n\n---\n\n上一版不合格：' + parts.join('；')
    + '。请重写全文，严格按上面的骨架与要求：六爻逐条都要写、结论先行、纯中文、不要 JSON/字段名/代码块、结尾带免责句。只输出正文，不要解释。';
}

function isLiuyaoResult(value: unknown): value is LiuyaoResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, any>;
  if (!['time', 'coin', 'number'].includes(String(r.method))) return false;
  if (typeof r.question !== 'string' || typeof r.questionType !== 'string') return false;
  if (!r.date || !r.ganZhi || !r.dayGZ || !r.benGua || !r.bianGua) return false;
  if (!Array.isArray(r.naJia) || r.naJia.length !== 6) return false;
  if (!Array.isArray(r.bianNaJia) || r.bianNaJia.length !== 6) return false;
  if (!Array.isArray(r.yaoRecords) || r.yaoRecords.length !== 6) return false;
  if (!Number.isInteger(r.dayGZ.ganIdx) || !Number.isInteger(r.dayGZ.zhiIdx)) return false;
  if (typeof r.monthZhi !== 'string' || typeof r.xunKong !== 'string') return false;
  return r.naJia.every((y: any) => y && Number.isInteger(y.position) && y.position >= 1 && y.position <= 6
    && typeof y.isDong === 'boolean' && typeof y.label === 'string' && typeof y.liuQin === 'string'
    && typeof y.ganZhi === 'string' && typeof y.naZhi === 'string');
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: '请求格式无效' }, { status: 400 }); }
    const result = (body as { result?: unknown } | null)?.result;
    if (!isLiuyaoResult(result)) {
      return NextResponse.json({ error: '卦象数据不完整或格式不符合要求' }, { status: 400 });
    }
    if (!AI_KEY) {
      return NextResponse.json({ error: '未配置 AI API Key' }, { status: 500 });
    }

    // 1. 排盘分析 + 上下文 + Prompt（全部本地计算，AI 不参与算卦）
    const analysis = analyzeLiuyao(result);
    const context = buildReportContext(result, analysis);
    const prompt = buildReportPrompt(context);

    // 2. 第一次生成
    const first = await callModel(prompt);
    let validation = validateReport(first.report);
    let report = first.report;
    let rewrote = false;

    // 3. 用户裁定（2026-10-23）：不合格自动重写一次
    if (!validation.valid) {
      rewrote = true;
      try {
        const second = await callModel(prompt + correctionPrompt(validation));
        const secondValidation = validateReport(second.report);
        // 重写版更好才替换；两份都不合格时保留缺项更少的
        const score = (v: { missing: string[]; warnings: string[] }) => v.missing.length * 2 + v.warnings.length;
        if (secondValidation.valid || score(secondValidation) <= score(validation)) {
          report = second.report;
          validation = secondValidation;
        }
      } catch (e) {
        // 重写失败就用第一版，前端照常显示并按 validation 标注
        console.error('[liuyao-report] 重写失败:', e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({
      report, context, validation, rewrote,
      // 2026-10-24 契约：只返回已登记、可核验的出处；当前六爻无已入仓底本，留空由前端显示「本站自研」。
      sourceIds: [],
    });
  } catch {
    // 不把内部异常文本回给客户端；错误细节留在服务端排错里。
    console.error('[liuyao-report] internal error');
    return NextResponse.json({ error: '报告生成暂时失败，请稍后重试' }, { status: 500 });
  }
}
