'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { REPORT_TYPE_LABELS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/report/types';
import { checkReportAccess } from '@/lib/report/access';
import type { ReportRecord } from '@/lib/report/types';
import { getVisitorId } from '@/lib/auth/visitor';

/** 返回链接要撑到 44px 命中区，否则手机上只有 17px 高 */
const BACK: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44 };

/** 把报告正文按行渲染：连续的 `- ` 归到一个 ul 里，空行只作为块间距 */function renderReport(text: string) {
  const out: React.ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(
      <ul key={`ul-${out.length}`} style={{ margin: '0 0 12px', padding: 0, listStyle: 'none' }}>
        {items.map((t, i) => (
          <li key={i} className="qn-body" style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span aria-hidden="true" style={{ flex: '0 0 auto', color: 'var(--color-accent-gold-text)' }}>·</span>
            <span style={{ flex: '1 1 auto' }}>{t}</span>
          </li>
        ))}
      </ul>
    );
    items = [];
  };

  text.split('\n').forEach((line, i) => {
    if (line.startsWith('# ')) {
      flush();
      out.push(<h2 key={i} className="qn-title" style={{ margin: '26px 0 10px', textWrap: 'balance' }}>{line.slice(2)}</h2>);
    } else if (line.startsWith('## ')) {
      flush();
      out.push(<h3 key={i} className="qn-body" style={{ margin: '22px 0 8px', fontWeight: 600, color: 'var(--color-accent-gold-text)', letterSpacing: '0.04em' }}>{line.slice(3)}</h3>);
    } else if (line.startsWith('> ')) {
      flush();
      out.push(<blockquote key={i} className="qn-body" style={{ margin: '10px 0', padding: '10px 14px', borderLeft: '2px solid var(--color-accent-gold)', background: 'rgba(178,149,93,0.04)', borderRadius: '0 8px 8px 0' }}>{line.slice(2)}</blockquote>);
    } else if (line.startsWith('- ')) {
      items.push(line.slice(2));
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      out.push(<p key={i} className="qn-body" style={{ marginBottom: 8 }}>{line}</p>);
    }
  });
  flush();
  return out;
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const vid = getVisitorId();
      fetch(`/api/reports/${id}?visitorId=${encodeURIComponent(vid)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReport(d.data); else setError(d.error || '报告不存在'); })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <main className="qn-shell qn-shell--wide" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <div style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px) - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(178,149,93,0.2)', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin 0.9s linear infinite' }} />
        <p className="qn-meta" style={{ marginTop: 24, letterSpacing: '0.1em' }}>加载中...</p>
      </div>
    </main>
  );

  if (error || !report) return (
    <main className="qn-shell qn-shell--wide" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <div className="qn-card" style={{ textAlign: 'center', padding: '44px 24px' }}>
        <div className="qn-alert" role="alert" style={{ display: 'inline-block' }}>{error || '报告不存在'}</div>
        <div style={{ marginTop: 22 }}>
          <Link href="/dashboard" className="qn-link" style={BACK}>← 返回报告列表</Link>
        </div>
      </div>
    </main>
  );

  const access = checkReportAccess(report.status);
  const displayText = access.canViewFull ? (report.reportText || report.previewText || '') : (report.previewText || '');

  return (
    <main className="qn-shell qn-shell--wide" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <Link href="/dashboard" className="qn-link" style={BACK}>← 返回报告列表</Link>

      <header className="qn-card" style={{ marginTop: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <p className="qn-cap" style={{ marginBottom: 6 }}>{REPORT_TYPE_LABELS[report.type] || report.type}</p>
            <h1 className="qn-title" style={{ textWrap: 'balance' }}>{report.title}</h1>
            <p className="qn-meta" style={{ marginTop: 8 }}>{new Date(report.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <span className="qn-badge" style={{ marginTop: 4 }}>
            <span className="qn-badge__dot" style={{ background: REPORT_STATUS_COLORS[report.status] || 'var(--color-text-secondary)' }} />
            {REPORT_STATUS_LABELS[report.status] || report.status}
          </span>
        </div>
      </header>


      <article className="qn-card">
        {displayText ? renderReport(displayText) : (
          <p className="qn-meta" style={{ textAlign: 'center', padding: '28px 0' }}>暂无报告内容</p>
        )}
      </article>
    </main>
  );
}
