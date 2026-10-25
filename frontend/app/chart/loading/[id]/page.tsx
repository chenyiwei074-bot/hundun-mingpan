'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult } from '@/app/lib/api';

type CreateMode = 'single' | 'double';

export default function LoadingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [mode, setMode] = useState<CreateMode>('single');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let count = 0;

    // 读取提交时保存的实际模式，单人排盘不显示“双盘关系分析”。
    try {
      const raw = sessionStorage.getItem('chart_preview');
      if (raw) {
        const preview = JSON.parse(raw);
        if (preview.chartId === id) setMode(preview.mode === 'double' ? 'double' : 'single');
        if (preview.chart && preview.chartId === id) {
          timer = setTimeout(() => {
            if (!cancelled) router.push('/chart/result/' + id);
          }, 600);
          return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
          };
        }
      }
    } catch {}

    const schedule = (delay: number) => {
      timer = setTimeout(() => { void poll(); }, delay);
    };

    const poll = async () => {
      if (cancelled) return;
      count += 1;
      try {
        const res = await getChartResult(id);
        if (cancelled) return;
        if (res.httpStatus === 401) {
          setError('无法确认本机身份，请使用创建这份命盘时的浏览器重新打开。');
          return;
        }
        if (res.httpStatus === 404) {
          setError('这份命盘不存在、已过保存期限，或当前浏览器无权访问。');
          return;
        }
        if (res.httpStatus === 200 && res.data?.chartData) {
          router.push('/chart/result/' + id);
          return;
        }
        if (count < 60) schedule(res.httpStatus === 202 || res.data?.status === 'processing' ? 1200 : 1500);
        else setError('排盘等待时间较长，请检查网络后重试。');
      } catch {
        if (cancelled) return;
        if (count < 60) schedule(1500);
        else setError('网络异常，请检查连接后重试。');
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, router]);

  return (
    <main className="qn-shell qn-shell--wide" style={{ minHeight: '76vh', display: 'grid', placeItems: 'center' }}>
      <section className="qn-ink qn-rise" role="status" aria-live="polite" style={{ width: '100%', maxWidth: 480, padding: '40px 28px 36px', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ width: 62, height: 62, margin: '0 auto 24px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(178,149,93,0.25)' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin 1.1s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <span className="qn-title" style={{ color: 'var(--color-accent-gold-light)', margin: 0 }}>混</span>
          </div>
        </div>

        <h1 className="qn-hero" style={{ margin: 0 }}>正在生成你的命盘</h1>
        <p className="qn-note" style={{ margin: '12px 0 0' }}>
          排盘完成后会自动打开结果页{mode === 'double' ? '，并提供双方对照入口。' : '。'}
        </p>
        <p className="qn-cap" style={{ margin: '14px 0 0' }}>正在等待排盘结果返回</p>
      </section>

      {error && (
        <section className="qn-alert qn-rise" role="alert" style={{ width: '100%', maxWidth: 480, marginTop: 16, textAlign: 'center' }}>
          <p style={{ margin: 0 }}>{error}</p>
          <button type="button" onClick={() => router.push('/create')} className="qn-btn qn-btn--ghost" style={{ display: 'flex', margin: '14px auto 0' }}>
            返回重新排盘
          </button>
        </section>
      )}
    </main>
  );
}
