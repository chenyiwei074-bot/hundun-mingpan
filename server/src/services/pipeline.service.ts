import prisma from '../database';
import { generateChart } from './chart.service';
import { renderPoster } from './render.service';
import { generateMarketing } from './marketing.service';
import type { CreateChartInput } from '../utils/types';

export async function runPipeline(input: CreateChartInput, chartId: string): Promise<void> {
  try {
    const chart = generateChart(input);
    const chartJson = JSON.stringify(chart);

    const marketing = generateMarketing(chart);
    const analysisJson = JSON.stringify({ marketing });

    const posterHtml = renderPoster({ chart, name: input.name });

    // 过滤空字节 (PostgreSQL TEXT 不允许 \x00)
    const safePosterHtml = posterHtml.replace(/\x00/g, '');
    const safeChartJson = chartJson.replace(/\x00/g, '');

    await prisma.chart.update({
      where: { id: chartId },
      data: {
        chartJson: safeChartJson,
        analysisJson,
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
