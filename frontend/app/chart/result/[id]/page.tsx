'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';
import ChartOverview from '@/components/chart/ChartOverview';
import BaziCard from '@/components/chart/BaziCard';
import ZiweiCard from '@/components/chart/ZiweiCard';
import DoubleVerify from '@/components/chart/DoubleVerify';
import ReportUnlock from '@/components/chart/ReportUnlock';
import { saveReport } from '@/lib/report/saveReport';

export default function ChartResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [chartData, setChartData] = useState<any>(null);
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(false);

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

  // 统一接入报告保存：数据加载完成后保存八字和紫微报告
  useEffect(() => {
    if (!chartData || !chartName || savedRef.current) return;
    savedRef.current = true;

    const birthInfo = chartData?.bazi?.birthInfo || {};

    // 保存八字报告
    saveReport({
      type: 'bazi',
      title: `${chartName} - 八字命盘`,
      inputJson: {
        name: chartName,
        gender: birthInfo.gender || '',
        birthday: birthInfo.birthday || '',
        birthPlace: birthInfo.birthPlace || '',
      },
      resultJson: chartData?.bazi || undefined,
      analysisJson: chartData?.bazi?.enrichment || undefined,
    }).catch(() => {});

    // 保存紫微报告
    if (chartData?.ziwei) {
      saveReport({
        type: 'ziwei',
        title: `${chartName} - 紫微斗数`,
        inputJson: {
          name: chartName,
          gender: birthInfo.gender || '',
          birthday: birthInfo.birthday || '',
          birthPlace: birthInfo.birthPlace || '',
        },
        resultJson: chartData?.ziwei || undefined,
        analysisJson: undefined,
      }).catch(() => {});
    }
  }, [chartData, chartName]);

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
<main className="pt-[56px] pb-20 px-4">
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