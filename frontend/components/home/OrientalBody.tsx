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

/* 梅花示意：画的是观梅占（辰年十二月十七日申时）得泽火革，初爻动 —— 
   这一卦同时是 engine 的验收金标准，示意图和算法对得上。动爻用深金加粗。 */
function MeiHuaPreview() {
  const lines = [1, 0, 1, 1, 1, 0];
  const dong = 1;
  return (
    <div className="pv">
      <svg viewBox="0 0 200 90">
        {lines.map((v, i) => {
          const y = 8 + (5 - i) * 13;
          const on = i + 1 === dong;
          const stroke = on ? goldDeep : gold;
          const w = on ? 2.4 : 1.4;
          const op = on ? 0.95 : 0.5;
          if (v === 1) {
            return <line key={i} x1={4} y1={y} x2={196} y2={y} stroke={stroke} strokeWidth={w} opacity={op} />;
          }
          return (<g key={i}>
            <line x1={4} y1={y} x2={92} y2={y} stroke={stroke} strokeWidth={w} opacity={op} />
            <line x1={108} y1={y} x2={196} y2={y} stroke={stroke} strokeWidth={w} opacity={op} />
          </g>);
        })}
      </svg>
    </div>
  );
}

/* 二十八宿直日表示意：四象各 7 宿铺成 4×7，金框即当日值宿。
   宿名走 SVG 文字，不进正文阶梯（与其余 preview 同一处理）。 */
