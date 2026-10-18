import { NextResponse } from 'next/server';
import { analyzeLiuyao } from '@/lib/liuyao/analysis';
import fs from 'fs';
import { buildReportContext, buildReportPrompt, validateReport } from '@/lib/liuyao/report';
import type { LiuyaoResult } from '@/types/liuyao';

const AI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const AI_KEY  = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

export async function POST(req: Request) {
  try {
    const { result } = await req.json() as { result: LiuyaoResult };
    if (!result || !result.naJia) {
      return NextResponse.json({ error: '无效的卦象数据' }, { status: 400 });
    }

    // 1. 分析
    const analysis = analyzeLiuyao(result);

    // 2. 报告上下文
    const context = buildReportContext(result, analysis);

    // 3. Prompt
    const prompt = buildReportPrompt(context);

    // 4. 调用 AI
    if (!AI_KEY) {
      return NextResponse.json({ error: '未配置 AI API Key' }, { status: 500 });
    }

    const aiRes = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
          // DeepSeek 默认 thinking：4096 token 会被思考占满导致 content 为空（实测 completion=4094、report=""）。
          // 报告不需要思考链 → 显式关闭，同时省 5× 成本。
          ...(/deepseek/i.test(AI_MODEL) ? { thinking: { type: 'disabled' } } : {}),
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('AI API error:', aiRes.status, err);
      return NextResponse.json({ error: `AI 调用失败: ${aiRes.status}` }, { status: 502 });
    }

    const aiData = await aiRes.json();
    // AI 用量记账（全免费站点的成本护栏；失败不影响返回）
    try {
      fs.appendFileSync('/srv/chaos/logs/ai-usage.jsonl', JSON.stringify({
        ts: new Date().toISOString(),
        model: AI_MODEL,
        purpose: 'liuyao-report-route',
        promptTokens: aiData.usage?.prompt_tokens ?? null,
        completionTokens: aiData.usage?.completion_tokens ?? null,
        totalTokens: aiData.usage?.total_tokens ?? null,
      }) + '\n');
    } catch {}
    const report = aiData.choices?.[0]?.message?.content || '';

    // 5. 质量检查
    const validation = validateReport(report);

    return NextResponse.json({ report, context, validation });
  } catch (e: any) {
    console.error('Report generation error:', e);
    return NextResponse.json({ error: e.message || '未知错误' }, { status: 500 });
  }
}