import Link from 'next/link';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { STATUS_DOT, isLiveEntry, statusCounts, statusTally } from '@/lib/tools/status';

// 西方目录的渲染。判据与目录页、门廊完全同一条（lib/tools/status.ts 的 isLiveEntry：
// 状态不是未开放且有 href 才给入口），未开放的一律写明"没有入口"并说清缺什么 ——
// 半开的门比关着的门更容易让人以为能进。
// 圆点也不在这里另配一份：以前这一份的"未开放"指向 var(--color-border-strong)，
// 而全站从来没有定义过那支令牌，于是它回退成 rgba(0,0,0,.22)，在 #241a3d 上等于没画。

const FIELDS: { key: 'question' | 'method' | 'basis' | 'reading'; label: string }[] = [
  { key: 'question', label: '适用问题' },
  { key: 'method', label: '方法' },
  { key: 'basis', label: '算法口径' },
  { key: 'reading', label: '结果怎么读' },
];

export default function WesternWorkspace() {
  const tally = statusCounts(WESTERN_INTENTS);
  return (
    <>
      <section className="qn-card qn-rise" style={{ marginTop: 18 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          目录 {statusTally(tally)}。
          {tally.live === 0
            ? ' 现在一项都进不去：每一项的算法口径都还没有可引的出处与验收样例，'
              + '与其先做个能点的空壳，不如把缺什么写在门上。'
            : ' 有入口的项在下面各自卡片里。'}
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
                {isLiveEntry(t) && t.href
                  ? <Link className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 12 }} href={t.href}>
                      进入 · {t.name}
                    </Link>
                  : <p className="qn-cap" style={{ marginTop: 12 }}>
                      {t.status === '未开放' ? '未开放，因此没有入口。' : '还没有页面链接，因此没有入口。'}
                    </p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
