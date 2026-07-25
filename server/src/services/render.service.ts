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


  // === 八字四柱 (匹配原始模板 {{bazi.柱.字段}}) ===
  const sz = bz.siZhu;
  const cg = bz.cangGan || {};
  const nayinData = bz.naYin || {};
  const zsData = bz.zhangSheng || {};

  ['year','month','day','hour'].forEach(p => {
    const pillar = sz[p];
    out['bazi.'+p+'.gan'] = pillar.gan;
    out['bazi.'+p+'.zhi'] = pillar.zhi;
    out['bazi.'+p+'.naYin'] = nayinData[p] || '';
    out['bazi.'+p+'.zhangSheng'] = zsData[p] || '';
    out['bazi.'+p+'.shiShen'] = '';
    out['bazi.'+p+'.ziZuo'] = '';
    // cangGan HTML
    const cgArr = cg[p] || [];
    out['bazi.'+p+'.cangGanHtml'] = cgArr.map((x:any) => 
      '<span>' + x.gan + '<small>(' + (x.shiShen||'') + ')</small></span>'
    ).join('');
    // Also keep underscore versions for my table
    out['bazi.'+p+'_gan'] = pillar.gan;
    out['bazi.'+p+'_zhi'] = pillar.zhi;
  });
  out['bazi.day_master'] = bz.dayMaster;
  out['bazi.dayMaster'] = bz.dayMaster;
  out['bazi.dayunStart'] = bz.dayunStart || '';

  // === 紫微十二宫 (匹配原始模板 {{gongs.地支.*}}) ===
  zw.gongs.forEach((g: any) => {
    const branch = g.dizhi; // 巳,午,未,申,酉,戌,亥,子,丑,寅,卯,辰
    if (!branch) return;
    out['gongs.'+branch+'.flag'] = g.gong === '命宫' ? '命' : (g.gong === '身宫' ? '身' : '');
    out['gongs.'+branch+'.name'] = g.gong || '';
    out['gongs.'+branch+'.shenBadge'] = g.gong === '身宫' ? '身' : '';
    out['gongs.'+branch+'.ganzhi'] = (g.tiangan||'') + (g.dizhi||'');
    out['gongs.'+branch+'.mainStarsHtml'] = (g.mainStars || []).map((s: string) => '<span>'+s+'</span>').join('') || '';
    out['gongs.'+branch+'.auxStars'] = (g.auxStars || []).join(' · ') || '';
    out['gongs.'+branch+'.smallStars'] = '';
    if (g.sihua && g.sihua.length > 0) {
      out['gongs.'+branch+'.sihua'] = g.sihua.map((s: any) => s.star+s.hua).join(' · ');
    } else {
      out['gongs.'+branch+'.sihua'] = '';
    }
    if (g.daXian) {
      out['gongs.'+branch+'.daxian_range'] = (g.daXian.startAge||'')+'-'+(g.daXian.endAge||'')+'岁 '+(g.daXian.ganZhi?.gan||'')+(g.daXian.ganZhi?.zhi||'');
    } else {
      out['gongs.'+branch+'.daxian_range'] = '';
    }
  });

  // 四化星
  const sihuaStars: any = {};
  zw.gongs.forEach((g: any) => {
    (g.sihua || []).forEach((s: any) => {
      sihuaStars[s.hua] = (sihuaStars[s.hua] || []).concat(s.star);
    });
  });
  out['sihuaStars.lu'] = (sihuaStars['禄'] || []).join('·') || '—';
  out['sihuaStars.quan'] = (sihuaStars['权'] || []).join('·') || '—';
  out['sihuaStars.ke'] = (sihuaStars['科'] || []).join('·') || '—';
  out['sihuaStars.ji'] = (sihuaStars['忌'] || []).join('·') || '—';


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

  // === 头部回退值 ===
  if (!out['meta.archetype_name'] || out['meta.archetype_name'] === '-') {
    const mingStars = (zw.gongs[0]?.mainStars || []).join('') || '';
    const pattern = en?.格局?.primary || '';
    out['meta.archetype_name'] = mingStars ? (mingStars + '坐命' + (pattern ? ' · ' + pattern : '')) : ((bz.dayMaster || '') + '日主' + (pattern ? ' · ' + pattern : ''));
  }
  if (!out['meta.axis_oneliner'] || out['meta.axis_oneliner'] === '-') {
    const dm = bz.dayMaster || '';
    const ws = en?.旺衰?.verdict || '';
    const ms = (zw.gongs[0]?.mainStars || []).join('') || '';
    const mg = (zw.gongs[0]?.tiangan || '') + (zw.gongs[0]?.dizhi || '');
    const pattern = en?.格局?.primary || '';
    const parts: string[] = [];
    if (dm && ws) parts.push(dm + '日主' + ws);
    if (ms && mg) parts.push(ms + '坐命' + mg);
    if (pattern) parts.push(pattern);
    out['meta.axis_oneliner'] = parts.length > 0 ? parts.join('，') : '';
  }
  ['year','month','day','hour'].forEach(p => {
    if (!out['bazi.'+p+'.ziZuo'] || out['bazi.'+p+'.ziZuo'] === '') out['bazi.'+p+'.ziZuo'] = '—';
    if (!out['bazi.'+p+'.shiShen'] || out['bazi.'+p+'.shiShen'] === '') out['bazi.'+p+'.shiShen'] = '—';
  });


  // === 两盘主轴印证 ===
  out['axes.bazi_main'] = (bz.dayMaster || '') + '日主，' + (en?.格局?.primary || '普通格局') + '，日主' + (en?.旺衰?.verdict || '中和') + '。' + ((en?.调候用神||[]).length > 0 ? '调候用神：' + (en?.调候用神||[]).join('、') + '。' : '');
  out['axes.ziwei_main'] = '命宫' + (zw.gongs[0]?.tiangan||'') + (zw.gongs[0]?.dizhi||'') + '，主星' + ((zw.gongs[0]?.mainStars||[]).join('、')||'无') + '，' + (zw.wuXingJu?.name||'') + '局。';

  // === 大运流年 (section_02 + dayun table) ===
  const dayun = bz.dayun || [];
  const dayunLen = Math.min(dayun.length, 10);
  for (let i = 0; i < dayunLen; i++) {
    const d = dayun[i];
    const startYr = d ? (d.startYear || (d.startAge||0) + bi.year) : 0;
    const endYr = d ? (d.endYear || startYr + 9) : 0;
    const gz = d ? (d.ganZhi.gan + d.ganZhi.zhi) : '';
    const range = d ? (d.startAge + '-' + d.endAge + '岁') : '';
    const fullRange = d ? (startYr + '-' + endYr + ' (' + range + ')') : '';
    const isCurrent = (d && d.startYear <= currentYear && d.endYear >= currentYear) || d?.isCurrent;
    out['section_02.bazi.'+i+'.range'] = fullRange || '-';
    out['section_02.bazi.'+i+'.gz'] = gz || '-';
    out['section_02.bazi.'+i+'.shishen'] = (d?.ganShiShen || d?.zhiShiShen || gz) || '-';
    out['section_02.bazi.'+i+'.current_class'] = isCurrent ? 'current' : '';
    out['dayun.'+i+'.age_range'] = range || '-';
    out['dayun.'+i+'.gz'] = gz || '-';
    out['dayun.'+i+'.shishen'] = (d?.ganShiShen || d?.zhiShiShen || gz) || '-';
    out['dayun.'+i+'.current_class'] = isCurrent ? 'current' : '';
  }
  for (let i = dayunLen; i < 10; i++) {
    out['dayun.'+i+'.age_range'] = '-';
    out['dayun.'+i+'.gz'] = '-';
    out['dayun.'+i+'.shishen'] = '-';
    out['dayun.'+i+'.current_class'] = '';
    out['section_02.bazi.'+i+'.range'] = '-';
    out['section_02.bazi.'+i+'.gz'] = '-';
    out['section_02.bazi.'+i+'.shishen'] = '-';
    out['section_02.bazi.'+i+'.current_class'] = '';
  }

  let currentDayun = null;
  for (const d of dayun) {
    if (d.startYear <= currentYear && d.endYear >= currentYear) { currentDayun = d; break; }
  }
  if (!currentDayun) currentDayun = dayun[0];
  const liunianList = currentDayun?.liuNian || [];
  const liunianLen = Math.min(liunianList.length, 10);
  out['liunian_dayun_label'] = currentDayun
    ? (currentDayun.ganZhi.gan + currentDayun.ganZhi.zhi + '大运（' + currentDayun.startAge + '-' + currentDayun.endAge + '岁）')
    : '—';
  for (let i = 0; i < liunianLen; i++) {
    const ln = liunianList[i];
    out['liunian.'+i+'.year'] = ln.year?.toString() || '-';
    out['liunian.'+i+'.age'] = ln.age?.toString() || '-';
    out['liunian.'+i+'.gz'] = (ln.ganZhi?.gan || '') + (ln.ganZhi?.zhi || '') || '-';
    out['liunian.'+i+'.shishen'] = (ln.ganZhi?.gan || '') + (ln.ganZhi?.zhi || '') || '-';
    out['liunian.'+i+'.current_class'] = (ln.year === currentYear) ? 'current' : '';
  }
  for (let i = liunianLen; i < 10; i++) {
    out['liunian.'+i+'.year'] = '-';
    out['liunian.'+i+'.age'] = '-';
    out['liunian.'+i+'.gz'] = '-';
    out['liunian.'+i+'.shishen'] = '-';
    out['liunian.'+i+'.current_class'] = '';
  }

  const dims = ['career','wealth','marriage','children','family','health'];
  dims.forEach(dim => {
    if (!out['dim.'+dim+'.bazi'] || out['dim.'+dim+'.bazi'] === '-') out['dim.'+dim+'.bazi'] = '（八字维度待AI分析）';
    if (!out['dim.'+dim+'.ziwei'] || out['dim.'+dim+'.ziwei'] === '-') out['dim.'+dim+'.ziwei'] = '（紫微维度待AI分析）';
    if (!out['dim.'+dim+'.verdict'] || out['dim.'+dim+'.verdict'] === '-') out['dim.'+dim+'.verdict'] = '待两盘印证';
    if (!out['dim.'+dim+'.fused'] || out['dim.'+dim+'.fused'] === '-') out['dim.'+dim+'.fused'] = '待AI融合分析';
  });
  for (let i=0; i<3; i++) {
    if (!out['conflicts.'+i+'.point'] || out['conflicts.'+i+'.point'] === '-') out['conflicts.'+i+'.point'] = '待AI冲突检测';
    if (!out['conflicts.'+i+'.bazi'] || out['conflicts.'+i+'.bazi'] === '-') out['conflicts.'+i+'.bazi'] = '—';
    if (!out['conflicts.'+i+'.ziwei'] || out['conflicts.'+i+'.ziwei'] === '-') out['conflicts.'+i+'.ziwei'] = '—';
    if (!out['conflicts.'+i+'.impact'] || out['conflicts.'+i+'.impact'] === '-') out['conflicts.'+i+'.impact'] = '—';
    if (!out['conflicts.'+i+'.advice'] || out['conflicts.'+i+'.advice'] === '-') out['conflicts.'+i+'.advice'] = '—';
  }
  if (!out['final.life_axis'] || out['final.life_axis'] === '-') {
    out['final.life_axis'] = (bz.dayMaster||'') + '日主，' + (en?.格局?.primary||'普通格局') + '，命宫主星' + ((zw.gongs[0]?.mainStars||[]).join('、')||'—') + '。完整报告中由AI综合两盘深度分析。';
  }
  for (let i=0; i<5; i++) {
    if (!out['final.nodes.'+i+'.age']) out['final.nodes.'+i+'.age'] = '—';
    if (!out['final.nodes.'+i+'.year']) out['final.nodes.'+i+'.year'] = '—';
    if (!out['final.nodes.'+i+'.event']) out['final.nodes.'+i+'.event'] = '（待AI分析关键人生节点）';
  }
  for (let i=0; i<3; i++) {
    if (!out['final.risks.'+i+'.range']) out['final.risks.'+i+'.range'] = '—';
    if (!out['final.risks.'+i+'.desc']) out['final.risks.'+i+'.desc'] = '（待AI分析高风险窗口）';
  }
  for (let i=0; i<2; i++) {
    if (!out['final.leverage.'+i+'.title']) out['final.leverage.'+i+'.title'] = '—';
    if (!out['final.leverage.'+i+'.desc']) out['final.leverage.'+i+'.desc'] = '（待AI分析优势放大策略）';
  }
  for (let i=0; i<4; i++) {
    if (!out['final.advice.'+i]) out['final.advice.'+i] = '（待AI生成建议）';
  }
  if (!out['section_01.text'] || out['section_01.text'] === '-') {
    out['section_01.text'] = '命主' + (bz.dayMaster||'') + '日主，' + (en?.格局?.primary||'格局待定') + '。完整命盘已生成，主轴印证结论待AI深度解读。';
    out['section_01.word_count'] = '待解读';
  }
  if (!out['section_02.conclusion'] || out['section_02.conclusion'] === '-') {
    out['section_02.conclusion'] = '大运流转已排定，阶段印证分析待AI完成。';
  }
  const defaultStrengths = [
    {title:'待AI分析', desc:'命盘优势特征待AI从八字与紫微双盘交叉验证后生成。'},
    {title:'待AI分析', desc:'命盘优势特征待AI从八字与紫微双盘交叉验证后生成。'},
    {title:'待AI分析', desc:'命盘优势特征待AI从八字与紫微双盘交叉验证后生成。'}
  ];
  const defaultWeaknesses = [
    {title:'待AI分析', desc:'命盘隐忧特征待AI从八字与紫微双盘交叉验证后生成。'},
    {title:'待AI分析', desc:'命盘隐忧特征待AI从八字与紫微双盘交叉验证后生成。'},
    {title:'待AI分析', desc:'命盘隐忧特征待AI从八字与紫微双盘交叉验证后生成。'}
  ];
  for (let i=0; i<3; i++) {
    if (!out['strengths.'+i+'.title'] || out['strengths.'+i+'.title'] === '-') out['strengths.'+i+'.title'] = defaultStrengths[i].title;
    if (!out['strengths.'+i+'.desc'] || out['strengths.'+i+'.desc'] === '-') out['strengths.'+i+'.desc'] = defaultStrengths[i].desc;
    if (!out['weaknesses.'+i+'.title'] || out['weaknesses.'+i+'.title'] === '-') out['weaknesses.'+i+'.title'] = defaultWeaknesses[i].title;
    if (!out['weaknesses.'+i+'.desc'] || out['weaknesses.'+i+'.desc'] === '-') out['weaknesses.'+i+'.desc'] = defaultWeaknesses[i].desc;
  }
  const confLabels = ['bazi','ziwei','consistency','stability'];
  const confDefaults = ['中','中','待测','待测'];
  const confScores = ['0.65','0.60','0.50','0.50'];
  confLabels.forEach((k,i) => {
    if (!out['confidence.'+k+'_level'] || out['confidence.'+k+'_level'] === '-') out['confidence.'+k+'_level'] = confDefaults[i];
    if (!out['confidence.'+k+'_score'] || out['confidence.'+k+'_score'] === '-') out['confidence.'+k+'_score'] = confScores[i];
  });
  if (!out['confidence.note'] || out['confidence.note'] === '-') out['confidence.note'] = '当前为基础排盘结果。完整报告由AI深度分析后更新置信度评估。';

  return out;
}

