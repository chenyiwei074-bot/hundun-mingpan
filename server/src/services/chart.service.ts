import { createChart, enrichBazi, getZhiCangGanFull } from '../core';
import type { BirthInfo, ChartResult } from '../core';
import type { CreateChartInput } from '../utils/types';

/**
 * 解析用户输入 → BirthInfo
 */
function parseBirthInfo(input: CreateChartInput): BirthInfo {
  const [datePart, timePart] = input.birthday.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  return {
    year,
    month,
    day,
    hour,
    minute,
    isLunar: input.calendar === '农历',
    gender: input.gender === '男' ? 'male' as const : 'female' as const,
    timeZone: 8,
  };
}

/**
 * 生成完整命盘 (排盘 + 增强)
 */
export function generateChart(input: CreateChartInput): ChartResult {
  const birthInfo: BirthInfo = parseBirthInfo(input);

  // Step 1: Yiqi 算法层 — 四柱 + 紫微 + 大运 + 流年
  const chart: any = createChart(birthInfo);

  // 附加地支藏干 (含十神)
  const dm = chart.bazi.dayMaster;
  const z = chart.bazi.siZhu;
  chart.bazi.cangGan = {
    year: getZhiCangGanFull(z.year.zhi, dm),
    month: getZhiCangGanFull(z.month.zhi, dm),
    day: getZhiCangGanFull(z.day.zhi, dm),
    hour: getZhiCangGanFull(z.hour.zhi, dm),
  };

  // 补 endAge 字段
  if (chart.bazi.dayun && Array.isArray(chart.bazi.dayun)) {
    for (const d of chart.bazi.dayun) {
      if (d.startAge !== undefined && d.endAge === undefined) {
        d.endAge = d.startAge + 9;
      }
    }
  }

  // Step 2: enrichBazi 补层 — 格局/旺衰/调候/刑冲合害/盖头
  const siZhuForEnrich: any = {
    '年': chart.bazi.siZhu.year,
    '月': chart.bazi.siZhu.month,
    '日': chart.bazi.siZhu.day,
    '时': chart.bazi.siZhu.hour,
  };
  chart.bazi.enrichment = enrichBazi(siZhuForEnrich);

  return chart as ChartResult;
}

/**
 * 生成树状文本 dump
 */
