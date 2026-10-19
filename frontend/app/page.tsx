// 门廊：只回答一个问题 —— 你要用哪一套体系。
//
// 这里刻意不放工具清单，也不写工具名：工具与状态只有一个事实源
// （lib/tools/catalog.ts 与 lib/tools/western-catalog.ts），门廊一旦抄一份，
// 目录改了这边就会说谎。卡片上只报"这一系里开放了几项"，数字从目录现算。

import Link from 'next/link';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import type { IntentGroup } from '@/lib/tools/catalog';

// 判据与 app/tools/page.tsx 顶部那行一致：状态不是未开放、且有 href 才算"开放"。
// 两处判据不同，门廊上的数就会与目录页对不上。
function counts(groups: IntentGroup[]) {
  const tools = groups.flatMap(g => g.tools);
  return {
    open: tools.filter(t => t.status !== '未开放' && t.href).length,
    total: tools.length,
    partial: tools.filter(t => t.status === '部分可用').length,
    closed: tools.filter(t => t.status === '未开放').length,
  };
}

const ENTRIES = [
  {
    href: '/oriental', mode: 'oriental', name: '东方',
    line: '八字紫微、六爻、梅花、星宿、黄历与户型相关的一套。',
    note: '历法按节气月建与真太阳时；排盘由本站引擎算，不给吉凶评分。',
    groups: INTENTS,
  },
  {
    href: '/western', mode: 'western', name: '西方',
    line: '占星、塔罗、月相与数字命理的一套。',
    note: '按可验证的顺序逐个开放；口径没裁定的项目一律标未开放，模型也不替它伪造结果。',
    groups: WESTERN_INTENTS,
  },
];

export default function GatePage() {
  return (
    <main className="qn-shell qn-shell--wide" data-mode="gate">
      <header className="qn-rise" style={{ paddingTop: 28 }}>
        <p className="qn-eyebrow">混沌 · 两套体系</p>
        <h1 className="qn-hero">先选一套体系</h1>
        <p className="qn-meta" style={{ marginTop: 10 }}>
          东方与西方各有一套历法口径、取数规则和解读方式，两边不共用算法，也不互相换算。
          进来之后想换，回到这一页重选就行。
        </p>
      </header>

      <div className="gate-grid">
        {ENTRIES.map(e => {
          const c = counts(e.groups);
          return (
            <Link key={e.href} href={e.href} className="qn-card domain-card" data-mode={e.mode}>
              <p className="qn-eyebrow">{e.name}体系</p>
              <p className="qn-title" style={{ marginTop: 6 }}>进入{e.name}</p>
              <p className="qn-body" style={{ marginTop: 8 }}>{e.line}</p>
              <p className="qn-meta" style={{ marginTop: 10 }}>{e.note}</p>
              <p className="qn-axis" style={{ marginTop: 14, display: 'block' }}>
                已开放 {c.open} / {c.total} 项
                <span className="domain-card__tally">
                  部分可用 {c.partial} · 未开放 {c.closed}
                </span>
              </p>
            </Link>
          );
        })}
      </div>

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          卡片上的数字由两套目录现算，本站不在门廊维护第二份工具清单；每一项的可用状态、
          计算口径与需要哪些输入，进到工作页或
          <Link className="qn-link" href="/tools" style={{ marginLeft: 4 }}>全部工具与取数口径</Link>
          都看得到。
        </p>
      </section>
    </main>
  );
}
