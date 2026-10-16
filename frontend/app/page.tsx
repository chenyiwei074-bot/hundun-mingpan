'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ink   = '#1d1d1f'; const mute  = '#6e6e73';
const paper = '#f5f5f7'; const white = '#ffffff';
const gold  = '#b2955d'; const goldText = '#8b6d3b'; const red = '#d4544a';

// Round to 6 decimals so server & client Math.cos/sin stay identical (hydration-safe)
const R6 = (n: number) => Math.round(n * 1e6) / 1e6;

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Taiji() {
  const R = 100;
  const H = R / 2;
  const ticks24 = Array.from({ length: 24 }, (_, i) => {
    const rad = ((i * 360) / 24 - 90) * Math.PI / 180;
    const inner = R + 32;
    const len = i % 6 === 0 ? 10 : i % 3 === 0 ? 6 : 3;
    return { x1: R6(inner * Math.cos(rad)), y1: R6(inner * Math.sin(rad)),
             x2: R6((inner + len) * Math.cos(rad)), y2: R6((inner + len) * Math.sin(rad)),
             thick: i % 6 === 0 ? 0.6 : 0.3 };
  });
  const stems = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
  const gua   = ["☰","☱","☲","☳","☴","☵","☶","☷"];
  return (
    <svg viewBox="-168 -168 336 336" className="taiji" role="img" aria-label="太极图">
      <defs>
        <radialGradient id="hp-yang" cx="60%" cy="35%">
          <stop offset="0%" stopColor={gold} stopOpacity={0.40} />
          <stop offset="100%" stopColor={gold} stopOpacity={0.20} />
        </radialGradient>
        <radialGradient id="hp-yin" cx="40%" cy="65%">
          <stop offset="0%" stopColor={ink} stopOpacity={0.24} />
          <stop offset="100%" stopColor={ink} stopOpacity={0.10} />
        </radialGradient>
      </defs>

      {/* Twenty-four solar-term ticks */}
      <g opacity={0.32}>
        {ticks24.map((t, i) => (
          <line key={"t" + i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={gold} strokeWidth={t.thick} strokeLinecap="round" />
        ))}
      </g>
      {/* Eight trigrams */}
      <g opacity={0.26}>
        {gua.map((g, i) => {
          const a = (i * 45 - 90) * Math.PI / 180;
          return (
            <text key={"g" + i} x={R6((R + 20) * Math.cos(a))} y={R6((R + 20) * Math.sin(a))}
              textAnchor="middle" dominantBaseline="central"
              fill={gold} fontSize={12} fontFamily="serif">{g}</text>
          );
        })}
      </g>
      {/* Ten heavenly stems */}
      <g opacity={0.28}>
        {stems.map((st, i) => {
          const a = (i * 36 - 108) * Math.PI / 180;
          return (
            <text key={"s" + i} x={R6((R + 54) * Math.cos(a))} y={R6((R + 54) * Math.sin(a))}
              textAnchor="middle" dominantBaseline="central"
              fill={gold} fontSize={10} fontFamily="serif" letterSpacing="0.1em">{st}</text>
          );
        })}
      </g>

      <circle r={R} fill="none" stroke="rgba(178,149,93,0.48)" strokeWidth={1.2} />
      {/* Yang half */}
      <path d={`M0,${-R} A${R},${R} 0 0,1 0,${R} A${H},${H} 0 0,1 0,0 A${H},${H} 0 0,0 0,${-R} Z`}
        fill="url(#hp-yang)" />
      {/* Yin half */}
      <path d={`M0,${-R} A${R},${R} 0 0,0 0,${R} A${H},${H} 0 0,0 0,0 A${H},${H} 0 0,1 0,${-R} Z`}
        fill="url(#hp-yin)" />
      <path d={`M0,${-R} A${H},${H} 0 0,1 0,0 A${H},${H} 0 0,1 0,${R}`}
        fill="none" stroke="rgba(178,149,93,0.55)" strokeWidth={0.8} />
      <circle cy={-H} r={H * 0.32} fill={ink} opacity={0.30} />
      <circle cy={H} r={H * 0.32} fill={gold} opacity={0.60} />
      <circle r={1.8} fill={gold} opacity={0.35} />
    </svg>
  );
}

function BaziPreview() {
  const R = 88; const cx = 100; const cy = 100;
  const bars = [
    { h: 46, stem: red, branch: red },
    { h: 54, stem: "#c8a43e", branch: "#c8a43e" },
    { h: 42, stem: red, branch: "#5b8db8", dayMaster: true },
    { h: 58, stem: "#c8b89a", branch: red },
  ];
  const spacing = 12;
  const startX = cx - (bars.length * spacing) / 2 + spacing / 2;
  const palaceNames = ["命","兄","夫","子","财","疾","迁","友","官","田","福","父"];
  const mingGong = 5;

  return (
    <svg viewBox="0 0 200 200">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={gold} strokeWidth={0.8} opacity={0.25} />
      <circle cx={cx} cy={cy} r={R - 10} fill="none" stroke={gold} strokeWidth={0.4} opacity={0.10} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const isMing = i === mingGong;
        const ca = Math.cos(a); const sa = Math.sin(a);
        return (
          <g key={"p"+i}>
            <line x1={R6(cx + (R-4)*ca)} y1={R6(cy + (R-4)*sa)} x2={R6(cx + (R+3)*ca)} y2={R6(cy + (R+3)*sa)}
              stroke={isMing ? red : gold} strokeWidth={isMing ? 1.4 : 0.6}
              opacity={isMing ? 0.55 : 0.18} strokeLinecap="round" />
            <text x={R6(cx + (R+11)*ca)} y={R6(cy + (R+11)*sa)} textAnchor="middle" dominantBaseline="central"
              fill={isMing ? red : goldText} fontSize={isMing ? 8 : 6.5}
              fontWeight={isMing ? 600 : 400} fontFamily="serif"
              opacity={isMing ? 0.50 : 0.30}>{palaceNames[i]}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={R - 7} fill="none" stroke={gold} strokeWidth={0.3} strokeDasharray="1 5" opacity={0.10} />
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        const y1 = cy - b.h / 2;
        const y2 = cy + b.h / 2;
        return (
          <g key={"bar"+i}>
            <line x1={x} y1={y1} x2={x} y2={y2}
              stroke={b.dayMaster ? red : gold} strokeWidth={b.dayMaster ? 2.5 : 2}
              strokeLinecap="round" opacity={b.dayMaster ? 0.70 : 0.30} />
            <line x1={x-2.5} y1={y1} x2={x+2.5} y2={y1}
              stroke={b.dayMaster ? red : gold} strokeWidth={0.8} opacity={0.3} strokeLinecap="round" />
            <line x1={x-2.5} y1={y2} x2={x+2.5} y2={y2}
              stroke={b.dayMaster ? red : gold} strokeWidth={0.8} opacity={0.3} strokeLinecap="round" />
          </g>
        );
      })}
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        return <circle key={"s"+i} cx={x} cy={cy - b.h / 2 - 10} r={b.dayMaster ? 4 : 3}
          fill={b.dayMaster ? red : b.stem} opacity={b.dayMaster ? 0.85 : 0.60} />;
      })}
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        return <circle key={"b"+i} cx={x} cy={cy + b.h / 2 + 10} r={3} fill={b.branch} opacity={0.40} />;
      })}
      <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke={gold} strokeWidth={0.4} opacity={0.15} />
      <line x1={cx} y1={cy-3} x2={cx} y2={cy+3} stroke={gold} strokeWidth={0.4} opacity={0.15} />
    </svg>
  );
}