export function dumpChartText(chart: ChartResult): string {
  const lines: string[] = [];
  const bi = (chart.bazi as any).birthInfo || (chart.ziwei as any).birthInfo;

  // ---- 紫微斗数部分 ----
  const zw = chart.ziwei as any;
  lines.push('紫微斗数命盘');
  lines.push('┌');
  lines.push('├基本信息');
  lines.push('│  ├性别 : ' + (bi.gender === 'male' ? '男' : '女'));
  lines.push('│  ├阳历: ' + bi.year + '-' + String(bi.month).padStart(2, '0') + '-' + String(bi.day).padStart(2, '0') + ' ' + String(bi.hour).padStart(2, '0') + ':' + String(bi.minute).padStart(2, '0'));
  if (zw.lunarDate) {
    lines.push('│  ├农历: ' + zw.lunarDate.year + '年' + zw.lunarDate.monthCn + '月' + zw.lunarDate.dayCn);
  }
  if (zw.siZhu) {
    const sz = zw.siZhu;
    lines.push('│  ├节气四柱: ' + sz.year.gan + sz.year.zhi + ' ' + sz.month.gan + sz.month.zhi + ' ' + sz.day.gan + sz.day.zhi + ' ' + sz.hour.gan + sz.hour.zhi);
  }
  lines.push('│  ├阴阳: ' + (zw.yinYang || ''));
  lines.push('│  └五行局: ' + (zw.wuXingJu?.name || ''));
  lines.push('│');

  // 十二宫
  lines.push('├命盘十二宫');
  zw.gongs.forEach((g: any, idx: number) => {
    const isLast = idx === zw.gongs.length - 1;
    const prefix = isLast ? '│  └' : '│  ├';
    const childPrefix = isLast ? '│    ' : '│  │';
    const isMing = g.gong === '命宫';
    const marks = isMing ? ' [命]' : '';
    const gongName = g.gong.endsWith('宫') ? g.gong : g.gong + '宫';
    lines.push(prefix + gongName + '[' + g.tiangan + g.dizhi + ']' + marks);
    const main = g.mainStars?.length > 0 ? g.mainStars.join('·') : '无主星';
    lines.push(childPrefix + '├主星: ' + main);
    const aux = g.auxStars?.length > 0 ? g.auxStars.join('·') : '无';
    lines.push(childPrefix + '├辅星: ' + aux);
    if (g.sihua?.length > 0) {
      lines.push(childPrefix + '├四化: ' + g.sihua.map((s: any) => s.star + s.hua).join('·'));
    }
    if (g.daXian) {
      const dxMark = g.daXian.isCurrent ? '★当前' : '';
      lines.push(childPrefix + '└大限: ' + g.daXian.startAge + '-' + g.daXian.endAge + '虚岁 ' + dxMark);
    }
    if (!isLast) lines.push('│  │');
  });

  // ---- 八字部分 ----
  const bz = chart.bazi as any;
  lines.push('');
  lines.push('八字命盘');
  lines.push('┌');
  const sz = bz.siZhu;
  lines.push('├四柱: ' + sz.year.gan + sz.year.zhi + ' ' + sz.month.gan + sz.month.zhi + ' ' + sz.day.gan + sz.day.zhi + ' ' + sz.hour.gan + sz.hour.zhi);
  lines.push('├日主: ' + bz.dayMaster);
  lines.push('├大运起运: ' + bz.dayunStart + '岁');

  if (bz.dayun?.length > 0) {
    lines.push('├大运');
    bz.dayun.slice(0, 8).forEach((d: any, i: number) => {
      const prefix = i === Math.min(7, bz.dayun.length - 1) ? '│  └' : '│  ├';
      lines.push(prefix + d.startYear + '-' + d.endYear + '  ' + d.ganZhi.gan + d.ganZhi.zhi);
    });
  }

  const en = bz.enrichment;
  if (en) {
    lines.push('│');
    lines.push('├算法补层');
    lines.push('│  ├格局: ' + (en.格局?.primary || '-') + ' (置信度: ' + (en.格局?.confidence || '-') + ')');
    const ws = en.旺衰;
    if (ws) {
      lines.push('│  ├旺衰: ' + (ws.verdict || '-') + ' (score=' + (ws.score ?? '-') + ')');
    }
    if (en.调候用神) {
      lines.push('│  ├调候用神: ' + en.调候用神.join('、'));
    }
  }

  return lines.join('\n');
}

/**
 * 提取免费版摘要
 */
export function extractFreeSummary(chart: ChartResult, analysis?: Record<string, unknown> | null): {
  bazi: Record<string, unknown>;
  ziwei: Record<string, unknown>;
  keywords: string[];
} {
  const bz = chart.bazi as any;
  const zw = chart.ziwei as any;

  const bazi = {
    siZhu: {
      year: bz.siZhu.year.gan + bz.siZhu.year.zhi,
      month: bz.siZhu.month.gan + bz.siZhu.month.zhi,
      day: bz.siZhu.day.gan + bz.siZhu.day.zhi,
      hour: bz.siZhu.hour.gan + bz.siZhu.hour.zhi,
    },
    dayMaster: bz.dayMaster,
    geju: bz.enrichment?.格局?.primary || '-',
    wangshuai: bz.enrichment?.旺衰?.verdict || '-',
    tiaohou: bz.enrichment?.调候用神 || [],
  };

  const mingDizhi = zw.gongs[0]?.dizhi || '';
  const shenDizhi = zw.gongs[zw.shenGongIndex]?.dizhi || '';

  const ziwei = {
    mingGong: '命宫' + mingDizhi,
    shenGong: '身宫' + shenDizhi,
    mainStars: zw.gongs[0]?.mainStars || [],
    sihua: (zw.gongs[0]?.sihua || []).map((s: any) => s.star + s.hua),
  };

  const dim = (analysis as any)?.dim;
  const keywords = [
    dim?.career?.verdict || bz.enrichment?.格局?.primary || '格局待定',
    dim?.wealth?.verdict || (bz.dayMaster + '日主'),
    dim?.marriage?.verdict || (bz.enrichment?.旺衰?.verdict || '中和'),
  ].filter((k: string) => k && k !== '-').slice(0, 3)

  return { bazi, ziwei, keywords };
}
