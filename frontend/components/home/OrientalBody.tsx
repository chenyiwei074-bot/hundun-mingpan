'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { HOME_FEATURED_SLUGS, INTENT_ENTRIES, LAUNCHER_SLUGS, TOOL_BY_SLUG, homeCard } from '@/lib/tools/catalog';
import type { HomeCard, ToolEntry } from '@/lib/tools/catalog';
import { isLiveEntry, STATUS_DOT } from '@/lib/tools/status';
import ModeLanding from '@/components/home/ModeLanding';

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

const INTENT_GLYPH: Record<string, string> = {
  '认识自己': 'bazi', '问一件事': 'liuyao', '择时看周期': 'huangli', '看关系': 'hepan',
};

/** 共用青铜线刻底座，中心符号按各自工具语义绘制。 */
function ModuleGlyph({ slug, className = '', size = 84 }: { slug: string; className?: string; size?: number }) {
  const starPoints = Array.from({ length: 28 }, (_, i) => {
    const a = (i * 360 / 28 - 90) * Math.PI / 180, r = i % 7 === 0 ? 35 : 31;
    return { x: R6(60 + r * Math.cos(a)), y: R6(60 + r * Math.sin(a)), active: i === 4 };
  });
  let symbol: React.ReactNode;
  switch (slug) {
    case 'bazi':
      symbol = <g><path d="M33 34 Q60 20 87 34 M33 87 Q60 100 87 87" className="glyph-line glyph-soft" />{[0, 1, 2, 3].map(i => { const x = 38 + i * 15, top = [40, 34, 45, 37][i], bottom = [81, 86, 78, 83][i]; return <g key={i}><line x1={x} y1={top + 8} x2={x} y2={bottom - 8} className={i === 2 ? 'glyph-line glyph-accent' : 'glyph-line'} /><circle cx={x} cy={top} r={5} className={i === 2 ? 'glyph-fill glyph-accent-fill' : 'glyph-fill'} /><circle cx={x} cy={bottom} r={4} className="glyph-fill glyph-ink-fill" /></g>; })}<path d="M32 60 H88" className="glyph-line glyph-soft" /></g>;
      break;
    case 'liuyao': {
      const lines = [true, false, true, true, false, true];
      symbol = <g>{lines.map((solid, i) => { const y = 27 + i * 11, active = i === 3; return <g key={i}>{solid ? <line x1="34" y1={y} x2="86" y2={y} className={active ? 'glyph-line glyph-heavy glyph-accent' : 'glyph-line'} /> : <><line x1="34" y1={y} x2="55" y2={y} className="glyph-line" /><line x1="65" y1={y} x2="86" y2={y} className="glyph-line" /></>}{active && <circle cx="92" cy={y} r="3.2" className="glyph-fill glyph-accent-fill" />}</g>; })}{[44, 60, 76].map(x => <circle key={x} cx={x} cy="96" r="3.3" className="glyph-fill glyph-coin" />)}</g>;
      break;
    }
    case 'meihua':
      symbol = <g><path d="M60 84 C55 73 68 63 60 49 C56 42 55 35 59 29 M60 67 Q47 57 41 58 M61 55 Q74 46 79 43 M58 77 Q49 74 44 77" className="glyph-line glyph-heavy" />{[0, 1, 2, 3, 4].map(i => { const a = (i * 72 - 90) * Math.PI / 180, x = R6(60 + 10 * Math.cos(a)), y = R6(35 + 10 * Math.sin(a)); return <ellipse key={i} cx={x} cy={y} rx="4.2" ry="6.1" transform={'rotate(' + (i * 72) + ' ' + x + ' ' + y + ')'} className="glyph-fill glyph-accent-fill" />; })}<circle cx="60" cy="35" r="3.2" className="glyph-fill glyph-ink-fill" />{[34, 86].map((x, side) => <g key={x}>{[0, 1, 2].map(i => { const y = 52 + i * 9; return ((i + side) % 2 === 0) ? <line key={i} x1={x - 8} y1={y} x2={x + 8} y2={y} className="glyph-line glyph-soft" /> : <g key={i}><line x1={x - 8} y1={y} x2={x - 2} y2={y} className="glyph-line glyph-soft" /><line x1={x + 2} y1={y} x2={x + 8} y2={y} className="glyph-line glyph-soft" /></g>; })}</g>)}</g>;
      break;
    case 'xiu-benming':
      symbol = <g><circle cx="60" cy="60" r="38" className="glyph-ring glyph-soft" /><circle cx="60" cy="60" r="24" className="glyph-ring glyph-soft" />{starPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.active ? 3.5 : 1.7} className={p.active ? 'glyph-fill glyph-accent-fill' : 'glyph-fill glyph-star'} />)}<path d="M60 48 L63.4 56.6 L72 60 L63.4 63.4 L60 72 L56.6 63.4 L48 60 L56.6 56.6 Z" className="glyph-star-core" /></g>;
      break;
    case 'xiu-he':
      symbol = <g><ellipse cx="47" cy="60" rx="24" ry="34" className="glyph-line glyph-soft" /><ellipse cx="73" cy="60" rx="24" ry="34" className="glyph-line glyph-accent" /><path d="M38 74 Q60 43 82 47 M38 47 Q59 77 82 73" className="glyph-line glyph-soft" />{[[37, 48], [47, 32], [56, 64], [43, 81], [69, 38], [80, 55], [74, 78]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 ? 3.2 : 2.2} className={i === 3 ? 'glyph-fill glyph-accent-fill' : 'glyph-fill glyph-star'} />)}<circle cx="60" cy="60" r="4" className="glyph-fill glyph-coin" /></g>;
      break;
    case 'hepan':
      symbol = <g><circle cx="42" cy="60" r="24" className="glyph-ring glyph-soft" /><circle cx="78" cy="60" r="24" className="glyph-ring glyph-accent" />{[[42, 42], [42, 60], [42, 78], [78, 42], [78, 60], [78, 78]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" className={i < 3 ? 'glyph-fill glyph-coin' : 'glyph-fill glyph-accent-fill'} />)}<path d="M42 42 L78 60 M42 60 L78 42 M42 78 L78 60 M50 60 H70" className="glyph-line glyph-soft" /></g>;
      break;
    case 'huangli':
      symbol = <g><rect x="32" y="34" width="56" height="53" rx="5" className="glyph-outline" /><path d="M32 47 H88 M44 29 V40 M76 29 V40" className="glyph-line glyph-heavy" /><path d="M43 58 H52 M60 58 H69 M77 58 H80 M43 71 H52 M60 71 H69 M77 71 H80" className="glyph-line glyph-soft" /><circle cx="48" cy="79" r="4" className="glyph-fill glyph-accent-fill" /><path d="M70 76 C77 70 84 78 79 84 C76 87 72 85 70 83 C73 84 76 81 76 78 C76 76 73 75 70 76Z" className="glyph-moon" /></g>;
      break;
    case 'fengshui':
      symbol = <g><rect x="32" y="32" width="56" height="56" rx="2" className="glyph-outline" /><path d="M50.7 32 V88 M69.3 32 V88 M32 50.7 H88 M32 69.3 H88" className="glyph-line glyph-soft" /><circle cx="60" cy="60" r="10" className="glyph-ring glyph-accent" /><path d="M60 43 L65 61 L60 57 L55 61 Z" className="glyph-needle" /><circle cx="60" cy="60" r="2.6" className="glyph-fill glyph-coin" /><path d="M60 21 V28 M60 92 V99 M21 60 H28 M92 60 H99" className="glyph-line glyph-accent" /></g>;
      break;
    case 'xingming':
      symbol = <g><rect x="33" y="30" width="54" height="60" rx="3" className="glyph-outline" /><rect x="40" y="37" width="40" height="46" rx="1" className="glyph-ring glyph-soft" /><path d="M60 38 V82 M41 60 H79" className="glyph-line glyph-soft" /><text x="60" y="65" textAnchor="middle" className="glyph-seal-text">名</text><circle cx="82" cy="86" r="5" className="glyph-fill glyph-accent-fill" /></g>;
      break;
    case 'dayun':
      symbol = <g><path d="M34 82 C44 74 48 68 54 65 C61 61 62 52 70 49 C77 46 81 38 87 34" className="glyph-line glyph-accent glyph-heavy" /><path d="M34 87 H88 M34 87 V34" className="glyph-line glyph-soft" />{[[38, 79], [52, 67], [67, 53], [82, 38]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5" className="glyph-fill glyph-disc" /><circle cx={x} cy={y} r="2.4" className={i === 3 ? 'glyph-fill glyph-accent-fill' : 'glyph-fill glyph-coin'} /></g>)}<path d="M80 34 L88 33 L86 41" className="glyph-line glyph-accent" /></g>;
      break;
    default:
      symbol = <g><path d="M29 43 Q44 37 60 44 V86 Q44 79 29 85 Z M91 43 Q76 37 60 44 V86 Q76 79 91 85 Z" className="glyph-outline" /><path d="M60 44 V86 M36 52 Q46 49 53 53 M36 61 Q46 58 53 62 M67 53 Q76 49 84 52 M67 62 Q76 58 84 61" className="glyph-line glyph-soft" /><circle cx="60" cy="33" r="5" className="glyph-fill glyph-accent-fill" /></g>;
  }
  return <span className={'module-glyph ' + className} style={{ width: size, height: size }} aria-hidden="true"><svg viewBox="0 0 120 120" focusable="false"><circle cx="60" cy="60" r="52" className="glyph-disc" /><circle cx="60" cy="60" r="46" className="glyph-ring" />{symbol}</svg></span>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/** 首页只留版式：每个 slug 用哪张示意图、启动器刻哪个字、按钮写什么。
 *  工具名、一句话说明、有没有入口，全部来自 lib/tools/catalog —— 首页不再自己抄一份，
 *  两份清单各自漂移（梅花那行原来就跟目录页写法不同）由 tools/directory-acceptance 判红。 */
type Skin = { go?: string };

const SKIN: Record<string, Skin> = {
  'liuyao': { go: '开始问卦' },
  'meihua': { go: '即物起卦' },
  'xiu-benming': { go: '查本命宿' },
  'huangli': { go: '查今日' },
};

const rowSkin = (slug: string): Skin => SKIN[slug] ?? {};

const ENGINES: (HomeCard & Skin)[] = HOME_FEATURED_SLUGS
  .map(s => { const c = homeCard(s); return c ? { ...c, ...rowSkin(s) } : null; })
  .filter((x): x is HomeCard & Skin => !!x);

/** 启动器轨道：没有 href 的卡片就是未开放，按目录页同一套做法渲染（无链接、无按钮、写明原因）。 */
const LAUNCHER: (HomeCard & Skin)[] = LAUNCHER_SLUGS
  .map(s => { const c = homeCard(s); return c ? { ...c, ...rowSkin(s) } : null; })
  .filter((x): x is HomeCard & Skin => !!x);

// 户型入口卡整份现读目录：名称、状态、那句隐私说明、href 都不在这里重写第二份。
// isLiveEntry 为假就不画这张卡 —— 目录哪天把它改成未开放，这里不许还留着一扇门。
const FP_TOOL = TOOL_BY_SLUG['fengshui'];
const FP_ENTRY: (ToolEntry & { href: string }) | null =
  FP_TOOL && isLiveEntry(FP_TOOL) && FP_TOOL.href ? { ...FP_TOOL, href: FP_TOOL.href } : null;

// 「即将上线」只预告目录里确实没有的东西。星座命盘这一项已经归到西方目录
// （lib/tools/western-catalog 里的 astro-natal / astro-synasty，状态未开放），
// 再在这里挂一遍就是两处各说一套 —— 用户在东方页看到"即将上线"、在西方页看到"未开放"。
/* 东方工作页的正文。原先它就是 app/page.tsx；#双体系 把 / 收成"选体系"的门廊之后，
   这一整块（首屏主视觉、四类意图、核心引擎、启动器与它自带的 .hp 作用域样式）整体搬到这里，
   由 app/oriental/page.tsx 挂上。内容一个字没删：入口仍然全部来自 lib/tools/catalog，
   页面自己不留第二份工具清单。 */
export default function OrientalBody() {
  const heroRef  = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLElement>(null);
  const coreRef  = useRef<HTMLElement>(null);
  const ctaRef   = useRef<HTMLElement>(null);

  const [showLauncher, setShowLauncher] = useState(false);

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

  // 首屏主视觉交给共用框架的 hero 槽（见 components/home/ModeLanding.tsx）：
  // 框架在它后面紧接问事框，两页的 qa.top 才是同一个数。
  // 原来这一节写着"一整屏"并吃 min-height:100dvh —— 实测把问事框顶到 y=450（375 上 782），
  // 而"问事框在首屏"是裁定的硬线，所以这里改成一条 ≤1/3 视口的窄带：
  // 圆盘留在桌面（与文字并排），窄屏让位给文字与四类意图（判据要的是意图可点，不是一张图）。
  // 同时去掉这一节里的「开始使用」大按钮与"核心引擎 ↓"那条：两者合计 ~120px，
  // 保留任何一条都会把 hero 顶出 1/3 视口；启动器仍由页尾 CTA 那一发打开（harness 点的是按钮文本，不认位置）。
  const hero = (
      <section ref={heroRef} className="hero">
        <div className="hero-noise" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-art fx fx-stage"><HeroPan /></div>
          <div className="hero-copy">
            {/* 换体系的那条路走导航（工作页导航里有「返回选择」），正文里不再重复一次：
                同一个动作出现两次，第二次就会与第一次漂移。
                旧 tagline「Ai+传统命理研究平台」退役 —— 它把站说成"AI 算命"，而这里 AI 只解释、不算命。 */}
            <h1 className="h1 fx fx-title">混沌</h1>
            <p className="hero-sub fx fx-sub">东方术数 · 风水与择时</p>
            {/* 首屏四类意图，仍在问事框之前：把意图挪到输入框下面看着更"框优先"，
                但 375 那一档会算不过来 —— 一个完整输入框（4 行 + 预留答案格 ~500px）
                加意图两行必然出折线。留在上面，靠压 hero 自己的内边距同时满足两条线：
                桌面 hero ~296px（≤1/3 视口 300）· qa.top ~312（≤360）·
                375 hero ~246（≤271）· qa.top ~262，四类意图底边 ~238 仍在屏内。 */}
            <nav className="intent-nav fx fx-cta" aria-label="按你想问的事查找">
              {INTENT_ENTRIES.map(it => (
                <Link key={it.intent} href={it.href} className="intent-item">
                  <ModuleGlyph slug={INTENT_GLYPH[it.intent] || 'tools'} className="intent-glyph" size={32} />
                  <span className="intent-copy">
                    <span className="intent-name">{it.intent}</span>
                    <span className="intent-tool">{it.tool}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>
  );

  return (
    <div className="hp">

      {/* 正文由框架给 <main>（批E 之前这里自己写了一个 main）：没有这个地标时，
          harness 的 main 区间审计是空过的 —— 字号、对比度、可点尺寸全部落在 region "other"，报告照样"全绿"。 */}
      <ModeLanding mode="oriental" shellClass="hp-shell" hero={hero}>

      {/* ════════════ 户型：独立入口卡（运维 2026-10-22 裁定 E1）════════════
          这张卡解决的是"功能在、入口无"：目录里 可用 + href=/fengshui，而东方页此前
          零个链接、正文零次提到户型，只能从页脚「全部工具与取数口径」再点一层。
          没塞进启动器那一格 —— 启动器一格说不清"上传→标注→逐条确认→规则→带标号报告"这件事，
          而这条流程正是它区别于其余工具的地方。名称/状态/那句隐私说明全部现读目录，
          这里不写第二份真相。 */}
      {FP_ENTRY && (
      <section className="band band-paper">
        <div className="wrap">
          <div className="qn-card fp-feature">
            <ModuleGlyph slug="fengshui" className="fp-feature__glyph" size={82} />
            <div className="fp-feature__copy">
              <div className="fp-feature__heading">
                <h2 className="qn-title" style={{ margin: 0 }}>{FP_ENTRY.name}</h2>
                <span className="qn-badge"><span className="qn-badge__dot" style={{ background: STATUS_DOT[FP_ENTRY.status] }} />{FP_ENTRY.status}</span>
              </div>
              <p className="qn-meta fp-feature__question">{FP_ENTRY.question}</p>
              <p className="qn-note fp-feature__note">确认朝向与房间、门窗标注后，可以查看空间关系、主要动线与采光提示；每项说明都能对应到图上的标注。</p>
              <p className="qn-cap fp-feature__privacy">上传户型图为可选；图片用途和保存方式见隐私政策。</p>
              <Link href={FP_ENTRY.href} className="qn-btn qn-btn--ghost qn-btn--block fp-feature__action">进入 · {FP_ENTRY.name}</Link>
            </div>
          </div>
        </div>
      </section>
      )}

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
              「混沌」取意于天地未判、万象初生。<br />我们把东方术数与风水中的常用方法，<br />整理成清晰易用的日常工具。
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
          <Eyebrow>东方常用工具</Eyebrow>

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
            {ENGINES.map(e => (
              <div key={e.slug} className={e.href ? 'core-row' : 'core-row is-disabled'}>
                <div className="row-pv"><ModuleGlyph slug={e.slug} className="module-glyph--card" size={76} /></div>
                <div className="row-copy">
                  <h3 className="h3">{e.title}</h3>
                  <p className="body muted">{e.href ? e.teaser : '这项功能仍在整理中，暂未开放。'}</p>
                  {e.href
                    ? <Link href={e.href} className="text-link">{e.go} <span aria-hidden="true">→</span></Link>
                    : <span className="tag">暂未开放</span>}
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: '18px 0 0' }}>
            <Link href="/tools" className="text-link">查看全部东方工具 <span aria-hidden="true">→</span></Link>
          </p>
        </div>
      </section>

      {/* ════════════ CTA ════════════ */}
      <section ref={ctaRef} className="band band-paper cta">
        <div className="wrap cta-block">
          <h2 className="h2">从一个问题<br />开始探索</h2>
          <div className="cta-row">
            <p className="body">选择一项工具，继续探索命盘、卦象、择时与关系。</p>
            <button onClick={() => { window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' }); setTimeout(() => setShowLauncher(true), prefersReduced() ? 0 : 600) }}
              className="btn-primary">
              选择工具 <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      </ModeLanding>

      {/* ════════════ LAUNCHER MODAL ════════════ */}
      {showLauncher && (
        <div className="overlay" onClick={() => setShowLauncher(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLauncher(false)} className="sheet-x" aria-label="关闭">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
            </button>

            <div className="sheet-head">
              <p className="eyebrow center">东方术数与风水</p>
              <h2 className="h2 sheet-title">选择想了解的方向</h2>
            </div>

            <div className="sheet-body">
              <button onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollBy({left:-340,behavior: prefersReduced() ? 'auto' : 'smooth'}) }}
                className="sheet-arrow sheet-arrow-l" aria-label="上一个">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M10 3l-5 5 5 5"/></svg>
              </button>

              {/* data-vh-scroll：这条横向轨永远溢出容器（7 张卡 × 100%），显式声明它的可滚动
                  凭据是左右两个箭头按钮，视觉验收 harness 据此放行；没有声明的溢出会被判失败。 */}
              <div id="ls" className="sheet-track" data-vh-scroll="arrows">
                {LAUNCHER.map(item => {
                  const body = (
                    <>
                      <ModuleGlyph slug={item.slug} className="sheet-symbol" size={66} />
                      <h3 className="h3 sheet-name">{item.title}</h3>
                      {item.href ? <span className="sheet-rule" /> : <span className="tag">未开放</span>}
                      <p className="body muted sheet-desc">{item.href ? item.teaser : '这项功能仍在整理中，暂未开放。'}</p>
                      <span className={item.href ? 'sheet-go' : 'sheet-go is-dim'}>
                        {item.href ? '进入' : '未开放'}
                        {item.href && <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>}
                      </span>
                    </>
                  );
                  return item.href
                    ? <Link key={item.slug} href={item.href} onClick={() => setShowLauncher(false)} className="sheet-item">{body}</Link>
                    : <div key={item.slug} className="sheet-item is-soon" aria-disabled="true">{body}</div>;
                })}
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

        /* ===== 首屏：一条窄带，不再是一整屏 =====
           原来 min-height:100dvh + align-content:center 把问事框顶到 y=450（375 上 782）。
           裁定 E1 要"问事框顶边 ≤360 且 hero ≤1/3 视口"，两条同时成立只能靠收紧这一节的
           内边距：「混沌」必须留在字号梯的 display 那一阶（桌面 88 / 窄屏 44）——
           我之前试过去 64px，被字号梯判红（梯只认 token 定义的级），那才是对的结果。
           圆盘桌面与文字并排（不额外加高），窄屏让位给文字与四类意图。 */
        .hp .hero {
          position: relative; overflow: hidden;
          display: flex; flex-direction: column;
          padding: calc(var(--qn-nav-h) + 2px) 1.5rem 6px;
          background: linear-gradient(180deg, var(--color-bg-card) 0%, #fafaf8 100%);
        }
        @media (max-width: 699px) {
          /* 整块圆盘在 375 上比标题加四类意图还高，留着就把问事框挤出首屏。
             圆盘不删 —— 核心引擎那一节它还会出现一次，首屏让路给可点的入口。 */
          .hp .hero-art { display: none; }
          /* 同理副标题（26px 一行 + 行距 = 36px）：375 那一档 1/3 视口只有 271px，
             标题(46) + 意图两行(96) + 内边距(64) 已经 206，加上它就 284 超线。

          /* 2026-10-22 裁定：装饰可以让位，说明不许消失。375 上把副标题降到 meta 档一行
             （13px，约 20px），hero 仍在 1/3 视口线内；不整条隐藏。 */
          .hp .hero-copy .hero-sub {
            display: block;
            font-size: var(--qn-fs-meta);
            line-height: 1.4;
            margin: 0.1rem 0 0;
            letter-spacing: 0.04em;
          }
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
        /* 圆盘按"高度 ≤1/3 视口减掉文字那一列"来给：原来是 min(500px, 74svh)，
           在一整屏的 hero 里没问题，收成窄带之后它自己就能把 hero 顶到 500+。 */
        .hp .hero-art { width: 100%; max-width: 200px; margin: 0 auto; }
        .hp .pan { display: block; width: 100%; height: auto; overflow: visible; }
        .hp .hero-copy { text-align: center; }
        /* 四类意图入口：两列，窄屏也放得下；每项 ≥44px 可点高度。 */
        .hp .intent-nav {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px; margin-top: 10px;
        }
        .hp .intent-item {
          display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 54px;
          padding: 8px 10px; border-radius: 12px; text-align: left; text-decoration: none;
          background: color-mix(in srgb, var(--color-bg-primary) 72%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-gold-text) 15%, transparent), 0 3px 9px rgba(34,25,15,.035);
          transition: transform .22s ease, box-shadow .22s ease, background-color .22s ease;
        }
        .hp .intent-item:hover { transform: translateY(-2px); background: var(--color-bg-card); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-gold-text) 44%, transparent), 0 8px 18px rgba(34,25,15,.07); }
        .hp .intent-item:focus-visible, .hp .core-row a:focus-visible, .hp .fp-feature a:focus-visible { outline: 2px solid var(--color-accent-gold-text); outline-offset: 3px; }
        .hp .intent-glyph { width: 32px !important; height: 32px !important; }
        .hp .intent-copy { display: grid; gap: 2px; min-width: 0; }
        .hp .intent-name { font-size: var(--qn-fs-meta); font-weight: 600; letter-spacing: .03em; color: var(--color-text-primary); }
        .hp .intent-tool { font-size: var(--qn-fs-eyebrow); line-height: 1.35; color: var(--color-text-secondary); }

        /* ===== 版面 ===== */
        .hp .band { padding: clamp(3.25rem, 7svh, 5.25rem) 1.5rem; }
        .hp .band-paper { background: var(--color-bg-primary); }
        .hp .band-white { background: var(--color-bg-card); }
        .hp .brand, .hp .core, .hp .cta { scroll-margin-top: var(--qn-nav-h); }
        .hp .wrap { max-width: 1120px; margin: 0 auto; }

        /* ===== 字 ===== */
        .hp .eyebrow {
          font-size: var(--qn-fs-eyebrow); font-weight: 600; letter-spacing: .20em;
          color: var(--color-accent-gold-text); margin: 0 0 1.35rem; text-align: left;
        }
        .hp .eyebrow.center { text-align: center; }
        .hp .h1 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: var(--qn-fs-display); font-weight: 600; line-height: 1.05;
          letter-spacing: 0.06em; margin: 0; color: var(--color-text-primary);
        }
        .hp .h2 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: 36px; font-weight: 600; line-height: 1.28;
          letter-spacing: 0.02em; margin: 0; color: var(--color-text-primary);
        }
        .hp .h3 {
          font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif;
          font-size: 21px; font-weight: 600; line-height: 1.35;
          letter-spacing: 0.01em; margin: 0 0 0.45rem; color: var(--color-text-primary);
        }
        .hp .body { font-size: 14px; line-height: 1.7; margin: 0 0 .8rem; max-width: 34rem; }
        .hp .muted { color: var(--color-text-secondary); }
        .hp .hero-sub { font-size: var(--qn-fs-hero); line-height: 1.2; margin: 0.3rem 0 0; color: var(--color-text-secondary); }
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
        .hp .ink-flag { padding: clamp(1.25rem, 3vw, 2rem); margin-bottom: clamp(1.25rem, 3svh, 2rem); border-radius: 20px; }
        .hp .ink-grid { display: grid; grid-template-columns: 1fr; gap: clamp(1rem, 3vw, 2rem); align-items: center; }
        .hp .ink-art { width: 100%; max-width: 240px; margin: 0 auto; }
        .hp .ink-copy .h2 { font-size: 28px; }
        .hp .ink-copy .body { max-width: 42rem; }
        .hp .ink-copy .h2, .hp .ink-copy .body { color: #fff; }
        .hp .ink-copy .text-link { color: var(--color-accent-gold-light); }
        .hp .core-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .hp .core-row {
          display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 14px; align-items: center;
          min-width: 0; padding: 16px; border: 1px solid color-mix(in srgb, var(--color-accent-gold-text) 14%, var(--color-hairline));
          border-radius: 18px; background: linear-gradient(145deg, var(--color-bg-card), color-mix(in srgb, var(--color-bg-primary) 64%, var(--color-bg-card)));
          box-shadow: 0 4px 14px rgba(34,25,15,.04), inset 0 1px 0 rgba(255,255,255,.76);
          transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease;
        }
        .hp .core-row:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--color-accent-gold-text) 36%, var(--color-hairline)); box-shadow: 0 12px 26px rgba(34,25,15,.09), inset 0 1px 0 rgba(255,255,255,.86); }
        .hp .core-row:hover .module-glyph { transform: perspective(700px) rotateX(5deg) rotateY(-8deg) translateY(-1px) scale(1.035); }
        .hp .intent-item:active { transform: translateY(0) scale(.99); }
        .hp .core-row.is-disabled { background: color-mix(in srgb, var(--color-bg-primary) 74%, var(--color-bg-card)); box-shadow: none; }
        .hp .core-row.is-disabled .module-glyph { opacity: .62; }
        .hp .row-pv { width: 76px; height: 76px; display: grid; place-items: center; }
        .hp .row-copy { min-width: 0; }
        .hp .row-copy .h3 { margin-bottom: 5px; }
        .hp .row-copy .body { max-width: none; margin-bottom: 4px; font-size: 14px; line-height: 1.55; }
        .hp .pv, .hp .pv svg { display: block; width: 100%; height: auto; overflow: visible; }
        .hp .module-glyph { display: block; flex: 0 0 auto; perspective: 700px; transition: transform .28s cubic-bezier(.2,.7,.2,1), opacity .2s ease; }
        .hp .module-glyph svg { display: block; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 7px 7px rgba(53,39,20,.13)); }
        .hp .glyph-disc { fill: color-mix(in srgb, var(--color-accent-gold) 8%, var(--color-bg-primary)); stroke: color-mix(in srgb, var(--color-accent-gold) 48%, transparent); stroke-width: 1; }
        .hp .glyph-ring { fill: none; stroke: color-mix(in srgb, var(--color-accent-gold-text) 58%, transparent); stroke-width: 1; stroke-dasharray: 1.2 3.6; }
        .hp .glyph-outline { fill: none; stroke: var(--color-accent-gold-text); stroke-width: 1.4; stroke-linejoin: round; }
        .hp .glyph-line { fill: none; stroke: var(--color-accent-gold-text); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
        .hp .glyph-heavy { stroke-width: 2.2; }
        .hp .glyph-soft { opacity: .58; }
        .hp .glyph-accent { stroke: var(--color-accent-gold); opacity: .95; }
        .hp .glyph-fill { fill: var(--color-accent-gold-text); }
        .hp .glyph-accent-fill { fill: var(--color-accent-gold); }
        .hp .glyph-ink-fill { fill: var(--color-text-primary); opacity: .72; }
        .hp .glyph-coin { fill: color-mix(in srgb, var(--color-accent-gold) 70%, var(--color-accent-gold-text)); stroke: var(--color-bg-primary); stroke-width: 1; }
        .hp .glyph-star { fill: color-mix(in srgb, var(--color-accent-gold-text) 70%, var(--color-bg-card)); }
        .hp .glyph-star-core { fill: color-mix(in srgb, var(--color-accent-gold) 38%, transparent); stroke: var(--color-accent-gold-text); stroke-width: .8; }
        .hp .glyph-moon { fill: var(--color-accent-gold-text); }
        .hp .glyph-needle { fill: var(--color-accent-gold); stroke: var(--color-accent-gold-text); stroke-width: .7; stroke-linejoin: round; }
        .hp .glyph-seal-text { fill: var(--color-accent-gold-text); font: 600 18px "Noto Serif SC", "Source Han Serif SC", serif; }

        .hp .fp-feature { display: grid; grid-template-columns: 82px minmax(0, 1fr); align-items: start; gap: 18px; padding: clamp(16px, 3vw, 24px); border-radius: 20px; }
        .hp .fp-feature__copy { min-width: 0; }
        .hp .fp-feature__heading { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .hp .fp-feature__question, .hp .fp-feature__note, .hp .fp-feature__privacy { margin: 7px 0 0; }
        .hp .fp-feature__action { margin-top: 12px; }
        .hp .tools { margin-top: clamp(2rem, 5svh, 3.25rem); }
        .hp .tools-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
        .hp .tool { border-top: 1px solid var(--color-hairline); padding-top: .8rem; }
        .hp .tool-t { font-size: 16px; font-weight: 600; margin: 0 0 .35rem; color: var(--color-text-primary); }
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
        .hp .sheet-symbol { margin-bottom: 1rem; }
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
        /* transform-box:view-box 让旋转中心落在 viewBox 的几何中心（圆心就是 0,0） */
        .hp .pan-orb, .hp .pan-orb-rev { transform-box: view-box; transform-origin: 50% 50%; }
        .hp .pan-orb { animation: hpSpin 220s linear infinite; }
        .hp .pan-orb-rev { animation: hpSpin 300s linear infinite reverse; }

        /* 窄屏：品牌段保持作者写的三行节奏 */
        @media (max-width: 400px) {
          .hp .brand-note .body { font-size: var(--qn-fs-meta); }
        }

        @media (max-width: 699px) {
          .hp .h2 { font-size: 30px; }
          .hp .h3 { font-size: 19px; }
          .hp .band { padding: 3rem 1rem; }
          .hp .core-rows { grid-template-columns: 1fr; gap: 10px; }
          .hp .core-row { grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding: 13px; border-radius: 15px; }
          .hp .row-pv { width: 64px; height: 64px; }
          .hp .fp-feature { grid-template-columns: 56px minmax(0, 1fr); gap: 12px; }
          .hp .fp-feature__glyph { width: 56px !important; height: 56px !important; }
          .hp .fp-feature__action { grid-column: 1 / -1; }
        }

        @media (min-width: 680px) {
          .hp .core-row { gap: 12px; padding: 14px; }
        }

        @media (min-width: 900px) {
          .hp .core-rows { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .hp .hero-inner { grid-template-columns: 1.05fr 0.95fr; gap: clamp(2.5rem, 6vw, 5rem); }
          /* 宽屏把四类意图摊成一行：两行 2×2 时文案列高 234，加内边距正好把 hero 顶到 330，
             超开 1/3 视口那条线（300）。摊开之后文案列 ~182，hero ~246 ——
             动的是排列，不是砍掉副标题或压缩行距那种"挤"。窄屏仍按 2×2（一行放不下四个）。 */
          .hp .intent-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .hp .hero-art { margin: 0; justify-self: end; }
          .hp .hero-copy { text-align: left; }
          .hp .brand-grid { grid-template-columns: 1.1fr 0.9fr; align-items: end; }
          .hp .ink-grid { grid-template-columns: .7fr 1.3fr; }
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