function XiuPreview() {
  const zi = ['角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁',
    '奎', '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸'];
  const active = 4;
  const cw = 24, ch = 22, gx = 2, gy = 3;
  return (
    <div className="pv">
      <svg viewBox="0 0 182 97">
        {zi.map((c, i) => {
          const x = (i % 7) * (cw + gx);
          const y = Math.floor(i / 7) * (ch + gy);
          const on = i === active;
          return (
            <g key={c}>
              <rect x={x} y={y} width={cw} height={ch} rx={3}
                fill={on ? 'rgba(178,149,93,0.18)' : 'none'}
                stroke={on ? goldDeep : gold} strokeWidth={on ? 1.4 : 0.6} opacity={on ? 0.95 : 0.3} />
              <text x={x + cw / 2} y={y + ch / 2 + 4} textAnchor="middle" fontSize="11"
                fontFamily="serif" fill={on ? goldDeep : inkH} opacity={on ? 1 : 0.5}>{c}</text>
            </g>
          );
        })}
      </svg>
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

/** 首页只留版式：每个 slug 用哪张示意图、启动器刻哪个字、按钮写什么。
 *  工具名、一句话说明、有没有入口，全部来自 lib/tools/catalog —— 首页不再自己抄一份，
 *  两份清单各自漂移（梅花那行原来就跟目录页写法不同）由 tools/directory-acceptance 判红。 */
type Skin = { pv?: 'liuyao' | 'meihua' | 'xiu' | 'hepan' | 'zeri'; zi: string; go?: string };

const SKIN: Record<string, Skin> = {
  'liuyao':      { pv: 'liuyao', zi: '爻', go: '开始问卦' },
  'meihua':      { pv: 'meihua', zi: '梅', go: '即物起卦' },
  'xiu-benming': { pv: 'xiu',    zi: '宿', go: '查本命宿' },
  'hepan':       { pv: 'hepan',  zi: '合', go: '查看关系结构' },
  'xingming':    { pv: 'hepan',  zi: '合' },
  'huangli':     { pv: 'zeri',   zi: '历', go: '查今日' },
  'bazi':        { zi: '命' },
  'tools':       { zi: '箱' },
};

const rowSkin = (slug: string): Skin => SKIN[slug] ?? { zi: '?' };

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
const SOON = [
  { t: "面相", d: "观察面部特征与传统相法的象征说法" },
  { t: "手相", d: "认识主要掌纹与传统手相文化" },
];

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
            <p className="hero-sub fx fx-sub">东方术数 · 工具箱</p>
            {/* 首屏四类意图，仍在问事框之前：把意图挪到输入框下面看着更"框优先"，
                但 375 那一档会算不过来 —— 一个完整输入框（4 行 + 预留答案格 ~500px）
                加意图两行必然出折线。留在上面，靠压 hero 自己的内边距同时满足两条线：
                桌面 hero ~296px（≤1/3 视口 300）· qa.top ~312（≤360）·
                375 hero ~246（≤271）· qa.top ~262，四类意图底边 ~238 仍在屏内。 */}
            <nav className="intent-nav fx fx-cta" aria-label="按你想问的事查找">
              {INTENT_ENTRIES.map(it => (
                <Link key={it.intent} href={it.href} className="intent-item">
                  <span className="intent-name">{it.intent}</span>
                  <span className="intent-tool">{it.tool}</span>
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
          <div className="qn-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="qn-title" style={{ margin: 0 }}>{FP_ENTRY.name}</h2>
              <span className="qn-badge">
                <span className="qn-badge__dot" style={{ background: STATUS_DOT[FP_ENTRY.status] }} />
                {FP_ENTRY.status}
              </span>
            </div>
            <p className="qn-meta" style={{ marginTop: 8, marginBlockEnd: 0 }}>{FP_ENTRY.question}</p>
            <p className="qn-note" style={{ margin: '8px 0 0' }}>
              五步走：选图或拍图 → 识别出墙与门窗 → 你逐条确认（没确认的一律画虚线）→
              规则层按九宫推 → 每条判定都指回图上的标号。朝向没确认时日照那一层不出判定。
            </p>
            <p className="qn-cap" style={{ margin: '8px 0 0' }}>{FP_ENTRY.note}</p>
            <Link href={FP_ENTRY.href} className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 12 }}>
              进入 · {FP_ENTRY.name}
            </Link>
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
              「混沌」之名，取自道家宇宙观。<br />天地未分，元气未判。混沌自研 AI 辅助研读传统术数，<br />让传统智慧更易理解。
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
            {ENGINES.map(e => (
              <div key={e.slug} className="core-row">
                <div className="row-pv">
                  {e.pv === 'liuyao' && <LiuYaoPreview />}
                  {e.pv === 'meihua' && <MeiHuaPreview />}
                  {e.pv === 'xiu' && <XiuPreview />}
                  {e.pv === 'hepan' && <HePanPreview />}
                  {e.pv === 'zeri' && <ZeRiPreview />}
                </div>
                <div className="row-copy">
                  <h3 className="h3">{e.title}</h3>
                  <p className="body muted">{e.teaser}</p>
                  {e.href
                    ? <Link href={e.href} className="text-link">{e.go} <span aria-hidden="true">→</span></Link>
                    : <span className="tag">未开放</span>}
                </div>
              </div>
            ))}
          </div>

          <p style={{ margin: '18px 0 0' }}>
            <Link href="/tools" className="text-link">全部工具与取数口径 <span aria-hidden="true">→</span></Link>
          </p>

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

      </ModeLanding>

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

              {/* data-vh-scroll：这条横向轨永远溢出容器（7 张卡 × 100%），显式声明它的可滚动
                  凭据是左右两个箭头按钮，视觉验收 harness 据此放行；没有声明的溢出会被判失败。 */}
              <div id="ls" className="sheet-track" data-vh-scroll="arrows">
                {LAUNCHER.map(item => {
                  const body = (
                    <>
                      <svg viewBox="0 0 72 72" className="sheet-zi">
                        <rect x="1" y="1" width="70" height="70" rx="8" fill="none" stroke={gold} strokeWidth="1.2" opacity="0.35" />
                        <text x="36" y="50" textAnchor="middle" fill={goldDeep} fontSize="32" fontWeight="700" fontFamily="serif">{item.zi}</text>
                      </svg>
                      <h3 className="h3 sheet-name">{item.title}</h3>
                      {item.href ? <span className="sheet-rule" /> : <span className="tag">未开放</span>}
                      <p className="body muted sheet-desc">{item.teaser}</p>
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
          display: grid; gap: 2px; align-content: center; text-align: left;
          min-height: 44px; padding: 8px 12px; border-radius: 10px; text-decoration: none;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.09);
        }
        .hp .intent-item:hover { box-shadow: inset 0 0 0 1px rgba(178, 149, 93, 0.55); }
        .hp .intent-name { font-size: var(--qn-fs-body); font-weight: 600; letter-spacing: 0.06em; color: var(--color-text-primary); }
        .hp .intent-tool { font-size: var(--qn-fs-meta); color: var(--color-text-primary); opacity: 0.78; }

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
          min-height: 44px; padding: 0 0.4rem; margin: 0;
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
          /* 宽屏把四类意图摊成一行：两行 2×2 时文案列高 234，加内边距正好把 hero 顶到 330，
             超开 1/3 视口那条线（300）。摊开之后文案列 ~182，hero ~246 ——
             动的是排列，不是砍掉副标题或压缩行距那种"挤"。窄屏仍按 2×2（一行放不下四个）。 */
          .hp .intent-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .hp .hero-art { margin: 0; justify-self: end; }
          .hp .hero-copy { text-align: left; }
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
