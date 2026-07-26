'use client';

import { useState } from 'react';
import Link from 'next/link';

interface YaoInfo {
  position: number;
  value: number;
  yinYang: string;
  isDong: boolean;
  naGan: string;
  naZhi: string;
  liuQin: string;
  liuShen: string;
  shiYing: string | null;
  xunKong: boolean;
}

interface GuaInfo {
  name: string;
  shangGua: string;
  xiaGua: string;
  gongWei: string;
  gongWuXing: string;
  shiYao: number;
  yingYao: number;
  guaType: string;
}

interface PanData {
  benGua: GuaInfo;
  bianGua: GuaInfo | null;
  yaoList: YaoInfo[];
  yaoListBian: YaoInfo[];
  riChen: { gan: string; zhi: string };
  yueJian: string;
  xunKongZhi: string[];
}

interface LiuYaoResult {
  question: string;
  qiGua: { method: string; shangGuaNum: number; xiaGuaNum: number; dongYaoPositions: number[] };
  pan: PanData;
  analysis: string;
  advice: string;
}

const GUA_SYMBOLS: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };
const YAO_MAP: Record<number,string> = { 6:'× 老阴 ▸ 变阳', 7:'▬▬▬ 少阳', 8:'▬ ▬ 少阴', 9:'○ 老阳 ▸ 变阴' };

function getVisitorId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('hundun_visitor_id');
  if (!id) { id = 'visitor_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); localStorage.setItem('hundun_visitor_id', id); }
  return id;
}

export default function LiuYaoPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LiuYaoResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!question.trim()) { setError('请输入你想问的问题'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/liuyao/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), method: 'random' }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else setError(json.error || '起卦失败');
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#e0d5b7', fontFamily:'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #2a2520' }}>
        <Link href='/' style={{ fontSize:'22px', fontWeight:'bold', color:'#d4a853', textDecoration:'none' }}>混沌阁</Link>
        <span style={{ fontSize:'14px', color:'#8a7a5a' }}>六爻决策</span>
      </header>

      <main style={{ maxWidth:600, margin:'0 auto', padding:'24px 20px' }}>
        {!result && (
          <div style={{ textAlign:'center', paddingTop:40 }}>
            <h1 style={{ fontSize:'28px', color:'#d4a853', marginBottom:8 }}>混沌问卦</h1>
            <p style={{ color:'#8a7a5a', marginBottom:32, lineHeight:1.8 }}>
              一事一占 · 六爻定吉凶<br/>
              心中默念问题，起卦推演天机
            </p>

            <textarea
              value={question}
              onChange={e => { setQuestion(e.target.value); setError(''); }}
              placeholder='例如：这个工作机会适合我吗？'
              rows={3}
              style={{
                width:'100%', maxWidth:400, padding:12, background:'#1a1612', border:'1px solid #3a3025',
                borderRadius:8, color:'#e0d5b7', fontSize:16, resize:'vertical', outline:'none'
              }}
            />

            {error && <p style={{ color:'#c44', marginTop:8, fontSize:14 }}>{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                marginTop:24, padding:'14px 48px', background: loading ? '#5a4a30':'#d4a853',
                color: loading ? '#aaa':'#0a0a0a', border:'none', borderRadius:8, fontSize:18,
                fontWeight:'bold', cursor: loading ? 'wait':'pointer'
              }}
            >
              {loading ? '起卦中...' : '开始起卦'}
            </button>

            <p style={{ marginTop:24, fontSize:13, color:'#5a5040' }}>
              「混沌六爻」三盘合断 · 古籍参照 · 决策参考
            </p>
          </div>
        )}

        {result && (
          <ResultView result={result} onBack={() => setResult(null)} onNew={() => { setResult(null); setQuestion(''); }} />
        )}
      </main>
    </div>
  );
}

