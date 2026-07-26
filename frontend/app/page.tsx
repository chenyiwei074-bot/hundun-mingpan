'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/app/lib/api';

export default function HomePage() {
  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0d5b7] font-sans">
      {/* ===== Nav ===== */}
      <nav className="border-b border-[#1a1814] px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-[#d4a853] text-lg font-bold tracking-[3px] no-underline">混沌阁</Link>
          <Link href="/create" className="text-xs text-[#8a7a5a] tracking-[2px] hover:text-[#e0c878] transition-colors no-underline">命盘排盘</Link>
          <Link href="/liuyao" className="text-xs text-[#8a7a5a] tracking-[2px] hover:text-[#e0c878] transition-colors no-underline">六爻决策</Link>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <section className="max-w-2xl mx-auto px-4 pt-20 pb-12 text-center">
        {/* 印章 */}
        <div className="mx-auto mb-8 w-20 h-20 border-2 border-[#c9a84c] rounded-sm flex items-center justify-center transform -rotate-3">
          <div className="text-[#c9a84c] text-center leading-tight">
            <div className="text-xs tracking-[3px]">混沌</div>
            <div className="text-xs tracking-[3px] mt-0.5">阁</div>
          </div>
        </div>

        <h1 className="text-[#e8e0d5] text-2xl md:text-3xl tracking-[4px] font-normal mb-3">
          古籍为根 · AI 参详
        </h1>
        <p className="text-sm text-[#a89a85] tracking-[1px] mb-2">
          《滴天髓》《三命通会》《紫微斗数全书》原文为根
        </p>
        <p className="text-xs text-[#6b5f52] tracking-[1px] mb-10">
          AI 逐句参详，专业克制，按次计费，不订阅
        </p>

        {/* 双 CTA */}
        <div className="flex gap-4 justify-center">
          <Link href="/create"
            className="bg-[#c9a84c] text-[#0d0b09] text-sm px-8 py-3 rounded-lg tracking-[3px] font-medium hover:bg-[#e0c878] transition-colors no-underline"
          >开始排盘</Link>
          <Link href="/liuyao"
            className="border border-[#c9a84c]/40 text-[#c9a84c] text-sm px-8 py-3 rounded-lg tracking-[3px] hover:bg-[#c9a84c]/10 transition-colors no-underline"
          >六爻起卦</Link>
        </div>
      </section>

      {/* ===== 卖点滚动 ===== */}
      <section className="max-w-2xl mx-auto px-4 py-6 overflow-hidden">
        <div className="flex gap-6 animate-marquee whitespace-nowrap text-xs text-[#4a4035] tracking-[2px]">
          <span>《滴天髓》</span><span>·</span>
          <span>《三命通会》</span><span>·</span>
          <span>《穷通宝鉴》</span><span>·</span>
          <span>《子平真诠》</span><span>·</span>
          <span>《紫微斗数全书》</span><span>·</span>
          <span>《渊海子平》</span><span>·</span>
          <span>《增删卜易》</span><span>·</span>
          <span>《卜筮正宗》</span>
        </div>
      </section>

      {/* ===== 核心功能 ===== */}
      <section className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-center text-[10px] text-[#6b5f52] tracking-[3px] mb-8">核 心 功 能</p>
        <p className="text-center text-xs text-[#8a7a5a] mb-8 leading-relaxed">
          每一句解读都引自古籍原文，可溯源、不空谈、千人千面
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* 命盘排盘 */}
          <Link href="/create"
            className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-5 hover:border-[#c9a84c]/40 transition-all group no-underline block"
          >
            <div className="text-2xl mb-3">☰☷</div>
            <h3 className="text-[#e0c878] text-sm tracking-[2px] mb-1">命盘排盘</h3>
            <p className="text-[10px] text-[#8a7a5a] leading-relaxed mb-3">
              八字 × 紫微双体系<br/>自动起盘 · AI 解读
            </p>
            <span className="text-[10px] text-[#6b5f52] tracking-[1px] group-hover:text-[#c9a84c] transition-colors">
              免费 → 了解详情
            </span>
          </Link>

          {/* 六爻起卦 */}
          <Link href="/liuyao"
            className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-5 hover:border-[#c9a84c]/40 transition-all group no-underline block"
          >
            <div className="text-2xl mb-3">☰☵☶</div>
            <h3 className="text-[#e0c878] text-sm tracking-[2px] mb-1">混沌问卦</h3>
            <p className="text-[10px] text-[#8a7a5a] leading-relaxed mb-3">
              一事一占 · 三盘合断<br/>六爻决策 · 即时起卦
            </p>
            <span className="text-[10px] text-[#6b5f52] tracking-[1px] group-hover:text-[#c9a84c] transition-colors">
              免费 → 开始摇卦
            </span>
          </Link>
        </div>
      </section>

      {/* ===== 海报展示 ===== */}
      <section className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-[10px] text-[#6b5f52] tracking-[3px] mb-6">专 属 海 报</p>
        <p className="text-sm text-[#a89a85] mb-8 leading-relaxed">
          生成你的专属命盘海报 · 分享给懂的人看
        </p>
        <div className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-4 inline-block">
          <div className="w-48 h-64 bg-[#0a0806] rounded flex items-center justify-center text-[#3a3025] text-xs tracking-[2px]">
            命盘海报预览
          </div>
        </div>
      </section>

      {/* ===== 底部 CTA ===== */}
      <section className="max-w-2xl mx-auto px-4 py-12 text-center">
        <Link href="/create"
          className="inline-block bg-[#c9a84c] text-[#0d0b09] text-sm px-10 py-3.5 rounded-lg tracking-[3px] font-medium hover:bg-[#e0c878] transition-colors no-underline"
        >免费排一张自己的盘试试 →</Link>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-[#1a1814] py-8 text-center">
        <p className="text-[10px] text-[#4a4035] tracking-[2px] mb-3">
          古籍数字化 · AI 参详 — 仅作文化研究与体验，不构成任何决策建议
        </p>
        <div className="flex justify-center gap-6 text-[10px] text-[#6b5f52] tracking-[1px]">
          <span>混沌阁 · 命理研究</span>
        </div>
      </footer>
    </div>
  );
}
