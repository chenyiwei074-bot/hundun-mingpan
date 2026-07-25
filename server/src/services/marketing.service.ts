import type { ChartResult } from '../core';

export interface MarketingCopy {
  title: string;
  hook: string;
  paywall_text: string;
}

/**
 * 规则引擎生成营销文案
 * 基于命盘数据自动生成，LLM 增强预留接口
 */
export function generateMarketing(chart: ChartResult): MarketingCopy {
  const bz = chart.bazi as any;
  const en = bz.enrichment || {};
  const zw = chart.ziwei as any;

  const dayMaster = bz.dayMaster || '?';
  const geju = en.格局?.primary || '普通格局';
  const wangshuai = en.旺衰?.verdict || '中和';
  const tiaohou = en.调候用神 || [];
  const mingGong = zw.gongs?.[0];
  const mainStar = mingGong?.mainStars?.[0] || '';

  // 五行强弱分析
  const wx = en.五行统计?.withCangGan || {};
  const topElement = getTopElement(wx);

  // 生成 title
  const title = generateTitle(dayMaster, geju, wangshuai, topElement);

  // 生成 hook
  const hook = generateHook(geju, wangshuai, tiaohou, mainStar);

  // 生成 paywall_text
  const paywallText = generatePaywallText(dayMaster, geju, wangshuai, mingGong);

  return { title, hook, paywall_text: paywallText };
}

function getTopElement(wx: Record<string, number>): string {
  let max = 0;
  let top = '';
  for (const [k, v] of Object.entries(wx)) {
    if (v > max) { max = v; top = k; }
  }
  return top;
}

function generateTitle(dm: string, geju: string, ws: string, topEl: string): string {
  const templates = [
    '你的' + geju + '不靠蛮力，靠对时机的精准把握',
    '别再用普通人的方式努力——你命盘中的' + dm + '日主有话要说',
    dm + '日主的你，真正的优势不在勤奋，而在' + (ws === '偏弱' ? '借势' : '定力'),
    'AI 解读你的' + geju + '：为什么你总在关键时刻' + (ws === '偏强' ? '顶得住' : '需要贵人'),
    '命盘中' + topEl + '气最旺——这是你最容易成事的赛道',
    '你的' + geju + '藏着三个被忽略的财富密码',
    dm + '日' + geju + '：你的天赋配置比90%的人更适合' + (ws === '偏强' ? '创业' : '策略型工作'),
  ];

  // 根据日主和格局选模板
  const idx = (dm.charCodeAt(0) + geju.length) % templates.length;
  return templates[idx];
}

function generateHook(geju: string, ws: string, th: string[], ms: string): string {
  const parts: string[] = [];

  if (geju && geju !== '普通格局') {
    parts.push(geju + '的完整运作逻辑');
  }
  if (ms) {
    parts.push(ms + '坐命宫的深层解读');
  }
  if (th.length > 0) {
    parts.push(th.slice(0, 2).join('') + '调候的真实含义');
  }
  parts.push((ws === '偏弱' ? '如何借势翻盘' : '如何守住优势'));
  parts.push('未来五年关键转折节点');

  // 随机取2-3个
  const shuffled = parts.sort(() => Math.random() - 0.5);
  return '完整版解析：' + shuffled.slice(0, 3).join(' · ');
}

function generatePaywallText(dm: string, geju: string, ws: string, mingGong: any): string {
  const benefits = [
    { title: '事业突破点', desc: dm + '日主最佳行业方向 + ' + geju + '发力窗口期' },
    { title: '财富节奏', desc: '大运财气走势图，精准标注积累期与扩张期' },
    { title: '感情走向', desc: '八字合盘 + 紫微夫妻宫，解读你的缘分地图' },
    { title: '未来五年', desc: '逐年分析关键转折、高风险窗口与最佳行动时机' },
    { title: '白话导读', desc: '零术语，像朋友聊天一样读懂 8000 字命盘解读' },
    { title: '专业报告', desc: '十神 · 格局 · 旺衰 · 调候 · 大运流年完整精要' },
  ];

  return JSON.stringify(benefits);
}

/**
 * LLM 增强接口（预留）
 * 传入 chart + 现有 marketing → 返回优化后的 copy
 */
export interface LLMMarketingEnhancer {
  enhance(chart: ChartResult, base: MarketingCopy): Promise<MarketingCopy>;
}

/**
 * 默认无 LLM 增强器
 */
export const noopEnhancer: LLMMarketingEnhancer = {
  async enhance(_chart, base) { return base; },
};
