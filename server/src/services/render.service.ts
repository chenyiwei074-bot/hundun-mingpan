import * as fs from 'fs';
import * as path from 'path';
import type { ChartResult } from '../core';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

interface RenderOptions {
  chart: ChartResult;
  analysis?: Record<string, unknown>;
  name?: string;
  currentYear?: number;
}

export function renderPoster(options: RenderOptions): string {
  const { chart, analysis = {}, name = '', currentYear } = options;
  const templatePath = path.join(__dirname, '..', 'templates', 'report-zonghe-poster.html');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const chartFlat = chartToFlat(chart, currentYear);
  const analysisFlat = analysisToFlat(analysis);
  const data = { ...chartFlat, ...analysisFlat };
  if (name) data['name'] = name;
  return renderTemplate(template, data);
}

function calcVirtualAge(birthYear: number, currentYear: number): number {
  return currentYear - birthYear + 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function chartToFlat(chart: any, currentYear?: number): Record<string, any> {
  const out: Record<string, any> = {};
  const bi = chart.bazi.birthInfo;
  const bz = chart.bazi;
  const zw = chart.ziwei;
  currentYear = currentYear || new Date().getFullYear();
  const virtualAge = calcVirtualAge(bi.year, currentYear);

  out['meta.solar_date'] = bi.year + '-' + pad(bi.month) + '-' + pad(bi.day) + ' ' + pad(bi.hour) + ':' + pad(bi.minute);
  if (zw.lunarDate) {
    out['meta.lunar_date'] = zw.lunarDate.year + '年' + zw.lunarDate.monthCn + '月' + zw.lunarDate.dayCn;
  } else {
    out['meta.lunar_date'] = '-';
  }
  out['meta.gender_full'] = bi.gender === 'male' ? '男（' + (zw.yinYang || '') + '）' : '女（' + (zw.yinYang || '') + '）';
  out['meta.age_virtual'] = virtualAge.toString();
  out['meta.current_year'] = currentYear.toString();
  const now = new Date();
  out['meta.gen_time'] = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
  out['meta.yinyang'] = zw.yinYang || '-';

  const MING_ZHU: any = {'子':'贪狼','丑':'巨门','寅':'禄存','卯':'文曲','辰':'廉贞','巳':'武曲','午':'破军','未':'武曲','申':'廉贞','酉':'文曲','戌':'禄存','亥':'巨门'};
  const SHEN_ZHU: any = {'子':'火星','丑':'天相','寅':'天梁','卯':'天同','辰':'文昌','巳':'天机','午':'火星','未':'天相','申':'天梁','酉':'天同','戌':'文昌','亥':'天机'};
  const mingDizhi = zw.gongs[0]?.dizhi;
  const shenDizhi = DIZHI[zw.shenGongIndex];
  out['ziwei.ming_zhu'] = MING_ZHU[mingDizhi] || '-';
  out['ziwei.shen_zhu'] = SHEN_ZHU[shenDizhi] || '-';
  out['ziwei.zi_dou_jun'] = zw.ziDouJun || '-';
  out['ziwei.wuxing_ju'] = zw.wuXingJu?.name || '-';

  const en = bz.enrichment;
  out['core.geju'] = en?.格局?.primary || '-';
  out['core.geju_confidence'] = en?.格局?.confidence || '-';
  out['core.wangshuai_verdict'] = en?.旺衰?.verdict || '-';
  out['core.wangshuai_score'] = en?.旺衰?.score?.toString() || '-';
  const ws = en?.旺衰?.score ?? 0;
  out['core.wangshuai_pos_pct'] = Math.max(0, Math.min(100, Math.round((ws + 10) * 5))).toString();
  const tc = en?.调候用神 || [];
  out['core.tiaohou.0'] = tc[0] || '-';
  out['core.tiaohou.1'] = tc[1] || '-';
  out['core.tiaohou_confidence'] = '高';

  const yl = en?.五行旺相 || {};
  for (const k of ['木','火','土','金','水']) out['core.yueling.' + k] = yl[k] || '-';

  const wx = en?.五行统计?.withCangGan || en?.五行统计 || {木:0,火:0,土:0,金:0,水:0};
  for (const k of ['木','火','土','金','水']) {
    out['core.wuxing.' + k] = (typeof wx[k] === 'number' ? Math.round(wx[k] * 10) / 10 : wx[k]) ?? '-';
  }
  const wxMax = Math.max(...['木','火','土','金','水'].map(k => +wx[k] || 0)) || 1;
  for (const k of ['木','火','土','金','水']) out['core.wuxing_pct.' + k] = Math.round(((+wx[k] || 0) / wxMax) * 100);

  if (bi.name) out['name'] = bi.name;
  return out;
}

function analysisToFlat(analysis: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (analysis.meta) {
    out['meta.archetype_name'] = analysis.meta.archetype_name;
    out['meta.axis_oneliner'] = analysis.meta.axis_oneliner;
  }
  if (analysis.axes) {
    out['axes.bazi_main'] = analysis.axes.bazi_main;
    out['axes.ziwei_main'] = analysis.axes.ziwei_main;
  }
  if (analysis.consistency) out['ziwei.consistency'] = analysis.consistency;

  for (let i = 0; i < 3; i++) {
    const s = analysis.strengths?.[i] || {};
    out['strengths.' + i + '.title'] = s.title || '-';
    out['strengths.' + i + '.desc'] = s.desc || '-';
    const w = analysis.weaknesses?.[i] || {};
    out['weaknesses.' + i + '.title'] = w.title || '-';
    out['weaknesses.' + i + '.desc'] = w.desc || '-';
  }

  if (analysis.section_01) {
    out['section_01.text'] = analysis.section_01.text || '-';
    out['section_01.word_count'] = analysis.section_01.word_count || '-';
  }
  if (analysis.section_02) {
    out['section_02.conclusion'] = analysis.section_02.conclusion || '-';
  }

  const dims = ['career','wealth','marriage','children','family','health'];
  for (const k of dims) {
    const d = analysis.dim?.[k] || {};
    out['dim.' + k + '.bazi'] = d.bazi || '-';
    out['dim.' + k + '.ziwei'] = d.ziwei || '-';
    out['dim.' + k + '.verdict'] = d.verdict || '-';
    out['dim.' + k + '.verdict_class'] = d.verdict_class || 'verdict-yes';
    out['dim.' + k + '.fused'] = d.fused || '-';
  }

  for (let i = 0; i < 3; i++) {
    const c = analysis.conflicts?.[i] || {};
    out['conflicts.' + i + '.point'] = c.point || '-';
    out['conflicts.' + i + '.bazi'] = c.bazi || '-';
    out['conflicts.' + i + '.ziwei'] = c.ziwei || '-';
    out['conflicts.' + i + '.impact'] = c.impact || '-';
    out['conflicts.' + i + '.impact_class'] = c.impact_class || 'low';
    out['conflicts.' + i + '.advice'] = c.advice || '-';
  }

  if (analysis.final) {
    out['final.life_axis'] = analysis.final.life_axis || '-';
    for (let i = 0; i < 5; i++) {
      const n = analysis.final.nodes?.[i] || {};
      out['final.nodes.' + i + '.age'] = n.age || '-';
      out['final.nodes.' + i + '.year'] = n.year || '-';
      out['final.nodes.' + i + '.event'] = n.event || '-';
    }
    for (let i = 0; i < 3; i++) {
      const r = analysis.final.risks?.[i] || {};
      out['final.risks.' + i + '.range'] = r.range || '-';
      out['final.risks.' + i + '.desc'] = r.desc || '-';
    }
    for (let i = 0; i < 2; i++) {
      const l = analysis.final.leverage?.[i] || {};
      out['final.leverage.' + i + '.title'] = l.title || '-';
      out['final.leverage.' + i + '.desc'] = l.desc || '-';
    }
    for (let i = 0; i < 4; i++) out['final.advice.' + i] = analysis.final.advice?.[i] || '-';
  }

  if (analysis.confidence) {
    for (const k of ['bazi','ziwei','consistency','stability']) {
      out['confidence.' + k + '_level'] = analysis.confidence[k + '_level'] || '-';
      out['confidence.' + k + '_score'] = analysis.confidence[k + '_score'] || '-';
    }
    out['confidence.note'] = analysis.confidence.note || '-';
  }

  return out;
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let html = template;
  for (const k of Object.keys(data)) {
    const escaped = k.replace(/[.*+?^${}()|[]\\]/g, '\\$&');
    html = html.replace(new RegExp('\\{\\{' + escaped + '\\}\\}', 'g'), String(data[k] ?? '-'));
  }
  html = html.replace(/\{\{[a-zA-Z0-9_.]+\}\}/g, '-');
  return html;
}
