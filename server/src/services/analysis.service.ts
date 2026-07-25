import { DeepSeekProvider } from './ai/DeepSeekProvider';
import type { ChartResult } from '../core';
import * as path from 'path';
import * as fs from 'fs';

const provider = new DeepSeekProvider();

function getPrompt(): string {
  const promptPath = path.join(__dirname, '..', 'prompts', 'comprehensive-analysis.txt');
  return fs.readFileSync(promptPath, 'utf-8');
}

function buildChartSummary(chart: ChartResult): Record<string, unknown> {
  const bz = chart.bazi as any;
  const zw = chart.ziwei as any;
  const en = bz.enrichment || {};

  return {
    name: '',
    birthInfo: {
      solar: bz.birthInfo.year + '-' + String(bz.birthInfo.month).padStart(2,'0') + '-' + String(bz.birthInfo.day).padStart(2,'0') + ' ' + String(bz.birthInfo.hour).padStart(2,'0') + ':' + String(bz.birthInfo.minute).padStart(2,'0'),
      gender: bz.birthInfo.gender === 'male' ? '男' : '女',
      lunarDate: zw.lunarDate ? (zw.lunarDate.year + '年' + zw.lunarDate.monthCn + '月' + zw.lunarDate.dayCn) : ''
    },
    bazi: {
      siZhu: {
        year: bz.siZhu.year.gan + bz.siZhu.year.zhi,
        month: bz.siZhu.month.gan + bz.siZhu.month.zhi,
        day: bz.siZhu.day.gan + bz.siZhu.day.zhi,
        hour: bz.siZhu.hour.gan + bz.siZhu.hour.zhi
      },
      dayMaster: bz.dayMaster,
      dayunStart: bz.dayunStart,
      shiShen: bz.shiShen || {},
      cangGan: bz.cangGan || {},
      naYin: bz.naYin || {},
      zhangSheng: bz.zhangSheng || {},
      enrichment: {
        geju: en.格局 || {},
        wangshuai: en.旺衰 || {},
        tiaohou: en.调候用神 || [],
        wuxing: en.五行统计 || {},
        yueling: en.月令 || {}
      },
      dayun: (bz.dayun || []).slice(0, 5).map((d: any) => ({
        ganZhi: d.ganZhi.gan + d.ganZhi.zhi,
        ageRange: d.startAge + '-' + d.endAge + '岁',
        yearRange: d.startYear + '-' + d.endYear,
        shiShen: d.ganShiShen || d.zhiShiShen || ''
      }))
    },
    ziwei: {
      mingGong: zw.gongs?.[0] ? {
        gong: zw.gongs[0].gong,
        ganZhi: (zw.gongs[0].tiangan||'') + (zw.gongs[0].dizhi||''),
        mainStars: zw.gongs[0].mainStars || [],
        auxStars: zw.gongs[0].auxStars || [],
        sihua: zw.gongs[0].sihua || []
      } : null,
      shenGong: zw.gongs?.[zw.shenGongIndex] ? {
        gong: zw.gongs[zw.shenGongIndex].gong,
        ganZhi: (zw.gongs[zw.shenGongIndex].tiangan||'') + (zw.gongs[zw.shenGongIndex].dizhi||''),
        mainStars: zw.gongs[zw.shenGongIndex].mainStars || []
      } : null,
      wuxingJu: zw.wuXingJu?.name || '',
      yinYang: zw.yinYang || '',
      mingZhu: '',
      shenZhu: '',
      allGongs: (zw.gongs || []).map((g: any) => ({
        gong: g.gong,
        ganZhi: (g.tiangan||'') + (g.dizhi||''),
        mainStars: g.mainStars || [],
        auxStars: g.auxStars || [],
        sihua: g.sihua || [],
        daXian: g.daXian ? (g.daXian.startAge + '-' + g.daXian.endAge + '岁') : ''
      }))
    }
  };
}

export async function generateAIAnalysis(chart: ChartResult, name: string): Promise<Record<string, unknown>> {
  const chartSummary = buildChartSummary(chart);
  chartSummary.name = name;

  const prompt = getPrompt();

  console.log('Calling DeepSeek for comprehensive analysis...');
  const startTime = Date.now();

  const response = await provider.generateAnalysis({
    chartData: chartSummary,
    type: 'comprehensive',
    name,
    promptOverride: prompt + '\n\n请基于以下命盘数据生成分析 JSON：'
  });

  const elapsed = Date.now() - startTime;
  console.log('DeepSeek analysis completed in ' + elapsed + 'ms, tokens: ' + (response.tokensUsed || '?'));

  return response.result;
}
