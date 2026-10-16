'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// SVG 画线用字面量（presentation attribute 里 var() 不生效），取值与 globals.css
// 的品牌金 token 逐个对齐；文字色一律走 var(--color-*)，页面不再自带一套色板。
const gold = '#b2955d';        // == --color-accent-gold
const goldLight = '#d4b87a';   // == --color-accent-gold-light
const goldDeep = '#7a5f31';    // == --color-accent-gold-text
const inkH = '#1d1d1f';        // == --color-text-primary

// Round to 6 decimals so server & client Math.cos/sin stay identical (hydration-safe)
const R6 = (n: number) => Math.round(n * 1e6) / 1e6;

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 首屏主视觉：天圆（刻度圈 + 天干 + 八卦）· 地方（十二宫方盘）· 中宫（太极）。
   方盘只排地支——地支按宫位是固定的，十二宫名要随命盘变，画死在这里就是假数据。 */
function HeroPan() {
  const H = 100;              // 方盘半边长
  const U = 50;               // 单格边长（中宫 = 2×2 格）
  const TR = 182;             // 刻度圈基线半径
  const R = 44;               // 中宫太极半径

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const rad = ((i * 360) / 24 - 90) * Math.PI / 180;
    const len = i % 6 === 0 ? 12 : i % 3 === 0 ? 7 : 4;
    return { x1: R6(TR * Math.cos(rad)), y1: R6(TR * Math.sin(rad)),
             x2: R6((TR + len) * Math.cos(rad)), y2: R6((TR + len) * Math.sin(rad)),
             w: i % 6 === 0 ? 0.9 : 0.5 };
  });
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const cells = [
    { r: 0, c: 0, z: "巳" }, { r: 0, c: 1, z: "午" }, { r: 0, c: 2, z: "未" }, { r: 0, c: 3, z: "申" },
    { r: 1, c: 3, z: "酉" }, { r: 2, c: 3, z: "戌" }, { r: 3, c: 3, z: "亥" },
    { r: 3, c: 2, z: "子" }, { r: 3, c: 1, z: "丑" }, { r: 3, c: 0, z: "寅" },
    { r: 2, c: 0, z: "卯" }, { r: 1, c: 0, z: "辰" },
  ];
  const split = [-H + U, -H + 2 * U, -H + 3 * U];   // -50 / 0 / 50
  const cellX = (c: number) => R6(-H + c * U + U / 2);
  const cellY = (r: number) => R6(-H + r * U + U / 2);
  const half = R / 2;

  return (
    <svg viewBox="-200 -200 400 400" className="pan" role="img" aria-label="命盘示意">
      <defs>
        <radialGradient id="hp-yang" cx="60%" cy="35%">
          <stop offset="0%" stopColor={gold} stopOpacity={0.34} />
          <stop offset="100%" stopColor={gold} stopOpacity={0.14} />
        </radialGradient>
        <radialGradient id="hp-yin" cx="40%" cy="65%">
          <stop offset="0%" stopColor={inkH} stopOpacity={0.16} />
          <stop offset="100%" stopColor={inkH} stopOpacity={0.05} />
        </radialGradient>
      </defs>

      {/* 天行健：刻度圈与天干反向缓转，方盘与中宫不动 */}
      <g className="pan-orb">
        <g>
          {ticks.map((t, i) => (
            <line key={"t" + i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={gold} strokeWidth={t.w} strokeLinecap="round" opacity={0.55} />
          ))}
        </g>
        <circle r={TR} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.30} />
        <circle r={196} fill="none" stroke={gold} strokeWidth={0.5} opacity={0.18} />
      </g>
      <g className="pan-orb-rev">
        {stems.map((s, i) => {
          const a = (i * 36 - 90) * Math.PI / 180;
          return (
            <text key={"s" + i} x={R6(166 * Math.cos(a))} y={R6(166 * Math.sin(a))}
              textAnchor="middle" dominantBaseline="central"
              fill={goldDeep} fontSize={12} fontFamily="serif" letterSpacing="0.08em"
              opacity={0.75}>{s}</text>
          );
        })}
      </g>

      {/* 地方：4×4 十二宫，中间 2×2 是空出来的中宫 */}
      <g className="pan-square">
        <rect x={-H} y={-H} width={2 * H} height={2 * H} rx={2}
          fill="none" stroke={gold} strokeWidth={1} opacity={0.45} />
        <rect x={-U} y={-U} width={2 * U} height={2 * U}
          fill="none" stroke={gold} strokeWidth={0.7} opacity={0.28} />
        {split.map((v, i) => (
          <g key={"v" + i}>
            <line x1={v} y1={-H} x2={v} y2={-U} stroke={gold} strokeWidth={0.6} opacity={0.26} />
            <line x1={v} y1={U} x2={v} y2={H} stroke={gold} strokeWidth={0.6} opacity={0.26} />
            <line x1={-H} y1={v} x2={-U} y2={v} stroke={gold} strokeWidth={0.6} opacity={0.26} />
            <line x1={U} y1={v} x2={H} y2={v} stroke={gold} strokeWidth={0.6} opacity={0.26} />
          </g>
        ))}
        {cells.map(({ r, c, z }) => (
          <text key={z} x={cellX(c)} y={cellY(r)} textAnchor="middle" dominantBaseline="central"
            fill={goldDeep} fontSize={17} fontFamily="serif" opacity={0.72}>{z}</text>
        ))}
      </g>

      {/* 中宫太极 */}
      <g className="pan-taiji">
        <circle r={R} fill="none" stroke={gold} strokeWidth={0.9} opacity={0.55} />
        <path d={`M0,${-R} A${R},${R} 0 0,1 0,${R} A${half},${half} 0 0,1 0,0 A${half},${half} 0 0,0 0,${-R} Z`}
          fill="url(#hp-yang)" />
        <path d={`M0,${-R} A${R},${R} 0 0,0 0,${R} A${half},${half} 0 0,0 0,0 A${half},${half} 0 0,1 0,${-R} Z`}
          fill="url(#hp-yin)" />
        <path d={`M0,${-R} A${half},${half} 0 0,1 0,0 A${half},${half} 0 0,1 0,${R}`}
          fill="none" stroke={gold} strokeWidth={0.7} opacity={0.6} />
        <circle cy={-half} r={R6(half * 0.32)} fill={inkH} opacity={0.32} />
        <circle cy={half} r={R6(half * 0.32)} fill={gold} opacity={0.62} />
      </g>
    </svg>
  );
}

