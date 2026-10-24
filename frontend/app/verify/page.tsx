'use client';

import { useState } from 'react';
import Link from 'next/link';
import { verifyReceipt } from '@/lib/receipt/receipt';
import type { Receipt, VerifyCheck } from '@/lib/receipt/receipt';

// 站内验真：把下载到的回执 JSON 贴进来或选文件，全部在浏览器本地重算摘要比对。
// 这一页不联网、不查库、不按 id 去拉报告 —— 报告的 inputJson 里有原始问题与生辰，
// 任何「按编号取原文」的做法都会把验真页变成枚举入口。所以这里只有一种输入：回执本身。

interface Result { ok: boolean; checks: VerifyCheck[]; receipt: Receipt }

const CHECK_LABELS: Record<string, string> = {
  version: '回执格式', plateHash: '卦盘内容', subjectHash: '问事内容',
  seedHash: '随机承诺', commitBits: '随机校验记录', tossReplay: '卦象生成记录',
  commitSchema: '随机校验格式', randomness: '随机过程', reportHash: '解读内容',
  parentHash: '卦盘关联', recordHash: '整份回执', receiptId: '回执编号', anchor: '公开台账',
};

function checkDescription(check: VerifyCheck, receipt: Receipt): string {
  if (check.field === 'anchor') return '此页不会查询公开台账，因此无法确认是否登记或完成锚定。';
  if (check.field === 'subjectHash' && check.na) return '回执不含问题原文；由本人重新输入当初的问题后，才能核对这一项。';
  if (check.field === 'randomness' && check.na) return receipt.core.method === 'coin'
    ? '这份较早的回执没有随机校验信息，无法核验摇卦过程。'
    : '时间与报数起卦不使用随机过程。';
  if (check.field === 'version') return check.ok ? '回执格式可识别。' : '无法识别这份回执的格式。';
  if (check.field === 'plateHash') return check.ok ? '卦盘内容与回执记录相符。' : '卦盘内容与回执记录不符。';
  if (check.field === 'subjectHash') return check.ok ? '你输入的问题与回执记录相符。' : '你输入的问题与回执记录不符。';
  if (check.field === 'seedHash' || check.field === 'commitBits' || check.field === 'tossReplay') {
    return check.ok ? '随机记录与回执中的预先承诺相符。' : '随机记录与回执中的预先承诺不符。';
  }
  if (check.field === 'commitSchema') return '这份回执使用的随机校验格式无法核验。';
  if (check.field === 'reportHash') return check.ok ? '解读内容与回执记录相符。' : '解读内容与回执记录不符。';
  if (check.field === 'parentHash') return check.ok ? '解读回执中包含卦盘关联编号。' : '解读回执缺少卦盘关联编号。';
  if (check.field === 'recordHash') return check.ok ? '回执整体内容与校验值相符。' : '回执整体内容与校验值不符。';
  if (check.field === 'receiptId') return check.ok ? '回执编号与文件内容相符。' : '回执编号与文件内容不符。';
  return check.ok ? '与回执记录相符。' : '与回执记录不符。';
}

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
      setError('无法读取这份回执。请粘贴从本站下载的完整内容，或直接选择原始文件。');
      return;
    }
    if (!parsed?.core || !parsed?.recordHash) {
      setError('文件内容不完整，无法识别为本站回执。请重新选择完整的下载文件。');
      return;
    }
    try {
      const r = await verifyReceipt(parsed, question.trim() ? { question } : undefined);
      setResult({ ...r, receipt: parsed });
    } catch {
      setError('暂时无法完成核验。请确认回执文件完整后重试。');
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
        <p className="qn-meta" style={{ letterSpacing: '0.06em' }}>核验在当前浏览器内完成，回执内容不会上传。</p>
      </header>

      <section className="qn-card qn-rise qn-rise--2">
        <label className="qn-label" htmlFor="rv-file">选一份回执（.json）</label>
        <input id="rv-file" className="qn-input" type="file" accept="application/json,.json"
          style={{ marginTop: 8 }} onChange={e => { void onFile(e.target.files?.[0]); }} />
        <label className="qn-label" htmlFor="rv-text" style={{ display: 'block', marginTop: 16 }}>或直接粘贴内容</label>
        <textarea id="rv-text" className="qn-textarea" rows={7} style={{ marginTop: 8, width: '100%' }}
          placeholder="粘贴从本站下载的完整回执内容"
          value={text} onChange={e => setText(e.target.value)} />
        <label className="qn-label" htmlFor="rv-q" style={{ display: 'block', marginTop: 16 }}>当初问的事（选填）</label>
        <input id="rv-q" className="qn-input" style={{ marginTop: 8, width: '100%' }} value={question}
          placeholder="填写后可核对问事内容；回执本身不保存原文"
          onChange={e => setQuestion(e.target.value)} />
        {error && <p className="qn-alert" role="alert" style={{ marginTop: 14 }}>{error}</p>}
        <button type="button" className="qn-btn qn-btn--solid qn-btn--block" style={{ marginTop: 16 }}
          onClick={() => run(text)}>开始验真</button>
      </section>

      {result && (
        <section className="qn-card qn-rise" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p className="qn-title" style={{ margin: 0 }}>
              {result.ok ? '已核验项目均通过' : '部分核验未通过'}
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
                  color: c.na || c.field === 'anchor' ? 'var(--color-accent-gold-text)' : c.ok ? 'var(--color-ji)' : 'var(--color-xiong)',
                }}>
                  {c.field === 'anchor' ? '未查询' : c.na ? '未复核' : c.ok ? '通过' : '不通过'}
                </span>
                <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <strong>{CHECK_LABELS[c.field] || '校验项目'}</strong> · {checkDescription(c, result.receipt)}
                </span>
              </div>
            ))}
          </div>
          <p className="qn-note" style={{ marginTop: 14 }}>
            核验通过只说明已检查的项目彼此相符。它不能证明回执最初生成的时间，也不能证明没人重做过另一份文件；不代表卦象或解读准确。
          </p>
          <p className="qn-cap" style={{ marginTop: 8 }}>
            公开台账：此页不会查询台账，因此无法确认这份回执是否已登记或完成锚定。
          </p>
        </section>
      )}

      <section className="qn-legal" style={{ marginTop: 24 }}>
        <h2>核验范围</h2>
        <p>本地核验可检查回执内容是否完整、盘面和校验摘要是否相符。若回执包含随机承诺，也会检查最终记录能否由该承诺复算。</p>
        <p>它不能证明现实中确实掷过硬币，也不能独立证明校验码曾在结果揭晓前被公开记录；重新起卦会生成一份新承诺。核验也不判断解读是否准确。</p>
        <p>回执不保存问事原文。需要复核问题时，由本人重新输入当初的问题；出生信息不会参与这项核验。</p>
        <details style={{ marginTop: 12 }}>
          <summary className="qn-meta" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>查看校验原理</summary>
          <p className="qn-meta" style={{ marginTop: 6 }}>
            页面在本机重新计算校验摘要，并与回执记录比较；不会把回执内容发送到服务器。随机承诺会核对校验码、六次结果与最终卦象之间是否一致。
          </p>
        </details>
        <p className="qn-linkrow">
          <Link href="/liuyao/create" className="qn-link">去起卦</Link>
          <Link href="/tools" className="qn-link">全部工具与取数口径</Link>
        </p>
      </section>
    </main>
  );
}
