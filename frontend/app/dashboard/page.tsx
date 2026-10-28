'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { REPORT_TYPE_LABELS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/report/types';
import { getVisitorId } from '@/lib/auth/visitor';
import type { ReportListItem, ReportType } from '@/lib/report/types';
import { deleteTarotReading, getTarotReading, listTarotReadings } from '@/app/lib/api';
import type { TarotSavedReadingDetail, TarotSavedReadingListItem } from '@/app/lib/api';
import { TAROT_DECK } from '@/lib/tarot/deck';
import { getMarseilleReading } from '@/lib/tarot/marseille-readings';
import PlainLanguageView from '@/components/ai/PlainLanguageView';

const TYPE_MARKS: Record<ReportType, string> = { bazi: '八', ziwei: '紫', liuyao: '六', tarot: '塔' };

export default function DashboardPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tarotReadings, setTarotReadings] = useState<TarotSavedReadingListItem[]>([]);
  const [tarotLoading, setTarotLoading] = useState(true);
  const [tarotError, setTarotError] = useState('');
  const [visitorId, setVisitorId] = useState('');
  const [expandedTarotId, setExpandedTarotId] = useState('');
  const [tarotDetails, setTarotDetails] = useState<Record<string, TarotSavedReadingDetail>>({});
  const [tarotDetailLoading, setTarotDetailLoading] = useState('');
  const [tarotDetailError, setTarotDetailError] = useState('');
  const [tarotDeletingId, setTarotDeletingId] = useState('');

  useEffect(() => {
    const vid = getVisitorId();
    setVisitorId(vid);
    fetch('/api/reports', { headers: vid ? { 'x-visitor-id': vid } : {} })
      .then(r => r.json())
      .then(d => {
        if (!d.success || !Array.isArray(d.data)) throw new Error(d.error || '加载失败，请稍后重试');
        setReports(d.data.filter((item: ReportListItem) => item.type !== 'tarot'));
      })
      .catch(() => setError("加载失败，请稍后重试"))
      .finally(() => setLoading(false));
    listTarotReadings(vid)
      .then(setTarotReadings)
      .catch(err => setTarotError(err instanceof Error ? err.message : '塔罗记录暂时无法读取'))
      .finally(() => setTarotLoading(false));
  }, []);

  const toggleTarotDetail = async (item: TarotSavedReadingListItem) => {
    if (expandedTarotId === item.id) {
      setExpandedTarotId('');
      setTarotDetailError('');
      return;
    }
    setExpandedTarotId(item.id);
    setTarotDetailError('');
    if (tarotDetails[item.id]) return;
    setTarotDetailLoading(item.id);
    try {
      const detail = await getTarotReading(visitorId || getVisitorId(), item.id);
      setTarotDetails(current => ({ ...current, [item.id]: detail }));
    } catch {
      setTarotDetailError('记录不存在、已过期或当前浏览器身份无权查看。请刷新列表后重试。');
    } finally {
      setTarotDetailLoading('');
    }
  };

  const removeTarotReading = async (item: TarotSavedReadingListItem) => {
    if (!window.confirm('确认删除这条塔罗记录？删除后无法恢复。')) return;
    setTarotDeletingId(item.id);
    setTarotDetailError('');
    try {
      await deleteTarotReading(visitorId || getVisitorId(), item.id);
      setTarotReadings(current => current.filter(row => row.id !== item.id));
      setTarotDetails(current => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      if (expandedTarotId === item.id) setExpandedTarotId('');
    } catch {
      setTarotDetailError('删除失败：记录可能已过期、已删除或当前浏览器身份无权操作。');
    } finally {
      setTarotDeletingId('');
    }
  };

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <h1 className="qn-hero" style={{ margin: '0 0 6px' }}>我的报告</h1>
      <p className="qn-meta" style={{ marginBottom: 28 }}>八字命盘 · 紫微斗数 · 六爻占卜 · 塔罗牌阵</p>

      {/* 加载/空/列表三种状态共用同一高度容器：页脚在数据到达前后不移动。 */}
      <div data-dashboard-content style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px) - 120px)' }}>
      {error ? (
        <>
          <div className="qn-alert" role="alert">{error}</div>
          <div style={{ marginTop: 18 }}>
            <button type="button" className="qn-btn qn-btn--ghost" onClick={() => window.location.reload()}>重新加载</button>
          </div>
        </>
      ) : loading ? (
        <div style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px) - 140px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(178,149,93,0.2)', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin 0.9s linear infinite' }} />
          <p className="qn-meta" style={{ marginTop: 24, letterSpacing: '0.1em' }}>加载中...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="qn-card" style={{ textAlign: 'center', padding: '44px 24px' }}>
          <h2 className="qn-title" style={{ marginBottom: 8 }}>暂无命盘或卦象报告</h2>
          <p className="qn-meta" style={{ marginBottom: 26 }}>生成八字命盘或完成六爻起卦后，记录会显示在这里</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/create" className="qn-btn qn-btn--ghost">八字排盘 →</Link>
            <Link href="/liuyao/create" className="qn-btn qn-btn--ghost">六爻起卦 →</Link>
          </div>
        </div>
      ) : (
        <div className="qn-stack">
          {reports.map(r => (
            <Link key={r.id} href={`/report/${r.id}`} className="qn-card qn-row">
              <span style={{
                flex: '0 0 auto', width: 40, height: 40, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif',
                fontSize: 'var(--qn-fs-body)', color: 'var(--color-accent-gold-text)',
                background: 'rgba(178, 149, 93, 0.08)',
              }}>{TYPE_MARKS[r.type] || '命'}</span>
              <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <p className="qn-body" style={{ fontWeight: 500 }}>{r.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="qn-cap">{REPORT_TYPE_LABELS[r.type] || r.type} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}</span>
                  <span className="qn-badge">
                    <span className="qn-badge__dot" style={{ background: REPORT_STATUS_COLORS[r.status] || 'var(--color-text-secondary)' }} />
                    {REPORT_STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              </div>
              <span className="qn-cap" style={{ flex: '0 0 auto' }}>查看 →</span>
            </Link>
          ))}
        </div>
      )}
      </div>

      <section className="tarot-dashboard" data-tarot-dashboard aria-labelledby="tarot-dashboard-title">
        <header className="tarot-dashboard__heading">
          <div>
            <p className="qn-eyebrow">本机访问者标识</p>
            <h2 className="qn-title" id="tarot-dashboard-title">塔罗记录</h2>
          </div>
          <span className="qn-cap">保留 7 天</span>
        </header>
        <p className="qn-meta">保存的抽牌与解读只供此浏览器标识查看；过期后记录会自动清理。</p>
        {tarotError && <p className="qn-alert" role="alert">{tarotError}</p>}
        {tarotDetailError && <p className="qn-alert" role="alert">{tarotDetailError}</p>}
        {tarotLoading ? (
          <div className="qn-card tarot-dashboard__empty" aria-live="polite">正在读取塔罗记录…</div>
        ) : tarotReadings.length === 0 ? (
          <div className="qn-card tarot-dashboard__empty">
            <p className="qn-meta">还没有保存的塔罗记录。</p>
            <Link href="/tarot" className="qn-btn qn-btn--ghost">开始一次塔罗解读 →</Link>
          </div>
        ) : (
          <div className="tarot-dashboard__list">
            {tarotReadings.map(item => {
              const expanded = expandedTarotId === item.id;
              const detail = tarotDetails[item.id];
              return (
                <article className="qn-card tarot-dashboard__item" key={item.id} data-tarot-record-id={item.id}>
                  <div className="tarot-dashboard__item-heading">
                    <button
                      type="button"
                      className="tarot-dashboard__toggle"
                      aria-expanded={expanded}
                      onClick={() => void toggleTarotDetail(item)}
                    >
                      <span className="tarot-dashboard__mark" aria-hidden="true">塔</span>
                      <span className="tarot-dashboard__item-copy">
                        <strong>{item.title}</strong>
                        <span>{new Date(item.createdAt).toLocaleString('zh-CN')} · 塔罗牌阵</span>
                      </span>
                      <span className="tarot-dashboard__chevron" aria-hidden="true">{expanded ? '收起 ↑' : '查看 ↓'}</span>
                    </button>
                    <button
                      type="button"
                      className="tarot-dashboard__delete"
                      onClick={() => void removeTarotReading(item)}
                      disabled={tarotDeletingId === item.id}
                      aria-label={`删除塔罗记录：${item.title}`}
                    >{tarotDeletingId === item.id ? '删除中…' : '删除'}</button>
                  </div>
                  {expanded && (
                    <div className="tarot-dashboard__detail">
                      {tarotDetailLoading === item.id ? (
                        <p className="qn-meta" role="status">正在读取这条记录…</p>
                      ) : detail ? (
                        <>
                          <PlainLanguageView context="tarot" parts={[
                            { id: 'summary', text: detail.reading.summary },
                            ...detail.reading.cards.map((card, index) => ({ id: `card-${index}`, text: card.text })),
                          ]}>{textById => <>
                          <p className="tarot-dashboard__summary">{textById.summary}</p>
                          <ol className="tarot-dashboard__cards">
                            {detail.reading.cards.map((card, index) => {
                              const deckCard = TAROT_DECK.find(item => item.id === card.cardId);
                              const marseille = deckCard ? getMarseilleReading(deckCard) : null;
                              const orientationKey = card.orientation === '正位' ? 'upright' : 'reversed';
                              return (
                                <li key={`${card.cardId}-${index}`}>
                                  <div className="tarot-dashboard__card-title">
                                    <span>{card.position}</span>
                                    <strong>{card.nameZh || deckCard?.nameZh || card.cardId}</strong>
                                    <span>{card.orientation}</span>
                                  </div>
                                  <p>{textById[`card-${index}`]}</p>
                                  {card.source && <small>韦特牌义出处：{card.source}</small>}
                                  {marseille && <small className="qn-cap" style={{ display: 'block', marginTop: 6 }}>马赛 · 本站自研象征读法：{marseille[orientationKey]}</small>}
                                </li>
                              );
                            })}
                          </ol>
                          </>}</PlainLanguageView>
                          {detail.reading.notes.length > 0 && <p className="qn-cap">{detail.reading.notes.join(' ')}</p>}
                        </>
                      ) : !tarotDetailError ? <p className="qn-meta">展开时读取记录详情。</p> : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
