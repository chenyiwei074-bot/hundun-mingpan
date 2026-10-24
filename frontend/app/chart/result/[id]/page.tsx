'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createChartShareLink, getChartResult, revokeChartShareLink } from '@/app/lib/api';
import ChartOverview from '@/components/chart/ChartOverview';
import BaziCard from '@/components/chart/BaziCard';
import ScenarioMatrix from '@/components/bazi/ScenarioMatrix';
import LifeCurve from '@/components/bazi/LifeCurve';
import HepanSection from '@/components/chart/HepanSection';
import ZiweiCard from '@/components/chart/ZiweiCard';
import DoubleVerify from '@/components/chart/DoubleVerify';
import { saveReport } from '@/lib/report/saveReport';
import { aiWaitMessage, decideAiWait } from '@/lib/chart/ai-wait';
import type { AiWaitState } from '@/lib/chart/ai-wait';
import AiReading from '@/components/chart/AiReading';

type ChartShare = { shareId: string; url: string; expiresAt: string };

function formatShareExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
}

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
  const [canShare, setCanShare] = useState(false);
  const [share, setShare] = useState<ChartShare | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [shareError, setShareError] = useState('');
  const savedRef = useRef(false);

  const makeShareLink = async () => {
    if (!id || !canShare || shareBusy) return;
    setShareBusy(true);
    setShareNotice('');
    setShareError('');
    try {
      const result: any = await createChartShareLink(id);
      const data = result?.data;
      if (!result?.success || !data?.token || !data?.shareId || !data?.expiresAt) {
        if (result?.httpStatus === 409) throw new Error('命盘还未完成，请稍后再生成分享链接。');
        if (result?.httpStatus === 401) throw new Error('无法确认本机身份，请刷新页面后重试。');
        if (result?.httpStatus === 404) throw new Error('没有找到这份命盘，可能已过保存期限。');
        throw new Error(result?.error || '分享链接生成失败，请稍后重试。');
      }
      const url = new URL(`/share/chart/${encodeURIComponent(data.token)}`, window.location.origin).toString();
      setShare({ shareId: data.shareId, url, expiresAt: data.expiresAt });
      setShareNotice('链接已生成。复制后可发送给对方，7 天后自动失效。');
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '分享链接生成失败，请稍后重试。');
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareLink = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setShareNotice('分享链接已复制。');
      setShareError('');
    } catch {
      setShareError('浏览器未允许复制，请选中链接并手动复制。');
    }
  };

  const revokeShareLink = async () => {
    if (!id || !share || shareBusy) return;
    setShareBusy(true);
    setShareNotice('');
    setShareError('');
    try {
      const result: any = await revokeChartShareLink(id, share.shareId);
      if (!result?.success && result?.httpStatus !== 200) {
        if (result?.httpStatus === 401) throw new Error('无法确认本机身份，请刷新页面后重试。');
        if (result?.httpStatus === 404) throw new Error('分享链接已失效，或当前浏览器不再拥有这份命盘。');
        throw new Error(result?.error || '撤回失败，请稍后重试。');
      }
      setShare(null);
      setShareNotice('分享链接已撤回，持有者现在无法再查看这份命盘。');
    } catch (e) {
      setShareError(e instanceof Error ? e.message : '撤回失败，请稍后重试。');
    } finally {
      setShareBusy(false);
    }
  };

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
      if (res?.httpStatus === 401 || res?.httpStatus === 404) {
        setError(res.httpStatus === 401
          ? '无法确认本机身份，请使用创建这份命盘时的浏览器重新打开。'
          : '这份命盘不存在、已过保存期限，或当前浏览器无权访问。');
        setLoading(false);
        return;
      }
      const data = res?.data || {};
      if (data.status === 'complete' || data.status === 'completed') setCanShare(true);
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
        <section className="qn-card" aria-labelledby="chart-share-title">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 620 }}>
              <p className="qn-cap" style={{ margin: '0 0 8px' }}>只读分享</p>
              <h2 id="chart-share-title" className="qn-title" style={{ margin: '0 0 8px' }}>把这份命盘分享给别人</h2>
              <p className="qn-meta" style={{ margin: 0 }}>对方可查看盘面与解读，不会看到姓名、出生资料或地点。分享链接 7 天后失效。</p>
            </div>
            {!share && (
              <button type="button" onClick={makeShareLink} disabled={shareBusy || !canShare} className="qn-btn qn-btn--solid">
                {shareBusy ? '正在生成…' : canShare ? '生成分享链接' : '解读完成后可分享'}
              </button>
            )}
          </div>
          {share && (
            <div className="chart-share-controls" style={{ gap: 10, alignItems: 'end', marginTop: 20 }}>
              <label style={{ minWidth: 0 }}>
                <span className="qn-cap" style={{ display: 'block', marginBottom: 7 }}>分享链接 · 有效至 {formatShareExpiry(share.expiresAt)}</span>
                <input
                  type="url"
                  readOnly
                  value={share.url}
                  aria-label="命盘分享链接"
                  onFocus={event => event.currentTarget.select()}
                  style={{ width: '100%', minWidth: 0, padding: '11px 12px', border: '1px solid rgba(95,75,42,.22)', borderRadius: 8, background: 'rgba(255,255,255,.62)', color: 'var(--color-text-primary)', fontSize: 13 }}
                />
              </label>
              <button type="button" onClick={copyShareLink} disabled={shareBusy} className="qn-btn qn-btn--solid">复制链接</button>
              <button type="button" onClick={revokeShareLink} disabled={shareBusy} className="qn-btn qn-btn--ghost">撤回</button>
            </div>
          )}
          {shareNotice && <p role="status" className="qn-meta" style={{ margin: '12px 0 0' }}>{shareNotice}</p>}
          {shareError && <p role="alert" className="qn-meta" style={{ margin: '12px 0 0', color: '#a13b31' }}>{shareError}</p>}
        </section>
        <ChartOverview chartData={enrichedChartData} chartName={chartName} />
        <DoubleVerify chartData={enrichedChartData} />
        <BaziCard bazi={enrichedChartData.bazi} enrichment={enrichedChartData.bazi?.enrichment} />
        <ZiweiCard ziwei={enrichedChartData.ziwei} bazi={enrichedChartData.bazi} />
        {/* 无条件挂载：四柱不齐时组件自己走降级分支（说明 + /create），不在页面里玩条件渲染 ——
            整节静悄悄消失，用户分不清是"这站没这功能"还是"我的盘没算出来"。 */}
        <ScenarioMatrix chart={enrichedChartData.bazi} />
        <LifeCurve chart={enrichedChartData.bazi} />
        {/* 合盘：同样无条件挂载。没有对方数据时它自己显示一张能当场填的表，
            而不是整节消失 —— 那一栏的隐私边界（本机算、不进 API/报告/台账）也在这节里说。 */}
        <HepanSection chartData={enrichedChartData} />

        {/* AI 解读卡：盘面先出，这一栏按状态机给话。没有百分比、没有「预计 X 秒」——
            免费模型的耗时实测 94–116 秒但随负载浮动，编一个进度条就是撒谎。 */}
        <section className="qn-card">
          <p className="qn-cap" style={{ marginBottom: 8 }}>AI 解读 · 免费生成</p>
          {aiAnalysis ? (
            <AiReading aiAnalysis={aiAnalysis} />
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
