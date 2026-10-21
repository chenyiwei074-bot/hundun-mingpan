// 门廊：只回答一个问题 —— 你要用哪一套体系。两栏铺满首屏，整栏就是链接。
//
// 这里刻意不放工具清单，也不写工具名：工具与状态只有一个事实源
// （lib/tools/catalog.ts 与 lib/tools/western-catalog.ts，状态与计数在 lib/tools/status.ts）。
// 门廊一旦抄一份，目录改了这边就会说谎；所以栏底那三个数是现算出来的。
//
// 栏内不许再嵌任何可点元素（裁定 ①）：一个 <a> 里再放 <a> 或 <button>，键盘要走两遍
// 同一块地方，读屏软件报出来的层级也是假的。/tools 那条链接因此从门廊搬走了，
// 改挂在两页工作页的页脚。

import Link from 'next/link';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import type { IntentGroup } from '@/lib/tools/catalog';
import { statusCounts, statusTally } from '@/lib/tools/status';

// 装饰只做"这一侧是谁"的形状，不参与阅读：全部 aria-hidden、pointer-events:none，
// 描边走低透明度，绝不用来承托文字（文字底下变浅变深都会改对比度）。
function HexagramArt() {
  return (
    <svg width="84" height="96" viewBox="0 0 84 96" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5" opacity="0.22">
        <line x1="4" y1="10" x2="80" y2="10" />
        <line x1="4" y1="30" x2="34" y2="30" />
        <line x1="50" y1="30" x2="80" y2="30" />
        <line x1="4" y1="50" x2="80" y2="50" />
        <line x1="4" y1="70" x2="34" y2="70" />
        <line x1="50" y1="70" x2="80" y2="70" />
        <line x1="4" y1="90" x2="80" y2="90" />
      </g>
    </svg>
  );
}

function EclArt() {
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" fill="none" aria-hidden="true">
      <circle cx="52" cy="52" r="48" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="52" cy="52" r="30" stroke="currentColor" strokeWidth="1" opacity="0.13" />
      <g stroke="currentColor" strokeWidth="2" opacity="0.3">
        <line x1="52" y1="4" x2="52" y2="12" />
        <line x1="100" y1="52" x2="92" y2="52" />
        <line x1="52" y1="100" x2="52" y2="92" />
        <line x1="4" y1="52" x2="12" y2="52" />
      </g>
      <circle cx="82" cy="26" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

interface Entry {
  href: string;
  mode: 'oriental' | 'western';
  eyebrow: string;
  name: string;
  lead: string;
  cta: string;
  groups: IntentGroup[];
  art: React.ReactNode;
}

const ENTRIES: Entry[] = [
  {
    href: '/oriental', mode: 'oriental',
    eyebrow: '八字 · 六爻 · 风水',
    name: '东方玄学',
    lead: '从八字、六爻到风水，在传统体系中寻找问题的脉络。',
    cta: '进入东方世界 →',
    groups: INTENTS,
    art: <HexagramArt />,
  },
  {
    href: '/western', mode: 'western',
    eyebrow: '占星 · 塔罗 · 数字象征',
    name: '西方玄学',
    lead: '从占星、塔罗到数字象征，探索不同的自我理解方式。',
    cta: '进入西方世界 →',
    groups: WESTERN_INTENTS,
    art: <EclArt />,
  },
];

export default function GatePage() {
  return (
    <main className="gate-shell" data-mode="gate">
      <header className="gate-head qn-rise">
        <p className="qn-eyebrow">混沌 · 两套体系</p>
        <h1 className="qn-hero">先选一套体系</h1>
        <p className="gate-head__note">
          东方与西方各有一套历法口径、取数规则和解读方式，两边不共用算法，也不互相换算。
          排盘、卦象与方位判定都由对应工具计算，模型只做解释与引导。
        </p>
      </header>

      <div className="gate-grid">
        {ENTRIES.map(e => {
          const c = statusCounts(e.groups);
          return (
            <Link key={e.href} href={e.href} className="domain-card" data-mode={e.mode}>
              <span className="domain-card__veil" aria-hidden="true" />
              <span className="domain-card__art" aria-hidden="true">{e.art}</span>
              <div className="domain-card__copy">
                <p className="qn-eyebrow">{e.eyebrow}</p>
                <h2 className="domain-card__title">{e.name}</h2>
                <p className="qn-body">{e.lead}</p>
                <p className="domain-card__cta">{e.cta}</p>
                <p className="domain-card__tally">{statusTally(c)}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="qn-legal gate-legal">
        <p className="qn-note" style={{ margin: 0 }}>
          栏底那三个数（可用 / 部分可用 / 未开放，相加等于总项数）由两套目录现算，本站不在门廊维护第二份工具清单。
          每一项的可用状态、计算口径与需要哪些输入，进到工作页后从页脚「工具状态与取数口径」看。
        </p>
      </section>
    </main>
  );
}
