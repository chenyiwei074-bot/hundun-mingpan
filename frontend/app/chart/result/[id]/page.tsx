'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';
import ChartOverview from '@/components/chart/ChartOverview';
import BaziCard from '@/components/chart/BaziCard';
import ScenarioMatrix from '@/components/bazi/ScenarioMatrix';
import LifeCurve from '@/components/bazi/LifeCurve';
import ZiweiCard from '@/components/chart/ZiweiCard';
import DoubleVerify from '@/components/chart/DoubleVerify';
import { saveReport } from '@/lib/report/saveReport';
import { aiWaitMessage, decideAiWait } from '@/lib/chart/ai-wait';
import type { AiWaitState } from '@/lib/chart/ai-wait';

export default function ChartResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [chartData, setChartData] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiState, setAiState] = useState<AiWaitState>('chart-pending');
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!id) { setError('缺少命盘ID'); setLoading(false); return; }
    let cancelled = false;
    // 后端的 chartData 是权威结果，说明字段优先用它。本会话的客户端预览只在
    // 后端还没吐某个字段时补位（农历换算那半边后端尚未同步），而且必须四柱逐字
    // 相同才敢补——四柱不同就不是同一次排盘，宁可不说，也不能说错。
    const graftLocalMeta = (cd: any) => {
      if (!cd?.bazi?.siZhu) return cd;
      try {
        const raw = sessionStorage.getItem('chart_preview');
        if (!raw) return cd;
        const local = JSON.parse(raw)?.chart;
        const sig = (s: any) => ['year', 'month', 'day', 'hour'].map(k => (s?.[k]?.gan || '') + (s?.[k]?.zhi || '')).join(' ');
        const ls = sig(local?.bazi?.siZhu);
        if (ls.length < 8 || ls !== sig(cd.bazi.siZhu)) return cd;
        return { ...cd, bazi: { ...cd.bazi,
          trueSolarTime: cd.bazi.trueSolarTime ?? local.bazi.trueSolarTime,
          calendarConversion: cd.bazi.calendarConversion ?? local.bazi.calendarConversion } };
      } catch { return cd; }
    };
    const fallbackToSession = () => {
      try {
        const raw = sessionStorage.getItem('chart_preview');
        if (raw) { const p = JSON.parse(raw); setChartData(p.chart); setChartName(p.chartName || ''); setLoading(false); return true; }
      } catch {}
      return false;
    };
    const startedAt = Date.now();
    let plateShown = false;
    const poll = async () => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      let res: any;
      try {
        res = await getChartResult(id);
      } catch {
        // 网络抖动不该被读成「排盘失败」：按仍在处理走，到 210s 才收。
        res = { httpStatus: 202, data: { status: 'processing' } };
      }
      if (cancelled) return;
      const data = res?.data || {};
      const d = decideAiWait({
        httpStatus: res?.httpStatus ?? 0,
        status: data.status,
        chartData: data.chartData,
        aiAnalysis: data.aiAnalysis,
      }, elapsed);
      // 盘面已经画出来了就不该退回「正在排盘」，AI 那一栏继续按等待处理。
      setAiState(plateShown && d.state === 'chart-pending' ? 'ai-waiting' : d.state);
      if (d.showPlate && !plateShown && data.chartData) {
        plateShown = true;
        setChartData(graftLocalMeta(data.chartData));
        setChartName(data.name || '');
        setError(null);
        setLoading(false);
      }
      if (data.aiAnalysis) setAiAnalysis(data.aiAnalysis);
      if (d.keepPolling) { setTimeout(poll, d.nextDelayMs); return; }
      if (!plateShown) {
        if (fallbackToSession()) return;
        setError(d.state === 'chart-failed' ? '排盘未完成，请返回重试' : '网络异常，请检查连接后重试');
        setLoading(false);
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
      <main className="qn-shell qn-shell--wide">
        <section style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(178,149,93,0.2)', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin 0.9s linear infinite' }} />
          <p className="qn-meta" style={{ marginTop: 24, letterSpacing: '0.1em' }}>正在生成命理档案...</p>
        </section>
      </main>
    );
  }
  if (error) {
    return (
      <main className="qn-shell qn-shell--wide" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p className="qn-title">{error}</p>
        <button type="button" onClick={() => router.push('/create')} className="qn-btn qn-btn--solid" style={{ marginTop: 24 }}>重新排盘</button>
      </main>
    );
  }
  if (!enrichedChartData) return null;

  return (
    <main className="qn-shell qn-shell--wide">
      <div style={{ display: 'grid', gap: 40 }}>
        <ChartOverview chartData={enrichedChartData} chartName={chartName} />
        <DoubleVerify chartData={enrichedChartData} />
        <BaziCard bazi={enrichedChartData.bazi} enrichment={enrichedChartData.bazi?.enrichment} />
        <ZiweiCard ziwei={enrichedChartData.ziwei} bazi={enrichedChartData.bazi} />
        {/* 无条件挂载：四柱不齐时组件自己走降级分支（说明 + /create），不在页面里玩条件渲染 ——
            整节静悄悄消失，用户分不清是"这站没这功能"还是"我的盘没算出来"。 */}
        <ScenarioMatrix chart={enrichedChartData.bazi} />
        <LifeCurve chart={enrichedChartData.bazi} />

        {/* AI 解读卡：盘面先出，这一栏按状态机给话。没有百分比、没有「预计 X 秒」——
            免费模型的耗时实测 94–116 秒但随负载浮动，编一个进度条就是撒谎。 */}
        <section className="qn-card">
          <p className="qn-cap" style={{ marginBottom: 8 }}>AI 解读 · 免费生成</p>
          {aiAnalysis ? (
            Object.entries(aiAnalysis as Record<string, any>).map(([k, v]) => (
              <div key={k} style={{ marginTop: 16 }}>
                <h3 className="qn-title" style={{ marginBottom: 6 }}>{k}</h3>
                {typeof v === 'string' ? (
                  <p className="qn-body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{v}</p>
                ) : Array.isArray(v) ? (
                  <ul className="qn-body" style={{ paddingLeft: 20, lineHeight: 1.85 }}>
                    {v.map((x, i) => <li key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}
                  </ul>
                ) : (
                  <pre className="qn-body" style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>{JSON.stringify(v, null, 2)}</pre>
                )}
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {aiState !== 'ai-ready' && (
                <span aria-hidden="true" style={{ display: 'inline-flex', gap: 4 }}>
                  {[0, 0.3, 0.6].map(d => (
                    <span key={d} style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent-gold)',
                      animation: `glow-breathe 1.5s ease-in-out ${d}s infinite`,
                    }} />
                  ))}
                </span>
              )}
              <p className="qn-body" style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{aiWaitMessage(aiState)}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}