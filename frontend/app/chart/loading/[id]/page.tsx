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
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#ffffff', color: '#1d1d1f' }}>
      <nav className="fixed top-0 z-50 w-full" style={{ background: 'rgba(250,250,249,0.85)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
        <div className="mx-auto flex h-11 max-w-[1024px] items-center px-6">
          <a href="/" className="no-underline text-base font-semibold tracking-[-0.01em]" style={{ color: '#1d1d1f' }}>混沌</a>
        </div>
      </nav>

      <div className="text-center pt-11">
        <div className="w-16 h-16 mx-auto mb-8 relative">
          <div className="absolute inset-0 rounded-full border-2 border-accent-gold/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-accent-gold animate-spin" style={{ borderTopColor: '#b2955d' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-xl font-bold" style={{ color: '#b2955d' }}>混</span>
          </div>
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-[0.05em] mb-3" style={{ color: '#1d1d1f' }}>
          正在建立你的命理档案
        </h1>
        <p className="text-sm mb-10" style={{ color: '#86868b' }}>
          八字 × 紫微双盘 AI 合参
        </p>

        {/* Progress steps */}
        <div className="space-y-3 max-w-[280px] mx-auto">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={i} className="flex items-center gap-3 transition-all duration-500"
                style={{ opacity: done || active ? 1 : 0.3 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                  style={{
                    background: done ? '#b2955d' : active ? 'rgba(178,149,93,0.15)' : 'rgba(0,0,0,0.06)',
                    color: done ? '#fff' : active ? '#b2955d' : 'rgba(0,0,0,0.25)',
                  }}>
                  {done ? '✓' : s.icon}
                </div>
                <span className="text-sm tracking-wider" style={{
                  color: done ? '#1d1d1f' : active ? '#b2955d' : 'rgba(0,0,0,0.25)',
                  fontWeight: active ? 600 : 400,
                }}>
                  {s.label}
                </span>
                {active && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse ml-auto" style={{ background: '#b2955d' }} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-8 rounded-lg p-4 text-sm max-w-[320px] mx-auto" style={{ background: 'rgba(212,84,74,0.06)', color: '#d4544a' }}>
            <p className="mb-3">{error}</p>
            <button onClick={() => router.push('/create')} className="px-5 py-2 rounded-full text-sm font-medium" style={{ background: '#b2955d', color: '#fff' }}>
              返回重新排盘
            </button>
          </div>
        )}
      </div>
    </div>
  );
}