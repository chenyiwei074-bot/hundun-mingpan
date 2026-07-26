'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/app/lib/api';

const GLYPHS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸','子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','乾','坤','震','巽','坎','离','艮','兑','魁','钺','禄','权','科','忌','斗','宿','星'];

export default function HomePage() {
  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ===== Nav — 1:1 qingnang ===== */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="glow-breathe text-2xl font-bold text-hu-po-jin font-serif">混沌阁</span>
            <span className="hidden text-sm sm:inline text-dai-qing/60">命理研究</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex lg:gap-6">
            <Link href="/create" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">
              <span className="mr-1 text-[10px] text-hu-po-jin">✦</span>命盘排盘
            </Link>
            <Link href="/liuyao" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">混沌问卦</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/create" className="qn-btn qn-btn--primary qn-btn--sm no-underline">免费排盘</Link>
          </div>
        </div>
      </nav>

      {/* ===== Main ===== */}
      <main className="flex-1 pt-[calc(4rem+env(safe-area-inset-top,0px))]">
        <div className="flex flex-col items-center">

          {/* ===== Hero — 1:1 qingnang ===== */}
          <section className="relative flex min-h-[88vh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-xuan-zhi via-xuan-zhi to-dai-qing-dark" />

            {/* Ink-sea waves */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0">
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  <div className="absolute inset-x-0 bottom-0 top-[44%] bg-dai-qing-dark" />
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
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 text-hu-po-jin">
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  {GLYPHS.map((g, i) => (
                    <span key={i} className="qn-glyph font-serif" style={{
                      left: `${5 + (i * 7) % 90}%`,
                      top: `${3 + (i * 11) % 92}%`,
                      fontSize: `${14 + (i % 3) * 8}px`,
                      color: i % 3 === 0 ? 'var(--color-hu-po-jin)' : 'rgba(212,175,55,0.5)',
                      animationDuration: `${8 + (i % 5) * 2}s`,
                      animationDelay: `${-(i * 0.7).toFixed(1)}s`,
                      ['--glyph-peak' as string]: `${0.12 + (i % 3) * 0.06}`,
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative z-[1] flex flex-col items-center">
              <div className="relative">
                <h1 className="flex font-serif text-8xl font-bold text-hu-po-jin md:text-9xl">
                  <span className="gold-foil-text inline-block">混</span>
                  <span className="gold-foil-text inline-block">沌</span>
                  <span className="gold-foil-text inline-block">阁</span>
                </h1>
                <p className="mt-4 text-sm text-hu-po-jin/50">HUNDUN PAVILION</p>
              </div>
              <div className="mt-9">
                <p className="font-serif text-xl text-xuan-zhi/85">古籍为根 · AI 参详</p>
                <div className="divider-ink mx-auto mt-4 w-48" />
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-xuan-zhi/60">
                  八字 · 紫微 · 六爻<br />三术合参，以古籍为根，AI 逐句参详
                </p>
              </div>
              <div className="mt-11 flex flex-col items-center gap-4 sm:flex-row">
                <Link href="/create"
                  className="btn-glow group relative rounded-xl bg-xuan-zhi px-9 py-3.5 font-medium text-dai-qing-dark shadow-lg shadow-dai-qing-dark/40 transition-all hover:shadow-xl hover:shadow-hu-po-jin/20 no-underline"
                >
                  <span className="relative z-[1]">开始排盘</span>
                </Link>
                <Link href="/liuyao"
                  className="btn-glow relative rounded-xl border border-xuan-zhi/30 px-9 py-3.5 text-xuan-zhi/90 transition-all hover:border-hu-po-jin/50 hover:bg-hu-po-jin/10 hover:text-xuan-zhi no-underline"
                >
                  <span className="relative z-[1]">六爻起卦</span>
                </Link>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8">
              <div className="h-8 w-5 rounded-full border border-xuan-zhi/25">
                <div className="mx-auto mt-1.5 h-2 w-1 rounded-full bg-xuan-zhi/40" />
              </div>
            </div>
          </section>

          {/* ===== Core Features — dark section 1:1 qingnang ===== */}
          <section className="relative w-full bg-dai-qing-dark pb-28">
            {/* Floating glyphs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden text-hu-po-jin" aria-hidden="true">
              {GLYPHS.slice(15, 30).map((g, i) => (
                <span key={i} className="qn-glyph font-serif" style={{
                  left: `${10 + (i * 13) % 85}%`,
                  top: `${5 + (i * 17) % 90}%`,
                  fontSize: `${13 + (i % 4) * 5}px`,
                  animationDuration: `${7 + (i % 4) * 3}s`,
                  animationDelay: `${-(i * 1.2).toFixed(1)}s`,
                  ['--glyph-peak' as string]: '0.15',
                }}>{g}</span>
              ))}
            </div>

            {/* Marquee: classics */}
            <div className="relative border-b border-xuan-zhi/8 py-7">
              <p className="mb-3 text-center text-[10px] tracking-[0.4em] text-xuan-zhi/35">古籍为根 · 逐句可溯源</p>
              <div className="qn-marquee text-[15px] text-hu-po-jin/55">
                <div className="qn-marquee__track">
                  <div className="flex shrink-0 items-center">
                    {['《 周易 》','《 滴天髓 》','《 穷通宝鉴 》','《 三命通会 》','《 渊海子平 》','《 增删卜易 》','《 卜筮正宗 》','《 紫微斗数全书 》'].map((name, i) => (
                      <span key={i} className="qn-marquee__item">
                        <span className="font-serif">{name}</span>
                        <span className="qn-marquee__dot">·</span>
                      </span>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {['《 周易 》','《 滴天髓 》','《 穷通宝鉴 》','《 三命通会 》','《 渊海子平 》','《 增删卜易 》','《 卜筮正宗 》','《 紫微斗数全书 》'].map((name, i) => (
                      <span key={'b'+i} className="qn-marquee__item">
                        <span className="font-serif">{name}</span>
                        <span className="qn-marquee__dot">·</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Core functions heading */}
            <div className="px-6 pt-24">
              <h2 className="text-center font-serif text-3xl text-xuan-zhi">核心功能</h2>
              <p className="mt-3 text-center text-[15px] text-xuan-zhi/55">三术合参 — 以古籍为根 · AI 逐句参详</p>
            </div>

            {/* Feature cards grid */}
            <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-5 px-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* 八字排盘 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/create" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="absolute right-4 top-4 rounded-full bg-hu-po-jin/15 px-3 py-0.5 text-xs text-hu-po-jin">免费</span>
                  <span className="inline-block self-start font-serif text-4xl text-hu-po-jin">命</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi">八字排盘</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60">录入生辰，按古法自动起盘排柱</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>

              {/* 紫微斗数 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/create" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="absolute right-4 top-4 rounded-full bg-hu-po-jin/15 px-3 py-0.5 text-xs text-hu-po-jin">免费</span>
                  <span className="inline-block self-start font-serif text-4xl text-hu-po-jin">紫</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi">紫微斗数</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60">十二宫排盘，看主星四化与大限流年</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>

              {/* 六爻起卦 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/liuyao" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="inline-block self-start font-serif text-4xl text-hu-po-jin">卦</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi">六爻起卦</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60">依《增删卜易》《卜筮正宗》参详卦象</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>

              {/* 八字合盘 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/create" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="absolute right-4 top-4 rounded-full bg-hu-po-jin/15 px-3 py-0.5 text-xs text-hu-po-jin">免费</span>
                  <span className="inline-block self-start font-serif text-4xl text-hu-po-jin">缘</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi">八字合盘</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60">两盘对照，参看缘分契合与互补</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* ===== 命盘海报 demo section ===== */}
          <section className="w-full px-6 py-28">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-[11px] tracking-[0.4em] text-dai-qing/55">一 页 海 报</p>
              <h2 className="mt-4 font-serif text-3xl text-dai-qing">你的命盘 · 你的海报</h2>
              <div className="mx-auto mt-4 w-32 divider-ink" />
              <p className="mt-4 text-sm text-dai-qing/60">生成专属命盘海报，分享给懂的人看</p>

              <div className="mt-10 flex justify-center">
                <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi p-3 shadow-sm" style={{ width: 280, height: 380 }}>
                  <div className="flex h-full items-center justify-center rounded-xl bg-xuan-zhi-dark/50">
                    <span className="font-serif text-sm text-dai-qing/20">命盘海报预览</span>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <Link href="/create" className="qn-demo__cta no-underline">免费排一张自己的盘试试 →</Link>
              </div>
            </div>
          </section>

          {/* ===== Bottom CTA ===== */}
          <section className="w-full bg-dai-qing-dark px-6 py-20 text-center">
            <h2 className="font-serif text-2xl text-xuan-zhi">随身携带你的混沌阁</h2>
            <p className="mt-4 text-sm text-xuan-zhi/55">随时随地，排一盘，问一卦</p>
            <Link href="/create"
              className="btn-glow relative mt-10 inline-block rounded-xl bg-hu-po-jin px-12 py-4 font-medium text-dai-qing-dark transition-all hover:bg-hu-po-jin-light hover:shadow-xl hover:shadow-hu-po-jin/25 no-underline"
            >免费注册</Link>
          </section>

          {/* ===== Footer ===== */}
          <footer className="w-full bg-xuan-zhi border-t border-dai-qing/8 py-8">
            <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4">
              <div className="flex gap-8 text-xs text-dai-qing/25 tracking-[0.03em]">
                <Link href="/" className="hover:text-hu-po-jin transition-colors no-underline">首页</Link>
                <Link href="/create" className="hover:text-hu-po-jin transition-colors no-underline">命盘排盘</Link>
                <Link href="/liuyao" className="hover:text-hu-po-jin transition-colors no-underline">混沌问卦</Link>
              </div>
              <p className="text-xs text-dai-qing/20 tracking-[0.03em]">
                混沌阁 · 命理研究 — 古籍数字化 · AI 参详 · 仅作文化研究与体验，不构成任何决策建议
              </p>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}
