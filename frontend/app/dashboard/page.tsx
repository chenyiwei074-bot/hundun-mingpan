'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { REPORT_TYPE_LABELS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/report/types';
import { getVisitorId } from '@/lib/auth/visitor';
import type { ReportListItem, ReportType } from '@/lib/report/types';

const TYPE_MARKS: Record<ReportType, string> = { bazi: '八', ziwei: '紫', liuyao: '六' };

export default function DashboardPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const vid = getVisitorId();
    fetch(`/api/reports?visitorId=${vid}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReports(d.data); })
      .catch(() => setError("加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <h1 className="qn-hero" style={{ margin: '0 0 6px' }}>我的报告</h1>
      <p className="qn-meta" style={{ marginBottom: 28 }}>八字命盘 · 紫微斗数 · 六爻占卜</p>

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
          <h2 className="qn-title" style={{ marginBottom: 8 }}>暂无报告</h2>
          <p className="qn-meta" style={{ marginBottom: 26 }}>生成命盘或起卦后会自动保存</p>
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
    </main>
  );
}
