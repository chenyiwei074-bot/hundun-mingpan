// 门廊：只回答一个问题 —— 你要用哪一套体系。两栏铺满首屏，整栏就是链接。
//
// 栏内不许再嵌任何可点元素（裁定 ①）：一个 <a> 里再放 <a> 或 <button>，键盘要走两遍
// 同一块地方，读屏软件报出来的层级也是假的。/tools 那条链接因此从门廊搬走了，
// 改挂在两页工作页的页脚。

import Link from 'next/link';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import type { IntentGroup } from '@/lib/tools/catalog';
import { isLiveEntry } from '@/lib/tools/status';

// 装饰只做"这一侧是谁"的形状，不参与阅读：全部 aria-hidden、pointer-events:none，
// 描边走低透明度，绝不用来承托文字（文字底下变浅变深都会改对比度）。
function HexagramArt() {
  return (
    <svg width="320" height="320" viewBox="0 0 320 320" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="east-bronze" cx="34%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#f4e5b9" />
          <stop offset="24%" stopColor="#c4a66b" />
          <stop offset="58%" stopColor="#866a3c" />
          <stop offset="100%" stopColor="#4d402d" />
        </radialGradient>
        <radialGradient id="east-stone" cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="100%" stopColor="#d9d0bd" />
        </radialGradient>
        <filter id="east-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#30251a" floodOpacity="0.24" />
        </filter>
      </defs>
      <ellipse cx="170" cy="266" rx="112" ry="22" fill="#342719" opacity="0.18" />
      <g filter="url(#east-shadow)" transform="translate(166 146) rotate(-18)">
        <ellipse cy="28" rx="126" ry="104" fill="#453b2e" opacity="0.72" />
        <ellipse cy="12" rx="124" ry="103" fill="url(#east-bronze)" stroke="#55442b" strokeWidth="5" />
        <ellipse cy="10" rx="108" ry="88" fill="url(#east-stone)" stroke="#f0dfb4" strokeWidth="2" />
        <ellipse cy="10" rx="91" ry="72" stroke="#866a3c" strokeWidth="1.5" opacity="0.72" />
        <ellipse cy="10" rx="74" ry="58" stroke="#9b8154" strokeWidth="1" opacity="0.56" />
        <path d="M-102 10H102M0-79V99M-71-42L71 62M71-42L-71 62" stroke="#9b8154" strokeWidth="1" opacity="0.28" />
        <g stroke="#725b38" strokeLinecap="round" opacity="0.72">
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i * Math.PI) / 12;
            const x1 = Math.cos(angle) * 96;
            const y1 = 10 + Math.sin(angle) * 77;
            const x2 = Math.cos(angle) * (i % 3 === 0 ? 108 : 102);
            const y2 = 10 + Math.sin(angle) * (i % 3 === 0 ? 87 : 82);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 === 0 ? 2 : 1} />;
          })}
        </g>
        <circle cy="10" r="42" fill="#ece2ce" stroke="#8a7045" strokeWidth="2" />
        <path d="M0-35C20-35 35-20 35 0C35 20 20 35 0 35C-20 35-35 20-35 0C-35-20-20-35 0-35Z" fill="#f7f0df" />
        <path d="M0-35C-8-21-8-10 0 0C8 10 8 21 0 35C20 35 35 20 35 0C35-20 20-35 0-35Z" fill="#4d4638" />
        <circle cy="-17" r="5" fill="#4d4638" />
        <circle cy="17" r="5" fill="#f7f0df" />
        <circle cy="10" r="42" stroke="#fffaf0" strokeWidth="1" opacity="0.76" />
      </g>
      <g transform="translate(248 214) rotate(18)" fill="#7a5f31" opacity="0.72">
        <path d="M0-35L6-6L0 0L-6-6Z" />
        <path d="M0 35L-6 6L0 0L6 6Z" opacity="0.52" />
        <circle r="5" fill="#d0b780" />
      </g>
    </svg>
  );
}