/* 一盘双参示意。墨底版（ink）把线宽与不透明度整体抬起来：纸面版的 0.10–0.30
   放到 #23201a 上等于没有。四柱圆点统一走品牌金，不再用 #d4544a —— 那个值是
   六神·螣蛇的冻结编码色，装饰画不能占用数据色。 */
function BaziPreview({ ink = false }: { ink?: boolean }) {
  const R = 88, cx = 100, cy = 100;
  const line = ink ? goldLight : gold;
  const lab = ink ? goldLight : goldDeep;
  const o = (a: number) => (ink ? Math.min(1, a * 2.8) : a);
  const bars = [{ h: 46 }, { h: 54 }, { h: 42, dayMaster: true }, { h: 58 }];
  const spacing = 12;
  const startX = cx - (bars.length * spacing) / 2 + spacing / 2;
  const palaceNames = ["命", "兄", "夫", "子", "财", "疾", "迁", "友", "官", "田", "福", "父"];
  const mingGong = 5;

  return (
    <svg viewBox="0 0 200 200" className="pv">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={line} strokeWidth={0.8} opacity={o(0.25)} />
      <circle cx={cx} cy={cy} r={R - 10} fill="none" stroke={line} strokeWidth={0.4} opacity={o(0.10)} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const isMing = i === mingGong;
        const ca = Math.cos(a), sa = Math.sin(a);
        return (
          <g key={"p" + i}>
            <line x1={R6(cx + (R - 4) * ca)} y1={R6(cy + (R - 4) * sa)}
              x2={R6(cx + (R + 3) * ca)} y2={R6(cy + (R + 3) * sa)}
              stroke={line} strokeWidth={isMing ? 1.4 : 0.6}
              opacity={isMing ? o(0.55) : o(0.18)} strokeLinecap="round" />
            <text x={R6(cx + (R + 11) * ca)} y={R6(cy + (R + 11) * sa)} textAnchor="middle"
              dominantBaseline="central" fill={lab} fontSize={isMing ? 8 : 6.5}
              fontWeight={isMing ? 600 : 400} fontFamily="serif"
              opacity={isMing ? o(0.50) : o(0.30)}>{palaceNames[i]}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={R - 7} fill="none" stroke={line} strokeWidth={0.3}
        strokeDasharray="1 5" opacity={o(0.10)} />
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        const y1 = cy - b.h / 2, y2 = cy + b.h / 2;
        return (
          <g key={"bar" + i}>
            <line x1={x} y1={y1} x2={x} y2={y2} stroke={line}
              strokeWidth={b.dayMaster ? 2.5 : 2} strokeLinecap="round"
              opacity={b.dayMaster ? o(0.70) : o(0.30)} />
            <line x1={x - 2.5} y1={y1} x2={x + 2.5} y2={y1} stroke={line}
              strokeWidth={0.8} opacity={o(0.3)} strokeLinecap="round" />
            <line x1={x - 2.5} y1={y2} x2={x + 2.5} y2={y2} stroke={line}
              strokeWidth={0.8} opacity={o(0.3)} strokeLinecap="round" />
          </g>
        );
      })}
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        return <circle key={"s" + i} cx={x} cy={cy - b.h / 2 - 10} r={b.dayMaster ? 4 : 3}
          fill={line} opacity={b.dayMaster ? 0.92 : o(0.60)} />;
      })}
      {bars.map((b, i) => {
        const x = startX + i * spacing;
        return <circle key={"b" + i} cx={x} cy={cy + b.h / 2 + 10} r={3}
          fill={line} opacity={o(0.40)} />;
      })}
      <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={line} strokeWidth={0.4} opacity={o(0.15)} />
      <line x1={cx} y1={cy - 3} x2={cx} y2={cy + 3} stroke={line} strokeWidth={0.4} opacity={o(0.15)} />
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
            return <line key={i} x1={4} y1={y} x2={196} y2={y} stroke={gold} strokeWidth={1.4} opacity={0.5} />;
          }
          return (<g key={i}><line x1={4} y1={y} x2={92} y2={y} stroke={gold} strokeWidth={1.4} opacity={0.5} /><line x1={108} y1={y} x2={196} y2={y} stroke={gold} strokeWidth={1.4} opacity={0.5} /></g>);
        })}
      </svg>
      <div className="ly-coins">
        <span><Coin o={0.55} /></span>
        <span><Coin o={0.8} /></span>
        <span><Coin o={0.55} /></span>
      </div>
    </div>
  );
}

