'use client';

import React from 'react';

const GAN_WX: Record<string, string> = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const ZHI_WX: Record<string, string> = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };
const WX_COLOR: Record<string, string> = { '木': 'var(--color-wx-mu)', '火': 'var(--color-wx-huo)', '土': 'var(--color-wx-tu)', '金': 'var(--color-wx-jin)', '水': 'var(--color-wx-shui)' };
const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
function sx(y: number): string { const i = (y - 4) % 12; return ZODIAC[(i + 12) % 12]; }

interface Props { chartData: any; chartName: string; }

export default function ChartOverview({ chartData, chartName }: Props) {
  const b = chartData?.bazi; const z = chartData?.ziwei;
  const bi = b?.birthInfo; const en = b?.enrichment;
  const dm = b?.dayMaster; const sz = b?.siZhu;
  const gongs = z?.gongs || [];
  const fg = (n: string) => gongs.find((g: any) => g.gong === n) || gongs.find((g: any) => g.gong === n.replace('宫',''));
  const mg = fg('命宫');
  const glg = fg('官禄宫'); const cbg = fg('财帛宫');
  const gl = bi?.gender === 'male' ? '男' : '女';
  const bd = bi ? bi.year + '年' + bi.month + '月' + bi.day + '日' : '';
  const bt = bi ? String(bi.hour).padStart(2,'0') + ':' + String(bi.minute).padStart(2,'0') : '';
  const wl = en?.['旺衰']?.verdict || '';
  const gjName = en?.['格局']?.primary || '';
  const gjTags = en?.['格局']?.notes || [];
  const ds = b?.dayunStart;
  const pillarLine = sz ? [sz.year, sz.month, sz.day, sz.hour].map((p: any) => p ? p.gan + p.zhi : '--').join(' ') : '';
  const displayDayunStart = ds != null ? Math.round(ds) || 1 : null;
  const dayunLabel = ds != null && ds !== Math.round(ds) ? '约' + displayDayunStart + '岁' : ds != null ? displayDayunStart + '岁' : '';

  const stat = (label: string, value: string, dot?: string) => (
    <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
      <div className="qn-cap" style={{ display: 'block', marginBottom: 4 }}>{label}</div>
      <div className="qn-body" style={{ fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {dot && <span className="qn-badge__dot" style={{ display: 'inline-block', verticalAlign: 'middle', marginInlineEnd: 5, background: dot }} />}{value || '—'}
      </div>
    </div>
  );

  return (
    <section className="qn-rise">
      <header className="qn-ink" style={{ padding: '40px 28px', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>混 沌 阁 命 盘</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 0', textWrap: 'balance' }}>{chartName || '有缘人'} 的双盘命理档案</h1>
        {pillarLine && <p className="qn-meta" style={{ margin: '14px 0 0', letterSpacing: '0.05em' }}>四柱：{pillarLine}</p>}
        {ds != null && <p className="qn-note" style={{ margin: '4px 0 0' }}>起运 {dayunLabel} · {gl}性 · {bi?.year ? '属' + sx(bi.year) : ''}</p>}
      </header>

      <div className="qn-card qn-rise qn-rise--2" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 24px', marginBottom: 16 }}>
          <span className="qn-meta"><span className="qn-cap" style={{ marginRight: 4 }}>姓名</span>{chartName || '—'}</span>
          <span className="qn-meta"><span className="qn-cap" style={{ marginRight: 4 }}>生日</span>{bd || '—'}</span>
          <span className="qn-meta"><span className="qn-cap" style={{ marginRight: 4 }}>时间</span>{bt || '—'} · {gl}</span>
          <span className="qn-cap" style={{ marginLeft: 'auto', color: 'var(--color-accent-gold-text)' }}>✓ 八字 ✓ 紫微 ✓ 合参</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {stat('日主', dm, WX_COLOR[GAN_WX[dm]] || undefined)}
          {stat('强弱', wl)}
          {stat('命宫', mg?.mainStars?.[0] || '空宫')}
          {stat('官禄宫', glg?.mainStars?.[0] || '空宫借星')}
          {stat('财帛宫', cbg?.mainStars?.[0] || '空宫借星')}
          {stat('格局', gjName)}
        </div>
      </div>

      <div className="qn-card qn-rise qn-rise--3" style={{ border: '1px solid rgba(178,149,93,0.22)', boxShadow: '0 4px 24px rgba(178,149,93,0.06)' }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>八字 × 紫微斗数 双体系验证</p>
        <h2 className="qn-hero" style={{ margin: '10px 0 22px' }}>你的命格特点</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <p className="qn-axis" style={{ margin: '0 0 6px' }}>专业判断</p>
            <p className="qn-body">
              {dm ? '日主' + dm + '（' + (GAN_WX[dm]||'') + '），' : ''}
              {wl ? wl + '，' : ''}
              {gjName ? '格局为' + gjName + '。' : ''}
              {mg?.mainStars?.[0] ? '命宫' + mg.mainStars[0] + '坐守，' : ''}
              {glg?.mainStars?.[0] ? '官禄宫' + glg.mainStars[0] + '主事业。' : ''}
            </p>
          </div>
          <div>
            <p className="qn-axis" style={{ margin: '0 0 6px' }}>通俗解释</p>
            <p className="qn-meta">
              {dm ? '“' + dm + '”日主代表你的本质属性，属' + (GAN_WX[dm]||'') + '性格，' : ''}
              {wl === '身强' ? '自主能力强，适合主动出击，独立做决策。' : wl === '身弱' ? '需借助外力，贵人运佳，宜协作共赢。' : '命局中和，可刚可柔，适应力强。'}
              {gjTags?.length > 0 ? '格局倾向：' + gjTags.slice(0,3).join('、') + '。' : ''}
            </p>
          </div>
          <div>
            <p className="qn-axis" style={{ margin: '0 0 6px' }}>人生表现</p>
            <p className="qn-meta">
              {wl === '身强' ? '在事业上倾向于主导者角色，做事果断，执行力强。' : wl === '身弱' ? '在团队中更能发挥价值，善于借力，人际关系是你的优势。' : '在不同环境中均能找到适合自己的位置，灵活应变。'}
              {glg?.mainStars?.[0] ? '官禄宫' + glg.mainStars[0] + '暗示事业方向偏' + (glg.mainStars[0] === '紫微' ? '领导管理' : glg.mainStars[0] === '天府' ? '稳定守成' : '变化创新') + '。' : ''}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
