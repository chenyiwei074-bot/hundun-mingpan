'use client';

// 场景矩阵一节：11 行，每行都回指盘内证据（哪柱、天干还是藏干、那一宫被谁牵动、哪几步大运走到它）。
// 展开层放逐字引文与"本站约定"的推法说明 —— 引文必须与 docs/classics 里的入仓原文一字不差，
// 这一点由 tools/scenario-acceptance 比对，不靠人眼。

import type { BaziChart } from '@/app/lib/core/yiqi-core/types';
import { PALACE_MAP, SCENARIO_BASIS, buildScenarios } from '@/lib/bazi/scenarios';
import type { ScenarioRow } from '@/lib/bazi/scenarios';

const KIND_TONE: Record<ScenarioRow['性质'], string> = {
  有出处: 'var(--color-ji)',
  体系定义: 'var(--color-accent-gold)',
  本站约定: 'var(--color-text-muted)',
};

export default function ScenarioMatrix({ chart }: { chart?: BaziChart }) {
  // 裁定 6：无盘降级不是「整节消失」，而是说明缺什么 + 给一条去排盘的路。
  // 也不预置示例盘 —— 拿一张别人的盘当"你的矩阵"读，是编数据。
  const PILLARS = ['year', 'month', 'day', 'hour'] as const;
  if (!chart?.siZhu || !PILLARS.every(k => chart.siZhu[k]?.gan && chart.siZhu[k]?.zhi)) {
    return (
      <section className="qn-card qn-scenario qn-scenario--empty" style={{ marginBottom: 16 }}>
        <h2 className="qn-title" style={{ margin: 0 }}>场景矩阵</h2>
        <p className="qn-meta" style={{ marginTop: 8 }}>
          这一节读的是八字四柱：哪一伦取哪几颗星、那些星落在哪一柱、哪几步大运走到它。
          当前这份数据里没有完整四柱，所以没有可读的盘 —— 这里不预置示例盘，也不按别人的盘给你出话。
        </p>
        <a className="qn-btn qn-btn--solid" href="/create" style={{ marginTop: 14, display: 'inline-block' }}>先去排一张盘</a>
      </section>
    );
  }
  const rows = buildScenarios(chart);
  return (
    <section className="qn-card qn-scenario" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="qn-title" style={{ margin: 0 }}>场景矩阵</h2>
        <span className="qn-badge">
          <span className="qn-badge__dot" style={{ background: 'var(--color-accent-gold)' }} />
          {SCENARIO_BASIS}
        </span>
      </div>
      <p className="qn-meta" style={{ marginTop: 8 }}>
        同一张盘，按 11 个关系与处境各读一遍。每行只说三件事：这一伦取哪几颗星、看哪一宫，
        盘里到底有没有那些星、落在哪一柱，以及哪几步大运正走到它们。
        不出分、不判吉凶、不预测 —— 原典里紧挨着宫分句的那些吉凶断语，一概不取、一概不引。
      </p>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {rows.map(r => (
          <article key={r.场景} data-scenario={r.场景} style={{ border: '0.5px solid var(--color-border-subtle, rgba(0,0,0,0.08))', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <h3 className="qn-body" style={{ margin: 0, fontWeight: 600 }}>{r.场景}</h3>
              <span className="qn-badge">
                <span className="qn-badge__dot" style={{ background: KIND_TONE[r.性质] }} />
                {r.性质}
              </span>
            </div>

            <p className="qn-meta" style={{ margin: '8px 0 0' }}>
              取用：{r.取用星.length ? r.取用星.join('、') : '不取星'} ｜ 宫位：{r.宫位}
            </p>

            {r.并存.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {r.并存.map(s => (
                  <p className="qn-meta" key={s.说法} style={{ margin: 0 }}>
                    {s.说法}：取 {s.取用.join('、')}
                  </p>
                ))}
                <p className="qn-note" style={{ margin: 0 }}>两说并存，本站不裁决。</p>
              </div>
            )}

            {r.命中.length > 0 ? (
              <ul className="qn-meta" style={{ margin: '8px 0 0', paddingLeft: '1.1em' }}>
                {r.命中.map(h => <li key={h}>{h}</li>)}
              </ul>
            ) : (
              <p className="qn-meta" style={{ margin: '8px 0 0' }}>
                盘中不见{r.取用星.join('、') || '所取之星'}（天干与藏干都没有）—— 只说明取用与宫位，不作推断。
              </p>
            )}
            {r.不见.length > 0 && r.命中.length > 0 && (
              <p className="qn-note" style={{ margin: '6px 0 0' }}>另有 {r.不见.join('、')} 未现于盘中。</p>
            )}

            <details style={{ marginTop: 10 }}>
              <summary className="qn-cap" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                依据与宫位关系、所行岁运
              </summary>
              <div style={{ paddingTop: 6, display: 'grid', gap: 6 }}>
                <p className="qn-meta" style={{ margin: 0 }}>{r.依据}</p>
                {r.引文.length > 0 && r.引文.map((q, i) => (
                  <p className="qn-meta" key={`${r.场景}-q${i}`}
                    style={{ margin: 0, overflowWrap: 'anywhere', paddingLeft: 10, borderLeft: '2px solid var(--color-border-subtle, rgba(0,0,0,0.10))' }}>
                    原文：{q}
                  </p>
                ))}
                {r.出处.length > 0 && (
                  <p className="qn-note" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                    逐字底本：{r.出处.join('、')}
                  </p>
                )}
                <p className="qn-meta" style={{ margin: 0 }}>
                  宫位关系：{r.宫位关系.length ? r.宫位关系.join('；') : '该宫未见干支关系'}
                </p>
                <p className="qn-meta" style={{ margin: 0 }}>
                  岁运：{r.岁运.length ? r.岁运.join('；') : '诸大运天干地支主气未见所取之星'}
                </p>
              </div>
            </details>
          </article>
        ))}
      </div>

      <p className="qn-note" style={{ marginTop: 12 }}>
        {PALACE_MAP}这一层取自《渊海子平》论伤官与《三命通會》卷五引《秘訣》两段。
        那两段在原典里是连着吉凶判词的，本站不抄那些判词、也不把它们当结论，只取宫分这一层结构；
        两本的次序与用词有出入，引用时并列注明；本站不替两种说法作统一裁决。
        星之取用出自《滴天髓》六親論，同样只取映射子句。
      </p>
    </section>
  );
}
