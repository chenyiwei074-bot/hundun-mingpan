'use client';

import { useEffect, useState } from 'react';

interface StatsData {
  today: Record<string, number>;
  total: Record<string, number>;
  conversion: Record<string, string>;
}

const LABELS: Record<string, string> = {
  page_view: '首页访问',
  create_click: '点击生成',
  chart_complete: '命盘生成',
  wechat_click: '咨询微信',
};

const ICONS: Record<string, string> = {
  page_view: '👁',
  create_click: '✋',
  chart_complete: '✅',
  wechat_click: '💬',
};

const COLORS: Record<string, string> = {
  page_view: '#7b5ea7',
  create_click: '#c9a84c',
  chart_complete: '#4a9e6e',
  wechat_click: '#e05a45',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const eventOrder = ['page_view', 'create_click', 'chart_complete', 'wechat_click'];

  useEffect(() => {
    // 2026-10-16 安全修复：/api/admin/stats 需要口令，从网址 ?token= 取并放进请求头
    const adminToken = new URLSearchParams(window.location.search).get('token') || '';
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') + '/admin/stats', {
      headers: adminToken ? { 'x-admin-token': adminToken } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="qn-shell qn-shell--wide" aria-busy="true">
        <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
          <p className="qn-eyebrow" style={{ margin: 0 }}>混沌 · 数据概览</p>
          <h1 className="qn-hero" style={{ margin: '10px 0 6px' }}>运营面板</h1>
          <p className="qn-meta">
            {new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })}
          </p>
        </header>

        <section aria-label="正在加载今日数据" className="grid grid-cols-2 md:grid-cols-4 gap-3 qn-rise qn-rise--2">
          {eventOrder.map(k => (
            <article key={k} className="qn-card" style={{ padding: 18, textAlign: 'center' }}>
              <div aria-hidden="true" style={{ fontSize: 22, marginBottom: 8 }}>{ICONS[k]}</div>
              <div aria-hidden="true" style={{ width: 64, height: 34, margin: '0 auto', borderRadius: 6, background: 'var(--color-hairline)' }} />
              <p className="qn-cap" style={{ marginTop: 6 }}>{LABELS[k]}</p>
            </article>
          ))}
        </section>

        <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }} aria-label="正在加载转化漏斗">
          <h2 className="qn-axis" style={{ margin: '0 0 12px', textAlign: 'center' }}>转化漏斗</h2>
          <div aria-hidden="true">
            {eventOrder.map((k, i) => (
              <div key={k}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ flex: '0 0 88px', fontSize: 12, textAlign: 'right' }}>{LABELS[k]}</div>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ height: 18, width: '72%', borderRadius: 999, background: 'var(--color-hairline)' }} />
                  </div>
                  <div style={{ flex: '0 0 auto', minWidth: 74, display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ width: 36, height: 22, borderRadius: 5, background: 'var(--color-hairline)' }} />
                  </div>
                </div>
                {i < eventOrder.length - 1 && (
                  <p className="qn-cap" style={{ textAlign: 'center', margin: '0 0 4px', minHeight: 18 }}>
                    <span style={{ display: 'inline-block', width: 48, height: 14, borderRadius: 4, background: 'var(--color-hairline)' }} />
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }} aria-label="正在加载累计数据">
          <h2 className="qn-axis" style={{ margin: '0 0 14px', textAlign: 'center' }}>累计数据</h2>
          <dl style={{ display: 'grid', gap: 10, margin: 0 }}>
            {eventOrder.map(k => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--color-hairline)', paddingBottom: 10 }}>
                <dt className="qn-meta">{LABELS[k]}</dt>
                <dd aria-hidden="true" style={{ width: 40, height: 24, borderRadius: 5, margin: 0, background: 'var(--color-hairline)' }} />
              </div>
            ))}
          </dl>
        </section>

        <p className="qn-cap" style={{ textAlign: 'center', marginTop: 22 }}>
          混沌 · 本地运营面板 · 无需登录
        </p>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="qn-shell qn-shell--wide">
        <section className="qn-card" style={{ textAlign: 'center', padding: '44px 24px' }}>
          <h1 className="qn-title" style={{ margin: '0 0 12px' }}>运营数据暂不可用</h1>
          <p className="qn-alert" role="alert" style={{ margin: 0 }}>
            数据加载失败：请在网址后加 ?token=你的 ADMIN_STATS_TOKEN
          </p>
        </section>
      </main>
    );
  }

  const maxVal = Math.max(...eventOrder.map(k => stats.today[k] || 0), 1);

  return (
    <main className="qn-shell qn-shell--wide">
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>混沌 · 数据概览</p>
        <h1 className="qn-hero" style={{ margin: '10px 0 6px' }}>运营面板</h1>
        <p className="qn-meta">
          {new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })}
        </p>
      </header>

      <section aria-label="今日数据" className="grid grid-cols-2 md:grid-cols-4 gap-3 qn-rise qn-rise--2">
        {eventOrder.map(k => (
          <article key={k} className="qn-card" style={{ padding: 18, textAlign: 'center' }}>
            <div aria-hidden="true" style={{ fontSize: 22, marginBottom: 8 }}>{ICONS[k]}</div>
            <p className="qn-title" style={{ color: COLORS[k], margin: 0 }}>{stats.today[k] || 0}</p>
            <p className="qn-cap" style={{ marginTop: 6 }}>{LABELS[k]}</p>
          </article>
        ))}
      </section>

      <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }} aria-labelledby="admin-funnel-title">
        <h2 id="admin-funnel-title" className="qn-axis" style={{ margin: '0 0 12px', textAlign: 'center' }}>转化漏斗</h2>
        <div>
          {eventOrder.map((k, i) => {
            const val = stats.total[k] || 0;
            const pct = (val / maxVal) * 100;
            const convKey = i > 0
              ? [null, 'visit_to_create', 'create_to_complete', 'complete_to_wechat'][i]
              : null;

            return (
              <div key={k}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ flex: '0 0 88px', fontSize: 12, textAlign: 'right' }}>{LABELS[k]}</div>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div role="meter" aria-label={`${LABELS[k]}累计`} aria-valuemin={0} aria-valuemax={maxVal} aria-valuenow={val}
                      style={{ height: 18, width: Math.max(pct, 2) + '%', borderRadius: 999,
                        background: 'linear-gradient(90deg, ' + COLORS[k] + ', ' + COLORS[k] + '88)',
                        opacity: 0.3 + (0.7 * (1 - i * 0.2)), minWidth: val > 0 ? 40 : 2, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ flex: '0 0 auto', minWidth: 74, textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: COLORS[k] }}>{val}</span>
                    {convKey && <span className="qn-cap" style={{ marginLeft: 4 }}>({stats.conversion[convKey]})</span>}
                  </div>
                </div>
                {i < eventOrder.length - 1 && (
                  <p className="qn-cap" style={{ textAlign: 'center', margin: '0 0 4px' }}>
                    ↓ {stats.conversion[['visit_to_create','create_to_complete','complete_to_wechat'][i]]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }} aria-labelledby="admin-total-title">
        <h2 id="admin-total-title" className="qn-axis" style={{ margin: '0 0 14px', textAlign: 'center' }}>累计数据</h2>
        <dl style={{ display: 'grid', gap: 10, margin: 0 }}>
          {eventOrder.map(k => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--color-hairline)', paddingBottom: 10 }}>
              <dt className="qn-meta">{LABELS[k]}</dt>
              <dd className="qn-body" style={{ fontVariantNumeric: 'tabular-nums', margin: 0 }}>{stats.total[k] || 0}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="qn-cap" style={{ textAlign: 'center', marginTop: 22 }}>
        混沌 · 本地运营面板 · 无需登录
      </p>
    </main>
  );
}