function Coin({ o }: { o: number }) {
  return (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="none" stroke={gold} strokeWidth={1.2} opacity={o} />
      <rect x="14" y="14" width="12" height="12" rx="1.5" fill="none" stroke={gold} strokeWidth={1} opacity={o * 0.7} />
    </svg>
  );
}

function LiuYaoPreview() {
  const lines = [true, false, true, false, true, true];
  return (
    <div className="pv pv-liuyao">
      <svg viewBox="0 0 200 90" className="ly-lines">
        {lines.map((solid, i) => {
          const y = 8 + i * 13;
          if (solid) {
            return <line key={i} x1={4} y1={y} x2={196} y2={y} stroke={gold} strokeWidth={1} opacity={0.16} />;
          }
          return (<g key={i}><line x1={4} y1={y} x2={92} y2={y} stroke={gold} strokeWidth={1} opacity={0.16} /><line x1={108} y1={y} x2={196} y2={y} stroke={gold} strokeWidth={1} opacity={0.16} /></g>);
        })}
      </svg>
      <div className="ly-coins">
        <span><Coin o={0.50} /></span>
        <span><Coin o={0.70} /></span>
        <span><Coin o={0.50} /></span>
      </div>
    </div>
  );
}

function HePanPreview() {
  const cx1 = 100; const cx2 = 180; const cy = 96;
  const R = 72;
  const wuxing = ["木","火","土","金","水"];
  const colors = ["#5b9a5a",red,"#c8a43e","#c8b89a","#5b8db8"];
  const leftAngles = [0, 72, 144, 216, 288];
  const rightAngles = [36, 108, 180, 252, 324];
  return (
    <div className="pv">
      <svg viewBox="22 18 256 156">
        <circle cx={cx1} cy={cy} r={R} fill="none" stroke={gold} strokeWidth={1.2} opacity={0.30} />
        <circle cx={cx1} cy={cy} r={R-12} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.14} />
        {Array.from({length:24}, (_,i) => {
          const a = (i*15*Math.PI)/180;
          return <line key={"lt"+i} x1={R6(cx1+(R-3)*Math.cos(a))} y1={R6(cy+(R-3)*Math.sin(a))} x2={R6(cx1+(R+2)*Math.cos(a))} y2={R6(cy+(R+2)*Math.sin(a))} stroke={gold} strokeWidth={0.4} opacity={0.12} />;
        })}
        <circle cx={cx1} cy={cy-14} r={3.5} fill={gold} opacity={0.5} />
        {/* Right person - dark rings */}
        <circle cx={cx2} cy={cy} r={R} fill="none" stroke={ink} strokeWidth={1.2} opacity={0.14} />
        <circle cx={cx2} cy={cy} r={R-12} fill="none" stroke={ink} strokeWidth={0.6} opacity={0.08} />
        {Array.from({length:24}, (_,i) => {
          const a = (i*15*Math.PI)/180;
          return <line key={"rt"+i} x1={R6(cx2+(R-3)*Math.cos(a))} y1={R6(cy+(R-3)*Math.sin(a))} x2={R6(cx2+(R+2)*Math.cos(a))} y2={R6(cy+(R+2)*Math.sin(a))} stroke={ink} strokeWidth={0.4} opacity={0.07} />;
        })}
        <circle cx={cx2} cy={cy-14} r={3.5} fill={ink} opacity={0.25} />
        <line x1={cx1} y1={cy-R} x2={cx1} y2={cy+R} stroke={gold} strokeWidth={0.35} opacity={0.08} strokeDasharray="1 4" />
        <line x1={cx2} y1={cy-R} x2={cx2} y2={cy+R} stroke={ink} strokeWidth={0.35} opacity={0.05} strokeDasharray="1 4" />
        {/* Wuxing dots + labels - left */}
        {leftAngles.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          const dx = R6(50*Math.cos(rad)); const dy = R6(50*Math.sin(rad));
          const lx = R6(cx1 + 62*Math.cos(rad)); const ly = R6(cy + 62*Math.sin(rad));
          return (
            <g key={"lw"+i}>
              <circle cx={cx1+dx} cy={cy+dy} r={4.5} fill={colors[i]} opacity={0.6} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={colors[i]} opacity={0.7} fontFamily="serif">{wuxing[i]}</text>
            </g>
          );
        })}
        {/* Wuxing dots + labels - right */}
        {rightAngles.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          const dx = R6(50*Math.cos(rad)); const dy = R6(50*Math.sin(rad));
          const lx = R6(cx2 + 62*Math.cos(rad)); const ly = R6(cy + 62*Math.sin(rad));
          return (
            <g key={"rw"+i}>
              <circle cx={cx2+dx} cy={cy+dy} r={4.5} fill={colors[i]} opacity={0.6} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={colors[i]} opacity={0.7} fontFamily="serif">{wuxing[i]}</text>
            </g>
          );
        })}
        {/* Matching-element web */}
        {[[0,3],[1,1],[2,4],[3,0],[4,2]].map(([li,ri], i) => {
          const la = (leftAngles[li] * Math.PI) / 180;
          const ra = (rightAngles[ri] * Math.PI) / 180;
          return (
            <line key={"arc"+i}
              x1={R6(cx1 + 50*Math.cos(la))} y1={R6(cy + 50*Math.sin(la))}
              x2={R6(cx2 + 50*Math.cos(ra))} y2={R6(cy + 50*Math.sin(ra))}
              stroke={gold} strokeWidth={0.4} opacity={0.10} />
          );
        })}
        <circle cx={(cx1+cx2)/2} cy={cy} r={7} fill={gold} opacity={0.35} />
        <text x={(cx1+cx2)/2} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={goldText} opacity={0.85} fontFamily="serif" fontWeight="bold">合</text>
      </svg>
    </div>
  );
}