/* 合盘示意：五行点直接引冻结 token（当 fill 用，属于"圆点编码"，不作文字色）。
   原来这两圈用 #5b9a5a/#c8a43e/#5b8db8 自造了一套五行色，和产品里的编码对不上；
   9px 的木火土金水标签在缩略尺寸下也读不出来，去掉。 */
function HePanPreview() {
  const cx1 = 100, cx2 = 180, cy = 96, R = 72;
  const wx = ["var(--color-wx-mu)", "var(--color-wx-huo)", "var(--color-wx-tu)", "var(--color-wx-jin)", "var(--color-wx-shui)"];
  const leftAngles = [0, 72, 144, 216, 288];
  const rightAngles = [36, 108, 180, 252, 324];
  return (
    <div className="pv">
      <svg viewBox="22 18 256 156">
        <circle cx={cx1} cy={cy} r={R} fill="none" stroke={gold} strokeWidth={1.2} opacity={0.45} />
        <circle cx={cx1} cy={cy} r={R - 12} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.26} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return <line key={"lt" + i} x1={R6(cx1 + (R - 3) * Math.cos(a))} y1={R6(cy + (R - 3) * Math.sin(a))}
            x2={R6(cx1 + (R + 2) * Math.cos(a))} y2={R6(cy + (R + 2) * Math.sin(a))}
            stroke={gold} strokeWidth={0.4} opacity={0.28} />;
        })}
        <circle cx={cx1} cy={cy - 14} r={3.5} fill={gold} opacity={0.7} />
        <circle cx={cx2} cy={cy} r={R} fill="none" stroke={inkH} strokeWidth={1.2} opacity={0.22} />
        <circle cx={cx2} cy={cy} r={R - 12} fill="none" stroke={inkH} strokeWidth={0.6} opacity={0.14} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return <line key={"rt" + i} x1={R6(cx2 + (R - 3) * Math.cos(a))} y1={R6(cy + (R - 3) * Math.sin(a))}
            x2={R6(cx2 + (R + 2) * Math.cos(a))} y2={R6(cy + (R + 2) * Math.sin(a))}
            stroke={inkH} strokeWidth={0.4} opacity={0.14} />;
        })}
        <circle cx={cx2} cy={cy - 14} r={3.5} fill={inkH} opacity={0.35} />
        {leftAngles.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          return <circle key={"lw" + i} cx={R6(cx1 + 50 * Math.cos(rad))} cy={R6(cy + 50 * Math.sin(rad))}
            r={5} style={{ fill: wx[i] }} opacity={0.9} />;
        })}
        {rightAngles.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          return <circle key={"rw" + i} cx={R6(cx2 + 50 * Math.cos(rad))} cy={R6(cy + 50 * Math.sin(rad))}
            r={5} style={{ fill: wx[i] }} opacity={0.9} />;
        })}
        {[[0, 3], [1, 1], [2, 4], [3, 0], [4, 2]].map(([li, ri], i) => {
          const la = (leftAngles[li] * Math.PI) / 180;
          const ra = (rightAngles[ri] * Math.PI) / 180;
          return (
            <line key={"arc" + i}
              x1={R6(cx1 + 50 * Math.cos(la))} y1={R6(cy + 50 * Math.sin(la))}
              x2={R6(cx2 + 50 * Math.cos(ra))} y2={R6(cy + 50 * Math.sin(ra))}
              stroke={gold} strokeWidth={0.5} opacity={0.3} />
          );
        })}
        <circle cx={(cx1 + cx2) / 2} cy={cy} r={7} fill={gold} opacity={0.5} />
        <text x={(cx1 + cx2) / 2} y={cy} textAnchor="middle" dominantBaseline="central"
          fontSize={11} fill={goldDeep} fontFamily="serif" fontWeight="bold">合</text>
      </svg>
    </div>
  );
}

