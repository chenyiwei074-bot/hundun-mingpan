'use client';

import React from 'react';

const GAN_WX: Record<string, string> = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' };
const ZHI_WX: Record<string, string> = { '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火', '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水' };
const WX_COLOR: Record<string, string> = { '木': '#07a830', '火': '#d30505', '土': '#8b6d03', '金': '#ef9104', '水': '#2e83f6' };
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

  return (
    <section className='w-full'>
      <div className='relative overflow-hidden rounded-2xl px-6 py-10 md:px-10 md:py-14 mb-8' style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        <div className='absolute top-0 right-0 w-64 h-64 rounded-full opacity-10' style={{ background: 'radial-gradient(circle, #b2955d 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className='relative z-10'>
          <p className='text-xs tracking-[0.2em] mb-3' style={{ color: 'rgba(178,149,93,0.8)' }}>混 沌 阁 命 盘</p>
          <h1 className='text-2xl md:text-3xl font-serif font-bold tracking-[0.04em] mb-2' style={{ color: '#ffffff' }}>{chartName || '有缘人'} 的双盘命理档案</h1>
          {pillarLine && <p className='text-sm mt-3 tracking-[0.05em]' style={{ color: 'rgba(255,255,255,0.65)' }}>四柱：{ pillarLine }</p>}
          {ds != null && <p className='text-xs mt-1' style={{ color: 'rgba(178,149,93,0.6)' }}>起运 {dayunLabel} · { gl }性 · { bi?.year ? '属' + sx(bi.year) : '' }</p>}
        </div>
      </div>
      <div className='rounded-xl border border-black/5 bg-white p-5 md:p-6 mb-8 shadow-sm'>
        <div className='flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] mb-4'>
          <span style={{ color: '#1d1d1f' }}><span style={{ color: '#86868b' }}>姓名 </span>{chartName || '—'}</span>
          <span style={{ color: '#1d1d1f' }}><span style={{ color: '#86868b' }}>生日 </span>{bd || '—'}</span>
          <span style={{ color: '#1d1d1f' }}><span style={{ color: '#86868b' }}>时间 </span>{bt || '—'} · {gl}</span>
          <span className='ml-auto text-xs' style={{ color: '#b2955d' }}>✓ 八字 ✓ 紫微 ✓ 合参</span>
        </div>
        <div className='grid grid-cols-3 md:grid-cols-6 gap-3'>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>日主</div>
            <div className='text-sm font-semibold' style={{ color: WX_COLOR[GAN_WX[dm]] || '#1d1d1f' }}>{dm || '—'}</div>
          </div>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>强弱</div>
            <div className='text-sm font-semibold truncate' style={{ color: '#1d1d1f' }}>{wl || '—'}</div>
          </div>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>命宫</div>
            <div className='text-sm font-semibold truncate' style={{ color: '#1d1d1f' }}>{mg?.mainStars?.[0] || '空宫'}</div>
          </div>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>官禄宫</div>
            <div className='text-sm font-semibold truncate' style={{ color: '#1d1d1f' }}>{glg?.mainStars?.[0] || '空宫借星'}</div>
          </div>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>财帛宫</div>
            <div className='text-sm font-semibold truncate' style={{ color: '#1d1d1f' }}>{cbg?.mainStars?.[0] || '空宫借星'}</div>
          </div>
          <div className='rounded-lg p-3 text-center' style={{ background: 'rgba(0,0,0,0.02)' }}>
            <div className='text-[10px] tracking-wider mb-1' style={{ color: '#86868b' }}>格局</div>
            <div className='text-sm font-semibold truncate' style={{ color: '#1d1d1f' }}>{gjName || '—'}</div>
          </div>
        </div>
      </div>
      <div className='rounded-2xl p-6 md:p-8 mb-8' style={{ background: '#ffffff', border: '1px solid rgba(178,149,93,0.2)', boxShadow: '0 4px 24px rgba(178,149,93,0.06)' }}>
        <div className='flex items-center gap-3 mb-5'>
          <div className='w-10 h-10 rounded-full flex items-center justify-center' style={{ background: 'rgba(178,149,93,0.12)' }}>
            <span className='text-lg'>☀</span>
          </div>
          <div>
            <h3 className='font-serif text-lg font-bold tracking-wider' style={{ color: '#1d1d1f' }}>你的命格特点</h3>
            <p className='text-xs tracking-wider' style={{ color: '#b2955d' }}>八字 × 紫微斗数 双体系验证</p>
          </div>
        </div>
        <div className='space-y-4'>
          <div>
            <p className='text-xs tracking-wider mb-1.5' style={{ color: '#b2955d' }}>专业判断</p>
            <p className='text-[15px] leading-relaxed' style={{ color: '#1d1d1f' }}>
              {dm ? '日主' + dm + '（' + (GAN_WX[dm]||'') + '），' : ''}
              {wl ? wl + '，' : ''}
              {gjName ? '格局为' + gjName + '。' : ''}
              {mg?.mainStars?.[0] ? '命宫' + mg.mainStars[0] + '坐守，' : ''}
              {glg?.mainStars?.[0] ? '官禄宫' + glg.mainStars[0] + '主事业。' : ''}
            </p>
          </div>
          <div>
            <p className='text-xs tracking-wider mb-1.5' style={{ color: '#86868b' }}>通俗解释</p>
            <p className='text-sm leading-relaxed' style={{ color: '#555' }}>
              {dm ? '“' + dm + '”日主代表你的本质属性，属' + (GAN_WX[dm]||'') + '性格，' : ''}
              {wl === '身强' ? '自主能力强，适合主动出击，独立做决策。' : wl === '身弱' ? '需借助外力，贵人运佳，宜协作共赢。' : '命局中和，可刚可柔，适应力强。'}
              {gjTags?.length > 0 ? '格局倾向：' + gjTags.slice(0,3).join('、') + '。' : ''}
            </p>
          </div>
          <div>
            <p className='text-xs tracking-wider mb-1.5' style={{ color: '#86868b' }}>人生表现</p>
            <p className='text-sm leading-relaxed' style={{ color: '#555' }}>
              {wl === '身强' ? '在事业上倾向于主导者角色，做事果断，执行力强。' : wl === '身弱' ? '在团队中更能发挥价值，善于借力，人际关系是你的优势。' : '在不同环境中均能找到适合自己的位置，灵活应变。'}
              {glg?.mainStars?.[0] ? '官禄宫' + glg.mainStars[0] + '暗示事业方向偏' + (glg.mainStars[0] === '紫微' ? '领导管理' : glg.mainStars[0] === '天府' ? '稳定守成' : '变化创新') + '。' : ''}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
