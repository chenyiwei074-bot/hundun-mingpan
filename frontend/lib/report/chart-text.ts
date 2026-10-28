/** 把命盘结果整理成“我的报告”可读正文；不把原始 JSON 直接倒给用户。 */

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

function pillarText(value: any): string {
  if (!value || typeof value.gan !== 'string' || typeof value.zhi !== 'string') return '—';
  return `${value.gan}${value.zhi}`;
}

export function buildBaziReportText(name: string, bazi: any): string {
  if (!bazi) return '';
  const lines: string[] = [];
  lines.push(`# ${name || '命盘'} · 八字命盘`);
  lines.push('');
  const siZhu = bazi.siZhu || {};
  lines.push('## 四柱');
  lines.push(PILLAR_KEYS.map(k => `${PILLAR_LABELS[k]}：${pillarText(siZhu[k])}`).join('　'));
  if (bazi.dayMaster) lines.push('', `**日主**：${bazi.dayMaster}`);
  if (bazi.shiShen) {
    const parts = PILLAR_KEYS.map(k => bazi.shiShen[k]).filter(Boolean);
    if (parts.length) lines.push(`**十神**：${parts.join(' · ')}`);
  }
  if (bazi.naYin) {
    const parts = PILLAR_KEYS.map(k => bazi.naYin[k]).filter(Boolean);
    if (parts.length) lines.push(`**纳音**：${parts.join(' · ')}`);
  }
  const wuxing = bazi.enrichment?.五行统计;
  if (wuxing && typeof wuxing === 'object') {
    lines.push('', `**五行统计**：${Object.entries(wuxing).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  }
  const dayun = Array.isArray(bazi.dayun) ? bazi.dayun : [];
  if (dayun.length) {
    const current = dayun.find((d: any) => d.isCurrent) || dayun[0];
    if (current?.ganZhi) lines.push('', `**大运**：${pillarText(current.ganZhi)}（${current.startAge ?? '—'} 岁起）`);
  }
  lines.push('', '---', '', '本页由本站排盘规则生成，未保存原始输入或出生地点；详细结构可在对应命盘结果页查看。');
  return lines.join('\n');
}

export function buildZiweiReportText(name: string, ziwei: any): string {
  if (!ziwei) return '';
  const lines: string[] = [`# ${name || '命盘'} · 紫微斗数`, ''];
  if (ziwei.wuXingJu?.name) lines.push(`**五行局**：${ziwei.wuXingJu.name}`);
  if (ziwei.mingGongIndex !== undefined) lines.push(`**命宫索引**：${ziwei.mingGongIndex}`);
  if (ziwei.yinYang) lines.push(`**阴阳**：${ziwei.yinYang}`);
  const gongs = Array.isArray(ziwei.gongs) ? ziwei.gongs : [];
  if (gongs.length) {
    lines.push('', '## 十二宫主星');
    for (const g of gongs) {
      const stars = Array.isArray(g.mainStars) && g.mainStars.length ? g.mainStars.join('、') : '无主星';
      lines.push(`- ${g.gong || '宫位'}（${g.tiangan || ''}${g.dizhi || ''}）：${stars}`);
    }
  }
  lines.push('', '---', '', '本页由本站紫微排盘规则生成；星曜结构以命盘结果页为准。');
  return lines.join('\n');
}
