'use client';

// 中文问事框。它只做三件事：收下这句话、给出"下一步去哪"、说清这一步是谁给的。
//
// 边界写死在这里：
//  - 它不排盘、不起卦、不抽牌、不算任何命理结论 —— 结论只在各工具自己的页面里由引擎算；
//  - 它给出的入口一律来自目录（reconcile 之后），未开放的工具在这里也拿不到链接；
//  - 服务端 /api/assistant/route 目前不存在（网关把 /api/* 转给后端，后端没有这条路由），
//    所以每一轮都会回落本机目录路由，并把"这一轮是谁算的"明写在结果上。

import { useRef, useState } from 'react';
import Link from 'next/link';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { askRoute } from '@/lib/assistant/route-client';
import type { RouteOutcome } from '@/lib/assistant/route-client';
import type { AskTurn, Mode } from '@/lib/assistant/types';
import type { ToolEntry } from '@/lib/tools/catalog';

const GROUPS: Record<Mode, typeof INTENTS> = { oriental: INTENTS, western: WESTERN_INTENTS };
const OTHER: Record<Mode, typeof INTENTS> = { oriental: WESTERN_INTENTS, western: INTENTS };
const PLACEHOLDER: Record<Mode, string> = {
  oriental: '想问什么，用大白话写一句。例：我这个月能签成那单吗',
  western: '用中文写一句你想问的。例：我的月亮落在哪个星座',
};

/** 示例问题只从目录里现取：取已开放条目的 question 字段，页面不写第二份例子。 */
function examples(mode: Mode): { slug: string; name: string; q: string }[] {
  return GROUPS[mode].flatMap(g => g.tools)
    .filter((t: ToolEntry) => t.status !== '未开放' && t.href)
    .slice(0, 4)
    .map(t => ({ slug: t.slug, name: t.name, q: t.question }));
}

function toolOf(mode: Mode, slug: string | null): ToolEntry | undefined {
  if (!slug) return undefined;
  return GROUPS[mode].flatMap(g => g.tools).find(t => t.slug === slug);
}

export default function QuestionComposer({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);

  const ask = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setBusy(true);
    setErr(null);
    let outcome: RouteOutcome;
    try {
      outcome = await askRoute({ mode, text: q, catalog: GROUPS[mode].flatMap(g => g.tools), otherCatalog: OTHER[mode].flatMap(g => g.tools) });
    } catch (e) {
      // askRoute 自己已经兜底了；走到这里说明是编码错误，明说，不假装算过了。
      setErr('这一步在本机也没算出来（不是网络问题，是这一条判断的代码坏了）。请直接看下面的目录。');
      setBusy(false);
      return;
    }
    seq.current += 1;
    setTurns(t => [{ id: `t${seq.current}`, text: q, result: outcome.result, source: outcome.source }, ...t].slice(0, 6));
    setText('');
    setBusy(false);
  };

  const ex = examples(mode);

  return (
    <div className="qa" data-mode={mode} data-compact={compact ? '1' : undefined}>
      <form
        onSubmit={e => { e.preventDefault(); void ask(text); }}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <label className="qn-label" htmlFor={`qa-input-${mode}`} style={{ flex: '1 1 100%', margin: 0 }}>
          问一句（中文）
        </label>
        <input
          id={`qa-input-${mode}`} className="qn-input" style={{ flex: '2 1 180px', minWidth: 0 }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER[mode]} maxLength={200} aria-describedby={`qa-note-${mode}`} />
        <button type="submit" className="qn-btn qn-btn--solid" style={{ minWidth: 76 }}
          disabled={busy || text.trim().length === 0}>
          {busy ? '在想' : '问一下'}
        </button>
      </form>

      <p id={`qa-note-${mode}`} className="qn-cap" style={{ marginTop: 6 }}>
        问事框只把你带到该用的工具，不在这儿给结论；问题原文只留在这个页面上，不写日志、不进台账。
      </p>

      {!compact && ex.length > 0 && (
        <div className="qa-examples" style={{ marginTop: 10 }}>
          {ex.map(x => (
            <button key={x.slug} type="button" className="qn-chip" onClick={() => void ask(x.q)}
              style={{ minHeight: 44, maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.q}</span>
            </button>
          ))}
        </div>
      )}
      {!compact && ex.length === 0 && (
        <p className="qn-cap" style={{ marginTop: 10 }}>
          这一系目前一项都没开放，所以下面也不会给出示例问题 —— 空着比编几条像样的高明。
        </p>
      )}

      {err && <p className="qn-alert" role="alert" style={{ marginTop: 10 }}>{err}</p>}

      <div aria-live="polite">
        {turns.map(t => {
          const tool = toolOf(mode, t.result.toolSlug);
          const why = t.source === 'server'
            ? '这一轮来自服务端路由'
            : `这一轮由本机目录匹配给出，未经模型${t.result.needsClarification ? '' : ''}`;
          return (
            <div key={t.id} className="qn-card qa-turn" style={{ marginTop: 10 }}>
              <p className="qn-meta" style={{ margin: 0 }}>你问：{t.text}</p>
              {tool ? (
                <>
                  <p className="qn-body" style={{ marginTop: 8 }}>
                    该用的是{tool.name}（{tool.status}）。
                  </p>
                  <p className="qn-meta" style={{ marginTop: 4 }}>{tool.reading}</p>
                  {t.result.missingFields.length > 0 && (
                    <p className="qn-note" style={{ marginTop: 6 }}>
                      还要补：{t.result.missingFields.join('、')}。页面会再问你，这里不替你填。
                    </p>
                  )}
                  <Link href={tool.href!} className="qn-btn qn-btn--ghost" style={{ marginTop: 10, minHeight: 44 }}>
                    进入 · {tool.name}
                  </Link>
                </>
              ) : (
                <p className="qn-body" style={{ marginTop: 8 }}>
                  {t.result.clarification || '这句话我没能对上已经开放的工具。'}
                </p>
              )}
              <p className="qn-cap" style={{ marginTop: 8 }}>{why}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
