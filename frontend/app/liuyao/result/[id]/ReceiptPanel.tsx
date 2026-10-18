'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LiuyaoResult } from '@/types/liuyao';
import { buildPlateReceipt, buildReportReceipt, receiptFileName } from '@/lib/receipt/receipt';
import type { Receipt } from '@/lib/receipt/receipt';

// 结果回执面板：只负责「生成 + 下载」，验真在 /verify 上做。
// 全程不联网、不上传：摘要与盘身都留在用户自己手里，服务端没有新增任何端点。
// 台账（#80）没接进来之前，anchor 恒为 null，这里也就永远显示「未锚定」。

function download(receipt: Receipt) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = receiptFileName(receipt);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReceiptPanel({ result, reportText }: { result: LiuyaoResult; reportText?: string | null }) {
  const [plate, setPlate] = useState<Receipt | null>(null);
  const [report, setReport] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    setError('');
    try {
      const p = await buildPlateReceipt(result);
      setPlate(p);
      if (reportText) setReport(await buildReportReceipt(p, reportText));
    } catch (e) {
      setError(e instanceof Error ? `未能生成回执：${e.message}` : '未能生成回执');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="qn-card" style={{ marginBottom: 16, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p className="qn-title" style={{ margin: 0 }}>结果回执</p>
        <span className="qn-badge">
          <span className="qn-badge__dot" style={{ background: 'var(--color-text-muted)' }} />
          未锚定
        </span>
      </div>
      <p className="qn-meta" style={{ marginTop: 8 }}>
        给这一盘出一份可离线复验的凭证：盘身与问题分别取 SHA-256 摘要，问题只留带盐摘要，原文不进回执。
        改动任何一个字，验真就会失败。
      </p>

      {!plate && (
        <button type="button" className="qn-btn qn-btn--solid qn-btn--block" style={{ marginTop: 14 }}
          onClick={make} disabled={busy}>
          {busy ? '取摘要中' : '生成本盘回执'}
        </button>
      )}
      {error && <p className="qn-alert" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      {plate && (
        <>
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            {([['卦盘摘要', plate.core.plateHash], ['问题摘要', plate.core.subjectHash], ['回执编号', plate.recordHash]] as const)
              .map(([k, v]) => (
                <div key={k} className="qn-row" style={{ gap: 10 }}>
                  <span className="qn-axis" style={{ flex: '0 0 auto' }}>{k}</span>
                  <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span>
                </div>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="qn-btn qn-btn--ghost" onClick={() => download(plate)}>下载卦盘回执</button>
            {report && (
              <button type="button" className="qn-btn qn-btn--ghost" onClick={() => download(report)}>下载解读回执</button>
            )}
            <Link href="/verify" className="qn-btn qn-btn--ghost">去验真</Link>
          </div>
          <p className="qn-cap" style={{ marginTop: 12 }}>
            {report
              ? '解读比卦盘晚生成，所以另封一份并用 parentHash 指回卦盘，不把两个时间点伪造成一条记录。'
              : '本次未生成解读；先生成解读再下载，会另出一份解读回执。'}
          </p>
        </>
      )}
    </section>
  );
}
