'use client';

// 中文问事框。它只做三件事：收下这句话、给出"下一步去哪"、说清这一步是谁给的。
//
// 边界写死在这里：
//  - 它不排盘、不起卦、不抽牌、不算任何命理结论 —— 结论只在各工具自己的页面里由引擎算；
//  - 它给出的入口一律来自目录（reconcile 之后），未开放的工具在这里也拿不到链接；
//  - 服务端那一发是真发出去的（批A 修好了端点），所以"没用到服务端"的原因必须上屏（缺陷②）：
//    网关 404、超时、形状不合、答的是另一套体系 —— 这几种都回落本机目录，但页面要说是哪一种。
//
// 四种落点（批B 定的状态机，harness 各有一态）：
//   matched  对上唯一一个已开放工具 → 给入口
//   choices  两个同分 → 并列 chip 让用户挑，系统不选边
//   clarify  缺料（日期/时辰/地点/要问的那件事）→ 就地给补料提示
//   closed   对上的条目在目录里但没开放 → 说清缺什么，不给入口

import { useRef, useState } from 'react';
import Link from 'next/link';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { STATUS_DOT } from '@/lib/tools/status';
import { needsFor } from '@/lib/assistant/intent';
import { reconcile } from '@/lib/assistant/types';
import { askRoute } from '@/lib/assistant/route-client';
import type { RouteOutcome } from '@/lib/assistant/route-client';
import type { AskTurn, AssistantRouteResult, Mode } from '@/lib/assistant/types';
import type { ToolEntry } from '@/lib/tools/catalog';

const GROUPS: Record<Mode, typeof INTENTS> = { oriental: INTENTS, western: WESTERN_INTENTS };
const OTHER: Record<Mode, typeof INTENTS> = { oriental: WESTERN_INTENTS, western: INTENTS };
const PLACEHOLDER: Record<Mode, string> = {
  oriental: '想问什么，用大白话写一句。例：我这个月能签成那单吗',
  western: '用中文写一句你想问的。例：我的月亮落在哪个星座',
};

/** 示例问题只从目录里现取，页面不写第二份例子。
 *  批B 改了一件事：不再按状态过滤。西方五项都还没开放，过滤之后示例区就是空的 ——
 *  空着不等于"这一系没有问法"，读者会以为整页都问不出东西。现在照目录给四条，
 *  点下去落到 closed 那一支（写明没开放、缺什么、不给入口），这比不给例子诚实。 */
function examples(mode: Mode): { slug: string; q: string }[] {
  return GROUPS[mode].flatMap(g => g.tools)
    .slice(0, 4)
    .map(t => ({ slug: t.slug, q: t.question }));
}

function toolOf(mode: Mode, slug: string | null | undefined): ToolEntry | undefined {
  if (!slug) return undefined;
  return GROUPS[mode].flatMap(g => g.tools).find(t => t.slug === slug);
}

/** 这一轮到底是谁给的：三种来源三句话，不许混用。 */
function sourceLine(t: AskTurn): string {
  if (t.chosen) return '这一条是你在并列的候选里自己挑的，不是系统替你选的。';
  if (t.source === 'server') return '这一轮来自服务端路由';
  return '这一轮由本机目录匹配给出，未经模型';
}

/** 落点判定。顺序有意义：closed 与 choices 都比"没对上"具体，先看具体的那一支。 */
function outcomeOf(r: AssistantRouteResult): 'matched' | 'choices' | 'closed' | 'clarify' {
  if (r.available && r.toolSlug) return 'matched';
  if (r.closedSlug) return 'closed';
  if ((r.candidates?.length ?? 0) >= 2) return 'choices';
  return 'clarify';
}

