import Link from 'next/link';
import type { IntentGroup } from '@/lib/tools/catalog';
import { STATUS_DOT, isLiveEntry } from '@/lib/tools/status';

// 工具目录卡片的唯一渲染器（批F ①）。
//
// 为什么要合：东方目录页与西方工作页以前各写一份卡片，两份各有三处偏差 —— 字段标签一份写
// 「计算口径」一份写「算法口径」；西方那份渲染"已做/未做"、东方那份不渲染（于是
// 「部分可用」在 /tools 上只剩三个字，缺什么看不见）；两份还各抄一遍 FIELDS。
// 西方第一项开放之后，第三处偏差最要命：/tools 那句「全部工具目录」给的不是全部，
// 西方五项一个都不在上面。现在两套目录共用这一个渲染器，字段与状态口径只有一份。

const FIELDS: { key: 'question' | 'method' | 'basis' | 'reading'; label: string }[] = [
  { key: 'question', label: '适用问题' },
  { key: 'method', label: '怎么使用' },
  { key: 'basis', label: '规则与依据' },
  { key: 'reading', label: '结果怎么看' },
];

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
                  <h2 className="qn-title" style={{ margin: 0 }}>{t.name}</h2>
                  <span className="qn-badge">
                    <span className="qn-badge__dot" style={{ background: STATUS_DOT[t.status] }} />
                    {t.status}
                  </span>
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
                {/* 「部分可用」必须把两张清单摊开：只写状态词等于让读者自己猜缺的是哪一样，
                    猜错的人会以为宫位与相位也算了。清单本体在目录里，与引擎导出值逐字比对。 */}
                {(t.done?.length ?? 0) > 0 && (
                  <div className="qn-row" style={{ marginTop: 10 }}>
                    <p className="qn-cap" style={{ margin: 0 }}>已做（{t.done!.length} 项）</p>
                    <ul className="qn-meta" style={{ margin: '2px 0 0', paddingLeft: '1.2em' }}>
                      {t.done!.map(s => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {(t.notDone?.length ?? 0) > 0 && (
                  <div className="qn-row" style={{ marginTop: 8 }}>
                    <p className="qn-cap" style={{ margin: 0 }}>未做（{t.notDone!.length} 项）</p>
                    <ul className="qn-meta" style={{ margin: '2px 0 0', paddingLeft: '1.2em' }}>
                      {t.notDone!.map(s => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {t.note && <p className="qn-note" style={{ marginTop: 10 }}>{t.note}</p>}
                {isLiveEntry(t) && t.href ? (
                  <Link href={t.href} className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 14 }}>进入 · {t.name}</Link>
                ) : (
                  <p className="qn-cap" style={{ marginTop: 14 }}>
                    {t.status === '未开放' ? '未开放，因此没有入口。' : '还没有页面链接，因此没有入口。'}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
