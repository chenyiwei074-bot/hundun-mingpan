'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';
// enrichment computed server-side or via API
import ChartOverview from '@/components/chart/ChartOverview';
import BaziCard from '@/components/chart/BaziCard';
import ZiweiCard from '@/components/chart/ZiweiCard';
import DoubleVerify from '@/components/chart/DoubleVerify';
import ReportUnlock from '@/components/chart/ReportUnlock';

export default function ChartResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [chartData, setChartData] = useState<any>(null);
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('缺少命盘ID'); setLoading(false); return; }
    let cancelled = false;
    let count = 0;
    const fallbackToSession = () => {
      try {
        const raw = sessionStorage.getItem('chart_preview');
        if (raw) { const p = JSON.parse(raw); setChartData(p.chart); setChartName(p.chartName || ''); setLoading(false); return true; }
      } catch {}
      return false;
    };
    const poll = async () => {
      if (cancelled) return;
      try {
        const res: any = await getChartResult(id);
        if (cancelled) return;
        count++;
        if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (count < 60) { setTimeout(poll, 1000); return; }
          if (fallbackToSession()) return;
          setError('排盘超时，请返回重试'); setLoading(false);
        } else if (res.success && res.data) {
          setChartData(res.data.chartData || null);
          setChartName(res.data.name || '');
          setLoading(false);
        } else if (count < 60) { setTimeout(poll, 1000); }
        else {
          if (fallbackToSession()) return;
          setError('排盘超时，请返回重试'); setLoading(false);
        }
      } catch {
        if (!cancelled && count < 60) { setTimeout(poll, 1000); return; }
        if (fallbackToSession()) return;
        setError('网络异常，请检查连接后重试'); setLoading(false);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  const enrichedChartData = chartData;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#ffffff' }}>
        <div className="w-12 h-12 border-2 rounded-full animate-spin mb-6" style={{ borderColor: 'rgba(178,149,93,0.2)', borderTopColor: '#b2955d' }} />
        <p className="text-sm tracking-[0.1em]" style={{ color: '#86868b' }}>正在生成命理档案...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#ffffff' }}>
        <p className="text-base mb-6" style={{ color: '#1d1d1f' }}>{error}</p>
        <button onClick={() => router.push('/create')} className="rounded-full px-6 py-2.5 text-sm font-medium" style={{ background: '#b2955d', color: '#ffffff' }}>重新排盘</button>
      </div>
    );
  }
  if (!enrichedChartData) return null;

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f7' }}>
      <nav className="fixed top-0 z-50 w-full" style={{ background: "rgba(250,250,249,0.85)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}><div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-6"><a href="/" className="no-underline text-base font-semibold tracking-[-0.01em]" style={{ color: "#1d1d1f" }}>混沌</a><div className="hidden sm:flex items-center gap-6 text-xs"><a href="/create" className="no-underline tracking-[0.03em]" style={{ color: "#1d1d1f" }}>八字 & 紫微</a><a href="/liuyao" className="no-underline tracking-[0.03em]" style={{ color: "#1d1d1f" }}>六爻</a><span className="tracking-[0.03em]" style={{ color: "#86868b" }}>姓名合盘</span><span className="tracking-[0.03em]" style={{ color: "#86868b" }}>择日</span><span className="tracking-[0.03em]" style={{ color: "#86868b" }}>星座</span></div></div></nav>
      <main className="pt-[60px] pb-20 px-4">
        <div className="max-w-[720px] mx-auto">
          <ChartOverview chartData={enrichedChartData} chartName={chartName} />
          <div className="mb-10"><DoubleVerify chartData={enrichedChartData} /></div>
          <div className="mb-10"><BaziCard bazi={enrichedChartData.bazi} enrichment={enrichedChartData.bazi?.enrichment} /></div>
          <div className="mb-10"><ZiweiCard ziwei={enrichedChartData.ziwei} bazi={enrichedChartData.bazi} /></div>
          <div className="mb-10"><ReportUnlock chartId={id} /></div>
        </div>
      </main>
    </div>
  );
}
