import prisma from '../database';
import { generateChart } from './chart.service';
import { renderPoster } from './render.service';
import { generateMarketing } from './marketing.service';
import { generateAIAnalysis } from './analysis.service';
import type { CreateChartInput } from '../utils/types';

export async function runPipeline(input: CreateChartInput, chartId: string): Promise<void> {
  try {
    // === Phase 1: 纯计算（秒出） ===
    const chart = generateChart(input);
    const chartJson = JSON.stringify(chart);
    const marketing = generateMarketing(chart);
    const marketingJson = JSON.stringify(marketing);

    // 立即保存基本信息，让前端可以马上展示
    const safeChartJson = chartJson.replace(/\x00/g, '');
    const safeMarketingJson = marketingJson.replace(/\x00/g, '');

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        chartJson: safeChartJson,
        analysisJson: safeMarketingJson,  // 临时：先放 marketing，AI 完成后覆盖
        status: 'processing',  // 仍在处理中，但已有基础数据
      },
    });

    // === Phase 2: AI 分析（异步，10-30秒） ===
    let aiAnalysis: Record<string, unknown> = {};
    try {
      aiAnalysis = await generateAIAnalysis(chart, input.name);
      console.log('AI analysis generated for chart ' + chartId);
    } catch (aiError) {
      console.error('AI analysis failed, using defaults:', (aiError as Error).message);
    }

    // === Phase 3: 海报生成 ===
    const merged = { marketing, ...aiAnalysis };
    const analysisJson = JSON.stringify(merged);
    const posterHtml = renderPoster({ chart, analysis: merged, name: input.name });

    const safePosterHtml = posterHtml.replace(/\x00/g, '');
    const safeAnalysisJson = analysisJson.replace(/\x00/g, '');

    // 最终保存完整结果
    await prisma.chart.update({
      where: { id: chartId },
      data: {
        chartJson: safeChartJson,
        analysisJson: safeAnalysisJson,
        posterHtml: safePosterHtml,
        posterUrl: '/api/chart/poster/' + chartId,
        status: 'completed',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Pipeline error for chart', chartId, msg);
    await prisma.chart.update({
      where: { id: chartId },
      data: { status: 'failed', errorMessage: msg },
    });
  }
}