function ZeRiPreview() {
  const cx = 125; const cy = 105;
  const dR = 65;
  const diamond = (r: number) => {
    const pts: Array<{x:number,y:number}> = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * 90 - 90) * Math.PI / 180;
      pts.push({ x: R6(cx + r * Math.cos(a)), y: R6(cy + r * Math.sin(a)) });
    }
    return pts.map(p => p.x + ',' + p.y).join(' ');
  };
  return (
    <div className="pv">
      <svg viewBox="34 18 182 174">
        <polygon points={diamond(dR)} fill="none" stroke={gold} strokeWidth={1.2} opacity={0.30} />
        {[0,1,2,3].map(i => {
          const a1 = (i*90-90)*Math.PI/180; const a2 = ((i+1)*90-90)*Math.PI/180;
          const x1 = R6(cx+dR*Math.cos(a1)); const y1 = R6(cy+dR*Math.sin(a1));
          const x2 = R6(cx+dR*Math.cos(a2)); const y2 = R6(cy+dR*Math.sin(a2));
          const mx = (x1+x2)/2; const my = (y1+y2)/2;
          const dx = x2-x1; const dy = y2-y1; const len = Math.sqrt(dx*dx+dy*dy);
          const nx = -dy/len; const ny = dx/len;
          return <line key={"dt"+i} x1={mx+nx*2} y1={my+ny*2} x2={mx+nx*8} y2={my+ny*8} stroke={gold} strokeWidth={0.5} opacity={0.15} />;
        })}
        <polygon points={diamond(dR-16)} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.16} />
        <polygon points={diamond(dR-40)} fill="none" stroke={gold} strokeWidth={0.8} opacity={0.45} />
        {[0,1,2,3].map(i => {
          const a = (i*90-90)*Math.PI/180;
          return <circle key={"cd"+i} cx={R6(cx+(dR-16)*Math.cos(a))} cy={R6(cy+(dR-16)*Math.sin(a))} r={3} fill={gold} opacity={0.30} />;
        })}
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="central" fontSize={20} fill={goldText} opacity={0.8} fontFamily="serif" fontWeight="bold">{'\u5409'}</text>
      </svg>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>;
}

