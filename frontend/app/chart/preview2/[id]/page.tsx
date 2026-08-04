'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';
import BaziPillars from '@/components/bazi/BaziPillars';
import BaziEnrich from '@/components/bazi/BaziEnrich';
import ZiweiGongs from '@/components/ziwei/ZiweiGongs';

const GENDER_MAP: Record<string, string> = { 'male': '男', 'female': '女' };
const ZODIAC = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
function getShengXiao(year: number): string { const idx = (year - 4) % 12; return ZODIAC[(idx + 12) % 12]; }

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [chartData, setChartData] = useState<any>(null);
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 秒出：优先读 sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('chart_preview');
      if (raw) {
        const preview = JSON.parse(raw);
        setChartData(preview.chart);
        setChartName(preview.chartName || '');
        setLoading(false);
        return;
      }
    } catch {}

    // fallback: 轮询后端
    if (!id) return;
    let cancelled = false;
    let count = 0;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res: any = await getChartResult(id);
        if (cancelled) return;
        count++;
        if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (count < 60) { setTimeout(poll, 1000); return; }
          setError('排盘超时'); setLoading(false);
        } else if (res.success && res.data) {
          setChartData(res.data.chartData || null);
          setChartName(res.data.name || '');
          setLoading(false);
        } else if (count < 60) { setTimeout(poll, 1000); }
        else { setError('排盘超时'); setLoading(false); }
      } catch { if (!cancelled && count < 60) setTimeout(poll, 1000); else setError('网络错误'); }
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  const bazi = chartData?.bazi;
  const ziwei = chartData?.ziwei;
  const enrichment = bazi?.enrichment;
  const birthInfo = bazi?.birthInfo;

  const todayYear = new Date().getFullYear();
  const [selectedDayunIdx, setSelectedDayunIdx] = useState<number>(-1);
  const [selectedLiuNianIdx, setSelectedLiuNianIdx] = useState(0);

  const selectedDayun = selectedDayunIdx >= 0 ? bazi?.dayun?.[selectedDayunIdx] : null;

  useEffect(() => {
    if (!selectedDayun?.liuNian?.length) return;
    const idx = selectedDayun.liuNian.findIndex((ln: any) => ln.year === todayYear);
    setSelectedLiuNianIdx(idx >= 0 ? idx : 0);
  }, [selectedDayunIdx]);

  const selectedYear = selectedDayun?.liuNian?.[selectedLiuNianIdx]?.year || todayYear;

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
        <p className="text-text-muted text-sm mt-6 tracking-[2px]">正在排盘中...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4">
        <p className="text-text-primary text-lg mb-6">{error}</p>
        <button onClick={() => router.push('/create')} className="px-6 py-2 rounded-lg bg-accent-gold text-white text-sm">重新排盘</button>
      </div>
    );
  }
  if (!chartData) return null;

  return (
    <div className="min-h-screen bg-bg-primary">
      

      <div className="pt-11">
        {/* 命盘信息 */}
        {birthInfo && (
          <div className="max-w-5xl mx-auto px-4 pt-6 pb-4">
            <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
              <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-5 py-3 border-b border-black/5">
                <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">命盘信息</h3>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {chartName && <div className="text-center"><p className="text-[10px] text-text-muted/60 mb-0.5">姓名</p><p className="text-sm font-serif font-bold text-text-primary">{chartName}</p></div>}
                <div className="text-center"><p className="text-[10px] text-text-muted/60 mb-0.5">性别</p><p className="text-sm font-serif text-text-secondary">{GENDER_MAP[birthInfo.gender] || birthInfo.gender}</p></div>
                <div className="text-center"><p className="text-[10px] text-text-muted/60 mb-0.5">生肖</p><p className="text-sm font-serif text-text-secondary">{getShengXiao(birthInfo.year)}</p></div>
                <div className="text-center"><p className="text-[10px] text-text-muted/60 mb-0.5">生辰</p><p className="text-xs text-text-secondary">{birthInfo.year}.{birthInfo.month}.{birthInfo.day} {String(birthInfo.hour).padStart(2,'0')}:{String(birthInfo.minute || 0).padStart(2,'0')}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* 大运 + 流年 */}
        {bazi?.dayun?.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 pb-6">
            <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-black/5 bg-gradient-to-r from-accent-gold/10 to-accent-gold/5">
                <span className="text-[10px] text-text-muted tracking-wider">大运 · 流年</span>
              </div>
              {selectedDayunIdx < 0 ? (
                <div className="px-2 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="flex gap-1.5 min-w-max px-2">
                    {bazi.dayun.map((dy: any, idx: number) => (
                      <button key={idx} onClick={() => setSelectedDayunIdx(idx)}
                        className="flex-shrink-0 rounded-lg px-3 py-2.5 text-center transition-all duration-200 hover:scale-105 active:scale-95 min-w-[88px]"
                        style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
                        <p className="text-[10px] text-text-muted/70 mb-0.5">{dy.startAge}-{dy.endAge}岁</p>
                        <p className="text-sm font-serif font-bold" style={{ color: '#1d1d1f' }}>{dy.ganZhi.gan}{dy.ganZhi.zhi}</p>
                        <p className="text-[9px] text-text-muted/40 mt-0.5">{dy.startYear}-{dy.endYear}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setSelectedDayunIdx(-1)}
                      className="flex-shrink-0 rounded-lg px-3 py-2.5 text-center border"
                      style={{ minWidth: '88px', background: 'rgba(178,149,93,0.12)', borderColor: 'rgba(178,149,93,0.35)' }}>
                      <p className="text-[10px] text-text-muted/70 mb-0.5">{selectedDayun.startAge}-{selectedDayun.endAge}岁</p>
                      <p className="text-sm font-serif font-bold" style={{ color: '#b2955d' }}>{selectedDayun.ganZhi.gan}{selectedDayun.ganZhi.zhi}</p>
                      <p className="text-[9px] text-text-muted/40 mt-0.5">{selectedDayun.startYear}-{selectedDayun.endYear}</p>
                    </button>
                    <span className="text-[10px] text-text-muted/50">点击卡片收起</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedDayun.liuNian || []).map((ln: any, lnIdx: number) => {
                      const isSelected = lnIdx === selectedLiuNianIdx;
                      const isCurrent = ln.year === todayYear;
                      const ganZhi = (ln.ganZhi?.gan || '') + (ln.ganZhi?.zhi || '');
                      return (
                        <button key={ln.year} onClick={() => setSelectedLiuNianIdx(lnIdx)}
                          className="flex-shrink-0 w-[80px] rounded-lg px-2 py-2.5 text-center transition-all duration-200 hover:scale-105 active:scale-95"
                          style={{
                            background: isSelected ? 'rgba(178,149,93,0.12)' : 'transparent',
                            border: isSelected ? '0.5px solid rgba(178,149,93,0.35)' : isCurrent ? '0.5px solid rgba(212,84,74,0.25)' : '0.5px solid rgba(0,0,0,0.04)',
                          }}>
                          <p className="text-xs font-serif font-bold" style={{ color: isCurrent ? '#d4544a' : isSelected ? '#b2955d' : '#1d1d1f' }}>{ln.year}</p>
                          <p className="text-[10px] text-text-secondary/60 mt-0.5">{ganZhi}</p>
                          <p className="text-[9px] text-text-muted/40">{ln.age}岁</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 八字 + 紫微双栏 */}
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">八字排盘</h3>
                </div>
                {bazi?.siZhu && <BaziPillars siZhu={bazi.siZhu} dayMaster={bazi.dayMaster || ''} dayunStart={bazi.dayunStart || ''} cangGan={bazi.cangGan} naYin={bazi.naYin} zhangSheng={bazi.zhangSheng} shiShen={bazi.shiShen} enrichment={enrichment} />}
              </div>
              {enrichment && <BaziEnrich enrichment={enrichment} dayMaster={bazi?.dayMaster} />}
            </div>
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">紫微斗数</h3>
                </div>
                {ziwei?.gongs && <ZiweiGongs gongs={ziwei.gongs} mingGongIndex={0} shenGongIndex={ziwei.shenGongIndex} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}