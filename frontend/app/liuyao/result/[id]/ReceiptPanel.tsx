'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LiuyaoResult } from '@/types/liuyao';
import { buildPlateReceipt, buildReportReceipt, receiptFileName } from '@/lib/receipt/receipt';
import type { Receipt } from '@/lib/receipt/receipt';
import { anchorSentence, fetchAnchorStatus, submitReceiptSummary } from '@/lib/receipt/anchor';
import type { AnchorView } from '@/lib/receipt/anchor';
import { getVisitorId } from '@/lib/auth/visitor';

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

type AnchorRow = { view: AnchorView; text: string };

export default function ReceiptPanel({ result, reportText }: { result: LiuyaoResult; reportText?: string | null }) {
  const [plate, setPlate] = useState<Receipt | null>(null);
  const [report, setReport] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 台账状态：按回执分别记，未查过就是 null（界面写「未提交」）。
  const [ledger, setLedger] = useState<{ plate: AnchorRow | null; report: AnchorRow | null }>({ plate: null, report: null });
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [anchorError, setAnchorError] = useState('');

  const make = async () => {
    setBusy(true);
    setError('');
    try {
      const p = await buildPlateReceipt(result);
      setPlate(p);
      if (reportText) setReport(await buildReportReceipt(p, reportText));
    } catch {
      setError('暂时无法生成回执，请刷新页面后重试。');
    } finally {
      setBusy(false);
    }
  };

  /** 提交 = 只送摘要，送完立刻回读一次状态（服务端按 UTC 日分片，次日 04:20 才封账）。 */
  const submitAll = async () => {
    setAnchorBusy(true); setAnchorError('');
    const next: { plate: AnchorRow | null; report: AnchorRow | null } = { plate: ledger.plate, report: ledger.report };
    const jobs: [keyof typeof next, Receipt][] = [['plate', plate!], ...(report ? [['report', report] as [keyof typeof next, Receipt]] : [])];
    for (const [key, r] of jobs) {
      if (!r) continue;
      const s = await submitReceiptSummary(r, getVisitorId());
      if (!s.ok) { setAnchorError(s.error); continue; }
      const st = await fetchAnchorStatus(r);
      const day = (st.ok && st.day) || s.day;
      const reason = st.ok ? st.reason : undefined;
      next[key] = { view: st.view, text: anchorSentence(st.view, { day, reason }) + (s.already ? ' · 此前已提交过' : '') };
    }
    setLedger(next); setAnchorBusy(false);
  };

  const refreshAll = async () => {
    setAnchorBusy(true); setAnchorError('');
    const next: { plate: AnchorRow | null; report: AnchorRow | null } = { plate: null, report: null };
    const jobs: [keyof typeof next, Receipt | null][] = [['plate', plate], ['report', report]];
    for (const [key, r] of jobs) {
      if (!r) continue;
      const st = await fetchAnchorStatus(r);
      if (!st.ok) { setAnchorError(st.error); next[key] = { view: 'unknown', text: st.error }; continue; }
      next[key] = { view: st.view, text: anchorSentence(st.view, { day: st.day, reason: st.reason }) };
    }
    setLedger(next); setAnchorBusy(false);
  };

  const badge = ledger.plate?.view ?? 'unsubmitted';
  const badgeText = ledger.plate ? ledger.plate.text : '未提交';

  const rnd = plate?.core.randomness;
  // 有承诺时多列一行 seedHash：它是揭晓前唯一公布过的东西，用户自己也要能看见。
  const rows: [string, string][] = plate
    ? [
        ['卦盘摘要', plate.core.plateHash],
        ...(rnd ? [['随机承诺', rnd.seedHash] as [string, string]] : []),
        ['问题摘要', plate.core.subjectHash],
        ['回执编号', plate.recordHash],
      ]
    : [];

  return (
    <section className="qn-card" style={{ marginBottom: 16, padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p className="qn-title" style={{ margin: 0 }}>结果回执</p>
        <span className="qn-badge">
          <span className="qn-badge__dot" style={{ background: badge === 'pending' ? 'var(--color-accent-gold)' : 'var(--color-text-muted)' }} />
          {badgeText}
        </span>
      </div>
      <p className="qn-meta" style={{ marginTop: 8 }}>
        生成一份可离线核验的回执。系统会为盘面和问题计算校验摘要；回执不保存问题原文，内容被改动后核验会失败。
      </p>

      {!plate && (
        <button type="button" className="qn-btn qn-btn--solid qn-btn--block" style={{ marginTop: 14 }}
          onClick={make} disabled={busy}>
          {busy ? '生成中' : '生成本盘回执'}
        </button>
      )}
      {error && <p className="qn-alert" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      {plate && (
        <>
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            {rows.map(([k, v]) => (
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

          {/* 台账（P1）。两态措辞：未锚定 / 等待锚定 —— 服务端目前给不出 anchored，
              本站也不替它猜。提交只送摘要，状态是独立读取，下载的那份文件永不改写。 */}
          <div style={{ marginTop: 16, borderTop: '0.5px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="qn-btn qn-btn--ghost" onClick={() => void submitAll()} disabled={anchorBusy}>
                {anchorBusy ? '提交中' : '提交摘要进台账'}
              </button>
              <button type="button" className="qn-btn qn-btn--ghost" onClick={() => void refreshAll()} disabled={anchorBusy}>
                查询台账状态
              </button>
            </div>
            {anchorError && <p className="qn-alert" role="alert" style={{ marginTop: 12 }}>{anchorError}</p>}
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              <div className="qn-row" style={{ gap: 10 }}>
                <span className="qn-axis" style={{ flex: '0 0 auto' }}>卦盘回执</span>
                <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{ledger.plate ? ledger.plate.text : '未提交 —— 摘要还没送进台账，本站不替它声明任何链上事实'}</span>
              </div>
              {report && (
                <div className="qn-row" style={{ gap: 10 }}>
                  <span className="qn-axis" style={{ flex: '0 0 auto' }}>解读回执</span>
                  <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{ledger.report ? ledger.report.text : '未提交'}</span>
                </div>
              )}
            </div>
            <p className="qn-cap" style={{ marginTop: 10 }}>
              提交时会附带浏览器归属标识；台账只记录回执编号、校验摘要和核对所需的时间与规则信息，不会收到问题原文、出生信息或完整盘面。
              查询按回执编号进行，台账状态单独显示，不会改写你下载的回执。
            </p>
          </div>
          <p className="qn-cap" style={{ marginTop: 12 }}>
            {report
              ? '解读在卦盘之后生成，因此会单独核验，并保留它与原卦盘的对应关系。'
              : '本次未生成解读；先生成解读再下载，会另出一份解读回执。'}
          </p>
          {/* 随机承诺的边界照实写：能证明什么、不能证明什么，都按上限说。 */}
          {rnd ? (
            <p className="qn-cap" style={{ marginTop: 8 }}>
              本次在第一次掷币前生成了随机校验承诺，核验页可检查最终记录是否与承诺一致。
              它能发现记录生成后被改动的情况，但不能证明现实中确实掷过硬币，也不能阻止重新起卦。
            </p>
          ) : (
            <p className="qn-cap" style={{ marginTop: 8 }}>
              {plate.core.method === 'coin'
                ? '生成这份回执时还没有随机校验功能，因此只能核对盘面内容，不能核验掷币过程。'
                : '时间与报数起卦依据输入直接计算，不使用随机值，因此不需要随机承诺。'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
