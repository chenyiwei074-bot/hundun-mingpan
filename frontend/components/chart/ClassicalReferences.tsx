'use client';

import { useEffect, useState } from 'react';
import { getClassicSources, type ClassicSource } from '@/app/lib/api';

type Props = { sourceIds: string[] };

export default function ClassicalReferences({ sourceIds }: Props) {
  const ids = Array.from(new Set(sourceIds.filter(id => typeof id === 'string' && id.trim())));
  const requestKey = ids.join(',');
  if (!requestKey) return null;

  return <ClassicalReferencesContent key={requestKey} requestKey={requestKey} />;
}

function ClassicalReferencesContent({ requestKey }: { requestKey: string }) {
  const [sources, setSources] = useState<ClassicSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getClassicSources(requestKey.split(','))
      .then(data => { if (!cancelled) setSources(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestKey, attempt]);

  return (
    <details style={{ marginTop: 10, borderTop: 'var(--qn-hairline)', paddingTop: 8 }}>
      <summary className="qn-cap" style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        查看传统文献出处{sources.length > 0 ? `（${sources.length}）` : ''}
      </summary>
      <div style={{ display: 'grid', gap: 12, paddingTop: 8 }}>
        {loading && <p className="qn-note" role="status" style={{ margin: 0 }}>正在读取出处…</p>}
        {error && (
          <div>
            <p className="qn-note" role="alert" style={{ margin: '0 0 8px' }}>出处暂时无法读取，请稍后重试。</p>
            <button type="button" className="qn-btn qn-btn--quiet" onClick={() => setAttempt(value => value + 1)}>重试</button>
          </div>
        )}
        {!loading && !error && sources.map(source => (
          <article key={source.sourceId} style={{ paddingLeft: 12, borderLeft: '2px solid var(--color-accent-gold)' }}>
            <p className="qn-meta" style={{ margin: 0, fontWeight: 600 }}>
              《{source.book}》{source.chapter ? ` · ${source.chapter}` : ''}
            </p>
            <p className="qn-cap" style={{ margin: '4px 0 0' }}>{source.edition}</p>
            <details style={{ marginTop: 6 }}>
              <summary className="qn-cap" style={{ minHeight: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>展开原文</summary>
              <blockquote className="qn-meta" style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 360, overflow: 'auto' }}>
                {source.quote}
              </blockquote>
            </details>
          </article>
        ))}
      </div>
    </details>
  );
}
