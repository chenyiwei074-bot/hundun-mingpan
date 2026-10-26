import Link from 'next/link';
import type { IntentGroup } from '@/lib/tools/catalog';
import { isLiveEntry } from '@/lib/tools/status';

// 东方与西方目录共用卡片、状态、字段和图标规则，只按体系切换主题色与图形语义。

const FIELDS: { key: 'question' | 'method' | 'basis' | 'reading'; label: string }[] = [
  { key: 'question', label: '适用问题' },
  { key: 'method', label: '怎么使用' },
  { key: 'basis', label: '规则与依据' },
  { key: 'reading', label: '结果怎么看' },
];

const WESTERN_GLYPHS = new Set([
  'astro-natal', 'astro-synastry', 'tarot-draw', 'lunar-phase', 'numerology',
]);

/** 两套目录共用同一枚 24px 线性图标：同样的框、线宽与留白，只按体系换主题色。 */
function ToolGlyph({ slug }: { slug: string }) {
  const western = WESTERN_GLYPHS.has(slug);
  const mark = (() => {
    switch (slug) {
      case 'bazi': return <><path d="M5 6h14M5 10h14M5 14h14M5 18h14" /><path d="M8 6v4m8 4v4" /></>;
      case 'xiu-benming':
      case 'xiu-he': return <><path d="m12 3 2.1 5.2L20 10l-5.9 1.8L12 18l-2.1-6.2L4 10l5.9-1.8L12 3Z" /><path d="M19 16v5m-2.5-2.5h5" /></>;
      case 'liuyao': return <><path d="M4 5h16M4 10h6m4 0h6M4 15h16M4 20h6m4 0h6" /></>;
      case 'meihua': return <><circle cx="12" cy="12" r="2" /><path d="M12 10c-1-2-1-5 0-7 2 2 2.8 4.3 1 7m-3 1c-2 1-5 1-7 0 2-2 4.3-2.8 7-1m3 2c2-1 5-1 7 0-2 2-4.3 2.8-7 1m-1 0c1 2 1 5 0 7-2-2-2.8-4.3-1-7" /></>;
      case 'fengshui': return <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="m14 10 4-4-1 6-5 2 2-4ZM12 3v2m0 14v2M3 12h2m14 0h2" /></>;
      case 'huangli': return <><circle cx="12" cy="12" r="4" /><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1" /></>;
      case 'dayun': return <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5M12 7v5l3.5 2" /><path d="m18 4 2.5 1-.8 2.5" /></>;
      case 'hepan': return <><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /><path d="M10 12h4" /></>;
      case 'xingming':
      case 'name-compat': return <><path d="m5 17 9.8-9.8 3 3L8 20H5v-3Z" /><path d="m13.5 8.5 3 3M5 4h8M5 8h4" /></>;
      case 'astro-natal': return <><circle cx="12" cy="12" r="2.5" /><ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-32 12 12)" /><path d="M18.5 5.5h.01" /></>;
      case 'astro-synastry': return <><circle cx="8" cy="12" r="5.5" /><circle cx="16" cy="12" r="5.5" /><path d="m10 8 4 8m0-8-4 8" /></>;
      case 'tarot-draw': return <><rect x="6" y="3.5" width="12" height="17" rx="2" /><path d="M9 7h6m-6 9h6" /><path d="m12 9 .8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3L12 9Z" /></>;
      case 'lunar-phase': return <><path d="M18.5 15A8.5 8.5 0 0 1 9 5.5 8.5 8.5 0 1 0 18.5 15Z" /><path d="M17 4v4m-2-2h4" /></>;
      case 'numerology': return <><circle cx="12" cy="12" r="8.5" /><path d="M9 9.5 12 7v10m-3 0h6" /></>;
      default: return <><circle cx="12" cy="12" r="8.5" /><path d="m12 5 1.7 5.3L19 12l-5.3 1.7L12 19l-1.7-5.3L5 12l5.3-1.7L12 5Z" /></>;
    }
  })();

  const color = western ? '#82679f' : '#8d7042';
  const background = western ? 'rgba(130, 103, 159, .11)' : 'rgba(141, 112, 66, .12)';
  return (
    <span aria-hidden="true" data-tool-icon={slug} data-domain={western ? 'western' : 'oriental'}
      style={{ width: 40, height: 40, flex: '0 0 40px', display: 'grid', placeItems: 'center', borderRadius: 14, color, background, border: `1px solid ${color}35` }}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        {mark}
      </svg>
    </span>
  );
}

export default function ToolCatalog({ groups }: { groups: IntentGroup[] }) {
  return (
    <>
      {groups.map((g, gi) => (
        <section key={g.intent} style={{ marginTop: gi === 0 ? 0 : 28 }}>
          <p className="qn-axis">{g.intent}</p>
          <p className="qn-meta" style={{ margin: '6px 0 12px' }}>{g.lead}</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {g.tools.map(t => (
              <article key={t.slug} className="qn-card qn-rise">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 className="qn-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ToolGlyph slug={t.slug} />
                    <span>{t.name}</span>
                  </h2>
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {[FIELDS[0]].map(f => (
                    <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                      <span className="qn-axis" style={{ flex: '0 0 76px' }}>{f.label}</span>
                      <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t[f.key]}</span>
                    </div>
                  ))}
                </div>
                <details style={{ marginTop: 10, borderTop: 'var(--qn-hairline)', paddingTop: 4 }}>
                  <summary className="qn-axis" style={{ minHeight: 44, padding: '10px 0', cursor: 'pointer' }}>
                    展开使用方法、规则依据与结果说明
                  </summary>
                  <div style={{ display: 'grid', gap: 8, paddingBottom: 4 }}>
                    {FIELDS.slice(1).map(f => (
                      <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                        <span className="qn-axis" style={{ flex: '0 0 76px' }}>{f.label}</span>
                        <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t[f.key]}</span>
                      </div>
                    ))}
                  </div>
                </details>
                {(t.done?.length ?? 0) > 0 && (
                  <div className="qn-row" style={{ marginTop: 10 }}>
                    <p className="qn-cap" style={{ margin: 0 }}>支持的功能（{t.done!.length} 项）</p>
                    <ul className="qn-meta" style={{ margin: '2px 0 0', paddingLeft: '1.2em' }}>
                      {t.done!.map(s => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {t.note && <p className="qn-note" style={{ marginTop: 10 }}>{t.note}</p>}
                {isLiveEntry(t) && t.href && (
                  <Link href={t.href} className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 14 }}>进入 · {t.name}</Link>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
