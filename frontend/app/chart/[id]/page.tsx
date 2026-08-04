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
// 五行颜色
const GAN_WX: Record<string,string>={"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水"};
const ZHI_WX: Record<string,string>={"子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"};
const WX_COLOR: Record<string,string>={"木":"#07a830","火":"#d30505","土":"#8b6d03","金":"#ef9104","水":"#2e83f6"};
function gc(g:string):string{return WX_COLOR[GAN_WX[g]]||"#1d1d1f"}
function zc(z:string):string{return WX_COLOR[ZHI_WX[z]]||"#1d1d1f"}

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

  // 初始化：自动选中今年的流年
  useEffect(() => {
    if (!bazi?.dayun?.length || selectedDayunIdx >= 0) return;
    const today = todayYear;
    // 找哪个大运包含今年
    const dyIdx = bazi.dayun.findIndex((d: any) => d.startYear <= today && d.endYear >= today);
    if (dyIdx >= 0) {
      setSelectedDayunIdx(dyIdx);
      const dy = bazi.dayun[dyIdx];
      const lnIdx = (dy.liuNian || []).findIndex((ln: any) => ln.year === today);
      if (lnIdx >= 0) setSelectedLiuNianIdx(lnIdx);
    } else if (bazi.dayun.length > 0) {
      setSelectedDayunIdx(0);
      setSelectedLiuNianIdx(0);
    }
  }, [bazi]);

  useEffect(() => {
    if (!selectedDayun?.liuNian?.length) return;
    const idx = selectedDayun.liuNian.findIndex((ln: any) => ln.year === todayYear);
    setSelectedLiuNianIdx(idx >= 0 ? idx : 0);
  }, [selectedDayunIdx]);

  const selectedYear = selectedDayun?.liuNian?.[selectedLiuNianIdx]?.year || todayYear;
  const selectedDayunGanZhi = useMemo(() => ({
    gan: selectedDayun?.ganZhi?.gan || "",
    zhi: selectedDayun?.ganZhi?.zhi || "",
  }), [selectedDayun]);

  const selectedLiuNian = useMemo(() => {
    return selectedDayun?.liuNian?.[selectedLiuNianIdx] || null;
  }, [selectedDayun, selectedLiuNianIdx]);

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

        {/* 大运 + 流年 — 同行动画展开 */}
        {bazi?.dayun?.length > 0 && (
          <div className="max-w-5xl mx-auto px-4 pb-6">
            <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-black/5 bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 flex items-center justify-between">
                <span className="text-[10px] text-text-muted tracking-wider">大运 · 流年</span>
                {selectedDayunIdx >= 0 && (
                  <button onClick={() => setSelectedDayunIdx(-1)} className="text-[10px] text-accent-gold hover:opacity-70 transition-opacity">收起 ▲</button>
                )}
              </div>
              <div className="px-2 py-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="flex gap-1.5 min-w-max px-2 items-start">
                  {bazi.dayun.map((dy: any, idx: number) => {
                    const isSelected = idx === selectedDayunIdx;
                    const isHidden = selectedDayunIdx >= 0 && !isSelected;
                    const liuNian = dy.liuNian || [];
                    return (
                      <div key={idx} className="flex items-center gap-1"
                        style={{
                          maxWidth: isHidden ? '0px' : isSelected ? '1100px' : '88px',
                          opacity: isHidden ? 0 : 1,
                          overflow: 'hidden',
                          transition: 'max-width 0.45s ease, opacity 0.35s ease',
                        }}>
                        <button onClick={() => setSelectedDayunIdx(isSelected ? -1 : idx)}
                          className="flex-shrink-0 rounded-lg px-3 py-2.5 text-center transition-all duration-200 hover:scale-105 active:scale-95"
                          style={{
                            width: '88px',
                            height: '80px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            background: isSelected ? 'rgba(178,149,93,0.12)' : 'transparent',
                            border: isSelected ? '0.5px solid rgba(178,149,93,0.35)' : '0.5px solid rgba(0,0,0,0.04)',
                            transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                          }}>
                          <p style={{ width: "100%", textAlign: "center" }} className="text-[10px] text-text-muted/70 mb-0.5 whitespace-nowrap">{dy.startYear}-{dy.endYear}</p>
                          <p style={{ width: "100%", textAlign: "center" }} className="font-serif font-bold text-sm">
                            <span style={{ color: isSelected ? '#b2955d' : gc(dy.ganZhi.gan) }}>{dy.ganZhi.gan}</span>
                            <span style={{ color: isSelected ? '#b2955d' : zc(dy.ganZhi.zhi) }}>{dy.ganZhi.zhi}</span>
                          </p>
                          <p style={{ width: "100%", textAlign: "center" }} className="text-[9px] text-text-muted/40 mt-0.5 whitespace-nowrap">{dy.ganShiShen || ''}</p>
                        </button>
                        <div className="flex gap-1 items-center"
                          style={{
                            maxWidth: isSelected ? '900px' : '0px',
                            opacity: isSelected ? 1 : 0,
                            overflow: 'hidden',
                            transition: 'max-width 0.45s ease, opacity 0.35s ease',
                          }}>
                          <div className="w-px h-10 mx-1 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />
                          {liuNian.map((ln: any, lnIdx: number) => {
                            const isCur = ln.year === todayYear;
                            const isSel = lnIdx === selectedLiuNianIdx;
                            const gan = ln.ganZhi?.gan || ''; const zhi = ln.ganZhi?.zhi || '';
                            return (
                              <button key={ln.year} onClick={(e) => { e.stopPropagation(); setSelectedLiuNianIdx(lnIdx); }}
                                className="flex-shrink-0 w-[68px] rounded-lg px-1.5 py-2 text-center transition-all duration-200 hover:scale-105 active:scale-95"
                                style={{
                                  background: isSel ? 'rgba(178,149,93,0.12)' : 'transparent',
                                  border: isSel ? '0.5px solid rgba(178,149,93,0.35)' : isCur ? '0.5px solid rgba(212,84,74,0.25)' : '0.5px solid rgba(0,0,0,0.04)',
                                }}>
                                <p className="text-[11px] font-serif font-bold" style={{ color: isCur ? '#d4544a' : isSel ? '#b2955d' : '#1d1d1f' }}>{ln.year}</p>
                                <p className="text-[10px] mt-0.5">
                                  <span style={{ color: gc(gan) }}>{gan}</span>
                                  <span style={{ color: zc(zhi) }}>{zhi}</span>
                                </p>
                                <p className="text-[9px] text-text-muted/40">{ln.age}岁</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
{/* 八字 + 紫微双栏 */}
        <div className="max-w-5xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">八字四柱</h3>
                </div>
                {bazi?.siZhu && <BaziPillars siZhu={bazi.siZhu} dayMaster={bazi.dayMaster || ''} dayunStart={bazi.dayunStart || ''} cangGan={bazi.cangGan} naYin={bazi.naYin} zhangSheng={bazi.zhangSheng} shiShen={bazi.shiShen} enrichment={enrichment} liuNianGan={selectedLiuNian?.ganZhi?.gan || ""} liuNianZhi={selectedLiuNian?.ganZhi?.zhi || ""} dayunGan={selectedDayunGanZhi.gan} dayunZhi={selectedDayunGanZhi.zhi} />}
              </div>
              {enrichment && <BaziEnrich enrichment={enrichment} dayMaster={bazi?.dayMaster} />}
            </div>
            <div className="space-y-3 min-w-0">
              <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
                <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-2.5 border-b border-black/5">
                  <h3 className="text-xs font-serif font-bold text-text-primary tracking-[0.2em] text-center">紫微斗数</h3>
                </div>
                {ziwei?.gongs && <ZiweiGongs gongs={ziwei.gongs} mingGongIndex={0} shenGongIndex={ziwei.shenGongIndex} liuNianAge={selectedLiuNian?.age || 0} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
