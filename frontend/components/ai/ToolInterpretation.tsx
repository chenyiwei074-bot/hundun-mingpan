'use client';

import { useState } from 'react';

export type InterpretationResult = {
  mode: 'ai' | 'unavailable';
  aiReady: boolean;
  title: string;
  summary: string;
  sections: Array<{ title: string; body: string }>;
  notes: string[];
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
        只把本页已算出的结果交给混沌自研 AI 整理；它不重算盘面，也不把解读文字当成事实。{disabledReason ? ` ${disabledReason}` : ''}
      </p>
      {error && <p className="qn-alert" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12 }}>
          <p className="qn-title" style={{ margin: 0 }}>{result.title}</p>
          {result.mode === 'ai' && result.aiReady ? (
            <>
              <p className="qn-body" style={{ marginTop: 8 }}>{result.summary}</p>
              {result.sections.map(section => (
                <div key={section.title} style={{ marginTop: 12 }}>
                  <h3 className="qn-axis" style={{ margin: 0 }}>{section.title}</h3>
                  <p className="qn-body" style={{ margin: '4px 0 0' }}>{section.body}</p>
                </div>
              ))}
            </>
          ) : (
            <p className="qn-meta" style={{ marginTop: 8 }}>综合 AI 解读暂时不可用；上方规则结果仍然有效，AI 未参与本次解读。</p>
          )}
          {result.notes.length > 0 && (
            <p className="qn-note" style={{ marginTop: 10 }}>{result.notes.join(' ')}</p>
          )}
        </div>
      )}
    </section>
  );
}