function analysisToFlat(analysis: any): Record<string, any> {
  const out: Record<string, any> = {};
  const setIf = (key: string, val: any) => {
    if (val !== undefined && val !== null && val !== '' && val !== '-') out[key] = val;
  };
  if (analysis.marketing) {
    setIf('meta.archetype_name', analysis.marketing.title);
    setIf('meta.axis_oneliner', analysis.marketing.hook);
  }
  if (analysis.meta) {
    setIf('meta.archetype_name', analysis.meta.archetype_name);
    setIf('meta.axis_oneliner', analysis.meta.axis_oneliner);
  }
  if (analysis.axes) {
    setIf('axes.bazi_main', analysis.axes.bazi_main);
    setIf('axes.ziwei_main', analysis.axes.ziwei_main);
  }
  if (analysis.consistency) setIf('ziwei.consistency', analysis.consistency);

  for (let i = 0; i < 3; i++) {
    const s = analysis.strengths?.[i];
    if (s) { setIf('strengths.' + i + '.title', s.title); setIf('strengths.' + i + '.desc', s.desc); }
    const w = analysis.weaknesses?.[i];
    if (w) { setIf('weaknesses.' + i + '.title', w.title); setIf('weaknesses.' + i + '.desc', w.desc); }
  }

  if (analysis.section_01) {
    setIf('section_01.text', analysis.section_01.text);
    setIf('section_01.word_count', analysis.section_01.word_count);
  }
  if (analysis.section_02) {
    setIf('section_02.conclusion', analysis.section_02.conclusion);
  }

  const dims = ['career','wealth','marriage','children','family','health'];
  for (const k of dims) {
    const d = analysis.dim?.[k];
    if (d) {
      setIf('dim.' + k + '.bazi', d.bazi);
      setIf('dim.' + k + '.ziwei', d.ziwei);
      setIf('dim.' + k + '.verdict', d.verdict);
      setIf('dim.' + k + '.verdict_class', d.verdict_class);
      setIf('dim.' + k + '.fused', d.fused);
    }
  }

  for (let i = 0; i < 3; i++) {
    const c = analysis.conflicts?.[i];
    if (c) {
      setIf('conflicts.' + i + '.point', c.point);
      setIf('conflicts.' + i + '.bazi', c.bazi);
      setIf('conflicts.' + i + '.ziwei', c.ziwei);
      setIf('conflicts.' + i + '.impact', c.impact);
      setIf('conflicts.' + i + '.impact_class', c.impact_class);
      setIf('conflicts.' + i + '.advice', c.advice);
    }
  }

  if (analysis.final) {
    setIf('final.life_axis', analysis.final.life_axis);
    if (analysis.final.nodes) {
      for (let i = 0; i < 5; i++) {
        const n = analysis.final.nodes[i];
        if (n) { setIf('final.nodes.' + i + '.age', n.age); setIf('final.nodes.' + i + '.year', n.year); setIf('final.nodes.' + i + '.event', n.event); }
      }
    }
    if (analysis.final.risks) {
      for (let i = 0; i < 3; i++) {
        const r = analysis.final.risks[i];
        if (r) { setIf('final.risks.' + i + '.range', r.range); setIf('final.risks.' + i + '.desc', r.desc); }
      }
    }
    if (analysis.final.leverage) {
      for (let i = 0; i < 2; i++) {
        const l = analysis.final.leverage[i];
        if (l) { setIf('final.leverage.' + i + '.title', l.title); setIf('final.leverage.' + i + '.desc', l.desc); }
      }
    }
    if (analysis.final.advice) {
      for (let i = 0; i < 4; i++) setIf('final.advice.' + i, analysis.final.advice[i]);
    }
  }

  if (analysis.confidence) {
    for (const k of ['bazi','ziwei','consistency','stability']) {
      setIf('confidence.' + k + '_level', analysis.confidence[k + '_level']);
      setIf('confidence.' + k + '_score', analysis.confidence[k + '_score']);
    }
    setIf('confidence.note', analysis.confidence.note);
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
