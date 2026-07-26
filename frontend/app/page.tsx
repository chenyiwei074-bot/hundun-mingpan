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

        {/* 主标题 */}
        <h1 className="text-3xl md:text-4xl font-normal text-[#e8e0d5] tracking-[4px] mb-4 leading-relaxed">
          你的命盘里，藏着你没看到的人生答案
        </h1>

        {/* 副标题 */}
        <p className="text-base text-[#a89a85] tracking-[2px] mb-12">
          AI 结合传统八字与紫微斗数，为你生成专属命理分析
        </p>

        {/* 三个卖点 */}
        <div className="grid grid-cols-3 gap-4 mb-12 max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">{'☉'}</span>
            <span className="text-xs text-[#a89a85] tracking-[1px]">紫微八字</span>
            <span className="text-xs text-[#6b5f52]">双体系分析</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">{'◆'}</span>
            <span className="text-xs text-[#a89a85] tracking-[1px]">专属命盘</span>
            <span className="text-xs text-[#6b5f52]">海报</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">{'✎'}</span>
            <span className="text-xs text-[#a89a85] tracking-[1px]">万字深度</span>
            <span className="text-xs text-[#6b5f52]">解析报告</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/create')}
          className="btn-gold text-lg px-12 py-5 tracking-[4px] animate-pulse-gold"
        >
          免费生成我的命盘
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
