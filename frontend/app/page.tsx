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
    <div className="flex min-h-screen flex-col pb-[var(--tabbar-h)] md:pb-0">
      {/* ===== Nav ===== */}
      <nav className="fixed top-0 z-50 w-full bg-[var(--bg-deep)]/95 backdrop-blur-sm border-b border-[var(--border-subtle)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="text-2xl font-bold text-[var(--gold)] font-serif">混沌阁</span>
            <span className="hidden text-sm sm:inline text-[var(--text-muted)]">命理研究</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex lg:gap-6">
            <Link href="/create" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline">命盘排盘</Link>
            <Link href="/liuyao" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] no-underline">六爻决策</Link>
          </div>
          <div className="flex items-center gap-4" />
        </div>
      </nav>

      {/* ===== Main ===== */}
      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top,0px))]">
        <div className="flex flex-col items-center">

          {/* ===== Hero Section ===== */}
          <section className="relative flex min-h-[88vh] w-full flex-col items-center justify-center bg-[var(--bg-deep)]">
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-deep)] via-[var(--bg-deep)] to-transparent" />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[12%] top-[18%] h-72 w-72 bg-[var(--purple)] rounded-full opacity-[0.04] blur-3xl" />
              <div className="absolute bottom-[20%] right-[8%] h-64 w-64 bg-[var(--gold)] rounded-full opacity-[0.04] blur-3xl" />
            </div>

            <div className="relative z-[1] flex flex-col items-center text-center px-6">
              {/* 印章 */}
              <div className="mx-auto mb-10 w-24 h-24 border-2 border-[var(--gold)] rounded-sm flex items-center justify-center transform -rotate-3">
                <div className="text-[var(--gold)] text-center leading-tight">
                  <div className="text-sm tracking-[4px]">混沌</div>
                  <div className="text-sm tracking-[4px] mt-1">阁</div>
                </div>
              </div>

              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[var(--gold)] mb-4 tracking-[4px]">
                古籍为根 · AI 参详
              </h1>
              <p className="text-sm text-[var(--text-muted)] tracking-[2px] mb-2">
                《滴天髓》《三命通会》《紫微斗数全书》原文为根
              </p>
              <p className="text-[13px] text-[var(--text-muted)] tracking-[1px] mb-10">
                AI 逐句参详，八字 · 紫微 · 六爻，按次计费，不订阅
              </p>

              {/* CTA buttons */}
              <div className="flex gap-4">
                <Link href="/create"
                  className="inline-flex items-center justify-center bg-[var(--gold)] text-[var(--bg-deep)] px-8 py-3 rounded-lg text-sm tracking-[3px] font-medium hover:bg-[var(--gold-light)] transition-colors no-underline"
                >开始排盘</Link>
                <Link href="/liuyao"
                  className="inline-flex items-center justify-center border border-[var(--border-gold)] text-[var(--gold)] px-8 py-3 rounded-lg text-sm tracking-[3px] hover:bg-[var(--gold)]/10 transition-colors no-underline"
                >六爻起卦</Link>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 flex flex-col items-center gap-2 text-[var(--text-muted)]/40 text-xs tracking-[2px]">
              <span>▼</span>
            </div>
          </section>

          {/* ===== 古籍滚动条 ===== */}
          <section className="relative w-full bg-[var(--bg-card)] pb-28">
            <div className="pointer-events-none absolute inset-0 overflow-hidden text-[var(--gold)]/5 text-6xl font-serif flex items-center">
              <span className="animate-marquee whitespace-nowrap">
                滴天髓·三命通会·穷通宝鉴·子平真诠·紫微斗数全书·渊海子平·增删卜易·卜筮正宗
              </span>
            </div>
            <div className="relative border-b border-[var(--border-subtle)] py-7">
              <p className="text-center text-xs tracking-[4px] text-[var(--text-muted)]">
                古籍为根 · 逐句可溯源
              </p>
            </div>
            <div className="relative mx-auto max-w-5xl px-6 pt-20 text-center">
              <p className="text-[15px] text-[var(--text-secondary)] tracking-[2px] leading-relaxed">
                每一句解读都引自古籍原文，可溯源、不空谈、千人千面
              </p>
            </div>
          </section>

          {/* ===== 核心功能 ===== */}
          <section className="w-full px-6 py-28">
            <div className="mx-auto max-w-4xl">
              <p className="text-center text-[10px] text-[var(--text-muted)] tracking-[4px] mb-2">核 心 功 能</p>
              <p className="text-center text-xs text-[var(--text-muted)]/60 mb-12 tracking-[2px]">
                八字 × 紫微 × 六爻 · 三术合参
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {/* 命盘排盘 */}
                <Link href="/create"
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-8 hover:border-[var(--border-gold)] transition-all group no-underline block"
                >
                  <div className="text-3xl mb-4">☰☷</div>
                  <h3 className="font-serif text-lg text-[var(--gold)] tracking-[2px] mb-2">命盘排盘</h3>
                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-4">
                    八字排盘 · 紫微斗数<br/>
                    录入生辰，按古法自动起盘排柱
                  </p>
                  <span className="text-xs text-[var(--text-muted)]/60 tracking-[1px] group-hover:text-[var(--gold)] transition-colors">
                    免费 → 了解更多
                  </span>
                </Link>

                {/* 六爻起卦 */}
                <Link href="/liuyao"
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-8 hover:border-[var(--border-gold)] transition-all group no-underline block"
                >
                  <div className="text-3xl mb-4">☰☵☶</div>
                  <h3 className="font-serif text-lg text-[var(--gold)] tracking-[2px] mb-2">混沌问卦</h3>
                  <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-4">
                    一事一占 · 三盘合断<br/>
                    依《增删卜易》《卜筮正宗》参详卦象
                  </p>
                  <span className="text-xs text-[var(--text-muted)]/60 tracking-[1px] group-hover:text-[var(--gold)] transition-colors">
                    免费 → 开始摇卦
                  </span>
                </Link>
              </div>
            </div>
          </section>

          {/* ===== 海报特色 ===== */}
          <section className="relative w-full overflow-hidden bg-gradient-to-b from-[var(--bg-deep)] to-[var(--bg-card)] py-28">
            <div className="relative mx-auto max-w-2xl px-6 flex flex-col items-center text-center">
              <p className="font-serif text-xl text-[var(--gold)] tracking-[4px] mb-4">专 属 命 盘 海 报</p>
              <p className="text-sm text-[var(--text-muted)] mb-10 tracking-[1px]">
                生成你的专属命盘海报，分享给懂的人看
              </p>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-4 w-56 h-72 flex items-center justify-center">
                <span className="text-[var(--text-muted)]/30 text-xs tracking-[2px]">命盘海报</span>
              </div>
            </div>
          </section>

          {/* ===== 底部 CTA ===== */}
          <section className="w-full bg-[var(--bg-card)] px-6 py-20">
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <Link href="/create"
                className="inline-flex items-center justify-center bg-[var(--gold)] text-[var(--bg-deep)] px-12 py-4 rounded-lg text-base tracking-[4px] font-medium hover:bg-[var(--gold-light)] transition-colors no-underline"
              >免费排一张自己的盘试试 →</Link>
              <p className="mt-6 text-xs text-[var(--text-muted)]/50 tracking-[2px]">
                古籍数字化 · AI 参详 — 仅作文化研究与体验，不构成任何决策建议
              </p>
            </div>
          </section>

          {/* ===== Footer ===== */}
          <footer className="w-full bg-[var(--bg-deep)] border-t border-[var(--border-subtle)] py-8">
            <div className="mx-auto max-w-6xl px-6 text-center">
              <span className="text-xs text-[var(--text-muted)]/40 tracking-[2px]">混沌阁 · 命理研究</span>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}
