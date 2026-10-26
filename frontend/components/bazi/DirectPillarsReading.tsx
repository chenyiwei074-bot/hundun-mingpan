'use client';

import BaziEnrich from '@/components/bazi/BaziEnrich';
import ToolInterpretation from '@/components/ai/ToolInterpretation';
import type { DirectPillarsResult } from '@/lib/bazi/direct-pillars';

const COLUMNS = [
  { key: '年', label: '年柱' },
  { key: '月', label: '月柱' },
  { key: '日', label: '日柱' },
  { key: '时', label: '时柱' },
] as const;

export default function DirectPillarsReading({ result }: { result: DirectPillarsResult }) {
  return (
    <section className="qn-card qn-rise" aria-labelledby="direct-pillars-title" style={{ marginTop: 20 }}>
      <p className="qn-eyebrow" style={{ margin: 0 }}>八字四柱 · 独立解读</p>
      <h2 id="direct-pillars-title" className="qn-title" style={{ margin: '8px 0 0' }}>按你输入的四柱计算</h2>
      <p className="qn-note" style={{ marginTop: 8 }}>
        这里只分析你提供的四柱，不推算出生日期、时辰校正、紫微命盘或大运起运；每柱干支已做合法配对校验。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 16 }}>
        {COLUMNS.map(({ key, label }) => (
          <div key={key} className="qn-card" style={{ padding: '12px 6px', textAlign: 'center', minWidth: 0 }}>
            <span className="qn-cap" style={{ display: 'block' }}>{label}</span>
            <strong className="qn-title" style={{ display: 'block', marginTop: 4, letterSpacing: '0.12em' }}>
              {result.siZhu[key].gan}{result.siZhu[key].zhi}
            </strong>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <BaziEnrich enrichment={result.enrichment as Record<string, any>} />
      </div>

      <ToolInterpretation
        tool="bazi-pillars"
        title="八字四柱 · 混沌自研 AI 解读"
        payload={{ siZhu: result.siZhu, enrichment: result.enrichment }}
      />
    </section>
  );
}
