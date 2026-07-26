'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent } from '@/app/lib/api';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-[#0a0a0a]">
      {/* 装饰背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#7b5ea7] rounded-full opacity-[0.03] blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#c9a84c] rounded-full opacity-[0.03] blur-3xl" />
      </div>

      <div className="text-center max-w-lg w-full animate-fade-up relative z-10">
        {/* 印章 */}
        <div className="mx-auto mb-8 w-20 h-20 border-2 border-[#c9a84c] rounded-sm flex items-center justify-center transform -rotate-3">
          <div className="text-[#c9a84c] text-center leading-tight">
            <div className="text-xs tracking-[3px]">混沌</div>
            <div className="text-xs tracking-[3px] mt-0.5">阁</div>
          </div>
        </div>

        {/* 主标题 */}
        <h1 className="text-2xl md:text-3xl font-normal text-[#e8e0d5] tracking-[3px] mb-2 leading-relaxed">
          古籍为根 · AI 参详
        </h1>
        <p className="text-sm text-[#a89a85] tracking-[1px] mb-10">
          八字 · 紫微 · 六爻 — 传统术数，现代解读
        </p>

        {/* 两个入口卡片 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* 命盘排盘 */}
          <Link href="/create"
            className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-6 text-left hover:border-[#c9a84c]/40 transition-all group no-underline block"
          >
            <div className="text-3xl mb-3">☰☷</div>
            <h3 className="text-[#e0c878] text-base tracking-[2px] mb-1 group-hover:text-[#d4a853]">命盘排盘</h3>
            <p className="text-xs text-[#8a7a5a] leading-relaxed">
              八字 × 紫微双体系<br/>免费排盘 · AI 解读
            </p>
            <span className="inline-block mt-3 text-[10px] text-[#6b5f52] tracking-[1px] group-hover:text-[#c9a84c] transition-colors">
              开始排盘 →
            </span>
          </Link>

          {/* 六爻起卦 */}
          <Link href="/liuyao"
            className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-6 text-left hover:border-[#c9a84c]/40 transition-all group no-underline block"
          >
            <div className="text-3xl mb-3">☰☵☶</div>
            <h3 className="text-[#e0c878] text-base tracking-[2px] mb-1 group-hover:text-[#d4a853]">混沌问卦</h3>
            <p className="text-xs text-[#8a7a5a] leading-relaxed">
              一事一占 · 六爻决策<br/>三盘合断 · 免费体验
            </p>
            <span className="inline-block mt-3 text-[10px] text-[#6b5f52] tracking-[1px] group-hover:text-[#c9a84c] transition-colors">
              开始摇卦 →
            </span>
          </Link>
        </div>

        {/* 底部 */}
        <p className="text-xs text-[#6b5f52] tracking-[2px]">
          每日 3 次免费 · 古籍参照 · 不构成决策建议
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
