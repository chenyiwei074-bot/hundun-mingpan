'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import BaziPillars from '@/components/bazi/BaziPillars';
import BaziEnrich from '@/components/bazi/BaziEnrich';
import DayunSection from '@/components/bazi/DayunSection';
import ZiweiGongs from '@/components/ziwei/ZiweiGongs';

function getVid() {
  return typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
}

const GENDER_MAP: Record<string, string> = { 'male': '男', 'female': '女' };
const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
function getShengXiao(year: number): string { const idx = (year - 4) % 12; return ZODIAC[(idx + 12) % 12]; }

export default function ChartPreviewPage() {
  const router = useRouter();
  const [chartData, setChartData] = useState<any>(null);
  const [chartName, setChartName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const raw = sessionStorage.getItem('chart_preview');
    if (!raw) { setError('排盘数据不存在，请返回重新排盘'); return; }
    try {
      const { chart: data, chartName: cn } = JSON.parse(raw);
      setChartData(data);
      setChartName(cn || '');
    } catch { setError('数据解析失败'); }
  }, []);

  // 提取数据
  const bazi = chartData?.bazi;
  const ziwei = chartData?.ziwei;
  const enrichment = bazi?.enrichment;
  const birthInfo = bazi?.birthInfo;

  // 所有可用流年
  const allYears = useMemo(() => {
    if (!bazi?.dayun?.length) return [];
    const years: any[] = [];
    for (const dy of bazi.dayun) {
      for (const ln of (dy.liuNian || [])) {
        years.push({
          year: ln.year,
          age: ln.age,
          ganZhi: (ln.ganZhi?.gan || '') + (ln.ganZhi?.zhi || ''),
          dayunLabel: dy.ganZhi.gan + dy.ganZhi.zhi,
          startYear: dy.startYear,
          endYear: dy.endYear,
        });
      }
    }
    return years;
  }, [bazi]);

  // 当前选中流年
  const currentYearData = useMemo(() => allYears.find(y => y.year === selectedYear), [allYears, selectedYear]);

  // 大运信息
  const currentDayun = useMemo(() => {
    if (!bazi?.dayun?.length) return null;
    return bazi.dayun.find((d: any) => d.startYear <= selectedYear && d.endYear >= selectedYear) || null;
  }, [bazi, selectedYear]);

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
        <p className="text-text-primary text-lg mb-6">{error}</p>
        <button onClick={() => router.push('/create')} className="qn-btn qn-btn--primary qn-btn--sm">返回排盘</button>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
        <p className="text-text-muted text-sm mt-6 tracking-[2px]">正在加载...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Nav */}
      

      <div className="pt-11">
        {/* ════════════ 命盘信息 — 共享头部 ════════════ */}
        {birthInfo && (
          <div className="max-w-5xl mx-auto px-4 pt-6 pb-4">
            <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
              <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-5 py-3 border-b border-black/5">
                <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">命盘信息</h3>
              </div>
              <div className="p-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
                {chartName && (
                  <div className="text-center">
                    <p className="text-[10px] text-text-muted/60 mb-0.5">姓名</p>
                    <p className="text-sm font-serif font-bold text-text-primary">{chartName}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-[10px] text-text-muted/60 mb-0.5">性别</p>
                  <p className="text-sm font-serif text-text-secondary">{GENDER_MAP[birthInfo.gender] || birthInfo.gender}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-text-muted/60 mb-0.5">生肖</p>
                  <p className="text-sm font-serif text-text-secondary">{getShengXiao(birthInfo.year)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-text-muted/60 mb-0.5">生辰</p>
                  <p className="text-xs text-text-secondary">{birthInfo.year}.{birthInfo.month}.{birthInfo.day} {String(birthInfo.hour).padStart(2,'0')}:{String(birthInfo.minute || 0).padStart(2,'0')}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-text-muted/60 mb-0.5">八字</p>
                  <p className="text-xs font-serif text-text-secondary tracking-wider">
                    {bazi?.siZhu?.year?.gan}{bazi?.siZhu?.year?.zhi} {bazi?.siZhu?.month?.gan}{bazi?.siZhu?.month?.zhi} {bazi?.siZhu?.day?.gan}{bazi?.siZhu?.day?.zhi} {bazi?.siZhu?.hour?.gan}{bazi?.siZhu?.hour?.zhi}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ 时间轴 ════════════ */}
        {allYears.length > 0 && currentDayun && (
          <div className="max-w-5xl mx-auto px-4 pb-4">
            <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
              <div className="px-5 py-3 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-text-muted tracking-wider">大运</span>
                  <span className="text-sm font-serif font-bold text-accent-gold">
                    {currentDayun.ganZhi.gan}{currentDayun.ganZhi.zhi}
                  </span>
                  <span className="text-[10px] text-text-muted/50">
                    {currentDayun.startAge}-{currentDayun.endAge}岁 · {currentDayun.startYear}-{currentDayun.endYear}
                  </span>
                </div>
                {currentYearData && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted tracking-wider">选中</span>
                    <span className="text-sm font-serif font-bold text-text-primary">{currentYearData.year}</span>
                    <span className="text-xs text-text-secondary">{currentYearData.ganZhi}</span>
                    <span className="text-[10px] text-text-muted/50">{currentYearData.age}岁</span>
                  </div>
                )}
              </div>

              {/* 流年横向滚动条 */}
              <div className="px-2 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="flex gap-1 min-w-max px-2">
                  {allYears.map((y) => {
                    const isSelected = y.year === selectedYear;
                    const isCurrent = y.year === new Date().getFullYear();
                    return (
                      <button
                        key={y.year}
                        onClick={() => setSelectedYear(y.year)}
                        className="flex-shrink-0 w-[80px] rounded-lg px-2 py-2.5 text-center transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                          background: isSelected ? 'rgba(178,149,93,0.10)' : 'transparent',
                          border: isSelected ? '0.5px solid rgba(178,149,93,0.25)' : '0.5px solid transparent',
                        }}
                      >
                        <p className="text-[10px] text-text-muted/60 mb-1">{y.dayunLabel}</p>
                        <p className="text-xs font-serif font-bold" style={{
                          color: isCurrent ? '#d4544a' : isSelected ? '#b2955d' : '#1d1d1f',
                        }}>{y.year}</p>
                        <p className="text-xs text-text-secondary/60 mt-0.5">{y.ganZhi}</p>
                        <p className="text-[9px] text-text-muted/40">{y.age}岁</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ 双栏：八字 & 紫微 ════════════ */}
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 八字栏 */}
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">八字排盘</h3>
                </div>
                {bazi?.siZhu && (
                  <BaziPillars
                    siZhu={bazi.siZhu}
                    dayMaster={bazi.dayMaster || ''}
                    dayunStart={bazi.dayunStart || ''}
                    cangGan={bazi.cangGan}
                    naYin={bazi.naYin}
                    zhangSheng={bazi.zhangSheng}
                    shiShen={bazi.shiShen}
                    enrichment={enrichment}
                  />
                )}
              </div>

              {/* 选中流年八字信息 */}
              {currentYearData && (
                <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-black/5" style={{ background: 'rgba(178,149,93,0.04)' }}>
                    <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">
                      {currentYearData.year} 流年
                    </h3>
                  </div>
                  <div className="p-4 flex items-center justify-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] text-text-muted/60 mb-1">干支</p>
                      <p className="text-xl font-serif font-bold text-text-primary">{currentYearData.ganZhi}</p>
                    </div>
                    <div className="w-px h-10" style={{ background: 'rgba(0,0,0,0.06)' }} />
                    <div className="text-center">
                      <p className="text-[10px] text-text-muted/60 mb-1">年龄</p>
                      <p className="text-xl font-bold text-accent-gold">{currentYearData.age}岁</p>
                    </div>
                    <div className="w-px h-10" style={{ background: 'rgba(0,0,0,0.06)' }} />
                    <div className="text-center">
                      <p className="text-[10px] text-text-muted/60 mb-1">大运</p>
                      <p className="text-lg font-serif text-text-secondary">
                        {currentYearData.dayunLabel}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {enrichment && <BaziEnrich enrichment={enrichment} dayMaster={bazi?.dayMaster} />}
            </div>

            {/* 紫微栏 */}
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">紫微斗数</h3>
                </div>
                {ziwei?.gongs && (
                  <ZiweiGongs gongs={ziwei.gongs} mingGongIndex={0} shenGongIndex={ziwei.shenGongIndex} />
                )}
              </div>

              {/* 选中流年紫微信息 */}
              {currentYearData && (
                <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-black/5" style={{ background: 'rgba(178,149,93,0.04)' }}>
                    <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">
                      {currentYearData.year} 流年
                    </h3>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] text-text-muted/60 mb-2">流年四化（需后端数据）</p>
                    <div className="flex justify-center gap-4">
                      <span className="text-xs text-text-muted/40">化禄 -</span>
                      <span className="text-xs text-text-muted/40">化权 -</span>
                      <span className="text-xs text-text-muted/40">化科 -</span>
                      <span className="text-xs text-text-muted/40">化忌 -</span>
                    </div>
                  </div>
                </div>
              )}

              {bazi?.dayun && <DayunSection dayun={bazi.dayun} dayunStart={bazi.dayunStart || ''} />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="rounded-xl bg-gradient-to-br from-accent-gold/10 to-accent-gold/5 border border-accent-gold/20 p-6 text-center">
            <div className="text-2xl mb-3">🔐</div>
            <h3 className="font-serif text-lg text-text-primary mb-2">解锁完整命理报告</h3>
            <p className="text-sm text-text-secondary/60 mb-2 max-w-sm mx-auto">八字深度分析 · 紫微十二宫详解 · 十年大运 · 流年合参</p>
            <p className="text-xl text-accent-gold font-bold mb-5">&yen;199</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button className="qn-btn qn-btn--sm !bg-accent-gold !text-white !shadow-none" style={{ padding: '0 24px', height: '40px', fontSize: '14px' }}>获取完整报告</button>
              <button className="qn-btn qn-btn--sm border-black/10 !text-text-muted" style={{ padding: '0 24px', height: '40px', fontSize: '14px' }}>添加微信 Hundunge01</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}