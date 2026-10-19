import Link from 'next/link';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import type { ToolStatus } from '@/lib/tools/catalog';

// 西方目录的渲染。判据与 app/tools/page.tsx 完全同一条（状态不是未开放且有 href 才给入口），
// 未开放的一律写明"没有入口"并说清缺什么 —— 半开的门比关着的门更容易让人以为能进。
const STATUS_DOT: Record<ToolStatus, string> = {
  '可用': 'var(--color-ji)',
  '部分可用': 'var(--color-accent-gold)',
  '未开放': 'var(--color-border-strong, rgba(0,0,0,0.22))',
};

const FIELDS: { key: 'question' | 'method' | 'basis' | 'reading'; label: string }[] = [
  { key: 'question', label: '适用问题' },
  { key: 'method', label: '方法' },
  { key: 'basis', label: '算法口径' },
  { key: 'reading', label: '结果怎么读' },
];

export default function WesternWorkspace() {
  const tools = WESTERN_INTENTS.flatMap(g => g.tools);
  const open = tools.filter(t => t.status !== '未开放' && t.href);
  return (
    <>
      <section className="qn-card qn-rise" style={{ marginTop: 18 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          目录共 {tools.length} 项，其中已开放 {open.length} 项。
          {open.length === 0
            ? ' 现在一项都进不去：每一项的算法口径都还没有可引的出处与验收样例，'
              + '与其先做个能点的空壳，不如把缺什么写在门上。'
            : ' 已开放的项在下面各自卡片里有入口。'}
        </p>
      </section>

      {WESTERN_INTENTS.map(g => (
        <section key={g.intent} style={{ marginTop: 22 }}>
          <p className="qn-axis">{g.intent}</p>
          <p className="qn-meta" style={{ marginTop: 4 }}>{g.lead}</p>
          <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
            {g.tools.map(t => (
              <article key={t.slug} className="qn-card qn-rise">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 className="qn-title" style={{ margin: 0 }}>{t.name}</h2>
                  <span className="qn-badge">
                    <span className="qn-badge__dot" style={{ background: STATUS_DOT[t.status] }} />
                    {t.status}
                  </span>
                </div>
                {FIELDS.map(f => (
                  <div key={f.key} className="qn-row" style={{ marginTop: 8 }}>
                    <p className="qn-cap" style={{ margin: 0 }}>{f.label}</p>
                    <p className="qn-meta" style={{ margin: '2px 0 0' }}>{t[f.key]}</p>
                  </div>
                ))}
                {t.note && <p className="qn-note" style={{ marginTop: 8 }}>{t.note}</p>}
                {t.status !== '未开放' && t.href
                  ? <Link className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 12 }} href={t.href}>
                      进入 · {t.name}
                    </Link>
                  : <p className="qn-cap" style={{ marginTop: 12 }}>未开放，因此没有入口。</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
