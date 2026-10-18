import fs from 'fs';
import prisma from '../database';
import { generateChart } from './chart.service';
import { generateMarketing } from './marketing.service';
import { generateAIAnalysis } from './analysis.service';
import type { CreateChartInput } from '../utils/types';

// ── 全免费（2026-10-18 方向）：建盘即生成 AI 解读。以下为成本护栏。 ──
const AI_DAILY_VISITOR_CAP = 8;      // 每访客每日自动解读上限（防滥用；盘面/规则解读不受影响）
const AI_DEDUPE_DAYS = 90;           // 同生辰 90 天内复用已生成解读（0 成本）
const AI_USAGE_LOG = '/srv/chaos/logs/ai-usage.jsonl';
const AI_BUDGET_FILE = '/srv/chaos/state/ai-budget.json';
const AI_DEFAULT_DAILY_TOKENS = 3_000_000;

function todayTokenUsage(): number {
  try {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const text = fs.readFileSync(AI_USAGE_LOG, 'utf-8');
    let sum = 0;
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r.totalTokens && new Date(r.ts) >= dayStart) sum += r.totalTokens;
      } catch { /* skip bad line */ }
    }
    return sum;
  } catch { return 0; }
}

function dailyTokenBudget(): number {
  try {
    const b = JSON.parse(fs.readFileSync(AI_BUDGET_FILE, 'utf-8'));
    return Number(b.daily_tokens) || AI_DEFAULT_DAILY_TOKENS;
  } catch { return AI_DEFAULT_DAILY_TOKENS; }
}

export async function runPipeline(input: CreateChartInput, chartId: string): Promise<void> {
  try {
    // === 纯计算（秒出）===
    const chart = generateChart(input);
    const chartJson = JSON.stringify(chart);
    const marketing = generateMarketing(chart);
    const marketingJson = JSON.stringify(marketing);

    const safeChartJson = chartJson.replace(/\x00/g, '');
    const safeMarketingJson = marketingJson.replace(/\x00/g, '');

    // 盘面先落库（状态 processing）：前端可先看盘，AI 解读随后补
    await prisma.chart.update({
      where: { id: chartId },
      data: { chartJson: safeChartJson, analysisJson: safeMarketingJson, status: 'processing' },
    });

    let aiJson: string | null = null;
    try {
      const used = todayTokenUsage();
      const budget = dailyTokenBudget();
      if (used >= budget) {
        console.warn(`[AI] 今日 tokens ${used} 已达预算 ${budget}，跳过自动解读（盘面/规则解读不受影响）`);
      } else {
        // 闸2：同生辰去重（90 天）
        const rows = await prisma.$queryRaw<any[]>`SELECT birth_data FROM charts WHERE id = ${chartId}`;
        const birthData = rows?.[0]?.birth_data ?? '';
        let reused = false;
        if (birthData) {
          const dup = await prisma.$queryRaw<any[]>`
            SELECT ai_analysis FROM charts
            WHERE birth_data = ${birthData} AND ai_analysis IS NOT NULL AND id <> ${chartId}
              AND created_at > now() - interval '90 days'
            ORDER BY created_at DESC LIMIT 1`;
          if (dup && dup.length > 0) {
            // 只复用「合法结构化分析」；历史坏数据（含 raw / 无 meta）不复用
            try {
              const cached = JSON.parse(dup[0].ai_analysis);
              if (cached && typeof cached === 'object' && !(cached as any).raw && (cached as any).meta) {
                aiJson = dup[0].ai_analysis;
                reused = true;
                console.log('[AI] 命中同生辰缓存，复用解读（0 成本）');
              } else {
                console.warn('[AI] 缓存不是合法分析（raw/无 meta），忽略并重新生成');
              }
            } catch {
              console.warn('[AI] 缓存解析失败，忽略并重新生成');
            }
          }
        }
        if (!reused) {
          // 闸3：访客日上限
          const usedToday = await prisma.$queryRaw<any[]>`
            SELECT count(*)::int AS c FROM charts
            WHERE visitor_id = ${input.visitor_id} AND ai_analysis IS NOT NULL
              AND created_at >= date_trunc('day', now())`;
          const n = usedToday?.[0]?.c ?? 0;
          if (n >= AI_DAILY_VISITOR_CAP) {
            console.warn(`[AI] 访客今日已生成 ${n} 份解读（上限 ${AI_DAILY_VISITOR_CAP}），跳过`);
          } else {
            const res = await generateAIAnalysis(chart as any, input.name || '', undefined, 'brief');
            if (res && typeof res === 'object' && !(res as any).raw && (res as any).meta) {
              aiJson = JSON.stringify(res);
              console.log('[AI] 自动解读完成');
            } else if (res && typeof res === 'object' && (res as any).raw) {
              // 输出被截断/非 JSON：丢弃，避免把脏数据写进缓存
              console.warn('[AI] 输出非 JSON（可能被截断），本次不落库');
            } else {
              aiJson = JSON.stringify(res);
              console.log('[AI] 自动解读完成（结构未校验）');
            }
          }
        }
      }
    } catch (e) {
      console.error('[AI] 自动解读失败（不影响盘面）:', e);
    }

    if (aiJson) {
      await prisma.$executeRaw`UPDATE charts SET ai_analysis = ${aiJson} WHERE id = ${chartId}`;
    }
    await prisma.chart.update({ where: { id: chartId }, data: { status: 'completed' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Pipeline error for chart', chartId, msg);
    await prisma.chart.update({ where: { id: chartId }, data: { status: 'failed', errorMessage: msg } });
  }
}
