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
                    {section.factRefs?.length ? <span className="qn-cap">已按本页计算结果核对</span> : null}
                    {section.sourceIds?.length ? null : <span className="qn-cap" aria-label={`${section.title}：本站自研，无可核验古籍出处`}>本站自研</span>}
                  </div>
                  <p className="qn-body" style={{ margin: '4px 0 0' }}>{section.body}</p>
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