export default function QuestionComposer({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  // IME 门闩：中文输入法组词过程中的 Enter 是"确认候选词"，不是"发送"。
  // 只信 React 的合成事件不够（部分浏览器不在 nativeEvent.isComposing 上置位），
  // 所以 compositionstart/end 自己记一份，两个条件任一成立就不发送 —— 误发一次的代价是
  // 用户看到一条半截的问题被当成一句话去路由，比多按一次回车大得多。
  const composing = useRef(false);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  const grow = () => {
    const el = boxRef.current;
    if (!el) return;
    // 4 行起、最多 8 行：超过就内部滚。让 textarea 无限长会把下面的意图区/目录推出首屏，
    // 而"四类意图必须在首屏内"是一条钉着的契约。
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 8 * 24 + 20) + 'px';
  };

  const ask = async (raw: string, chosenSlug?: string) => {
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
    let result = outcome.result;
    if (chosenSlug) {
      // 用户在并列里挑了一个。挑中不等于放行：仍然走 reconcile 那道目录白名单，
      // "还要补什么"走 needsFor —— 两处都复用同一个实现，页面不抄第二份表。
      const missing = needsFor(chosenSlug, q);
      result = reconcile({
        mode, toolSlug: chosenSlug, confidence: outcome.result.confidence,
        needsClarification: missing.length > 0, clarification: null,
        missingFields: missing, available: true,
      }, mode, GROUPS[mode].flatMap(g => g.tools));
    }
    const turn: AskTurn = {
      id: `t${seq.current}`, text: q, result,
      source: outcome.source, degraded: outcome.degraded, chosen: !!chosenSlug,
    };
    setTurns(t => [turn, ...t].slice(0, 6));
    setText('');
    setBusy(false);
    requestAnimationFrame(grow);
  };

  const ex = examples(mode);

  return (
    <div className="qa" data-mode={mode} data-compact={compact ? '1' : undefined}>
      <form
        onSubmit={e => { e.preventDefault(); void ask(text); }}
        style={{ display: 'grid', gap: 8 }}>
        <label className="qn-label" htmlFor={`qa-input-${mode}`} style={{ margin: 0 }}>
          问一句（中文）
        </label>
        {/* 按钮文字在「问一下 / 在想」之间变长变短会让整行重新排（实测整页被推下去 54px、
            CLS 0.106），所以这一行 nowrap + 按钮固定最小宽；输入框自己 min-width:0，永远让得起。 */}
        <div className="qa-row">
          <textarea
            id={`qa-input-${mode}`} ref={boxRef} className="qn-input qn-textarea" rows={4}
            value={text}
            onChange={e => { setText(e.target.value); grow(); }}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.shiftKey) return;
              if (composing.current || e.nativeEvent.isComposing) return;
              e.preventDefault();
              void ask(text);
            }}
            placeholder={PLACEHOLDER[mode]} maxLength={500} aria-describedby={`qa-note-${mode}`} />
          <button type="submit" className="qn-btn qn-btn--solid qa-submit"
            disabled={busy || text.trim().length === 0}>
            {busy ? '在想' : '问一下'}
          </button>
        </div>
        <p className="qn-cap qa-keys">Enter 发送 · Shift + Enter 换行 · 中文组词中的回车不算发送</p>
      </form>

      <p id={`qa-note-${mode}`} className="qn-cap" style={{ marginTop: 6 }}>
        问事框只把你带到该用的工具，不在这儿给结论；问题原文只留在这个页面上，不写日志、不进台账。
      </p>

      {ex.length > 0 && (
        <div className="qa-examples" style={{ marginTop: 10 }}>
          {ex.map(x => (
            <button key={x.slug} type="button" className="qn-chip" onClick={() => void ask(x.q)}
              style={{ minHeight: 44, maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.q}</span>
            </button>
          ))}
        </div>
      )}

      {err && <p className="qn-alert" role="alert" style={{ marginTop: 10 }}>{err}</p>}

      {/* 两种模式都给答案面板固定高度 + 内部滚动：答案卡插进来不再把下面的目录或意图区推下去。
          /western 问事态实测 CLS 0.155 就是这么来的，compact 那一版桌面实测一条回答 0.039、
          两条 0.103（超 0.1 判红）。预留的高度写在 globals.css 的 .qa-pane 两条规则上，
          数字与理由（含 375 为什么读到 0）也记在那里 —— 这里只说约束：四类意图必须仍在首屏内，
          所以 compact 只能预留 132px，不能预留一整张卡的高度。 */}
      <div className="qa-pane" data-compact={compact ? '1' : undefined}>
        <div className="qa-turns" aria-live="polite">
        {/* 两种模式都渲染这一句：compact 那一版现在预留了 132px（见 globals.css 的 CLS 注释），
            预留的那一块必须有内容，否则首屏就是一截空白。 */}
        {turns.length === 0 && (
          <p className="qn-cap" style={{ margin: 0 }}>问一句之后，结果出现在这一块。</p>
        )}
        {turns.map(t => {
          const kind = outcomeOf(t.result);
          const tool = toolOf(mode, t.result.toolSlug);
          const closed = toolOf(mode, t.result.closedSlug);
          return (
            <div key={t.id} className="qn-card qa-turn" data-outcome={kind} style={{ marginTop: 10 }}>
              <p className="qn-meta" style={{ margin: 0 }}>你问：{t.text}</p>

              {kind === 'matched' && tool && (
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
              )}

              {kind === 'choices' && (
                <>
                  <p className="qn-body" style={{ marginTop: 8 }}>
                    {t.result.clarification || '这句话同时像两个工具，你要先看哪一个？'}
                  </p>
                  {/* 并列就摆两个 chip，谁也不许被默认选中：替用户挑一个，错了没人知道。 */}
                  <div className="qa-examples" style={{ marginTop: 8 }} role="group" aria-label="并列候选">
                    {(t.result.candidates ?? []).map(s => {
                      const c = toolOf(mode, s);
                      if (!c) return null;
                      return (
                        <button key={s} type="button" className="qn-chip"
                          style={{ minHeight: 44, maxWidth: '100%' }}
                          onClick={() => void ask(t.text, s)}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {kind === 'closed' && (
                <>
                  <p className="qn-body" style={{ marginTop: 8 }}>
                    <span className="qn-badge">
                      <span className="qn-badge__dot" aria-hidden="true"
                        style={{ background: STATUS_DOT['未开放'] }} />
                      未开放
                    </span>
                    <span style={{ marginLeft: 8 }}>{closed ? closed.name : '这一项'}还没做，所以这里不给入口。</span>
                  </p>
                  <p className="qn-meta" style={{ marginTop: 6 }}>
                    {t.result.clarification || '缺的部分补齐之后才会开放。'}
                  </p>
                </>
              )}

              {kind === 'clarify' && (
                <p className="qn-body" style={{ marginTop: 8 }}>
                  {t.result.clarification || '这句话我没能对上已经开放的工具。'}
                </p>
              )}

              {/* 降级理由必须上屏（缺陷②）。以前这个字段拿到了却不显示，于是"服务端根本没接上"
                  与"服务端答得很好"在页面上长得一模一样。 */}
              {t.degraded && (
                <p className="qn-note qa-degraded" role="status" style={{ marginTop: 8 }}>
                  服务端这一轮没用上：{t.degraded}。
                </p>
              )}
              <p className="qn-cap" style={{ marginTop: 8 }}>{sourceLine(t)}</p>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
