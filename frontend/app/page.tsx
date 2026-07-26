'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/app/lib/api';

const GLYPHS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸','子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥','乾','坤','震','巽','坎','离','艮','兑','魁','钺','禄','权','科','忌','斗','宿','星'];

export default function HomePage() {
  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon';
    trackEvent('page_view', vid);
  }, [])
  const [activePersona, setActivePersona] = useState<'standard' | 'casual'>('standard');
  const [activeDepth, setActiveDepth] = useState<'brief' | 'detail'>('brief');
  const demos = {
    standard: { brief: '此命局日主壬水生于申月，得长生之气，又见庚金发源，水源充沛。以印化杀为用，食神制杀为佐。格局清正，贵气暗藏。', detail: '日主壬水生于申月得长生，庚金发源，水源充沛。然戊土七杀透干，戌土坐支，杀势不弱。身强杀强，以印化杀为用，食神制杀为佐。早年行北方水地，印比帮身。中年入西方金地，事业腾达。晚运火土，财官显露。' },
    casual: { brief: '你的命盘就像一条大江，水源充足，气势磅礴。但江上有座大坝（七杀），让你不能肆意奔流。不过大坝上有闸门（印星），该放水时就放水，属于"看似被管着，实则有人罩"的类型。', detail: '你这命啊，一条大江，水多得要漫出来。命中带个七杀，就像江上修了座大坝，管着你。好在坝上有闸门，水多开闸，水少蓄水。你这个叫"有管教但有人罩"，命里带贵气。' },
  };;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ===== Nav — 1:1 qingnang ===== */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="glow-breathe text-2xl font-bold text-hu-po-jin font-serif">混沌</span>
            <span className="hidden text-sm sm:inline text-dai-qing/60">命理研究</span>
          </Link>
          <div className="hidden items-center gap-5 md:flex lg:gap-6 ml-auto">
            <Link href="/create" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">
              <span className="mr-1 text-[10px] text-hu-po-jin">✦</span>八字+紫微命盘
            </Link>
            <Link href="/liuyao" className="relative py-1.5 text-[13px] tracking-[0.02em] transition-colors lg:text-sm text-dai-qing/65 hover:text-dai-qing no-underline">混沌问卦</Link>
          </div>
          <div className="flex items-center gap-4">
            
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
                  </h1>
                <p className="mt-4 text-sm text-hu-po-jin/50">HUNDUN PAVILION</p>
              </div>
              <div className="mt-9">
                <p className="font-serif text-xl text-xuan-zhi/85">AI 推演 · 秒出命盘</p>
                <div className="divider-ink mx-auto mt-4 w-48" />
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-xuan-zhi/60">
                  八字 · 紫微 · 六爻<br />八字 × 紫微 · 双盘互证，AI 秒出结果
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
            <div className="qn-marquee py-7 border-b border-white/5">
              <div className="qn-marquee__track" style={{ gap: "2.5rem" }}>
                {["《周易》","《滴天髓》","《穷通宝鉴》","《三命通会》","《渊海子平》","《增删卜易》","《卜筮正宗》","《紫微斗数全书》"].map(function(name, i) { return (
                  <span key={i} className="qn-marquee__item text-[15px] tracking-[0.15em] text-hu-po-jin/55 font-serif">{name}</span>
                );})}
                {["《周易》","《滴天髓》","《穷通宝鉴》","《三命通会》","《渊海子平》","《增删卜易》","《卜筮正宗》","《紫微斗数全书》"].map(function(name, i) { return (
                  <span key={"d"+i} className="qn-marquee__item text-[15px] tracking-[0.15em] text-hu-po-jin/55 font-serif">{name}</span>
                );})}
              </div>
            </div>
{/* Core functions heading */}
            <div className="px-6 pt-24">
              <h2 className="text-center font-serif text-3xl text-xuan-zhi">核心功能</h2>
              <p className="mt-3 text-center text-[15px] text-xuan-zhi/55">三术合参 — 以古籍为根 · AI 逐句参详</p>
            </div>

            {/* Feature cards grid */}
            <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-5 px-6 sm:grid-cols-2 ">
              {/* 八字+紫微命盘 */}
              <div className="spotlight-card h-full rounded-2xl sm:col-span-2">
                <Link href="/create" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline items-center text-center">
                  <span className="absolute right-4 top-4 rounded-full bg-hu-po-jin/15 px-3 py-0.5 text-xs text-hu-po-jin">免费</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-block font-serif text-4xl text-hu-po-jin">问</span>
                    <span className="text-hu-po-jin/40 text-2xl">·</span>
                    <span className="inline-block font-serif text-4xl text-hu-po-jin">天</span>
                  </div>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi text-center">八字+紫微命盘</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60 text-center">双体系合参 — 八字看五行格局，紫微排十二宫星曜，AI 逐句参详</p>
                  <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>

              {/* 六爻起卦 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/liuyao" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="inline-block font-serif text-4xl text-hu-po-jin mx-auto">卦</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi text-center">六爻起卦</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60 text-center">依《增删卜易》《卜筮正宗》参详卦象</p>
                  <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>

              {/* 八字合盘 */}
              <div className="spotlight-card h-full rounded-2xl">
                <Link href="/create" className="card-float group relative flex h-full flex-col rounded-2xl border border-xuan-zhi/8 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-7 transition-colors hover:border-hu-po-jin/25 no-underline">
                  <span className="absolute right-4 top-4 rounded-full bg-hu-po-jin/15 px-3 py-0.5 text-xs text-hu-po-jin">免费</span>
                  <span className="inline-block font-serif text-4xl text-hu-po-jin mx-auto">缘</span>
                  <h3 className="mt-4 font-serif text-xl text-xuan-zhi text-center">八字合盘</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-xuan-zhi/60 text-center">两盘对照，参看缘分契合与互补</p>
                  <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-hu-po-jin/60 transition-colors group-hover:text-hu-po-jin">
                    <span>了解更多</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              </div>
            </div>
          </section>

                    {/* ===== 两种人格 × 两种深度 ===== */}
          <section className="w-full px-6 py-28">
            <div className="mx-auto max-w-3xl">
              <p className="text-center text-[11px] tracking-[0.4em] text-dai-qing/55">参 详 输 出</p>
              <h2 className="mt-4 text-center font-serif text-2xl text-dai-qing">两种人格 × 两种深度</h2>
              <p className="mt-3 text-center text-sm text-dai-qing/50">同一张盘，两种讲法——点下方按钮，现场感受</p>
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button className={"qn-demo__persona" + (activePersona === "standard" ? " is-active" : "")} onClick={() => setActivePersona("standard")}>
                  <span className="qn-demo__persona-sub">博 导 型</span>
                  <span className="qn-demo__persona-title font-serif">客观 · 专业 · 克制</span>
                  <span className="qn-demo__persona-desc">如博导般引经据典、逻辑严密</span>
                </button>
                <button className={"qn-demo__persona" + (activePersona === "casual" ? " is-active" : "")} onClick={() => setActivePersona("casual")}>
                  <span className="qn-demo__persona-sub">老 友 型</span>
                  <span className="qn-demo__persona-title font-serif">随性 · 风趣 · 一针见血</span>
                  <span className="qn-demo__persona-desc">如酒后老友般生动比喻</span>
                </button>
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button className={"qn-demo__depth" + (activeDepth === "brief" ? " is-active" : "")} onClick={() => setActiveDepth("brief")}>
                  <span>简要</span><span className="qn-demo__depth-sub">三五分钟速览</span>
                </button>
                <button className={"qn-demo__depth" + (activeDepth === "detail" ? " is-active" : "")} onClick={() => setActiveDepth("detail")}>
                  <span>详批</span><span className="qn-demo__depth-sub">逐柱逐宫参详</span>
                </button>
              </div>
              <div className="mt-8 qn-demo__output">
                <div className="qn-demo__output-head"><span className="qn-demo__lamp" /><span>参 详 输 出 · 示 例 文 风</span></div>
                <div className="qn-demo__text font-serif animate-ink-in" key={activePersona + activeDepth}>{demos[activePersona][activeDepth]}</div>
                <p className="qn-demo__hint">正式详批中可随时切换人格与深度 · 以上仅为文风示例</p>
              </div>
              <div className="mt-8 text-center"><Link href="/create" className="qn-demo__cta">免费排一张自己的盘试试 →</Link></div>
            </div>
          </section>

{/* ===== Bottom CTA ===== */}
          <section className="w-full bg-dai-qing-dark px-6 py-20 text-center">
            <h2 className="font-serif text-2xl text-xuan-zhi">随身携带你的混沌</h2>
            <p className="mt-4 text-sm text-xuan-zhi/55">随时随地，排一盘，问一卦</p>
            
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
                混沌 · 命理研究 — 古籍数字化 · AI 参详 · 仅作文化研究与体验，不构成任何决策建议
              </p>
            </div>
          </footer>

        </div>
      </main>
    </div>
  );
}
