'use client';

import { useEffect, useState } from 'react';
import LiuYaoPlate from '../../create/LiuYaoPlate';
import { analyzeLiuyao } from '@/lib/liuyao/analysis';
import type { LiuyaoAnalysisData } from '@/lib/liuyao/analysis';
import { WX } from '@/lib/liuyao/core';
import type { LiuyaoResult } from '@/types/liuyao';
import Link from 'next/link';

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const GUA_SYMBOL: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };

const card: React.CSSProperties = {
  background:'#fff', borderRadius:12, padding:'24px 28px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.04)', border:'1px solid #f0f0f0',
};

export default function LiuyaoResultPage() {
  const [result, setResult] = useState<LiuyaoResult | null>(null);
  const [analysisData, setAnalysisData] = useState<LiuyaoAnalysisData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('liuyao_result');
      if (stored) {
        const r: LiuyaoResult = JSON.parse(stored);
        setResult(r);
        // build analysis
        const ad = analyzeLiuyao(r);
        setAnalysisData(ad);
      }
    } catch(e) {
      console.error('Failed to load result:', e);
    }
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
    } catch (e: any) {
      setReportError(e.message || '生成失败，请重试');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={{maxWidth:660,margin:'0 auto',padding:'60px 20px'}}>
        <p style={{textAlign:'center',color:'#86868b'}}>加载中...</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main style={{maxWidth:660,margin:'0 auto',padding:'60px 20px'}}>
        <div style={{...card,textAlign:'center',padding:'60px 28px'}}>
          <p style={{margin:0,fontSize:16,color:'#86868b'}}>未找到卦象数据</p>
          <p style={{margin:0,fontSize:12,color:'#c7c7cc',marginTop:8}}>请返回起卦页面重新摇卦</p>
          <Link href="/liuyao/create" style={{display:'inline-block',marginTop:20,fontSize:13,color:'#b2955d',textDecoration:'none'}}>← 返回起卦</Link>
        </div>
      </main>
    );
  }

  const methodLabel = result.method === 'coin' ? '铜钱摇卦' : result.method === 'time' ? '时间起卦' : '数字起卦';

  return (
    <main style={{maxWidth:660,margin:'0 auto',padding:'40px 20px 80px'}}>

      {/* 1. 起卦信息卡 */}
      <div className="mb-5" style={card}>
        <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:16}}>起卦信息</p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',gap:12}}>
            <span style={{fontSize:12,color:'#86868b',minWidth:56}}>事项</span>
            <span style={{fontSize:13,color:'#1d1d1f',fontWeight:500}}>{result.question}</span>
          </div>
          <div style={{display:'flex',gap:12}}>
            <span style={{fontSize:12,color:'#86868b',minWidth:56}}>卦式</span>
            <span style={{fontSize:13,color:'#1d1d1f'}}>{methodLabel}</span>
          </div>
          <div style={{display:'flex',gap:12}}>
            <span style={{fontSize:12,color:'#86868b',minWidth:56}}>日期</span>
            <span style={{fontSize:13,color:'#1d1d1f'}}>
              {result.date.year}年{String(result.date.month).padStart(2,'0')}月{String(result.date.day).padStart(2,'0')}日{' '}
              {String(result.date.hour).padStart(2,'0')}:{String(result.date.minute).padStart(2,'0')}
            </span>
          </div>
          <div style={{display:'flex',gap:12}}>
            <span style={{fontSize:12,color:'#86868b',minWidth:56}}>干支</span>
            <span style={{fontSize:13,color:'#1d1d1f',display:'flex',gap:10}}>
              <span style={{color:'#d93a3a'}}>{result.ganZhi.year}</span>
              <span>{result.ganZhi.month}</span>
              <span style={{color:'#d93a3a'}}>{result.ganZhi.day}</span>
              <span>{result.ganZhi.hour}</span>
            </span>
          </div>
          <div style={{display:'flex',gap:12}}>
            <span style={{fontSize:12,color:'#86868b',minWidth:56}}>旬空</span>
            <span style={{fontSize:13,color:'#86868b'}}>{result.xunKong}</span>
          </div>
        </div>
      </div>

      {/* 2. 六爻排盘卡 */}
      <div className="mb-5" style={{...card,overflowX:'auto'}}>
        <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:20}}>六爻排盘</p>
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

      {/* 3. 卦象摘要 */}
      <div className="mb-5" style={card}>
        <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:16}}>卦象信息</p>
        <div style={{display:'flex',gap:32,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:180}}>
            <p style={{margin:0,fontSize:10,color:'#86868b',letterSpacing:'0.1em'}}>本卦</p>
            <p style={{margin:0,fontSize:22,fontFamily:'serif',color:'#1d1d1f',marginTop:4}}>{result.benGua.name}</p>
            <p style={{margin:0,fontSize:12,color:'#86868b',marginTop:4}}>
              {GUA_SYMBOL[result.benGua.shangGua]||''} {result.benGua.shangGua} + {GUA_SYMBOL[result.benGua.xiaGua]||''} {result.benGua.xiaGua}
            </p>
            <p style={{margin:0,fontSize:11,color:'#86868b',marginTop:2}}>{result.benGua.gong}宫 · {result.benGua.wuxing}</p>
          </div>
          {result.bianGua.name && (
            <div style={{flex:1,minWidth:180}}>
              <p style={{margin:0,fontSize:10,color:'#86868b',letterSpacing:'0.1em'}}>变卦</p>
              <p style={{margin:0,fontSize:22,fontFamily:'serif',color:'#1d1d1f',marginTop:4}}>{result.bianGua.name}</p>
              <p style={{margin:0,fontSize:12,color:'#86868b',marginTop:4}}>
                {result.bianGua.gong || '—'}
              </p>
              <p style={{margin:0,fontSize:11,color:'#86868b',marginTop:2}}>{result.bianGua.gong ? result.bianGua.gong + '宫 · ' + result.bianGua.wuxing : ''}</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. 世应分析 */}
      {analysisData?.shiYing && (
        <div className="mb-5" style={card}>
          <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:16}}>世应分析</p>
          <div style={{display:'flex',gap:40,flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <p style={{margin:0,fontSize:12,color:'#86868b'}}>世爻</p>
              <p style={{margin:0,fontSize:15,color:'#1d1d1f',fontWeight:500}}>
                {YAO_NAMES[analysisData.shiYing.shiPosition]}
                <span style={{marginLeft:8,fontSize:12,color:'#86868b'}}>{analysisData.shiYing.shiLiuQin} {analysisData.shiYing.shiWx}</span>
              </p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <p style={{margin:0,fontSize:12,color:'#86868b'}}>应爻</p>
              <p style={{margin:0,fontSize:15,color:'#1d1d1f',fontWeight:500}}>
                {YAO_NAMES[analysisData.shiYing.yingPosition]}
                <span style={{marginLeft:8,fontSize:12,color:'#86868b'}}>{analysisData.shiYing.yingLiuQin} {analysisData.shiYing.yingWx}</span>
              </p>
            </div>
          </div>
          <p style={{margin:0,fontSize:12,color:'#b2955d',marginTop:12}}>{analysisData.shiYing.relation}</p>
        </div>
      )}

      {/* 5. 动爻分析 */}
      {analysisData && analysisData.dongYao.length > 0 && (
        <div className="mb-5" style={card}>
          <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:16}}>动爻分析</p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {analysisData.dongYao.map(dy => (
              <div key={dy.position} style={{padding:'10px 14px',borderRadius:8,background:'rgba(178,149,93,0.04)'}}>
                <p style={{margin:0,fontSize:12,color:'#b2955d',fontWeight:500}}>{YAO_NAMES[dy.position-1]}动</p>
                <div style={{display:'flex',alignItems:'center',gap:12,marginTop:6}}>
                  <span style={{fontSize:11,color:'#86868b'}}>原：</span>
                  <span style={{fontSize:12,color:'#1d1d1f'}}>{dy.before.label} {dy.before.liuQin} {dy.before.ganZhi} {dy.before.wuxing}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
                  <span style={{fontSize:11,color:'#86868b'}}>变：</span>
                  {dy.after ? (
                    <span style={{fontSize:12,color:'#1d1d1f'}}>{dy.after.liuQin} {dy.after.ganZhi} {dy.after.wuxing}</span>
                  ) : (
                    <span style={{fontSize:12,color:'#c7c7cc'}}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. 用神分析 */}
      {analysisData && (
        <div className="mb-5" style={card}>
          <p style={{margin:0,fontSize:11,color:'#c7c7cc',letterSpacing:'0.15em',marginBottom:16}}>用神分析</p>
          <div>
            <div style={{marginBottom:10}}>
              <span style={{fontSize:11,color:'#86868b'}}>用神：</span>
              <span style={{fontSize:13,color:'#1d1d1f',fontWeight:500}}>{analysisData.yongShen.yongShen}</span>
            </div>
            {analysisData.yongShen.positions.length>0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {analysisData.yongShen.positions.map(m=>(
                  <div key={m.position} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,background:'rgba(178,149,93,0.04)'}}>
                    <span style={{fontSize:11,color:'#86868b'}}>{YAO_NAMES[m.position-1]}</span>
                    <span style={{fontSize:12,color:'#1d1d1f'}}>{m.liuQin} {m.ganZhi} {m.wuxing}</span>
                    <span style={{fontSize:10,color:'#b2955d'}}>{m.wangShuai}</span>
                    {m.shiYing && <span style={{fontSize:10,color:'#b2955d'}}>{m.shiYing}</span>}
                    {m.isDong && <span style={{fontSize:10,color:'#d4544a'}}>动</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{fontSize:11,color:'#c7c7cc'}}>未在当前卦中找到用神</p>
            )}
          </div>
        </div>
      )}

      {/* 7. AI 深度解析 */}
      <div className="mb-5" style={{...card,background:'linear-gradient(135deg,#fafaf8 0%,#f5f3ef 100%)'}}>
        {!reportContent && !reportLoading && (
          <>
            <p style={{margin:0,fontSize:16,fontFamily:'serif',color:'#1d1d1f',textAlign:'center',marginBottom:4}}>深度六爻解析</p>
            <p style={{margin:0,fontSize:11,color:'#86868b',textAlign:'center',marginBottom:16}}>AI 驱动的命理洞见</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px',marginBottom:18}}>
              {['世应关系','用神分析','动爻解析','旺衰判断','趋势推演','应期推演'].map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 0'}}>
                  <span style={{width:4,height:4,borderRadius:'50%',background:'#b2955d',flexShrink:0}}/>
                  <span style={{fontSize:12,color:'#1d1d1f'}}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center'}}>
              <button onClick={generateReport}
                style={{background:'#b2955d',color:'#fff',border:'none',borderRadius:999,padding:'12px 40px',fontSize:14,fontWeight:500,cursor:'pointer',letterSpacing:'0.1em',boxShadow:'0 4px 16px rgba(178,149,93,0.2)',transition:'all 0.2s'}}>
                生成六爻深度解析
              </button>
            </div>
          </>
        )}

        {reportLoading && (
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <p style={{margin:0,fontSize:14,fontFamily:'serif',color:'#b2955d'}}>
              正在推演卦象
              <span style={{animation:'glow-breathe 1.5s ease-in-out infinite'}}>.</span>
              <span style={{animation:'glow-breathe 1.5s ease-in-out 0.3s infinite'}}>.</span>
              <span style={{animation:'glow-breathe 1.5s ease-in-out 0.6s infinite'}}>.</span>
            </p>
          </div>
        )}

        {reportError && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <p style={{margin:0,fontSize:13,color:'#d4544a',marginBottom:12}}>{reportError}</p>
            <button onClick={generateReport}
              style={{background:'transparent',color:'#b2955d',border:'1px solid #b2955d',borderRadius:999,padding:'8px 24px',fontSize:12,cursor:'pointer'}}>
              重新生成
            </button>
          </div>
        )}

        {reportContent && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <p style={{margin:0,fontSize:13,fontFamily:'serif',color:'#1d1d1f',fontWeight:500}}>📜 六爻解析报告</p>
              <button onClick={() => { setReportContent(null); setReportError(''); }}
                style={{background:'transparent',color:'#86868b',border:'none',fontSize:11,cursor:'pointer'}}>
                收起
              </button>
            </div>
            <div style={{
              fontSize:14,lineHeight:'1.9',color:'#1d1d1f',
              fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",serif',
            }}>
              {reportContent.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} style={{fontSize:22,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 16px',fontWeight:700}}>{line.slice(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} style={{fontSize:17,fontFamily:'serif',color:'#b2955d',margin:'20px 0 10px',fontWeight:600,paddingBottom:6,borderBottom:'1px solid rgba(0,0,0,0.06)'}}>{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} style={{fontSize:14,color:'#1d1d1f',margin:'14px 0 6px',fontWeight:600}}>{line.slice(4)}</h3>;
                if (line.startsWith('> ')) return <blockquote key={i} style={{margin:'8px 0',padding:'8px 14px',borderLeft:'3px solid #b2955d',background:'rgba(178,149,93,0.04)',borderRadius:'0 8px 8px 0',color:'#555',fontSize:13}}>{line.slice(2)}</blockquote>;
                if (line.startsWith('- ')) return <li key={i} style={{margin:'2px 0 2px 16px',color:'#333'}}>{line.slice(2)}</li>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{margin:'8px 0',fontWeight:600,color:'#1d1d1f'}}>{line.slice(2,-2)}</p>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} style={{margin:'4px 0',color:'#333'}}>{line}</p>;
              })}
            </div>
            <div style={{marginTop:20,textAlign:'center'}}>
              <button onClick={generateReport}
                style={{background:'transparent',color:'#86868b',border:'none',fontSize:11,cursor:'pointer'}}>
                重新生成
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{display:'flex',justifyContent:'center',gap:20}}>
        <Link href="/liuyao/create" style={{background:'transparent',color:'#86868b',border:'none',padding:'10px 28px',fontSize:13,cursor:'pointer',letterSpacing:'0.08em',textDecoration:'none'}}>重新起卦</Link>
      </div>
      <p style={{textAlign:'center',fontSize:10,marginTop:20,color:'#c7c7cc',letterSpacing:'0.08em'}}>仅供参考 · 不构成决策建议</p>
    </main>
  );
}