function ResultView({ result, onBack, onNew }: { result: LiuYaoResult; onBack: () => void; onNew: () => void }) {
  const { question, pan, analysis } = result;
  const benGua = pan.benGua;
  const bianGua = pan.bianGua;

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{ background:'none', border:'1px solid #3a3025', color:'#8a7a5a', padding:'6px 14px', borderRadius:6, cursor:'pointer' }}>← 返回修改问题</button>
        <button onClick={onNew} style={{ background:'none', border:'1px solid #3a3025', color:'#8a7a5a', padding:'6px 14px', borderRadius:6, cursor:'pointer' }}>新问题</button>
      </div>

      {/* 问题 */}
      <div style={{ background:'#1a1612', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #2a2520' }}>
        <p style={{ color:'#8a7a5a', fontSize:13, marginBottom:4 }}>占问事项</p>
        <p style={{ fontSize:18, color:'#e0d5b7' }}>{question}</p>
      </div>

      {/* 卦象 */}
      <div style={{ background:'#1a1612', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #2a2520', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>
          {GUA_SYMBOLS[benGua.xiaGua]}{GUA_SYMBOLS[benGua.shangGua]}
        </div>
        <h2 style={{ fontSize:24, color:'#d4a853', margin:0 }}>{benGua.name}</h2>
        <p style={{ color:'#8a7a5a', fontSize:13 }}>
          {benGua.xiaGua}{benGua.shangGua} · {benGua.gongWei}宫 · 属{benGua.gongWuXing} · {benGua.guaType}
        </p>
        {bianGua && (
          <p style={{ color:'#8a7a5a', fontSize:13 }}>
            变卦: {GUA_SYMBOLS[bianGua.xiaGua]}{GUA_SYMBOLS[bianGua.shangGua]} {bianGua.name}
          </p>
        )}
        <p style={{ fontSize:12, color:'#5a5040', marginTop:8 }}>
          日辰: {pan.riChen.gan}{pan.riChen.zhi} · 月建: {pan.yueJian} · 旬空: {pan.xunKongZhi.join('')}
        </p>
      </div>

      {/* 分析 */}
      <div style={{ background:'#1a1612', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #2a2520' }}>
        <h3 style={{ color:'#d4a853', fontSize:16, marginBottom:8 }}>卦象分析</h3>
        <p style={{ color:'#c0b090', lineHeight:1.8 }}>{analysis}</p>
      </div>

      {/* 六爻详情 */}
      <div style={{ background:'#1a1612', borderRadius:12, padding:20, border:'1px solid #2a2520', overflowX:'auto' }}>
        <h3 style={{ color:'#d4a853', fontSize:16, marginBottom:12 }}>六爻排盘</h3>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ color:'#8a7a5a', borderBottom:'1px solid #2a2520' }}>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>爻位</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>爻象</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>纳甲</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>六亲</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>六神</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>世应</th>
              <th style={{ padding:'8px 4px', textAlign:'center' }}>旬空</th>
            </tr>
          </thead>
          <tbody>
            {[...pan.yaoList].reverse().map((yao) => (
              <tr key={yao.position} style={{ borderBottom:'1px solid #1a1612', color: yao.isDong ? '#d4a853':'#c0b090' }}>
                <td style={{ padding:'8px 4px', textAlign:'center' }}>
                  {['','初','二','三','四','五','上'][yao.position]}
                </td>
                <td style={{ padding:'8px 4px', textAlign:'center', fontWeight: yao.isDong ? 'bold':'normal' }}>
                  {yao.yinYang === '阳' ? '▬▬▬' : '▬ ▬'}{yao.isDong ? (yao.value===9?'○':'×') : ''}
                </td>
                <td style={{ padding:'8px 4px', textAlign:'center' }}>{yao.naGan}{yao.naZhi}</td>
                <td style={{ padding:'8px 4px', textAlign:'center' }}>{yao.liuQin}</td>
                <td style={{ padding:'8px 4px', textAlign:'center' }}>{yao.liuShen}</td>
                <td style={{ padding:'8px 4px', textAlign:'center', color: yao.shiYing==='世'?'#d4a853':'#c44' }}>{yao.shiYing || '-'}</td>
                <td style={{ padding:'8px 4px', textAlign:'center', color: yao.xunKong?'#c44':'#8a7a5a' }}>{yao.xunKong ? '空' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 温馨提示 */}
      <p style={{ marginTop:24, fontSize:12, color:'#5a5040', textAlign:'center', lineHeight:1.8 }}>
        仅供参考 · 不构成决策建议<br/>
        如需深入分析，可查看
        <Link href='/' style={{ color:'#d4a853', marginLeft:4 }}>完整命盘报告</Link>
      </p>
    </div>
  );
}
