'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';

const STEPS = [
  { label: '八字四柱计算', icon: '柱' },
  { label: '紫微十二宫排布', icon: '宫' },
  { label: '双盘关系分析', icon: '合' },
  { label: '生成命格档案', icon: '档' },
];

export default function LoadingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    // 先检查 sessionStorage
    try {
      const raw = sessionStorage.getItem('chart_preview');
      if (raw) {
        const preview = JSON.parse(raw);
        if (preview.chart) {
          // 有前端秒算结果，直接跳转
          setTimeout(() => router.push('/chart/result/' + id), 600);
          return;
        }
      }
    } catch {}

    // 轮询后端
    let cancelled = false;
    let count = 0;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await getChartResult(id);
        if (cancelled) return;
        count++;
        // 更新步骤动画
        setStep(Math.min(count, 3));
        if (res.httpStatus === 200 && res.data?.chartData) {
          setStep(4);
          setTimeout(() => router.push('/chart/result/' + id), 500);
        } else if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (count < 60) setTimeout(poll, 1200);
          else setError('排盘超时，请返回重试');
        } else if (count < 60) {
          setTimeout(poll, 1200);
        } else {
          setError('排盘超时，请返回重试');
        }
      } catch {
        if (!cancelled && count < 60) setTimeout(poll, 1500);
        else setError('网络异常，请检查连接后重试');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '76px 24px 48px' }}>
      <section className="qn-ink qn-rise" style={{ width: '100%', maxWidth: 420, padding: '40px 28px 34px', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, margin: '0 auto 26px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(178,149,93,0.25)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin 1.1s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="qn-title" style={{ color: 'var(--color-accent-gold-light)', margin: 0 }}>混</span>
          </div>
        </div>

        <h1 className="qn-hero" style={{ margin: 0 }}>正在建立你的命理档案</h1>
        <p className="qn-note" style={{ margin: '10px 0 30px' }}>正在生成八字 × 紫微双盘解读</p>

        <div style={{ display: 'grid', gap: 12, maxWidth: 280, margin: '0 auto', textAlign: 'left' }}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const badge = done ? 'var(--color-accent-gold)' : active ? 'rgba(178,149,93,0.22)' : 'rgba(255,255,255,0.08)';
            const tint = done ? 'var(--color-text-primary)' : active ? 'var(--color-accent-gold-light)' : 'rgba(255,255,255,0.55)';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'opacity .5s' }}>
                <span style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', background: badge, color: tint,
                  fontSize: 'var(--qn-fs-eyebrow)', fontWeight: 600, transition: 'background-color .3s, color .3s' }}>
                  {done ? '✓' : s.icon}
                </span>
                <span className="qn-meta" style={{ margin: 0, color: tint, fontWeight: active ? 600 : 400, letterSpacing: '0.04em' }}>
                  {s.label}
                </span>
                {active && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--color-accent-gold)', animation: 'qn-pulse 1.4s ease-in-out infinite' }} />}
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="qn-alert qn-rise" role="alert" style={{ width: '100%', maxWidth: 420, marginTop: 16, textAlign: 'center' }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button type="button" onClick={() => router.push('/create')} className="qn-btn qn-btn--ghost" style={{ display: 'flex', margin: '14px auto 0' }}>
            返回重新排盘
          </button>
        </div>
      )}
    </div>
  );
}
