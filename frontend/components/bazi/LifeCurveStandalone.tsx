'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getChartResult } from '@/app/lib/api';
import type { BaziChart } from '@/app/lib/core/yiqi-core/types';
import LifeCurve from '@/components/bazi/LifeCurve';
import LiuYuePanel from '@/components/bazi/LiuYuePanel';
import ToolInterpretation from '@/components/ai/ToolInterpretation';

type Preview = { chartId?: string; chart?: { bazi?: BaziChart } };

function readPreview(): Preview | null {
  try {
    const raw = sessionStorage.getItem('chart_preview');
    return raw ? JSON.parse(raw) as Preview : null;
  } catch { return null; }
}

export default function LifeCurveStandalone({ chartId }: { chartId?: string }) {
  const [chart, setChart] = useState<BaziChart | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noChart, setNoChart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setChart(undefined);
    setError('');
    setNoChart(false);
    setLoading(true);
    const useLocalPreview = (expectedId?: string) => {
      const preview = readPreview();
      if (preview?.chart?.bazi && (!expectedId || preview.chartId === expectedId)) {
        setChart(preview.chart.bazi);
        setLoading(false);
        return true;
      }
      return false;
    };

    if (!chartId) {
      if (!useLocalPreview()) { setNoChart(true); setLoading(false); }
      return () => { cancelled = true; };
    }

    if (chartId.startsWith('local_')) {
      if (!useLocalPreview(chartId)) {
        setError('本机预览已失效，请重新排盘后再查看人生曲线。');
        setLoading(false);
      }
      return () => { cancelled = true; };
    }

    void getChartResult(chartId).then(res => {
      if (cancelled) return;
      if (res.httpStatus === 401) {
        setError('无法确认本机身份，请使用创建这份命盘时的浏览器重新打开。');
      } else if (res.httpStatus === 404) {
        setError('这份命盘不存在、已过保存期限，或当前浏览器无权访问。');
      } else if (res.data?.chartData?.bazi) {
        setChart(res.data.chartData.bazi as BaziChart);
      } else if (!useLocalPreview(chartId)) {
        setError('这份命盘暂时没有可查看的大运与流年数据，请返回命盘结果页确认。');
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('命盘暂时无法读取，请检查网络后重试。');
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [chartId]);

  useEffect(() => {
    if (!chart || window.location.hash !== '#liuyue') return;
    const frame = requestAnimationFrame(() => document.getElementById('liuyue')?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [chart]);

  return (
    <main className="qn-shell qn-shell--wide" data-mode="oriental"
      data-dayun-loading={loading && chartId ? 'true' : undefined}>
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/oriental" className="domain-back">← 返回东方目录</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方 · 岁运结构</p>
        <h1 className="qn-hero">大运 · 流年 · 流月 · 人生曲线</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          先看大运和流年，再按交节时刻查看十二个节月的月柱与十神关系。这里只呈现结构，不提供吉凶评分或确定性预测。
        </p>
        <a className="qn-link" href="#liuyue" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>直接看流月 ↓</a>
      </header>

      {loading ? (
        <section className="qn-card" data-dayun-state="loading" role="status" aria-live="polite"><p className="qn-meta">正在读取这份命盘……</p></section>
      ) : error ? (
        <section className="qn-card" data-dayun-state="error" role="alert">
          <h2 className="qn-title">暂时无法读取命盘</h2>
          <p className="qn-meta">{error}</p>
          <p className="qn-linkrow">
            {chartId && <Link className="qn-link" href={`/chart/result/${encodeURIComponent(chartId)}`}>返回命盘结果</Link>}
            <Link className="qn-link" href="/create">重新排盘</Link>
          </p>
        </section>
      ) : noChart ? (
        <section className="qn-card" data-dayun-state="empty">
          <h2 className="qn-title">先打开一张命盘</h2>
          <p className="qn-meta">人生曲线需要使用已有命盘中的大运与流年数据。当前浏览器没有可读取的命盘，我们不会展示预置样例。</p>
          <Link className="qn-btn qn-btn--solid" href="/create" style={{ marginTop: 14, display: 'inline-block' }}>去排一张盘</Link>
        </section>
      ) : (
        <div data-dayun-state="ready">
        <LifeCurve chart={chart} />
        {chart && <ToolInterpretation tool="dayun" title="大运流年 · 混沌自研 AI 解读" payload={{
          siZhu: chart.siZhu,
          dayMaster: chart.dayMaster,
          shiShen: chart.shiShen,
          naYin: chart.naYin,
          dayunStart: chart.dayunStart,
          dayun: chart.dayun.map(segment => ({
            ganZhi: segment.ganZhi,
            startAge: segment.startAge,
            startYear: segment.startYear,
            endYear: segment.endYear,
            ganShiShen: segment.ganShiShen,
            zhiShiShen: segment.zhiShiShen,
            liuNian: segment.liuNian,
          })),
        }} />}
        {chart && <LiuYuePanel chart={chart} />}
        </div>
      )}

      <footer className="qn-legal qn-dayun-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          大运、流年沿用当前命盘；流月使用同一排盘库的精确节气时刻和月柱计算。个人备注仅保存在当前设备，不进入报告。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/oriental">返回东方目录</Link>
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
        </p>
      </footer>
    </main>
  );
}
