'use client';

import { useEffect, useState, useRef } from 'react';
import LiuYaoPlate from '../../create/LiuYaoPlate';
import { analyzeLiuyao } from '@/lib/liuyao/analysis';
import type { LiuyaoAnalysisData } from '@/lib/liuyao/analysis';
import { WX } from '@/lib/liuyao/core';
import { QISHU_BASIS } from '@/lib/meihua/engine';
import type { LiuyaoResult } from '@/types/liuyao';
import Link from 'next/link';
import ReceiptPanel from './ReceiptPanel';
import { saveReport } from '@/lib/report/saveReport';
import { RichText } from '@/lib/ui/richText';
import ClassicalReferences from '@/components/chart/ClassicalReferences';
import ToolInterpretation from '@/components/ai/ToolInterpretation';

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

export default function LiuyaoResultPage() {
  const [result, setResult] = useState<LiuyaoResult | null>(null);
  const [analysisData, setAnalysisData] = useState<LiuyaoAnalysisData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportSourceIds, setReportSourceIds] = useState<string[]>([]);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(true);
  const savedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('liuyao_result');
      if (stored) {
        const r: LiuyaoResult = JSON.parse(stored);
        setResult(r);
        const ad = analyzeLiuyao(r);
        setAnalysisData(ad);
        if (!savedRef.current) {
          savedRef.current = true;
          saveReport({
            type: 'liuyao',
            title: r.question || '六爻占卜',
            inputJson: { question: r.question || '', questionType: r.questionType || '', method: r.method || '' },
            resultJson: r as any,
            analysisJson: ad as any,
          }).catch(() => {});
        }
      }
    } catch(e) { console.error('Failed to load result:', e); }
    setLoading(false);
  }, []);

  const generateReport = async () => {
    if (!result) return;
    setReportLoading(true);
    setReportError('');
    try {
      const res = await fetch('/api/liuyao/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.report !== 'string' || !data.report.trim()) throw new Error('report-unavailable');
      setReportContent(data.report);
      const rawSources = data.sourceIds || data.sources || data.citations || [];
      const sourceIds = Array.isArray(rawSources)
        ? rawSources.map((item: any) => typeof item === 'string' ? item : item?.sourceId || item?.id || '').filter(Boolean)
        : [];
      setReportSourceIds(Array.from(new Set(sourceIds)));
      saveReport({
        type: 'liuyao',
        title: result.question || '六爻占卜',
        inputJson: { question: result.question || '', questionType: result.questionType || '', method: result.method || '' },
        resultJson: result as any,
        analysisJson: analysisData as any,
        reportText: data.report,
      }).catch(() => {});
    } catch {
      setReportError('本次报告暂未生成，请稍后重试。卦象盘面仍可查看。');
    } finally {
      setReportLoading(false);
    }
  };

  // ---- loading state ----
  if (loading) {
    return (
      // 这一帧必须占满一整屏。原来的骨架只有一个 <main> 里的一行字，页脚因此画在
      // 视口内（实测 1280×900 下 top=687）；卦象在同一 tick 之后插进来把页脚顶出屏幕，
      // Chrome 就记一次位移动 —— 四个 fixture 各报一条加载期 CLS（0.171 / 0.237 / 0.214 / 0.176），
      // 归因输出写得很死：CLS-SRC 的来源元素就是 footer.qn-footer，dy 与"页脚被推走"一致。
      // 所以修法不是放宽阈值，而是让页脚在第一帧就不在视口里：它从未被画在屏上，
      // 后面再怎么移动都不该有记账资格。
      <main className="qn-shell" style={{ textAlign: 'center', minHeight: '100vh' }}>
        <p className="qn-title" style={{ color: 'var(--color-text-secondary)' }}>起卦中...</p>
      </main>
    );
  }

  // ---- empty state ----
  if (!result) {
    return (
      <main className="qn-shell">
        <div className="qn-card" style={{ textAlign: 'center', padding: '60px 28px' }}>
          <p className="qn-title">未找到卦象数据</p>
          <p className="qn-meta" style={{ marginTop: 8 }}>请返回起卦页面重新摇卦</p>
          <Link href="/liuyao/create" className="qn-btn qn-btn--ghost" style={{ marginTop: 24 }}>
            ← 返回起卦
          </Link>
        </div>
      </main>
    );
  }

  const methodLabel = result.method === 'coin' ? '铜钱摇卦' : result.method === 'time' ? '时间起卦' : '数字起卦';

  // ---- main content ----
  return (
    <main className="qn-shell">

      {/* ===== PAGE TITLE ===== */}
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>六爻占卜</p>
        {result.question && (
          <h1 className="qn-hero" style={{ margin: '10px 0 0', overflowWrap: 'break-word' }}>{result.question}</h1>
        )}
        <p className="qn-meta" style={{ marginTop: 10 }}>
          {methodLabel} · {result.date.year}年{String(result.date.month).padStart(2, '0')}月{String(result.date.day).padStart(2, '0')}日
        </p>
        {result.ganZhi?.day && (
          <p className="qn-meta" style={{ marginTop: 6, fontFamily: '"Noto Serif SC", serif' }}>
            {result.ganZhi.year}年 {result.ganZhi.month}月 {result.ganZhi.day}日 {result.ganZhi.hour}时
            {result.xunKong ? ` · ${result.xunKong}旬空` : ''}
          </p>
        )}
        {result.solar && (
          <p className="qn-meta" style={{ marginTop: 6 }}>
            {result.solar.mode === 'true-solar'
              ? `起卦用${result.solar.label}：钟表 ${result.solar.clockText} → 真太阳时 ${result.solar.solarText}（${result.solar.correctionMinutes > 0 ? '+' : ''}${result.solar.correctionMinutes} 分钟）`
              : `起卦口径：${result.solar.label}`}
          </p>
        )}
        {result.solar?.crossedDay && (
          <p className="qn-cap" style={{ marginTop: 4 }}>校正后跨日，日柱按真太阳时所在日取</p>
        )}
        {result.solar && !result.solar.crossedDay && result.solar.crossedHour && (
          <p className="qn-cap" style={{ marginTop: 4 }}>校正后跨时辰，时柱按真太阳时所在时辰取</p>
        )}
        {/* 干支与纳甲各有各的口径版本戳，缺任意一个就是这次收口之前的盘：只标注，不重排
            （重跑覆盖历史等于伪造，A4 裁定）。文案保持一句，老盘不会因为我们又加了一个戳就多冒一行。
            报数那条还要看取数戳：D8 之前它把「先天数序号的二进制」当爻象，卦名与爻象是两套，
            那种盘的干支/纳甲两个戳齐全、光看它们认不出来，只有 qiShu.version 对得上才说明取数也是新口径。
            摇卦与时间的取数这一批没动，不拿这个戳去虚报它们的盘。 */}
        {(!result.ganzhiBasis || !result.najiaBasis ||
          (result.method === 'number' && result.qiShu?.version !== QISHU_BASIS)) && (
          <p className="qn-cap" style={{ marginTop: 6 }}>本盘按起卦时口径生成</p>
        )}
      </header>

      {/* ===== HERO: 六爻排盘 ===== */}
      <section className="qn-card qn-rise qn-rise--2" style={{ padding: '24px 16px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LiuYaoPlate
            benName={result.benGua.name}
            bianName={result.bianGua.name}
            gong={result.benGua.gong}
            gongWx={result.benGua.wuxing}
            bianGong={result.bianGua.gong ? { gong: result.bianGua.gong } : null}
            naJiaResult={result.naJia}
            bianNaJiaResult={result.bianNaJia}
            liuShenList={result.liuShen}
            WX={WX as Record<string,string>}
          />
        </div>
      </section>

      {/* ===== ANALYSIS: 世应 + 动爻 + 用神 ===== */}
      <section className="qn-card qn-rise qn-rise--3" style={{ marginBottom: 16 }}>

        {/* 世应 — compact inline */}
        {analysisData?.shiYing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            paddingBottom: 12, marginBottom: 12, borderBottom: 'var(--qn-hairline)',
          }}>
            <span className="qn-axis" style={{ minWidth: 40 }}>世应</span>
            <span className="qn-body" style={{ fontWeight: 500 }}>
              世爻 {YAO_NAMES[analysisData.shiYing.shiPosition - 1]} {analysisData.shiYing.shiLiuQin} {analysisData.shiYing.shiWx}
            </span>
            <span className="qn-meta" style={{ color: 'var(--color-text-secondary)' }}>·</span>
            <span className="qn-body" style={{ fontWeight: 500 }}>
              应爻 {YAO_NAMES[analysisData.shiYing.yingPosition - 1]} {analysisData.shiYing.yingLiuQin} {analysisData.shiYing.yingWx}
            </span>
            <span className="qn-cap" style={{
              color: 'var(--color-accent-gold-text)',
              background: 'rgba(178,149,93,0.08)',
              borderRadius: 6, padding: '3px 9px', marginLeft: 'auto',
            }}>{analysisData.shiYing.relation}</span>
          </div>
        )}

        {/* 动爻 — compact inline */}
        {analysisData && analysisData.dongYao.length > 0 && (
          <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: 'var(--qn-hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className="qn-axis" style={{ minWidth: 40, marginTop: 3 }}>动爻</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysisData.dongYao.map(dy => (
                  <div key={dy.position} className="qn-meta">
                    <span style={{ fontWeight: 600, color: 'var(--color-accent-gold-text)' }}>{YAO_NAMES[dy.position-1]}</span>
                    <span style={{ margin: '0 6px' }}>→</span>
                    <span>{dy.before.liuQin} {dy.before.ganZhi} {dy.before.wuxing}</span>
                    {dy.after && (
                      <span>
                        <span style={{ margin: '0 4px' }}>变</span>
                        {dy.after.liuQin} {dy.after.ganZhi} {dy.after.wuxing}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 用神 — compact inline */}
        {analysisData && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span className="qn-axis" style={{ minWidth: 40, marginTop: 3 }}>用神</span>
            <div style={{ minWidth: 0 }}>
              <p className="qn-body" style={{ fontWeight: 600 }}>{analysisData.yongShen.yongShen}</p>
              {analysisData.yongShen.positions.length > 0 && analysisData.yongShen.positions.map(m => (
                <p key={m.position} className="qn-meta" style={{ margin: '4px 0 0' }}>
                  {YAO_NAMES[m.position-1]} · {m.wuxing}
                  {m.wangShuai && <span style={{ marginLeft: 8 }}>{m.wangShuai}</span>}
                </p>
              ))}
              {analysisData.yongShen.positions.length === 0 && (
                <p className="qn-meta" style={{ margin: '4px 0 0' }}>未找到明显用神</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ===== 取数过程（时间起卦，与梅花页面同源） ===== */}
      {result.qiShu && (
        <section className="qn-card" style={{ marginBottom: 16, padding: '20px 24px' }}>
          <p className="qn-eyebrow" style={{ margin: 0 }}>起卦过程</p>
          <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
            {result.qiShu.steps.map((s, i) => (
              <li key={i} className="qn-meta" style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <span className="qn-axis" style={{ marginTop: 2 }}>{i + 1}</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{s}</span>
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: 'var(--qn-hairline)' }}>
            {result.qiShu.basis.map(b => (
              <p key={b} className="qn-cap" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{b}</p>
            ))}
          </div>
        </section>
      )}

      {/* ===== AI REPORT ===== */}
      {!reportContent && !reportLoading && (
        <section className="qn-card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 18, minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p className="qn-title">生成六爻深度解析</p>
          <p className="qn-meta" style={{ marginTop: 6, marginBottom: 20 }}>
            世应关系 · 用神分析 · 动爻解析 · 趋势推演
          </p>
          <button type="button" onClick={generateReport} className="qn-btn qn-btn--solid">
            开始解析
          </button>
        </section>
      )}

      {reportLoading && (
        <section className="qn-card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: 18, minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p className="qn-body" style={{ color: 'var(--color-accent-gold-text)', fontFamily: '"Noto Serif SC", serif' }}>
            正在推演卦象
            <span style={{ animation: 'glow-breathe 1.5s ease-in-out infinite' }}>.</span>
            <span style={{ animation: 'glow-breathe 1.5s ease-in-out 0.3s infinite' }}>.</span>
            <span style={{ animation: 'glow-breathe 1.5s ease-in-out 0.6s infinite' }}>.</span>
          </p>
        </section>
      )}

      {reportError && (
        <section className="qn-card" style={{ textAlign: 'center', padding: '20px 24px', marginBottom: 16 }}>
          <p className="qn-alert" role="alert" style={{ marginBottom: 14 }}>{reportError}</p>
          <button type="button" onClick={generateReport} className="qn-btn qn-btn--ghost">重新生成</button>
        </section>
      )}

      {reportContent && (
        <section className="qn-card" style={{ marginBottom: 16, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <p className="qn-title">六爻解析报告</p>
            <button type="button" onClick={() => { setReportContent(null); setReportSourceIds([]); setReportError(''); }} className="qn-btn qn-btn--quiet">
              收起
            </button>
          </div>
          <div className="qn-body">
            <RichText text={reportContent} />
          </div>
          {reportSourceIds.length > 0
            ? <ClassicalReferences sourceIds={reportSourceIds} />
            : <p className="qn-note" role="note" style={{ margin: '12px 0 0' }}>本站自研 · 本次报告未关联可核验的古籍出处。</p>}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button type="button" onClick={generateReport} className="qn-btn qn-btn--quiet">重新生成</button>
          </div>
        </section>
      )}

      {result && <ReceiptPanel result={result} reportText={reportContent} />}

      {/* ===== BOTTOM ACTIONS ===== */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <Link href="/liuyao/create" className="qn-btn qn-btn--ghost">重新起卦</Link>
        <Link href="/dashboard" className="qn-btn qn-btn--ghost">我的报告</Link>
      </div>
      <p className="qn-cap" style={{ textAlign: 'center', marginTop: 16 }}>仅供参考 · 不构成决策建议</p>
    
      {result && <ToolInterpretation tool="liuyao" title="六爻纳甲 · 混沌自研 AI 解读" question={result.question} payload={{
        method: result.method,
        questionType: result.questionType,
        ganZhi: result.ganZhi,
        dayGZ: { gan: result.dayGZ.gan, zhi: result.dayGZ.zhi },
        monthZhi: result.monthZhi,
        xunKong: result.xunKong,
        benGua: result.benGua,
        bianGua: result.bianGua,
        yaoRecords: result.yaoRecords.map(({ position, value, label, isDong }) => ({ position, value, label, isDong })),
        naJia: result.naJia,
        bianNaJia: result.bianNaJia,
        dongYao: result.dongYao,
        shiYing: result.shiYing,
        liuShen: result.liuShen,
        analysis: analysisData ? {
          benGua: analysisData.benGua,
          bianGua: analysisData.bianGua,
          shiYing: analysisData.shiYing,
          yongShen: analysisData.yongShen,
          dongYao: analysisData.dongYao,
          yaoStatus: analysisData.yaoStatus,
          monthZhi: analysisData.monthZhi,
          dayGZ: analysisData.dayGZ,
          xunKong: analysisData.xunKong,
          wangShuaiDetail: analysisData.wangShuaiDetail,
          monthDayRelations: analysisData.monthDayRelations,
          fuShen: analysisData.fuShen,
          hexagramRelations: analysisData.hexagramRelations,
        } : null,
      }} />}
</main>
  );
}
