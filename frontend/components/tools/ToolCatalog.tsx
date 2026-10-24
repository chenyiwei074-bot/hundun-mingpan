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

const STATUS_LABEL = { '可用': '已开放', '部分可用': '部分开放', '未开放': '筹备中' } as const;

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
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <p className="qn-meta" style={{ margin: 0 }}><strong>你可以了解：</strong> {t.question}</p>
                  {t.status !== '未开放' && <p className="qn-meta" style={{ margin: 0 }}><strong>结果内容：</strong> {t.reading}</p>}
                  {t.status === '部分可用' && <p className="qn-note" style={{ margin: 0 }}>目前开放部分功能，后续内容会继续完善。</p>}
                  {t.status === '未开放' && <p className="qn-note" style={{ margin: 0 }}>这项功能正在整理中，暂未开放。</p>}
                </div>
                {/* 「部分可用」必须把两张清单摊开：只写状态词等于让读者自己猜缺的是哪一样，
                    猜错的人会以为宫位与相位也算了。清单本体在目录里，与引擎导出值逐字比对。 */}
                {isLiveEntry(t) && t.href ? (
                  <Link href={t.href} className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 14 }}>进入 · {t.name}</Link>
                ) : (
                  <p className="qn-cap" style={{ marginTop: 14 }}>
                    {t.status === '未开放' ? '暂未开放' : '功能正在完善'}
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