function ZeRiPreview() {
  const cx = 125, cy = 105, dR = 65;
  const diamond = (r: number) => {
    const pts: Array<{ x: number, y: number }> = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * 90 - 90) * Math.PI / 180;
      pts.push({ x: R6(cx + r * Math.cos(a)), y: R6(cy + r * Math.sin(a)) });
    }
    return pts.map(p => p.x + ',' + p.y).join(' ');
  };
  return (
    <div className="pv">
      <svg viewBox="34 18 182 174">
        <polygon points={diamond(dR)} fill="none" stroke={gold} strokeWidth={1.2} opacity={0.45} />
        {[0, 1, 2, 3].map(i => {
          const a1 = (i * 90 - 90) * Math.PI / 180, a2 = ((i + 1) * 90 - 90) * Math.PI / 180;
          const x1 = R6(cx + dR * Math.cos(a1)), y1 = R6(cy + dR * Math.sin(a1));
          const x2 = R6(cx + dR * Math.cos(a2)), y2 = R6(cy + dR * Math.sin(a2));
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len, ny = dx / len;
          return <line key={"dt" + i} x1={mx + nx * 2} y1={my + ny * 2} x2={mx + nx * 8} y2={my + ny * 8}
            stroke={gold} strokeWidth={0.6} opacity={0.35} />;
        })}
        <polygon points={diamond(dR - 16)} fill="none" stroke={gold} strokeWidth={0.6} opacity={0.3} />
        <polygon points={diamond(dR - 40)} fill="none" stroke={gold} strokeWidth={0.8} opacity={0.6} />
        {[0, 1, 2, 3].map(i => {
          const a = (i * 90 - 90) * Math.PI / 180;
          return <circle key={"cd" + i} cx={R6(cx + (dR - 16) * Math.cos(a))} cy={R6(cy + (dR - 16) * Math.sin(a))}
            r={3} fill={gold} opacity={0.5} />;
        })}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={20}
          fill={goldDeep} fontFamily="serif" fontWeight="bold">{'\u5409'}</text>
      </svg>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

type Engine = { title: string; desc: string; href?: string; go?: string };

const ENGINES: Engine[] = [
  { title: '六爻问卦', desc: '金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。', href: '/liuyao', go: '开始问卦' },
  { title: '姓名合盘', desc: '二人姓名，五行适配。天格地格人格外格总格，五格剖象，深析缘分。' },
  { title: '择日', desc: '黄道吉日，天时地利。嫁娶开业搬家出行，择最优时日，趋吉避凶。' },
];

const SOON = [
  { t: "星座命盘", d: "西方占星 · 本命盘与合盘" },
  { t: "面相", d: "AI 面相分析 · 五官气色辨吉凶" },
  { t: "手相", d: "AI 手相解读 · 三大纹路断运势" },
];

export default function HomePage() {
  const heroRef  = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLElement>(null);
  const coreRef  = useRef<HTMLElement>(null);
  const ctaRef   = useRef<HTMLElement>(null);

  const [showLauncher, setShowLauncher] = useState(false);

  const scrollTo = (el: Element | null) => {
    el?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
  };

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.brand-line', { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, stagger: 0.14, duration: 0.8, ease: 'expo.out',
      scrollTrigger: { trigger: brandRef.current, start: 'top 78%', once: true },
    });
  }, { scope: brandRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.ink-flag', { opacity: 0, y: 44 }, {
      opacity: 1, y: 0, duration: 0.8, ease: 'expo.out',
      scrollTrigger: { trigger: coreRef.current, start: 'top 82%', once: true },
    });
    gsap.fromTo('.core-row', { opacity: 0, y: 32 }, {
      opacity: 1, y: 0, stagger: 0.10, duration: 0.7, ease: 'expo.out',
      scrollTrigger: { trigger: '.core-rows', start: 'top 86%', once: true },
    });
  }, { scope: coreRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.tool', { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'expo.out',
      scrollTrigger: { trigger: '.hp .tools', start: 'top 90%', once: true },
    });
  }, { scope: coreRef });

  useGSAP(() => {
    if (prefersReduced()) return;
    gsap.fromTo('.cta-block', { opacity: 0, y: 24 }, {
      opacity: 1, y: 0, duration: 0.6, ease: 'expo.out',
      scrollTrigger: { trigger: ctaRef.current, start: 'top 88%', once: true },
    });
  }, { scope: ctaRef });

  return (
    <div className="hp">

      {/* 首页正文整体进 <main>：没有这个地标时，harness 的 main 区间审计是空过的
          ——字号、对比度、可点尺寸全部落在 region "other"，报告照样"全绿"。 */}
      <main>

      {/* ════════════ HERO：一整屏，左盘右字 ════════════ */}
      <section ref={heroRef} className="hero">
        <div className="hero-noise" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-art fx fx-stage"><HeroPan /></div>
          <div className="hero-copy">
            <h1 className="h1 fx fx-title">混沌</h1>
            <p className="hero-sub fx fx-sub">Ai+传统命理研究平台</p>
            <div className="hero-actions fx fx-cta">
              <button onClick={() => setShowLauncher(true)} className="btn-primary">
                开始使用 <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>

        <div className="hero-foot fx fx-foot">
          <button onClick={() => scrollTo(coreRef.current)} className="btn-quiet">
            核心引擎 <span aria-hidden="true">↓</span>
          </button>
        </div>
      </section>

      {/* ════════════ BRAND：一句断句，一句解释 ════════════ */}
      <section ref={brandRef} className="band band-paper brand">
        <div className="wrap brand-grid">
          <div className="brand-say">
            <p className="brand-line h2">世间万象，</p>
            <p className="brand-line h2">看似纷繁无序</p>
            <p className="brand-line h2">实则暗藏规律</p>
          </div>
          <div className="brand-note">
            <p className="body">
              「混沌」之名，取自道家宇宙观。<br />天地未分，元气未判。以 AI 之力，解古籍之密，<br />让传统玄学，触手可及。
            </p>
            <svg viewBox="0 0 56 56" className="seal" aria-hidden="true">
              <rect x="2" y="2" width="52" height="52" rx="4" fill="none" stroke={goldDeep} strokeWidth="1.5" />
              <text x="28" y="36" textAnchor="middle" fill={goldDeep} fontSize="18" fontWeight="700" fontFamily="serif">混沌</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ════════════ CORE ════════════ */}
      <section ref={coreRef} className="band band-white core">
        <div className="wrap">
          <Eyebrow>核心引擎</Eyebrow>

          <div className="qn-ink ink-flag">
            <div className="ink-grid">
              <div className="ink-art"><BaziPreview ink /></div>
              <div className="ink-copy">
                <h2 className="h2">八字 &amp; 紫微</h2>
                <p className="body">混沌独有一盘双参。四柱天干地支 + 十二宫排盘。大运流年、主星四化，一图尽览。</p>
                <Link href="/create" className="text-link">开始排盘 <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>

          <div className="core-rows">
            {ENGINES.map((e, i) => (
              <div key={e.title} className="core-row">
                <div className="row-pv">
                  {i === 0 && <LiuYaoPreview />}
                  {i === 1 && <HePanPreview />}
                  {i === 2 && <ZeRiPreview />}
                </div>
                <div className="row-copy">
                  <h3 className="h3">{e.title}</h3>
                  <p className="body muted">{e.desc}</p>
                  {e.href
                    ? <Link href={e.href} className="text-link">{e.go} <span aria-hidden="true">→</span></Link>
                    : <span className="tag">即将上线</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="tools">
            <p className="eyebrow">更多即将上线</p>
            <div className="tools-grid">
              {SOON.map(m => (
                <div key={m.t} className="tool">
                  <h4 className="tool-t">{m.t}</h4>
                  <p className="tool-d">{m.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ CTA ════════════ */}
      <section ref={ctaRef} className="band band-paper cta">
        <div className="wrap cta-block">
          <h2 className="h2">随身携带<br />你的混沌</h2>
          <div className="cta-row">
            <p className="body">随时随地，排一盘，问一卦。</p>
            <button onClick={() => { window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' }); setTimeout(() => setShowLauncher(true), prefersReduced() ? 0 : 600) }}
              className="btn-primary">
              开始使用 <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      </main>

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
                      <text x="36" y="50" textAnchor="middle" fill={goldDeep} fontSize="32" fontWeight="700" fontFamily="serif">{item.zi}</text>
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
        .hp { background: var(--color-bg-card); color: var(--color-text-primary); }
        .hp * { box-sizing: border-box; }

        /* ===== 首屏 ===== */
        .hp .hero {
          position: relative; overflow: hidden;
          min-height: 100dvh;
          display: flex; flex-direction: column;
          padding: calc(var(--qn-nav-h) + 12px) 1.5rem 1.25rem;
          background: linear-gradient(180deg, var(--color-bg-card) 0%, #fafaf8 100%);
        }
        .hp .hero-noise {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E");
        }
        .hp .hero-inner {
          position: relative; z-index: 1; flex: 1; width: 100%;
          max-width: 1180px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr;
          align-items: center; align-content: center;
          gap: clamp(1.75rem, 5svh, 3.5rem);
        }
        .hp .hero-art { width: 100%; max-width: min(500px, 74svh); margin: 0 auto; }
        .hp .pan { display: block; width: 100%; height: auto; overflow: visible; }
        .hp .hero-copy { text-align: center; }
        .hp .hero-actions { margin-top: clamp(1.25rem, 3svh, 2rem); }
        .hp .hero-foot {
          position: relative; z-index: 1; width: 100%; max-width: 1180px; margin: 0 auto;
          padding-top: 0.75rem; border-top: var(--qn-hairline);
          display: flex; justify-content: center;
        }

        /* ===== 版面 ===== */
        .hp .band { padding: clamp(4.5rem, 11svh, 8rem) 1.5rem; }
        .hp .band-paper { background: var(--color-bg-primary); }
        .hp .band-white { background: var(--color-bg-card); }
        .hp .brand, .hp .core, .hp .cta { scroll-margin-top: var(--qn-nav-h); }
        .hp .wrap { max-width: 1120px; margin: 0 auto; }

        /* ===== 字 ===== */
        .hp .eyebrow {
          font-size: var(--qn-fs-eyebrow); font-weight: 600; letter-spacing: 0.24em;
          color: var(--color-accent-gold-text); margin: 0 0 2rem; text-align: left;
        }
        .hp .eyebrow.center { text-align: center; }
        .hp .h1 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--qn-fs-display); font-weight: 600; line-height: 1.05;
          letter-spacing: 0.06em; margin: 0; color: var(--color-text-primary);
        }
        .hp .h2 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--qn-fs-display); font-weight: 600; line-height: 1.18;
          letter-spacing: 0.02em; margin: 0; color: var(--color-text-primary);
        }
        .hp .h3 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--qn-fs-hero); font-weight: 600; line-height: 1.2;
          letter-spacing: 0.01em; margin: 0 0 0.5rem; color: var(--color-text-primary);
        }
        .hp .body { font-size: var(--qn-fs-body); line-height: 1.8; margin: 0 0 1.25rem; max-width: 34rem; }
        .hp .muted { color: var(--color-text-secondary); }
        .hp .hero-sub { font-size: var(--qn-fs-hero); line-height: 1.5; margin: 0.75rem 0 0; color: var(--color-text-secondary); }
        /* brand-line 不能再叠 font-family: inherit —— inherit 取的是父元素(.brand-say)的
           无衬线，会把 .h2 的宋体整条吃掉，断句就变成一坨黑体。 */
        .hp .brand-say { display: grid; gap: 0.1em; }

        /* ===== 按钮 / 链接 ===== */
        .hp .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          min-height: 48px; border: 0; border-radius: 999px; cursor: pointer;
          padding: 0 1.9rem; font-size: var(--qn-fs-body); font-weight: 600; font-family: inherit;
          letter-spacing: 0.06em; background: var(--color-accent-gold); color: var(--color-text-primary);
          transition: transform 400ms cubic-bezier(0.16,1,0.3,1), background-color 200ms;
        }
        .hp .btn-primary:hover { transform: translateY(-2px); background: var(--color-accent-gold-light); }
        .hp .btn-primary:active { transform: translateY(0); }
        .hp .btn-quiet {
          display: inline-flex; align-items: center; gap: 0.4rem;
          border: 0; background: none; cursor: pointer; font-family: inherit;
          padding: 0 0.5rem; margin: -0.5rem 0; font-size: var(--qn-fs-meta); font-weight: 600;
          letter-spacing: 0.14em; color: var(--color-accent-gold-text); min-height: 44px;
        }
        .hp .text-link {
          display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;
          min-height: 44px; padding: 0 0.4rem; margin: -0.5rem 0;
          font-size: var(--qn-fs-meta); font-weight: 600; letter-spacing: 0.06em;
          color: var(--color-accent-gold-text);
          transition: transform 400ms cubic-bezier(0.16,1,0.3,1);
        }
        .hp .text-link:hover { transform: translateX(3px); }
        .hp .tag {
          display: inline-block; font-size: var(--qn-fs-eyebrow); font-weight: 600; letter-spacing: 0.1em;
          padding: 0.25rem 0.7rem; border-radius: 999px;
          background: rgba(178,149,93,0.10); color: var(--color-accent-gold-text);
        }

        /* ===== 品牌段 ===== */
        .hp .brand-grid { display: grid; grid-template-columns: 1fr; gap: clamp(2rem, 5svh, 3.5rem); }
        .hp .brand-note { max-width: 34rem; }
        .hp .seal { width: 44px; height: 44px; opacity: 0.6; display: block; }

        /* ===== 核心引擎 ===== */
        .hp .ink-flag { padding: clamp(1.75rem, 4vw, 3rem); margin-bottom: clamp(2rem, 5svh, 3.5rem); }
        .hp .ink-grid { display: grid; grid-template-columns: 1fr; gap: clamp(1.5rem, 4vw, 3rem); align-items: center; }
        .hp .ink-art { width: 100%; max-width: 320px; margin: 0 auto; }
        .hp .ink-copy .h2, .hp .ink-copy .body { color: #fff; }
        .hp .ink-copy .text-link { color: var(--color-accent-gold-light); }
        .hp .core-rows { border-top: var(--qn-hairline); }
        .hp .core-row {
          display: grid; grid-template-columns: 1fr; gap: 1rem;
          padding: clamp(1.25rem, 3svh, 2rem) 0; border-bottom: var(--qn-hairline);
        }
        .hp .row-pv { width: 100%; max-width: 120px; }
        .hp .row-copy { min-width: 0; }
        .hp .pv, .hp .pv svg { display: block; width: 100%; height: auto; overflow: visible; }
        .hp .pv-liuyao { display: flex; flex-direction: column; gap: 0.6rem; }
        .hp .pv-liuyao .ly-lines { position: static; }
        .hp .pv-liuyao .ly-coins {
          display: flex; justify-content: center; gap: 8%; width: 46%; margin: 0 auto;
        }
        .hp .pv-liuyao .ly-coins > span { flex: 1; display: block; }

        .hp .tools { margin-top: clamp(2.5rem, 6svh, 4rem); }
        .hp .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
        .hp .tool { border-top: 1px solid var(--color-hairline); padding-top: 1rem; }
        .hp .tool-t { font-size: var(--qn-fs-title); font-weight: 600; margin: 0 0 0.35rem; color: var(--color-text-primary); }
        .hp .tool-d { font-size: var(--qn-fs-meta); line-height: 1.7; margin: 0; color: var(--color-text-secondary); }

        /* ===== CTA ===== */
        .hp .cta-block { display: grid; grid-template-columns: 1fr; gap: clamp(1.5rem, 4svh, 2.5rem); justify-items: start; }
        .hp .cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem 2.5rem; }
        .hp .cta .body { margin: 0; }

        /* ===== Launcher ===== */
        .hp .overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 1.5rem;
          background: rgba(0,0,0,0.45);
        }
        .hp .sheet {
          position: relative; width: 100%; max-width: 440px;
          border-radius: 24px; padding: 2.5rem 2rem;
          background: var(--color-bg-card); box-shadow: 0 32px 80px rgba(0,0,0,0.16);
        }
        .hp .sheet-x {
          position: absolute; top: 1.25rem; right: 1.25rem; width: 2rem; height: 2rem;
          border: 0; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: none; color: var(--color-text-secondary);
        }
        .hp .sheet-head { text-align: center; margin-bottom: 2rem; }
        .hp .sheet-head .eyebrow { margin-bottom: 0.75rem; }
        .hp .sheet-title { font-size: var(--qn-fs-hero); margin: 0; }
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
        .hp .sheet-name { font-size: var(--qn-fs-title); margin-bottom: 1rem; }
        .hp .sheet-rule { display: block; width: 2.5rem; height: 1px; margin: 0 0 1rem; background: rgba(178,149,93,0.24); }
        .hp .sheet-desc { margin-bottom: 1.5rem; max-width: 300px; }
        .hp .sheet-go {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-size: var(--qn-fs-meta); font-weight: 600; color: var(--color-accent-gold-text);
        }
        .hp .sheet-go.is-dim { color: var(--color-text-secondary); }
        .hp .sheet-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
          width: 2rem; height: 2rem; border-radius: 999px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-bg-card); border: 0.5px solid rgba(0,0,0,0.08);
        }
        .hp .sheet-arrow-l { left: -0.75rem; }
        .hp .sheet-arrow-r { right: -0.75rem; }

        /* ---- 命中区补足到 44px。32 的图标按钮在 44 方框的四个角上根本点不到，
           而视觉尺寸 32 是这个弹窗的密度上限，不能直接放大。两个按钮本来就是
           position:absolute，::after 居中撑到 44 即可。箭头那 20px 与卡片条目的
           重叠是既有的（z-index:1 已经压着条目），扩展只是把原本死掉的区域变成可用。 ---- */
        .hp .sheet-x::after,
        .hp .sheet-arrow::after {
          content: ''; position: absolute;
          top: 50%; left: 50%; width: 44px; height: 44px;
          transform: translate(-50%, -50%);
        }

        /* ===== 动效 ===== */
        @keyframes hpFade { from { opacity: 0; transform: translate3d(0,16px,0); } to { opacity: 1; transform: none; } }
        @keyframes hpScale { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes hpSpin { to { transform: rotate(360deg); } }
        .hp .fx { animation-duration: 700ms; animation-timing-function: cubic-bezier(0.16,1,0.3,1); animation-fill-mode: both; }
        .hp .fx-stage { animation-name: hpScale; animation-duration: 1100ms; }
        .hp .fx-title { animation-name: hpFade; animation-delay: 160ms; }
        .hp .fx-sub   { animation-name: hpFade; animation-delay: 260ms; }
        .hp .fx-cta   { animation-name: hpFade; animation-delay: 360ms; }
        .hp .fx-foot  { animation-name: hpFade; animation-delay: 520ms; }
        /* transform-box:view-box 让旋转中心落在 viewBox 的几何中心（圆心就是 0,0） */
        .hp .pan-orb, .hp .pan-orb-rev { transform-box: view-box; transform-origin: 50% 50%; }
        .hp .pan-orb { animation: hpSpin 220s linear infinite; }
        .hp .pan-orb-rev { animation: hpSpin 300s linear infinite reverse; }

        /* 窄屏：品牌段保持作者写的三行节奏 */
        @media (max-width: 400px) {
          .hp .brand-note .body { font-size: var(--qn-fs-meta); }
        }

        @media (min-width: 680px) {
          .hp .core-row { grid-template-columns: 140px minmax(0, 1fr); gap: clamp(1.5rem, 4vw, 3rem); align-items: center; }
          .hp .row-pv { max-width: 140px; }
        }

        @media (min-width: 900px) {
          .hp .hero-inner { grid-template-columns: 1.05fr 0.95fr; gap: clamp(2.5rem, 6vw, 5rem); }
          .hp .hero-art { margin: 0; justify-self: end; }
          .hp .hero-copy { text-align: left; }
          .hp .hero-foot { justify-content: flex-end; }
          .hp .brand-grid { grid-template-columns: 1.1fr 0.9fr; align-items: end; }
          .hp .ink-grid { grid-template-columns: 0.85fr 1.15fr; }
          .hp .ink-art { margin: 0; }
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
