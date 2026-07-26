'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/app/lib/api';

const GLYPHS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸','子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','乾','坤','震','巽','坎','离','艮','兑','命','运','禄','权','科','忌','魁','钺'];

export default function HomePage() {
  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, []);

  return (
    <div className="flex min-h-screen flex-col pb-[var(--tabbar-h)] md:pb-0">
      {/* ===== Nav — copied from qingnang ===== */}
      <nav className="fixed top-0 z-50 w-full bg-xuan-zhi/95 backdrop-blur-sm border-b border-xuan-zhi-dark">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="glow-breathe text-2xl font-bold text-hu-po-jin font-serif">混沌阁</span>
            <span className="hidden text-sm sm:inline text-dai-qing/60">命理研究</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex lg:gap-6">
            <Link href="/create" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">命盘排盘</Link>
            <Link href="/liuyao" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">六爻决策</Link>
          </div>
          <div className="flex items-center gap-4" />
        </div>
      </nav>

      {/* ===== Main ===== */}
      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top,0px))]">

        {/* ===== Hero — copied from qingnang ===== */}
        <section className="relative flex min-h-[88vh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-xuan-zhi via-xuan-zhi to-dai-qing-dark/10" />
          
          {/* Ink-sea waves — copied from qingnang */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0">
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-x-0 bottom-0 top-[44%] bg-dai-qing-dark/5" />
                <div className="ink-sea__layer" style={{ top: '24%', animationDuration: '12s', ['--bob-amp' as string]: '10px' }}>
                  <div className="ink-sea__track" style={{ animationDuration: '120s' }}>
                    <img src="/home/sea-strip.webp" alt="" className="h-full w-auto max-w-none select-none" draggable={false} />
                    <img src="/home/sea-strip.webp" alt="" aria-hidden="true" className="h-full w-auto max-w-none select-none" draggable={false} />
                  </div>
                </div>
                <div className="ink-sea__layer" style={{ top: '56%', animationDuration: '9s', animationDelay: '-4s', ['--bob-amp' as string]: '7px' }}>
                  <div className="ink-sea__track" style={{ animationDuration: '48s' }}>
                    <img src="/home/sea-front.webp" alt="" className="h-full w-auto max-w-none select-none" draggable={false} />
                    <img src="/home/sea-front.webp" alt="" aria-hidden="true" className="h-full w-auto max-w-none select-none" draggable={false} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ambient blurs */}
          <div aria-hidden="true" className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-hu-po-jin/5 blur-[100px]" />
          <div aria-hidden="true" className="absolute bottom-[20%] right-[8%] h-64 w-64 rounded-full bg-dai-qing-light/10 blur-[80px]" />
          
          {/* Floating glyphs */}
          <div className="pointer-events-none absolute inset-0 text-hu-po-jin">
            {GLYPHS.slice(0, 12).map((g, i) => (
              <span key={i} className="qn-glyph font-serif" style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${5 + Math.random() * 90}%`,
                fontSize: `${16 + Math.random() * 20}px`,
                color: i % 3 === 0 ? 'var(--color-hu-po-jin)' : 'var(--color-dai-qing)',
                animationDuration: `${8 + Math.random() * 6}s`,
                animationDelay: `${-Math.random() * 10}s`,
                position: 'absolute',
              }}>{g}</span>
            ))}
          </div>

          {/* Content */}
          <div className="relative z-[1] flex flex-col items-center">
            <div className="mb-10">
              <p className="text-xs tracking-[0.4em] text-dai-qing/40 mb-4">混沌阁</p>
            </div>
            <h1 className="font-serif text-5xl md:text-6xl font-bold text-hu-po-jin mb-4 tracking-[0.05em]">
              古籍为根 · AI 参详
            </h1>
            <p className="mt-3 text-sm text-dai-qing/60 tracking-[0.05em]">
              《滴天髓》《三命通会》《紫微斗数全书》原文为根
            </p>
            <p className="mt-2 text-[13px] text-dai-qing/50 tracking-[0.03em]">
              AI 逐句参详，八字 · 紫微 · 六爻，按次计费，不订阅
            </p>

            <div className="mt-10 flex gap-4">
              <Link href="/create"
                className="qn-btn qn-btn--primary px-8 py-3 text-sm tracking-[3px] no-underline"
              >开始排盘</Link>
              <Link href="/liuyao"
                className="inline-flex items-center justify-center border border-hu-po-jin/30 text-hu-po-jin px-8 py-3 rounded-lg text-sm tracking-[3px] hover:bg-hu-po-jin/10 transition-colors no-underline"
              >六爻起卦</Link>
            </div>
          </div>
        </section>

        {/* ===== 古籍溯源 — copied from qingnang ===== */}
        <section className="relative w-full bg-xuan-zhi-dark/30 pb-28">
          <div className="pointer-events-none absolute inset-0 overflow-hidden text-hu-po-jin/5 text-6xl font-serif flex items-center">
            <span className="animate-marquee whitespace-nowrap">
              滴天髓·三命通会·穷通宝鉴·子平真诠·紫微斗数全书·渊海子平·增删卜易·卜筮正宗
            </span>
          </div>
          <div className="relative border-b border-dai-qing/8 py-7">
            <p className="text-center text-xs tracking-[0.4em] text-dai-qing/40">
              古籍为根 · 逐句可溯源
            </p>
          </div>
          <div className="relative mx-auto max-w-5xl px-6 pt-20 text-center">
            <p className="text-[15px] text-dai-qing/60 tracking-[0.03em] leading-relaxed">
              每一句解读都引自古籍原文，可溯源、不空谈、千人千面
            </p>
          </div>
        </section>

        {/* ===== 核心功能 — copied from qingnang features section ===== */}
        <section className="w-full px-6 py-28">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-[11px] tracking-[0.4em] text-dai-qing/55">核 心 功 能</p>
              <h2 className="mt-4 font-serif text-3xl text-dai-qing">八字 × 紫微 × 六爻</h2>
              <div className="mx-auto mt-4 w-32 h-px bg-gradient-to-r from-transparent via-hu-po-jin/40 to-transparent" />
              <p className="mt-4 text-sm text-dai-qing/60">三术合参 — 古籍为根，AI 参详</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
              {/* 命盘排盘 */}
              <Link href="/create"
                className="qn-card group no-underline block"
              >
                <div className="text-3xl mb-4">☰☷</div>
                <h3 className="font-serif text-lg text-dai-qing tracking-[0.03em] mb-2 group-hover:text-hu-po-jin transition-colors">命盘排盘</h3>
                <p className="text-[13px] text-dai-qing/50 leading-relaxed mb-4">
                  八字排盘 · 紫微斗数<br/>
                  录入生辰，按古法自动起盘排柱
                </p>
                <span className="text-xs text-dai-qing/30 tracking-[0.02em] group-hover:text-hu-po-jin transition-colors">
                  免费 → 了解更多
                </span>
              </Link>

              {/* 六爻起卦 */}
              <Link href="/liuyao"
                className="qn-card group no-underline block"
              >
                <div className="text-3xl mb-4">☰☵☶</div>
                <h3 className="font-serif text-lg text-dai-qing tracking-[0.03em] mb-2 group-hover:text-hu-po-jin transition-colors">混沌问卦</h3>
                <p className="text-[13px] text-dai-qing/50 leading-relaxed mb-4">
                  一事一占 · 三盘合断<br/>
                  依《增删卜易》《卜筮正宗》参详卦象
                </p>
                <span className="text-xs text-dai-qing/30 tracking-[0.02em] group-hover:text-hu-po-jin transition-colors">
                  免费 → 开始摇卦
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ===== 海报特色 — replaces qingnang's 四维交互 ===== */}
        <section className="w-full px-6 py-28 bg-xuan-zhi-dark/20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-[11px] tracking-[0.4em] text-dai-qing/55">专 属 海 报</p>
              <h2 className="mt-4 font-serif text-3xl text-dai-qing">你的命盘 · 你的海报</h2>
              <div className="mx-auto mt-4 w-32 h-px bg-gradient-to-r from-transparent via-hu-po-jin/40 to-transparent" />
              <p className="mt-4 text-sm text-dai-qing/60">生成专属命盘海报，分享给懂的人看</p>
            </div>
            <div className="mt-12 flex justify-center">
              <div className="bg-xuan-zhi border border-dai-qing/10 rounded-xl p-4 w-56 h-72 flex items-center justify-center shadow-sm">
                <span className="text-dai-qing/15 text-xs tracking-[0.2em]">命盘海报</span>
              </div>
            </div>
            <div className="mt-5 text-center">
              <Link href="/create" className="text-sm text-hu-po-jin hover:text-hu-po-jin-light transition-colors no-underline">
                免费排一张自己的盘试试 →
              </Link>
            </div>
          </div>
        </section>

        {/* ===== 底部 CTA ===== */}
        <section className="w-full bg-xuan-zhi-dark/30 px-6 py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Link href="/create"
              className="qn-btn qn-btn--primary px-12 py-4 text-base tracking-[4px] no-underline"
            >免费排一张自己的盘试试 →</Link>
            <p className="mt-6 text-xs text-dai-qing/30 tracking-[0.03em]">
              古籍数字化 · AI 参详 — 仅作文化研究与体验，不构成任何决策建议
            </p>
          </div>
        </section>

        {/* ===== Footer ===== */}
        <footer className="w-full bg-xuan-zhi border-t border-dai-qing/8 py-8">
          <div className="mx-auto max-w-6xl px-6 flex justify-center gap-8 text-xs text-dai-qing/25 tracking-[0.03em]">
            <Link href="/create" className="hover:text-hu-po-jin transition-colors no-underline">命盘排盘</Link>
            <Link href="/liuyao" className="hover:text-hu-po-jin transition-colors no-underline">六爻决策</Link>
            <span>混沌阁 · 命理研究</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
