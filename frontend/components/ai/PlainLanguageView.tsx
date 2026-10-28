'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type PlainPart = { id: string; text: string };
export type PlainContext = 'tool' | 'chart' | 'tarot' | 'liuyao' | 'report';

type RewritePart = PlainPart & { sourceId: string };
const CHUNK_LENGTH = 1500;
const BATCH_LENGTH = 3000;

function splitForRewrite(text: string): string[] {
  let remaining = text.trim();
  const chunks: string[] = [];
  while (remaining.length > CHUNK_LENGTH) {
    let cut = CHUNK_LENGTH;
    for (const mark of ['\n\n', '\n', '。', '！', '？', '；']) {
      const position = remaining.lastIndexOf(mark, CHUNK_LENGTH);
      if (position >= CHUNK_LENGTH / 2) {
        cut = position + mark.length;
        break;
      }
    }
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length < 8 && chunks.length) chunks[chunks.length - 1] += remaining;
  else if (remaining) chunks.push(remaining);
  return chunks;
}

function rewriteBatches(parts: PlainPart[]): RewritePart[][] {
  const length = parts.reduce((sum, part) => sum + part.text.length, 0);
  if (parts.length <= 24 && length <= 6000 && parts.every(part => part.text.length <= 8000)) {
    return [parts.map(part => ({ ...part, sourceId: part.id }))];
  }
  const chunks = parts.flatMap((part, index) => splitForRewrite(part.text).map((text, chunk) => ({
    id: `p${index}_${chunk}`, sourceId: part.id, text,
  })));
  const batches: RewritePart[][] = [];
  for (const chunk of chunks) {
    const current = batches[batches.length - 1];
    if (current && current.length < 24 && current.reduce((sum, part) => sum + part.text.length, 0) + chunk.text.length <= BATCH_LENGTH) {
      current.push(chunk);
    } else {
      batches.push([chunk]);
    }
  }
  return batches;
}

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
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const rewriteController = useRef<AbortController | null>(null);
  useEffect(() => () => rewriteController.current?.abort(), []);
  const validCache = cached?.key === key ? cached : null;
  const showingPlain = plain && !!validCache;

  const selectPlain = async () => {
    if (loading) return;
    if (validCache) { setPlain(true); setError(''); return; }
    const eligible = parts.filter(part => part.text.trim().length >= 8);
    if (!eligible.length) {
      setError('这份解读没有足够的文字用于改写；原解读仍可阅读。');
      return;
    }
    const batches = rewriteBatches(eligible);
    const controller = new AbortController();
    rewriteController.current = controller;
    setLoading(true); setError(''); setProgress({ done: 0, total: batches.length });
    try {
      const rewrittenById = new Map<string, string>();
      for (const [batchIndex, batch] of batches.entries()) {
        const response = await fetch('/api/ai/plain-language', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ context, parts: batch.map(({ id, text }) => ({ id, text })) }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.success || !Array.isArray(json?.data?.parts)) {
          throw new Error(json?.error || '大白话改写暂时不可用');
        }
        const rewritten = json.data.parts as PlainPart[];
        if (rewritten.length !== batch.length || rewritten.some((part, index) =>
          part?.id !== batch[index].id || typeof part.text !== 'string' || !part.text.trim())) {
          throw new Error('改写结果不完整，请稍后再试');
        }
        rewritten.forEach(part => rewrittenById.set(part.id, part.text));
        setProgress({ done: batchIndex + 1, total: batches.length });
      }
      const textById = { ...original };
      const chunks = batches.flat();
      for (const part of eligible) {
        const paragraphs = chunks.filter(chunk => chunk.sourceId === part.id)
          .map(chunk => rewrittenById.get(chunk.id));
        if (paragraphs.some(text => !text)) throw new Error('改写结果不完整，请稍后再试');
        textById[part.id] = paragraphs.join('\n\n');
      }
      setCached({ key, textById });
      setPlain(true);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '大白话改写暂时不可用');
      setPlain(false);
    } finally {
      if (rewriteController.current === controller) rewriteController.current = null;
      setLoading(false);
    }
  };

  return (
    <div data-plain-mode={showingPlain ? 'plain' : 'original'}>
      <div role="group" aria-label="解读语言" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <button type="button" className="qn-btn qn-btn--quiet" aria-pressed={!showingPlain}
          style={{ minHeight: 44 }} onClick={() => { rewriteController.current?.abort(); setPlain(false); setError(''); }}>原解读</button>
        <button type="button" className="qn-btn qn-btn--ghost" aria-pressed={showingPlain}
          style={{ minHeight: 44 }} disabled={loading} onClick={() => void selectPlain()}>
          {loading ? `正在改写 ${progress.done}/${progress.total}…` : '大白话'}
        </button>
      </div>
      <p className="qn-cap" style={{ margin: '0 0 10px' }}>大白话只改写表达，盘面、牌位和出处以原结果为准；可随时切回原解读。</p>
      {error && <p className="qn-alert" role="alert" style={{ marginBottom: 10 }}>{error} 原解读仍可阅读。</p>}
      <div aria-live="polite">{children(showingPlain ? validCache!.textById : original)}</div>
    </div>
  );
}
