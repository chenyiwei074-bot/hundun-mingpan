import prisma from '../database';
import { generateChart } from './chart.service';
import { renderPoster } from './render.service';
import { generateMarketing } from './marketing.service';
import { generateAIAnalysis } from './analysis.service';
import type { CreateChartInput } from '../utils/types';

export async function runPipeline(input: CreateChartInput, chartId: string): Promise<void> {
  try {
    const chart = generateChart(input);
    const chartJson = JSON.stringify(chart);

    const marketing = generateMarketing(chart);

    let aiAnalysis: Record<string, unknown> = {};
    try {
      aiAnalysis = await generateAIAnalysis(chart, input.name);
      console.log('AI analysis generated successfully for chart ' + chartId);
    } catch (aiError) {
      console.error('AI analysis failed, using defaults:', (aiError as Error).message);
    }

    const merged = { marketing, ...aiAnalysis };
    const analysisJson = JSON.stringify(merged);

    const posterHtml = renderPoster({ chart, analysis: merged, name: input.name });

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
