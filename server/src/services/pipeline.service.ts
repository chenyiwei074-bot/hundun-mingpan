import prisma from '../database';
import { generateChart } from './chart.service';
import { generateMarketing } from './marketing.service';
import type { CreateChartInput } from '../utils/types';

export async function runPipeline(input: CreateChartInput, chartId: string): Promise<void> {
  try {
    // === 纯计算（秒出）===
    const chart = generateChart(input);
    const chartJson = JSON.stringify(chart);
    const marketing = generateMarketing(chart);
    const marketingJson = JSON.stringify(marketing);

    const safeChartJson = chartJson.replace(/\x00/g, '');
    const safeMarketingJson = marketingJson.replace(/\x00/g, '');

    // 直接完成 — AI 解读为付费功能，不在此处调用
    await prisma.chart.update({
      where: { id: chartId },
      data: {
        chartJson: safeChartJson,
        analysisJson: safeMarketingJson,
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