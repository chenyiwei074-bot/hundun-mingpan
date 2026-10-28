'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type PlainPart = { id: string; text: string };
export type PlainContext = 'tool' | 'chart' | 'tarot' | 'liuyao' | 'report';

/** 仅切换解读文字；计算结果、牌面与出处由调用页面照常渲染。 */
export default function PlainLanguageView({ context, parts, children }: {
  context: PlainContext;
  parts: PlainPart[];
  children: (textById: Record<string, string>) => ReactNode;
}) {
  const key = JSON.stringify(parts);
  const original = useMemo(() => Object.fromEntries(parts.map(part => [part.id, part.text])), [key]);
  const [cached, setCached] = useState<{ key: string; textById: Record<string, string> } | null>(null);
  const [plain, setPlain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const validCache = cached?.key === key ? cached : null;
  const showingPlain = plain && !!validCache;

  const selectPlain = async () => {
    if (loading) return;
    if (validCache) { setPlain(true); setError(''); return; }
    const eligible = parts.filter(part => part.text.trim().length >= 8 && part.text.length <= 8000);
    if (!eligible.length || eligible.reduce((sum, part) => sum + part.text.length, 0) > 18000) {
      setError('这份解读文字过长，暂时无法生成大白话；原解读仍可阅读。');
      return;
    }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/ai/plain-language', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, parts: eligible }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !Array.isArray(json?.data?.parts)) {
        throw new Error(json?.error || '大白话改写暂时不可用');
      }
      const rewritten = json.data.parts as PlainPart[];
      if (rewritten.length !== eligible.length || rewritten.some((part, index) =>
        part?.id !== eligible[index].id || typeof part.text !== 'string' || !part.text.trim())) {
        throw new Error('改写结果不完整，请稍后再试');
      }
      const textById = { ...original };
      rewritten.forEach(part => { textById[part.id] = part.text; });
      setCached({ key, textById });
      setPlain(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '大白话改写暂时不可用');
      setPlain(false);
    } finally { setLoading(false); }
  };

  return (
    <div data-plain-mode={showingPlain ? 'plain' : 'original'}>
      <div role="group" aria-label="解读语言" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <button type="button" className="qn-btn qn-btn--quiet" aria-pressed={!showingPlain}
          style={{ minHeight: 44 }} onClick={() => { setPlain(false); setError(''); }}>原解读</button>
        <button type="button" className="qn-btn qn-btn--ghost" aria-pressed={showingPlain}
          style={{ minHeight: 44 }} disabled={loading} onClick={() => void selectPlain()}>
          {loading ? '正在改写…' : '大白话'}
        </button>
      </div>
      <p className="qn-cap" style={{ margin: '0 0 10px' }}>大白话只改写表达，盘面、牌位和出处以原结果为准；可随时切回原解读。</p>
      {error && <p className="qn-alert" role="alert" style={{ marginBottom: 10 }}>{error} 原解读仍可阅读。</p>}
      <div aria-live="polite">{children(showingPlain ? validCache!.textById : original)}</div>
    </div>
  );
}
