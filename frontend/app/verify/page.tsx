'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RECEIPT_VERSIONS, verifyReceipt } from '@/lib/receipt/receipt';
import type { Receipt, VerifyCheck } from '@/lib/receipt/receipt';

// 站内验真：把下载到的回执 JSON 贴进来或选文件，全部在浏览器本地重算摘要比对。
// 这一页不联网、不查库、不按 id 去拉报告 —— 报告的 inputJson 里有原始问题与生辰，
// 任何「按编号取原文」的做法都会把验真页变成枚举入口。所以这里只有一种输入：回执本身。

interface Result { ok: boolean; checks: VerifyCheck[]; receipt: Receipt }

export default function VerifyPage() {
  const [text, setText] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const run = async (raw: string) => {
    setError('');
    setResult(null);
    let parsed: Receipt;
    try {
      parsed = JSON.parse(raw) as Receipt;
    } catch {
      setError('这不是一份 JSON 回执。请把你下载的 .json 文件内容整段贴进来，或直接选文件。');
      return;
    }
    if (!parsed?.core || !parsed?.recordHash) {
      setError(`缺 core 或 recordHash，不是本站认得的回执形状（${RECEIPT_VERSIONS.join(' / ')}）。`);
      return;
    }
    try {
      const r = await verifyReceipt(parsed, question.trim() ? { question } : undefined);
      setResult({ ...r, receipt: parsed });
    } catch (e) {
      setError(e instanceof Error ? `验真中断：${e.message}` : '验真中断');
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setText(await file.text());
  };

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>回执验真</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>本地重算，不取原文</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>SHA-256 在你自己的浏览器里算，页面不发送任何请求</p>
      </header>

      <section className="qn-card qn-rise qn-rise--2">
        <label className="qn-label" htmlFor="rv-file">选一份回执（.json）</label>
        <input id="rv-file" className="qn-input" type="file" accept="application/json,.json"
          style={{ marginTop: 8 }} onChange={e => { void onFile(e.target.files?.[0]); }} />
        <label className="qn-label" htmlFor="rv-text" style={{ display: 'block', marginTop: 16 }}>或直接粘贴内容</label>
        <textarea id="rv-text" className="qn-textarea" rows={7} style={{ marginTop: 8, width: '100%' }}
          placeholder='{"core":{"version":"hundun-receipt-v2", … }}'
          value={text} onChange={e => setText(e.target.value)} />
        <label className="qn-label" htmlFor="rv-q" style={{ display: 'block', marginTop: 16 }}>当初问的事（选填）</label>
        <input id="rv-q" className="qn-input" style={{ marginTop: 8, width: '100%' }} value={question}
          placeholder="填了才会复核问题摘要；回执里没有原文，这是刻意的"
          onChange={e => setQuestion(e.target.value)} />
        {error && <p className="qn-alert" role="alert" style={{ marginTop: 14 }}>{error}</p>}
        <button type="button" className="qn-btn qn-btn--solid qn-btn--block" style={{ marginTop: 16 }}
          onClick={() => run(text)}>开始验真</button>
      </section>

      {result && (
        <section className="qn-card qn-rise" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p className="qn-title" style={{ margin: 0 }}>
              {result.ok ? '这份回执与它记录的盘一致' : '验真未通过'}
            </p>
            <span className="qn-badge">
              <span className="qn-badge__dot" style={{ background: result.ok ? 'var(--color-ji)' : 'var(--color-xiong)' }} />
              {result.receipt.core.kind === 'liuyao-report' ? '解读回执' : '卦盘回执'}
            </span>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {result.checks.map(c => (
              <div key={c.field} className="qn-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                {/* 三态而不是两态：没测过的东西标成绿色「通过」就是在骗人，标成红色又是在谎报篡改。
                    金色是站里既有的中性强调墨色（次要灰在卡底只有 4.48:1，过不了 AA）。 */}
                <span className="qn-axis" style={{
                  flex: '0 0 84px',
                  color: c.na ? 'var(--color-accent-gold-text)' : c.ok ? 'var(--color-ji)' : 'var(--color-xiong)',
                }}>
                  {c.na ? '未复核' : c.ok ? '通过' : '不通过'}
                </span>
                <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <strong>{c.field}</strong> · {c.detail}
                </span>
              </div>
            ))}
          </div>
          <p className="qn-note" style={{ marginTop: 14 }}>
            通过只说明「这份回执与它自带的盘身、时间、摘要自洽，没有被改过」，不说明卦断得准不准，
            也不说明内容是谁写的。
          </p>
          <p className="qn-cap" style={{ marginTop: 8 }}>
            锚定状态：{result.receipt.anchor ? `${result.receipt.anchor.date} 已入台账 root ${result.receipt.anchor.root}` : '未锚定 —— 回执摘要尚未进入对外公开的每日台账；此处不做任何上链声明。'}
          </p>
        </section>
      )}

      <section className="qn-legal" style={{ marginTop: 24 }}>
        <h2>这页能证明什么，不能证明什么</h2>
        <p>能证明：你手上这份回执的内容自洽，改任何一个字都会红；以及它记录的是哪一盘、哪一刻、用哪套口径（{RECEIPT_VERSIONS.join(' / ')}）。</p>
        <p>v2 的铜钱卦还能多证明一层：这六个爻值确实由掷钱之前锁定的那个 seed 派生 —— seedHash、18 个 bit
          与盘上爻值三处互相咬合，改任何一处都会红。这就是 commit-reveal 能给的全部。</p>
        <p>不能证明：掷钱这个动作真的在物理世界里发生过；也不能证明你在揭晓之前没有整盘重来过 ——
          重来就是新 seed、新承诺，只有最后揭晓的那一份会进回执。要证「承诺早于结果」得把 seedHash 也送进每日台账，
          那是另一件事。解读正确与否同样不在证明范围内。回执里没有原始问题与生辰，问题只以带盐摘要存在，
          因此只有本人事后重填原文才能复核那一项。</p>
        <p className="qn-linkrow">
          <Link href="/liuyao/create" className="qn-link">去起卦</Link>
          <Link href="/tools" className="qn-link">全部工具与取数口径</Link>
        </p>
      </section>
    </main>
  );
}