function EclArt() {
  return (
    <svg width="320" height="320" viewBox="0 0 320 320" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="west-metal" cx="30%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#f4e7c1" />
          <stop offset="26%" stopColor="#c8ad72" />
          <stop offset="65%" stopColor="#806b4b" />
          <stop offset="100%" stopColor="#352a48" />
        </radialGradient>
        <radialGradient id="west-moon" cx="30%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#fff9e9" />
          <stop offset="45%" stopColor="#d8c6a2" />
          <stop offset="100%" stopColor="#9280a8" />
        </radialGradient>
        <filter id="west-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="20" stdDeviation="16" floodColor="#080314" floodOpacity="0.52" />
        </filter>
      </defs>
      <ellipse cx="161" cy="264" rx="112" ry="19" fill="#080314" opacity="0.4" />
      <g filter="url(#west-shadow)" transform="translate(160 150) rotate(-22)">
        <circle r="116" fill="#211936" stroke="url(#west-metal)" strokeWidth="12" />
        <circle r="101" fill="#241a3d" stroke="#d9b877" strokeWidth="1.5" opacity="0.92" />
        <circle r="82" stroke="#d9b877" strokeWidth="1" opacity="0.58" />
        <ellipse rx="110" ry="43" stroke="#e3d2ac" strokeWidth="5" opacity="0.72" transform="rotate(48)" />
        <ellipse rx="109" ry="38" stroke="#d9b877" strokeWidth="3" opacity="0.68" transform="rotate(-56)" />
        <ellipse rx="102" ry="31" stroke="#a89abf" strokeWidth="2" opacity="0.66" transform="rotate(8)" />
        <g stroke="#e7d5ad" strokeLinecap="round" opacity="0.75">
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i * Math.PI) / 12;
            const x1 = Math.cos(angle) * 88;
            const y1 = Math.sin(angle) * 88;
            const x2 = Math.cos(angle) * (i % 3 === 0 ? 102 : 96);
            const y2 = Math.sin(angle) * (i % 3 === 0 ? 102 : 96);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 3 === 0 ? 2 : 1} />;
          })}
        </g>
        <circle r="46" fill="url(#west-moon)" stroke="#f2e2bf" strokeWidth="2" />
        <path d="M10-43C-11-28-18-4-8 17C1 36 21 45 37 39C50 12 38-27 10-43Z" fill="#80738f" opacity="0.74" />
        <circle r="46" stroke="#fff7e5" strokeWidth="1" opacity="0.75" />
        <circle cx="-13" cy="-12" r="4" fill="#8d7b62" opacity="0.55" />
        <circle cx="17" cy="14" r="6" fill="#8d7b62" opacity="0.34" />
      </g>
      <circle cx="247" cy="84" r="7" fill="#e9d6aa" opacity="0.86" />
      <circle cx="247" cy="84" r="15" stroke="#d9b877" strokeWidth="1" opacity="0.42" />
    </svg>
  );
}

interface Entry {
  href: string;
  mode: 'oriental' | 'western';
  name: string;
  lead: string;
  cta: string;
  groups: IntentGroup[];
  art: React.ReactNode;
}

const ENTRIES: Entry[] = [
  {
    href: '/oriental', mode: 'oriental',
    name: '东方术数',
    lead: '从八字、六爻到风水，在传统体系中寻找问题的脉络。',
    cta: '进入东方世界 →',
    groups: INTENTS,
    art: <HexagramArt />,
  },
  {
    href: '/western', mode: 'western',
    name: '西方神秘学',
    lead: '循西方神秘学自身的知识与方法，不与东方术数混用；每项工具都写明适用范围与依据。',
    cta: '进入西方世界 →',
    groups: WESTERN_INTENTS,
    art: <EclArt />,
  },
];

// 体系卡片只列实际有入口的工具名称；这行是内容提示，不展示内部状态或开放数量。
const eyebrowLine = (groups: typeof INTENTS): string => {
  const open = groups.flatMap(g => g.tools).filter(isLiveEntry).map(t => t.name);
  if (!open.length) return '进入后查看本体系工具';
  // 分隔符用「、」不用「 · 」：条目名自己就带「 · 」（「二十八宿 · 本命宿」「西洋占星 · 合盘」），
  // 用「 · 」当列表分隔会把三个名字读成四个 —— 分隔符不能出现在被分隔的数据里。
  return open.join('、');
};

export default function GatePage() {
  return (
    <main className="gate-shell" data-mode="gate">
      <header className="gate-head qn-rise">
        <p className="qn-eyebrow">混沌 · 两套体系</p>
        <h1 className="qn-hero">先选一套体系</h1>
        {/* 运维 2026-10-21 补的一行：站是干什么的，得在门廊就说清，不靠页面标题去猜。 */}
        <p className="gate-head__tagline">东方术数与风水 · 西方神秘学工具箱</p>
        <p className="gate-head__note">
          东方与西方各有自己的知识体系与表达方式，混沌自研 AI 辅助解读与引导。
        </p>
      </header>

      <div className="gate-grid">
        {ENTRIES.map(e => {
          return (
            <Link key={e.href} href={e.href} className="domain-card" data-mode={e.mode}>
              <span className="domain-card__veil" aria-hidden="true" />
              <span className="domain-card__art" aria-hidden="true">{e.art}</span>
              <div className="domain-card__copy">
                <p className="qn-eyebrow">{eyebrowLine(e.groups)}</p>
                <h2 className="domain-card__title">{e.name}</h2>
                <p className="qn-body">{e.lead}</p>
                <p className="domain-card__cta">{e.cta}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="qn-legal gate-legal">
        <p className="qn-note" style={{ margin: 0 }}>
          各体系工具、支持范围与使用说明，可进入对应页面查看。
        </p>
      </section>
    </main>
  );
}
