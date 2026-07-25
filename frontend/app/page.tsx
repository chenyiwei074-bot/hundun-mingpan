'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent } from '@/app/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* 装饰背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#7b5ea7] rounded-full opacity-[0.03] blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#c9a84c] rounded-full opacity-[0.03] blur-3xl" />
      </div>

      <div className="text-center max-w-2xl animate-fade-up relative z-10">
        {/* 印章 */}
        <div className="mx-auto mb-10 w-24 h-24 border-2 border-[#c9a84c] rounded-sm flex items-center justify-center transform -rotate-3">
          <div className="text-[#c9a84c] text-center leading-tight">
            <div className="text-sm tracking-[4px]">混沌</div>
            <div className="text-sm tracking-[4px] mt-1">阁</div>
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-5xl md:text-6xl font-normal text-[#e8e0d5] tracking-[10px] mb-4">
          混沌阁命盘
        </h1>

        {/* 副标题 */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="w-8 h-px bg-[#c9a84c]/40" />
          <span className="text-[#7b5ea7] text-sm tracking-[4px]">八字</span>
          <span className="text-[#c9a84c] text-lg">×</span>
          <span className="text-[#7b5ea7] text-sm tracking-[4px]">紫微斗数</span>
          <span className="w-8 h-px bg-[#c9a84c]/40" />
        </div>

        <p className="text-base text-[#a89a85] tracking-[4px] mb-3">
          AI 智能融合 · 双盘交叉印证
        </p>
        <p className="text-sm text-[#6b5f52] tracking-[3px] mb-14">
          生成你的专属命理档案
        </p>

        {/* CTA */}
        <button
          onClick={() => router.push('/create')}
          className="btn-gold text-lg px-12 py-5 tracking-[4px] animate-pulse-gold"
        >
          免费生成命盘
        </button>

        {/* 底部 */}
        <p className="mt-12 text-xs text-[#6b5f52] tracking-[2px]">
          每日 3 次免费 · 基于传统命理算法 + AI 深度解读
        </p>
      </div>

      {/* 底部装饰 */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className="w-12 h-px bg-[#c9a84c]/20" />
        <span className="text-[10px] text-[#6b5f52] tracking-[3px]">混沌阁 · 命理研究</span>
        <span className="w-12 h-px bg-[#c9a84c]/20" />
      </div>
    </div>
  );
}