export default function HomePage() {
  const brandRef = useRef<HTMLElement>(null);
  const coreRef  = useRef<HTMLElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const ctaRef   = useRef<HTMLElement>(null);

  const [showLauncher, setShowLauncher] = useState(false);

  const scrollTo = (el: Element | null) => {
    el?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
  };

  // One scroll narrative inside the first screen below the fold.
  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.brand-quote', { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, duration: 0.7, ease: 'expo.out',
      scrollTrigger: { trigger: brandRef.current, start: 'top 78%', once: true },
    });
  }, { scope: brandRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.core-card', { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, stagger: 0.12, duration: 0.7, ease: 'expo.out',
      scrollTrigger: { trigger: coreRef.current, start: 'top 80%', once: true },
    });
  }, { scope: coreRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.tool-soon', { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'expo.out',
      scrollTrigger: { trigger: toolsRef.current, start: 'top 85%', once: true },
    });
  }, { scope: toolsRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.cta-block', { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, duration: 0.6, ease: 'expo.out',
      scrollTrigger: { trigger: ctaRef.current, start: 'top 88%', once: true },
    });
  }, { scope: ctaRef });

  return (
    <div className="hp">

      {/* ════════════ HERO ════════════ */}
      <section className="hero">
        <div className="hero-noise" aria-hidden="true" />

        <div className="hero-stack">
          <div className="hero-stage fx fx-stage"><Taiji /></div>
          <h1 className="h1 fx fx-title">混沌</h1>
          <p className="hero-sub fx fx-sub">Ai+传统命理研究平台</p>
          <div className="hero-actions fx fx-cta">
            <button onClick={() => setShowLauncher(true)} className="btn-primary">
              开始使用 <span aria-hidden="true">→</span>
            </button>
            <button onClick={() => scrollTo(coreRef.current)} className="btn-ghost">
              核心引擎 <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>
      </section>

      {/* ════════════ BRAND ════════════ */}
      <section ref={brandRef} className="band band-paper brand">
        <div className="brand-quote wrap-narrow">
          <p className="brand-line">世间万象，看似纷繁无序</p>
          <p className="brand-line mt-3">实则暗藏规律</p>
          <p className="body muted mt-10">
            「混沌」之名，取自道家宇宙观。<br />天地未分，元气未判。以 AI 之力，解古籍之密，<br />让传统玄学，触手可及。
          </p>
          <div className="seal-box">
            <svg viewBox="0 0 56 56" className="seal">
              <rect x="2" y="2" width="52" height="52" rx="4" fill="none" stroke={goldText} strokeWidth="1.5" />
              <text x="28" y="36" textAnchor="middle" fill={goldText} fontSize="18" fontWeight="700" fontFamily="serif">混沌</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ════════════ CORE ════════════ */}
      <section ref={coreRef} className="band band-white core">
        <div className="wrap-mid flex-col-gap">
          <Eyebrow>核心引擎</Eyebrow>

          <div className="core-card">
            <Shell>
              <div className="card-row">
                <div className="pv-col"><BaziPreview /></div>
                <div className="card-copy">
                  <h3 className="h3">八字 &amp; 紫微</h3>
                  <p className="body muted">混沌独有一盘双参。四柱天干地支 + 十二宫排盘。大运流年、主星四化，一图尽览。</p>
                  <Link href="/create" className="text-link">开始排盘 <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            </Shell>
          </div>

          <div className="core-card">
            <Shell>
              <div className="card-row card-row-rev">
                <div className="pv-col"><LiuYaoPreview /></div>
                <div className="card-copy">
                  <h3 className="h3">六爻问卦</h3>
                  <p className="body muted">金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。</p>
                  <Link href="/liuyao" className="text-link">开始问卦 <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            </Shell>
          </div>

          <div className="core-card">
            <Shell>
              <div className="card-row">
                <div className="pv-col"><HePanPreview /></div>
                <div className="card-copy">
                  <h3 className="h3">姓名合盘</h3>
                  <p className="body muted">二人姓名，五行适配。天格地格人格外格总格，五格剖象，深析缘分。</p>
                  <span className="tag">即将上线</span>
                </div>
              </div>
            </Shell>
          </div>

          <div className="core-card">
            <Shell>
              <div className="card-row card-row-rev">
                <div className="pv-col"><ZeRiPreview /></div>
                <div className="card-copy">
                  <h3 className="h3">择日</h3>
                  <p className="body muted">黄道吉日，天时地利。嫁娶开业搬家出行，择最优时日，趋吉避凶。</p>
                  <span className="tag">即将上线</span>
                </div>
              </div>
            </Shell>
          </div>

          <div ref={toolsRef} className="tools">
            <p className="eyebrow center">更多即将上线</p>
            <div className="tools-grid">
              {[
                { i:"⭐", t:"星座命盘", d:"西方占星 · 本命盘与合盘" },
                { i:"👤", t:"面相", d:"AI 面相分析 · 五官气色辨吉凶" },
                { i:"✋", t:"手相", d:"AI 手相解读 · 三大纹路断运势" },
              ].map((m, idx) => (
                <div key={idx} className="tool-soon">
                  <span className="tool-ico">{m.i}</span>
                  <h4 className="tool-t">{m.t}</h4>
                  <p className="tool-d muted">{m.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ CTA ════════════ */}
      <section ref={ctaRef} className="band band-paper cta">
        <div className="cta-block wrap-narrow">
          <h2 className="h2">随身携带你的混沌</h2>
          <p className="body muted">随时随地，排一盘，问一卦。</p>
          <button onClick={() => { window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' }); setTimeout(() => setShowLauncher(true), prefersReduced() ? 0 : 600) }}
            className="btn-primary">
            开始使用 <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* ════════════ LAUNCHER MODAL ════════════ */}
      {showLauncher && (
        <div className="overlay" onClick={() => setShowLauncher(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLauncher(false)} className="sheet-x" aria-label="关闭">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
            </button>

            <div className="sheet-head">
              <p className="eyebrow center">选择功能</p>
              <h2 className="h2 sheet-title">探索你的命理</h2>
            </div>

            <div className="sheet-body">
              <button onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollBy({left:-340,behavior: prefersReduced() ? 'auto' : 'smooth'}) }}
                className="sheet-arrow sheet-arrow-l" aria-label="上一个">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M10 3l-5 5 5 5"/></svg>
              </button>

              <div id="ls" className="sheet-track">
                {[
                  { href:"/create", zi:"命", title:"八字 & 紫微", desc:"四柱天干地支 + 十二宫排盘。大运流年、主星四化，一盘双参。" },
                  { href:"/liuyao", zi:"爻", title:"六爻问卦", desc:"金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。" },
                  { href:"#", zi:"合", title:"姓名合盘", desc:"二人姓名，五行适配。五格剖象，深析缘分。", tag:"即将上线" },
                  { href:"#", zi:"吉", title:"择日", desc:"黄道吉日，天时地利。嫁娶开业搬家出行，择最优时日，趋吉避凶。", tag:"即将上线" },
                ].map((item, i) => (
                  <Link key={i} href={item.href}
                    onClick={() => item.tag ? null : setShowLauncher(false)}
                    className={item.tag ? 'sheet-item is-soon' : 'sheet-item'}>
                    <svg viewBox="0 0 72 72" className="sheet-zi">
                      <rect x="1" y="1" width="70" height="70" rx="8" fill="none" stroke={gold} strokeWidth="1.2" opacity="0.35" />
                      <text x="36" y="50" textAnchor="middle" fill={goldText} fontSize="32" fontWeight="700" fontFamily="serif">{item.zi}</text>
                    </svg>
                    <h3 className="h3 sheet-name">{item.title}</h3>
                    {item.tag ? <span className="tag">{item.tag}</span> : <span className="sheet-rule" />}
                    <p className="body muted sheet-desc">{item.desc}</p>
                    <span className={item.tag ? 'sheet-go is-dim' : 'sheet-go'}>
                      {item.tag ? '敬请期待' : '进入'}
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>
                    </span>
                  </Link>
                ))}
              </div>

              <button onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollBy({left:340,behavior: prefersReduced() ? 'auto' : 'smooth'}) }}
                className="sheet-arrow sheet-arrow-r" aria-label="下一个">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hp {
          background: ${white}; color: ${ink};
          --fs-1: clamp(2.75rem, 6vw, 3.5rem);
          --fs-2: clamp(1.5rem, 2.6vw, 1.9rem);
          --fs-3: 1.0625rem;
          --fs-4: 0.875rem;
          --fs-5: 0.75rem;
        }
        .hp * { box-sizing: border-box; }

        /* ===== Layout ===== */
        .hp .hero {
          position: relative; overflow: hidden;
          min-height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          padding: 2.75rem 1.5rem 0;
          background: linear-gradient(180deg, ${white} 0%, #fafaf8 100%);
        }
        .hp .hero-noise {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E");
        }
        .hp .hero-stack {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          width: 100%; max-width: 1120px;
        }
        .hp .hero-stage { height: 41svh; min-height: 190px; width: 100%; display: flex; align-items: center; justify-content: center; }
        .hp .taiji { height: 100%; width: 100%; overflow: visible; }
        .hp .h1 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--fs-1); font-weight: 700; line-height: 1.05;
          letter-spacing: -0.04em; margin: 0 0 0.5rem; color: ${ink};
        }
        .hp .hero-sub { font-size: var(--fs-3); line-height: 1.7; margin: 0; color: ${mute}; }
        .hp .hero-actions { margin-top: 1.5rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; justify-content: center; }

        .hp .band { padding: 7rem 1.5rem; }
        .hp .band-paper { background: ${paper}; }
        .hp .band-white { background: ${white}; }
        .hp .brand, .hp .cta { scroll-margin-top: 2.75rem; }
        .hp .core { scroll-margin-top: 2.75rem; }
        .hp .wrap-narrow { max-width: 672px; margin: 0 auto; }
        .hp .wrap-mid { max-width: 980px; margin: 0 auto; }
        .hp .flex-col-gap { display: flex; flex-direction: column; gap: 1.5rem; }

        /* ===== Type ===== */
        .hp .eyebrow {
          font-size: var(--fs-5); font-weight: 600; letter-spacing: 0.22em;
          color: ${goldText}; margin: 0 0 2.5rem; text-align: center;
        }
        .hp .eyebrow.center { text-align: center; }
        .hp .h2 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--fs-2); font-weight: 700; line-height: 1.15;
          letter-spacing: -0.02em; margin: 0 0 0.75rem; color: ${ink};
        }
        .hp .h3 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--fs-2); font-weight: 600; line-height: 1.15;
          letter-spacing: -0.02em; margin: 0 0 0.75rem; color: ${ink};
        }
        .hp .body { font-size: var(--fs-3); line-height: 1.7; margin: 0 0 1.5rem; max-width: 34rem; }
        .hp .muted { color: ${mute}; }
        .hp .brand-line {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--fs-2); font-weight: 600; line-height: 1.6;
          letter-spacing: 0.05em; text-align: center; margin: 0; color: ${ink};
        }
        .hp .brand .body { text-align: center; margin-inline: auto; }
        .hp .mt-3 { margin-top: 0.75rem; }
        .hp .mt-10 { margin-top: 2.5rem; }

        /* ===== Buttons ===== */
        .hp .btn-primary {
          display: inline-flex; align-items: center; gap: 0.5rem;
          border: 0; border-radius: 999px; cursor: pointer;
          padding: 0.8rem 1.75rem; font-size: var(--fs-3); font-weight: 600; font-family: inherit;
          background: ${gold}; color: ${ink};
          transition: transform 400ms cubic-bezier(0.16,1,0.3,1);
        }
        .hp .btn-primary:hover { transform: translateY(-2px); }
        .hp .btn-primary:active { transform: translateY(0); }
        .hp .btn-ghost {
          display: inline-flex; align-items: center; gap: 0.4rem;
          border: 0; background: none; cursor: pointer; font-family: inherit;
          padding: 0; font-size: var(--fs-4); font-weight: 600; letter-spacing: 0.03em;
          color: ${goldText}; min-height: 44px;
        }
        .hp .text-link {
          display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;
          font-size: var(--fs-4); font-weight: 600; letter-spacing: 0.03em; color: ${goldText};
          min-height: 44px;
          transition: transform 400ms cubic-bezier(0.16,1,0.3,1);
        }
        .hp .text-link:hover { transform: translateX(3px); }
        .hp .tag {
          display: inline-block; font-size: var(--fs-5); font-weight: 600; letter-spacing: 0.1em;
          padding: 0.25rem 0.7rem; border-radius: 999px;
          background: rgba(178,149,93,0.08); color: ${goldText};
        }

        /* ===== Cards ===== */
        .hp .shell {
          background: ${white}; border-radius: 20px; padding: 1.5rem;
          box-shadow: 0 14px 40px rgba(0,0,0,0.05);
        }
        .hp .card-row { display: flex; flex-direction: column; align-items: center; gap: 2rem; }
        .hp .card-copy { text-align: center; min-width: 0; }
        .hp .card-copy .body { margin-inline: auto; }
        .hp .pv-col { width: 100%; max-width: 260px; flex-shrink: 0; }
        .hp .pv svg, .hp .pv-col > svg { display: block; width: 100%; height: auto; overflow: visible; }
        .hp .core-card { border-radius: 20px; transition: transform 400ms cubic-bezier(0.16,1,0.3,1); }
        .hp .core-card:hover { transform: translateY(-4px); }
        .hp .tools { margin-top: 1rem; }
        .hp .tools-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
        .hp .tool-soon {
          background: ${white}; border-radius: 16px; padding: 1.25rem; text-align: center;
          box-shadow: 0 14px 40px rgba(0,0,0,0.04);
        }
        .hp .tool-ico { font-size: var(--fs-2); line-height: 1; }
        .hp .tool-t { font-size: var(--fs-3); font-weight: 600; margin: 0.75rem 0 0.25rem; color: ${ink}; }
        .hp .tool-d { font-size: var(--fs-4); line-height: 1.7; margin: 0; }
        .hp .seal-box { display: flex; justify-content: center; margin-top: 2rem; }
        .hp .seal { width: 56px; height: 56px; opacity: 0.55; }

        .hp .pv-liuyao { position: relative; }
        .hp .pv-liuyao .ly-lines { position: static; }
        .hp .pv-liuyao .ly-coins {
          position: absolute; right: 0; top: 50%; transform: translateY(-50%);
          display: flex; gap: 4%; width: 46%;
        }
        .hp .pv-liuyao .ly-coins > span { flex: 1; display: block; }

        /* ===== CTA ===== */
        .hp .cta { text-align: center; }
        .hp .cta .body { margin-inline: auto; }

        /* ===== Launcher ===== */
        .hp .overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 1.5rem;
          background: rgba(0,0,0,0.45);
        }
        .hp .sheet {
          position: relative; width: 100%; max-width: 440px;
          border-radius: 24px; padding: 2.5rem 2rem;
          background: ${white}; box-shadow: 0 32px 80px rgba(0,0,0,0.16);
        }
        .hp .sheet-x {
          position: absolute; top: 1.25rem; right: 1.25rem; width: 2rem; height: 2rem;
          border: 0; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: none; color: ${mute};
        }
        .hp .sheet-head { text-align: center; margin-bottom: 2rem; }
        .hp .sheet-head .eyebrow { margin-bottom: 0.75rem; }
        .hp .sheet-title { margin: 0; }
        .hp .sheet-body { position: relative; }
        .hp .sheet-track {
          display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
        }
        .hp .sheet-track::-webkit-scrollbar { display: none; }
        .hp .sheet-item {
          scroll-snap-align: center; flex: 0 0 100%; min-width: 100%;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          padding: 0.5rem 1rem; text-decoration: none; cursor: pointer;
        }
        .hp .sheet-item.is-soon { pointer-events: none; }
        .hp .sheet-zi { width: 72px; height: 72px; margin-bottom: 1.25rem; }
        .hp .sheet-name { font-size: var(--fs-3); margin-bottom: 1rem; }
        .hp .sheet-rule { display: block; width: 2.5rem; height: 1px; margin: 0 0 1rem; background: rgba(178,149,93,0.24); }
        .hp .sheet-desc { margin-bottom: 1.5rem; max-width: 300px; }
        .hp .sheet-go {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: var(--fs-4); font-weight: 600; color: ${goldText};
        }
        .hp .sheet-go.is-dim { color: ${mute}; }
        .hp .sheet-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
          width: 2rem; height: 2rem; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: ${white}; border: 0.5px solid rgba(0,0,0,0.08);
        }
        .hp .sheet-arrow-l { left: -0.75rem; }
        .hp .sheet-arrow-r { right: -0.75rem; }

        /* ===== One-shot hero entrance ===== */
        @keyframes hpFade { from { opacity: 0; transform: translate3d(0,16px,0); } to { opacity: 1; transform: none; } }
        @keyframes hpScale { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
        .hp .fx { animation-duration: 700ms; animation-timing-function: cubic-bezier(0.16,1,0.3,1); animation-fill-mode: both; }
        .hp .fx-stage { animation-name: hpScale; }
        .hp .fx-title { animation-name: hpFade; animation-delay: 120ms; }
        .hp .fx-sub   { animation-name: hpFade; animation-delay: 200ms; }
        .hp .fx-cta   { animation-name: hpFade; animation-delay: 280ms; }

        /* Narrow phones: keep the brand paragraph on its three authored lines. */
        @media (max-width: 400px) {
          .hp .brand .body { font-size: var(--fs-4); }
        }

        /* ===== Wide layout ===== */
        @media (min-width: 640px) {
          .hp .band { padding: 9rem 1.5rem; }
          .hp .shell { padding: 2.5rem; }
          .hp .card-row { flex-direction: row; gap: 3rem; text-align: left; }
          .hp .card-row-rev { flex-direction: row-reverse; }
          .hp .card-copy { text-align: left; }
          .hp .card-copy .body { margin-inline: 0; }
          .hp .cta .body { margin-inline: auto; }
          .hp .tools-grid { grid-template-columns: repeat(3, 1fr); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hp *, .hp *::before, .hp *::after {
            animation: none !important; transition: none !important;
          }
          .hp .fx { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
