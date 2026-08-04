'use client';

import { useEffect, useState, useRef } from 'react';
import LiuYaoPlate from '../../create/LiuYaoPlate';
import { analyzeLiuyao } from '@/lib/liuyao/analysis';
import type { LiuyaoAnalysisData } from '@/lib/liuyao/analysis';
import { WX } from '@/lib/liuyao/core';
import type { LiuyaoResult } from '@/types/liuyao';
import Link from 'next/link';
import { saveReport } from '@/lib/report/saveReport';

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

const C = {
  ink: '#1d1d1f',
  mute: '#86868b',
  faint: '#c7c7cc',
  gold: '#b2955d',
  red: '#d93a3a',
  paper: '#fafaf8',
  white: '#fff',
  border: 'rgba(0,0,0,0.06)',
};

const card: React.CSSProperties = {
  background: C.white,
  borderRadius: 18,
  padding: '20px 24px',
  border: `0.5px solid ${C.border}`,
  boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: C.faint,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as any,
  marginBottom: 12,
};

export default function LiuyaoResultPage() {
  const [result, setResult] = useState<LiuyaoResult | null>(null);
  const [analysisData, setAnalysisData] = useState<LiuyaoAnalysisData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
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
      if (!res.ok) throw new Error(data.error || '生成失败');
      setReportContent(data.report);
      saveReport({
        type: 'liuyao',
        title: result.question || '六爻占卜',
        inputJson: { question: result.question || '', questionType: result.questionType || '', method: result.method || '' },
        resultJson: result as any,
        analysisJson: analysisData as any,
        reportText: data.report,
      }).catch(() => {});
    } catch (e: any) {
      setReportError(e.message || '生成失败，请重试');
    } finally {
      setReportLoading(false);
    }
  };

  // ---- loading state ----
  if (loading) {
    return (
      <main style={{maxWidth:660,margin:'0 auto',padding:'80px 20px',textAlign:'center'}}>
        <p style={{fontFamily:'"Noto Serif SC",serif',fontSize:18,color:C.mute}}>起卦中...</p>
      </main>
    );
  }

  // ---- empty state ----
  if (!result) {
    return (
      <main style={{maxWidth:660,margin:'0 auto',padding:'100px 20px'}}>
        <div style={{...card,textAlign:'center',padding:'60px 28px'}}>
          <p style={{margin:0,fontSize:18,fontFamily:'"Noto Serif SC",serif',color:C.ink}}>未找到卦象数据</p>
          <p style={{margin:0,fontSize:13,color:C.mute,marginTop:8}}>请返回起卦页面重新摇卦</p>
          <Link href="/liuyao/create" style={{display:'inline-block',marginTop:24,fontSize:13,color:C.gold,textDecoration:'none'}}>
            ← 返回起卦
          </Link>
        </div>
      </main>
    );
  }

  const methodLabel = result.method === 'coin' ? '铜钱摇卦' : result.method === 'time' ? '时间起卦' : '数字起卦';

  // ---- main content ----
  return (
    <main style={{maxWidth:680,margin:'0 auto',padding:'28px 20px 80px'}}>

      {/* ===== PAGE TITLE ===== */}
      <div style={{textAlign:'center',paddingTop:6,marginBottom:28}}>
        <p style={{margin:0,fontSize:11,fontWeight:600,color:C.gold,letterSpacing:'0.3em'}}>六爻占卜</p>
        {result.question && (
          <h1 style={{
            margin:0,fontSize:26,fontWeight:600,color:C.ink,
            fontFamily:'"Noto Serif SC","STSong",serif',
            lineHeight:1.4,marginTop:10,letterSpacing:'0.01em',
          }}>{result.question}</h1>
        )}
        <p style={{margin:0,fontSize:12,color:C.mute,marginTop:10,letterSpacing:'0.05em'}}>
          {methodLabel} · {result.date.year}年{String(result.date.month).padStart(2,'0')}月{String(result.date.day).padStart(2,'0')}日
        </p>
      </div>
      {/* ===== HERO: 六爻排盘 ===== */}
      <div style={{...card,padding:'24px 16px 18px',marginBottom:18,background:'linear-gradient(180deg,#ffffff 0%,#fbf8f1 100%)'}}>
        <div style={{display:'flex',justifyContent:'center'}}>
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
      </div>

      {/* ===== ANALYSIS: 世应 + 动爻 + 用神 ===== */}
      <div style={{...card,marginBottom:16}}>

        {/* 世应 — compact inline */}
        {analysisData?.shiYing && (
          <div style={{
            display:'flex',alignItems:'center',gap:8,
            paddingBottom:12,marginBottom:12,
            borderBottom:`0.5px solid ${C.border}`,
          }}>
            <span style={{fontSize:11,fontWeight:600,color:C.gold,letterSpacing:'0.12em',minWidth:40}}>世应</span>
            <span style={{fontSize:13,color:C.ink,fontWeight:500}}>
              世爻 {YAO_NAMES[analysisData.shiYing.shiPosition]} {analysisData.shiYing.shiLiuQin} {analysisData.shiYing.shiWx}
            </span>
            <span style={{fontSize:11,color:C.mute}}>·</span>
            <span style={{fontSize:13,color:C.ink,fontWeight:500}}>
              应爻 {YAO_NAMES[analysisData.shiYing.yingPosition]} {analysisData.shiYing.yingLiuQin} {analysisData.shiYing.yingWx}
            </span>
            <span style={{
              fontSize:11,color:C.gold,
              background:'rgba(178,149,93,0.06)',
              borderRadius:4,padding:'2px 8px',marginLeft:'auto'
            }}>{analysisData.shiYing.relation}</span>
          </div>
        )}

        {/* 动爻 — compact inline */}
        {analysisData && analysisData.dongYao.length > 0 && (
          <div style={{
            paddingBottom:12,marginBottom:12,
            borderBottom:`0.5px solid ${C.border}`,
          }}>
            <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <span style={{fontSize:11,fontWeight:600,color:C.gold,letterSpacing:'0.12em',minWidth:40,flexShrink:0,marginTop:1}}>动爻</span>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {analysisData.dongYao.map(dy => (
                  <div key={dy.position} style={{fontSize:12,color:C.ink}}>
                    <span style={{fontWeight:600,color:C.gold}}>{YAO_NAMES[dy.position-1]}</span>
                    <span style={{margin:'0 6px',color:C.mute}}>→</span>
                    <span>{dy.before.liuQin} {dy.before.ganZhi} {dy.before.wuxing}</span>
                    {dy.after && (
                      <span>
                        <span style={{margin:'0 4px',color:C.mute}}>变</span>
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
          <div>
            <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <span style={{fontSize:11,fontWeight:600,color:C.gold,letterSpacing:'0.12em',minWidth:40,flexShrink:0,marginTop:1}}>用神</span>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:C.ink}}>
                  {analysisData.yongShen.yongShen}
                </p>
                {analysisData.yongShen.positions.length > 0 && analysisData.yongShen.positions.map(m => (
                  <p key={m.position} style={{margin:'4px 0 0',fontSize:12,color:C.mute}}>
                    {YAO_NAMES[m.position-1]} · {m.wuxing}
                    <span style={{
                      marginLeft:8,fontSize:10,
                      color: m.wangShuai?.includes('旺') ? '#2e8b57' : C.mute,
                    }}>{m.wangShuai||''}</span>
                  </p>
                ))}
                {analysisData.yongShen.positions.length === 0 && (
                  <p style={{margin:'4px 0 0',fontSize:12,color:C.faint}}>未找到明显用神</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== AI REPORT ===== */}
      {!reportContent && !reportLoading && (
        <div style={{...card,textAlign:'center',padding:'32px 24px',marginBottom:18}}>
          <p style={{margin:0,fontSize:14,fontFamily:'"Noto Serif SC",serif',color:C.ink,marginBottom:4}}>
            生成六爻深度解析
          </p>
          <p style={{margin:0,fontSize:12,color:C.mute,marginBottom:20}}>
            世应关系 · 用神分析 · 动爻解析 · 趋势推演
          </p>
          <button
            onClick={generateReport}
            style={{
              background:C.gold,color:'#fff',border:'none',borderRadius:999,
              padding:'10px 36px',fontSize:13,fontWeight:500,cursor:'pointer',
              letterSpacing:'0.08em',
              boxShadow:'0 4px 14px rgba(178,149,93,0.18)',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(178,149,93,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(178,149,93,0.18)'; }}
          >
            开始解析
          </button>
        </div>
      )}

      {reportLoading && (
        <div style={{...card,textAlign:'center',padding:'32px 24px',marginBottom:18}}>
          <p style={{margin:0,fontSize:15,fontFamily:'"Noto Serif SC",serif',color:C.gold}}>
            正在推演卦象
            <span style={{animation:'glow-breathe 1.5s ease-in-out infinite'}}>.</span>
            <span style={{animation:'glow-breathe 1.5s ease-in-out 0.3s infinite'}}>.</span>
            <span style={{animation:'glow-breathe 1.5s ease-in-out 0.6s infinite'}}>.</span>
          </p>
        </div>
      )}

      {reportError && (
        <div style={{...card,textAlign:'center',padding:'20px 24px',marginBottom:16}}>
          <p style={{margin:0,fontSize:13,color:'#d4544a',marginBottom:12}}>{reportError}</p>
          <button onClick={generateReport}
            style={{background:'transparent',color:C.gold,border:`1px solid ${C.gold}`,borderRadius:999,padding:'8px 24px',fontSize:12,cursor:'pointer'}}>
            重新生成
          </button>
        </div>
      )}

      {reportContent && (
        <div style={{...card,marginBottom:16,padding:'24px 28px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <p style={{margin:0,fontSize:14,fontFamily:'"Noto Serif SC",serif',color:C.ink,fontWeight:600}}>
              六爻解析报告
            </p>
            <button onClick={() => { setReportContent(null); setReportError(''); }}
              style={{background:'transparent',color:C.mute,border:'none',fontSize:11,cursor:'pointer'}}>
              收起
            </button>
          </div>
          <div style={{fontSize:14,lineHeight:1.9,color:C.ink}}>
            {reportContent.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} style={{fontSize:20,fontFamily:'"Noto Serif SC",serif',color:C.ink,margin:'0 0 14px',fontWeight:700}}>{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} style={{fontSize:16,fontFamily:'"Noto Serif SC",serif',color:C.gold,margin:'18px 0 8px',fontWeight:600,paddingBottom:6,borderBottom:`0.5px solid ${C.border}`}}>{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} style={{fontSize:14,color:C.ink,margin:'12px 0 4px',fontWeight:600}}>{line.slice(4)}</h3>;
              if (line.startsWith('> ')) return <blockquote key={i} style={{margin:'6px 0',padding:'8px 14px',borderLeft:`3px solid ${C.gold}`,background:'rgba(178,149,93,0.03)',borderRadius:'0 8px 8px 0',color:'#555',fontSize:13}}>{line.slice(2)}</blockquote>;
              if (line.startsWith('- ')) return <li key={i} style={{margin:'2px 0 2px 16px',color:'#333'}}>{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} style={{margin:'4px 0'}}>{line}</p>;
            })}
          </div>
          <div style={{marginTop:20,textAlign:'center'}}>
            <button onClick={generateReport}
              style={{background:'transparent',color:C.mute,border:'none',fontSize:11,cursor:'pointer'}}>
              重新生成
            </button>
          </div>
        </div>
      )}

      {/* ===== BOTTOM ACTIONS ===== */}
      <div style={{display:'flex',justifyContent:'center',gap:24,marginTop:8}}>
        <Link href="/liuyao/create" style={{
          color:C.mute,fontSize:13,textDecoration:'none',
          letterSpacing:'0.06em',
        }}>
          重新起卦
        </Link>
        <Link href="/dashboard" style={{
          color:C.mute,fontSize:13,textDecoration:'none',
          letterSpacing:'0.06em',
        }}>
          我的报告
        </Link>
      </div>
      <p style={{textAlign:'center',fontSize:10,marginTop:16,color:C.faint,letterSpacing:'0.06em'}}>
        仅供参考 · 不构成决策建议
      </p>
    </main>
  );
}
