'use client';

import { useState } from 'react';
import ClassicalReferences from '@/components/chart/ClassicalReferences';

export type InterpretationSection = {
  id?: string;
  title: string;
  body: string;
  factRefs?: string[];
  sourceIds?: string[];
};
export type InterpretationResult = {
  mode: 'ai' | 'unavailable';
  aiReady: boolean;
  title: string;
  summary: string;
  sections: InterpretationSection[];
  notes?: string[];
};

const FACT_LABELS: Record<string, string> = {
  aspects: '相位', ascendant: '上升点', ben: '本卦', bian: '变卦', civil: '公历日期',
  dayGZ: '日干支', dongYao: '动爻', ganZhi: '干支', houses: '宫头', illumination: '照亮比例',
  ji: '忌', lunarDate: '农历日期', monthZhi: '月支', nextFullMoonUtcMs: '下次望月时刻',
  nextNewMoonUtcMs: '下次朔月时刻', phaseAngle: '月相角', phaseName: '月相', positions: '行星位置',
  shiYing: '世应', utcMs: '时刻', yi: '宜', yaoRecords: '爻记录',
};

function resolveFactReference(payload: unknown, ref: string): { label: string; value: string } | null {
  if (!ref.startsWith('$')) return null;
  const token = /(?:\.([A-Za-z_$][A-Za-z0-9_$]*)|\[(\d+)\]|\[("(?:\\.|[^"\\])*")\])/g;
  const labels: string[] = [];
  let value: unknown = payload;
  let offset = 1;
  while (offset < ref.length) {
    token.lastIndex = offset;
    const match = token.exec(ref);
    if (!match || match.index !== offset || !value || typeof value !== 'object') return null;
    const segment: string | number = match[1] ?? (match[2] !== undefined ? Number(match[2]) : JSON.parse(match[3]));
    if (!Object.prototype.hasOwnProperty.call(value, segment)) return null;
    value = (value as Record<string | number, unknown>)[segment];
    const knownLabel = typeof segment === 'string' && Object.prototype.hasOwnProperty.call(FACT_LABELS, segment)
      ? FACT_LABELS[segment]
      : undefined;
    labels.push(typeof segment === 'number' ? `第${segment + 1}项` : (knownLabel ?? segment));
    offset = token.lastIndex;
  }
  if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) return null;
  const displayValue = value === null ? '空' : typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return { label: labels.join(' / ') || '本页结果', value: displayValue.length > 120 ? `${displayValue.slice(0, 120)}…` : displayValue };
}

export default function ToolInterpretation({ tool, title, payload, question, disabledReason }: {
  tool: string;
  title?: string;
  payload: unknown;
  question?: string;
  disabledReason?: string;
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (disabledReason) return;
    setState('loading'); setError('');
    try {
      const res = await fetch('/api/ai/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, payload, question: question || '' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'AI 解读暂时不可用');
      setResult(json.data as InterpretationResult);
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 解读暂时不可用');
      setState('error');
    }
  };

  return (
    <section className="qn-card qn-ai-interpret" style={{ marginTop: 14 }} data-ai-interpret={tool} aria-live="polite">
      <div className="qn-row" style={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="qn-cap" style={{ margin: 0 }}>混沌自研 AI 辅助解读</p>
          <h2 className="qn-title" style={{ margin: '4px 0 0' }}>{title || '把这份结果读成一段话'}</h2>
        </div>
        <button type="button" className="qn-btn qn-btn--ghost" onClick={run} disabled={state === 'loading' || !!disabledReason}
          style={{ minHeight: 44 }}>
          {state === 'loading' ? '生成中…' : result ? '重新生成解读' : '生成 AI 解读'}
        </button>
      </div>
      <p className="qn-note" style={{ marginTop: 8 }}>
        只把本页已算出的结果交给混沌自研 AI 整理；它不重算盘面，也不把解读文字当成事实。
        {question?.trim() ? ' 你填写的问题会随本次请求一并处理。' : ''}{disabledReason ? ` ${disabledReason}` : ''}
      </p>
      {error && <p className="qn-alert" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p className="qn-title" style={{ margin: 0 }}>{result.title}</p>
          {result.mode === 'ai' && result.aiReady ? (
            <>
              <p className="qn-body" style={{ marginTop: 8 }}>{result.summary}</p>
              {result.sections.map((section, index) => (
                <div key={section.id || `${section.title}-${index}`} style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="qn-axis" style={{ margin: 0 }}>{section.title}</h3>
                    {section.factRefs?.length ? <span className="qn-cap" title={`${section.factRefs.length} 项本页计算数据`}>引用本页计算数据 · {section.factRefs.length} 项</span> : null}
                    {section.sourceIds?.length ? null : <span className="qn-cap" aria-label={`${section.title}：本站自研，无可核验古籍出处`}>本站自研</span>}
                  </div>
                  <p className="qn-body" style={{ margin: '4px 0 0' }}>{section.body}</p>
                  {section.factRefs?.length ? (
                    <details style={{ marginTop: 6 }}>
                      <summary className="qn-cap" style={{ cursor: 'pointer', minHeight: 36, display: 'inline-flex', alignItems: 'center' }}>
                        查看本节引用的计算数据
                      </summary>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        {section.factRefs.map(ref => {
                          const fact = resolveFactReference(payload, ref);
                          return fact ? <li key={ref} className="qn-meta" style={{ overflowWrap: 'anywhere' }}>{fact.label}：{fact.value}</li> : null;
                        })}
                      </ul>
                    </details>
                  ) : null}
                  {section.sourceIds?.length ? <ClassicalReferences sourceIds={section.sourceIds} /> : null}
                </div>
              ))}
            </>
          ) : (
            <p className="qn-meta" style={{ marginTop: 8 }}>综合 AI 解读暂时不可用；上方规则结果仍然有效，AI 未参与本次解读。</p>
          )}
          {(result.notes?.length ?? 0) > 0 && (
            <p className="qn-note" style={{ marginTop: 10 }}>{result.notes!.join(' ')}</p>
          )}
        </div>
      )}
    </section>
  );
}
