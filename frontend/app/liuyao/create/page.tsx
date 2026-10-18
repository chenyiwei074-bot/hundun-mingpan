'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { buildCoinResult, coinToss, calcYao } from '@/lib/liuyao/methods/coin';
import { buildTimeResult } from '@/lib/liuyao/methods/time';
import { buildNumberResult } from '@/lib/liuyao/methods/number';
import { getGua, getNaJia, getDayGanZhi, getXunKong, GUA_MAP } from '@/lib/liuyao/core';
import { resolveQiguaMoment, type QiguaPlace } from '@/lib/liuyao/solar-basis';
import type { QiguaSolarInfo } from '@/types/liuyao';
import { provinces as regionProvinces } from '@/app/lib/region-data';

type CoinFace = '字' | '花';
type YaoRecord = { position: number; coins: CoinFace[]; value: number; label: string; isDong: boolean };
type AnimPhase = 'idle' | 'spinning' | 'result';
type Step = 'input' | 'method' | 'tossing' | 'done';
type QiMethod = 'coin' | 'time' | 'number';

// 纳甲结果
type NaJiaYao = {
  position: number; value: number; label: string; isDong: boolean;
  naGan: string; naZhi: string; ganZhi: string;
  liuQin: string; shiYing: string; xunKong: boolean;
};

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const GUA_SYMBOL: Record<string, string> = { '乾': '☰', '兑': '☱', '离': '☲', '震': '☳', '巽': '☴', '坎': '☵', '艮': '☶', '坤': '☷' };

// 掷钱与花数→爻值都用 methods/coin 那一份；这里曾复制过一份 calcYao（与 coin.ts 逐字相同），
// 两份实现会各自漂移，删掉。


// ── 3D铜钱翻转（字面/花面交替）──
function FlipCoin({ sz = 80, spinning = false }: { sz?: number; spinning?: boolean }) {
  return (
    <div style={{ perspective: 500 }}>
      <div style={{
        width: sz, height: sz, position: 'relative',
        transformStyle: 'preserve-3d',
        animation: spinning ? 'coinSpin3D 2.2s cubic-bezier(0.15,0.85,0.25,1) forwards' : 'none',
      }}>
        <div style={{ position: 'absolute', width: sz, height: sz, backfaceVisibility: 'hidden' }}>
          <Coin face="字" sz={sz} />
        </div>
        <div style={{ position: 'absolute', width: sz, height: sz, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <Coin face="花" sz={sz} />
        </div>
      </div>
    </div>
  );
}

// ── 刻符龟甲 SVG ──
function TortoiseShell({ shaking = false, size = 220 }: { shaking?: boolean; size?: number }) {
  const w = size, h = size * 0.85;
  return (
    <svg width={w} height={h} viewBox="0 0 220 187" style={{
      animation: shaking ? 'shellShake 0.12s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.3))',
    }}>
      <defs>
        <radialGradient id="sg1" cx="42%" cy="30%"><stop offset="0%" stopColor="#c4a44a"/><stop offset="20%" stopColor="#a0782c"/><stop offset="50%" stopColor="#8b6914"/><stop offset="80%" stopColor="#6b4410"/><stop offset="100%" stopColor="#4a2810"/></radialGradient>
        <radialGradient id="sg2" cx="38%" cy="22%"><stop offset="0%" stopColor="rgba(255,255,255,0.22)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
        <filter id="stex"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" result="n"/><feColorMatrix type="saturate" values="0" in="n" result="gn"/><feBlend in="SourceGraphic" in2="gn" mode="multiply" result="tex"/></filter>
        <filter id="sgold"><feDropShadow dx="0" dy="0" stdDeviation="0.5" floodColor="#d4a853" floodOpacity="0.6"/></filter>
      </defs>
      <ellipse cx="110" cy="125" rx="100" ry="55" fill="#3a1c05" opacity="0.4"/>
      <path d="M15,115 Q10,50 55,28 Q105,2 165,28 Q210,50 205,115 Q165,158 110,165 Q55,158 15,115Z" fill="url(#sg1)" filter="url(#stex)"/>
      <g stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" fill="none">
        <path d="M110,12 Q110,60 110,128 Q110,155 110,165"/>
        <path d="M48,60 Q78,48 110,42 Q142,48 172,60"/>
        <path d="M30,92 Q68,76 110,72 Q152,76 190,92"/>
        <path d="M22,118 Q65,105 110,102 Q155,105 198,118"/>
        <path d="M30,140 Q68,132 110,130 Q152,132 190,140"/>
        <path d="M55,28 Q82,58 110,42"/><path d="M165,28 Q138,58 110,42"/>
        <path d="M30,62 Q65,82 110,72"/><path d="M190,62 Q155,82 110,72"/>
      </g>
      <path d="M25,78 Q48,32 110,20 Q158,30 180,62 Q130,55 82,60 Q48,65 25,78Z" fill="url(#sg2)"/>
      <g stroke="#d4a853" strokeWidth="1.2" fill="none" opacity="0.7" filter="url(#sgold)">
        <path d="M55,48 L72,48 M63,40 L63,56"/><path d="M55,55 L72,55"/>
        <path d="M148,48 L162,48 M155,40 L155,56"/><path d="M148,55 L155,48 L162,55"/>
        <path d="M65,82 L78,82 L78,95 L65,95Z M71,82 L71,95"/>
        <path d="M142,82 L155,82 L155,95 L142,95Z"/>
        <path d="M85,125 Q110,115 135,125 M90,136 L110,125 L130,136"/>
      </g>
      <path d="M15,115 Q10,50 55,28 Q105,2 165,28 Q210,50 205,115" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
    </svg>
  );
}

// ── 乾隆通宝铜钱 SVG ──
function Coin({ face, sz = 64, flipping = false, style }: { face: CoinFace; sz?: number; flipping?: boolean; style?: React.CSSProperties }) {
  const isZi = face === '字';
  return (
    <svg width={sz} height={sz} viewBox="0 0 64 64" style={{
      animation: flipping ? 'coinFlip3D 0.6s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.25))',
      ...style,
    }}>
      <defs>
        <radialGradient id={"ccg"+sz} cx="35%" cy="32%"><stop offset="0%" stopColor="#e8c878"/><stop offset="15%" stopColor="#d4a843"/><stop offset="45%" stopColor="#c8963c"/><stop offset="75%" stopColor="#a07828"/><stop offset="100%" stopColor="#7a5518"/></radialGradient>
        <radialGradient id={"cch"+sz} cx="50%" cy="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.14)"/><stop offset="100%" stopColor="rgba(0,0,0,0.08)"/></radialGradient>
        <filter id={"cpa"+sz}><feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" result="n"/><feColorMatrix type="matrix" values="0 0 0 0 0.28 0 0 0 0 0.38 0 0 0 0 0.2 0 0 0 0.07 0" in="n" result="p"/><feBlend in="SourceGraphic" in2="p" mode="multiply"/></filter>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#6b4410" stroke="#4a2a05" strokeWidth="1.2"/>
      <circle cx="32" cy="32" r="28" fill="url(#ccg)" filter="url(#cpa)"/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(120,80,20,0.3)" strokeWidth="0.6"/>
      {isZi ? (<>
        <rect x="24" y="22" width="16" height="16" rx="1.5" fill="#2a1508" stroke="#5a3010" strokeWidth="0.8"/>
        <rect x="25.5" y="23.5" width="13" height="13" rx="1" fill="#1a0a02"/>
        <text x="32" y="17" textAnchor="middle" fontSize="6.8" fontWeight="bold" fill="#3d1c00" fontFamily="serif">乾</text>
        <text x="32" y="50" textAnchor="middle" fontSize="6.8" fontWeight="bold" fill="#3d1c00" fontFamily="serif">隆</text>
        <text x="16" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4a2a05" fontFamily="serif">通</text>
        <text x="48" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4a2a05" fontFamily="serif">宝</text>
      </>) : (<>
        <rect x="24" y="22" width="16" height="16" rx="1.5" fill="#2a1508" stroke="#5a3010" strokeWidth="0.8"/>
        <rect x="25.5" y="23.5" width="13" height="13" rx="1" fill="#1a0a02"/>
        <text x="32" y="17" textAnchor="middle" fontSize="6.5" fill="#3d1c00" fontFamily="serif" fontWeight="bold">满</text>
        <text x="32" y="50" textAnchor="middle" fontSize="6.5" fill="#3d1c00" fontFamily="serif" fontWeight="bold">文</text>
        <text x="16" y="34" textAnchor="middle" fontSize="5.5" fill="#4a2a05" fontFamily="serif">宝</text>
        <text x="48" y="34" textAnchor="middle" fontSize="5.5" fill="#4a2a05" fontFamily="serif">泉</text>
      </>)}
      <circle cx="32" cy="32" r="28" fill="url(#cch)"/>
      <circle cx="32" cy="32" r="29" fill="none" stroke="#5a3510" strokeWidth="0.4" strokeDasharray="2 6" opacity="0.3"/>
    </svg>
  );
}

// ── Main ──
export default function LiuyaoCreatePage() {
  const [step, setStep] = useState<Step>('input');
  const [question, setQuestion] = useState('');
  const [questionType, setQuestionType] = useState<'财运'|'事业'|'感情'|'婚姻'|'考试'|'健康'|'出行'|'合作'|'其他'>('其他');
  const [error, setError] = useState('');
  const [method, setMethod] = useState<QiMethod>('coin');
  const [round, setRound] = useState(0);
  const [records, setRecords] = useState<YaoRecord[]>([]);
  const [anim, setAnim] = useState<AnimPhase>('idle');
  const [coins, setCoins] = useState<CoinFace[]>([]);
  const [showShell, setShowShell] = useState(false);
  const [numInput, setNumInput] = useState('');
  const [autoRunning, setAutoRunning] = useState(false);
  const router = useRouter();
  const [naJiaResult, setNaJiaResult] = useState<NaJiaYao[]>([]);
  const [bianNaJiaResult, setBianNaJiaResult] = useState<NaJiaYao[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const autoSeq = useRef<ReturnType<typeof setTimeout>|null>(null);
  const mounted = useRef(true);
  const [coinSz, setCoinSz] = useState(100);
  const questionRef = useRef(question);
  questionRef.current = question;
  const questionTypeRef = useRef(questionType);
  questionTypeRef.current = questionType;

  const [placeProv, setPlaceProv] = useState('');
  const [placeCity, setPlaceCity] = useState('');
  const [basis, setBasis] = useState<QiguaSolarInfo | null>(null);
  const placeRef = useRef<QiguaPlace | null>(null);
  placeRef.current = placeProv || placeCity ? { province: placeProv, city: placeCity } : null;

  // 口径预览只在客户端求值：SSR 用服务器时钟渲染时刻文本会触发 hydration 不一致
  useEffect(() => { setBasis(resolveQiguaMoment(new Date(), placeRef.current).info); }, [placeProv, placeCity]);

  const doTimeGua = useCallback(() => {
    const m = resolveQiguaMoment(new Date(), placeRef.current);
    const result = { ...buildTimeResult({ question, questionType, date: m.date }), solar: m.info };
    sessionStorage.setItem('liuyao_result', JSON.stringify(result));
    router.push('/liuyao/result/' + result.id);
  },[question, questionType]);

  const doNumGua = useCallback(() => {
    const nums=numInput.trim().split(/[,，\s]+/).map(Number).filter(n=>!isNaN(n)&&n>0);
    if(nums.length!==2){setError('请输入 2 个正整数，用逗号隔开');return;}
    setError('');
    const m = resolveQiguaMoment(new Date(), placeRef.current);
    const result = { ...buildNumberResult({ question, questionType, nums, now: m.date }), solar: m.info };
    sessionStorage.setItem('liuyao_result', JSON.stringify(result));
    router.push('/liuyao/result/' + result.id);
  },[question, questionType, numInput]);

  // ── Auto toss one round ──
  const executeTossRound = useCallback((rnd: number, recs: YaoRecord[]) => {
    if (!mounted.current) return;
    
    const cs: CoinFace[] = coinToss();
    setRound(rnd);
    setAnim('spinning');
    setCoins(cs);

    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      const y = calcYao(cs);
      const newRec: YaoRecord = { position: rnd, coins: cs, value: y.value, label: y.label, isDong: y.isDong };
      const newRecs = [...recs, newRec];
      setRecords(newRecs);
      setAnim('result');

      timer.current = setTimeout(() => {
        if (!mounted.current) return;
        if (rnd >= 6) {
          const gua = getGua(newRecs.map(r=>r.value));
          const benVals = newRecs.map(r=>r.value);
          const toss = resolveQiguaMoment(new Date(), placeRef.current);
          const tossNow = toss.date;
          const dg = getDayGanZhi(tossNow);
          const xk = getXunKong(dg.ganIdx, dg.zhiIdx);
          setNaJiaResult(getNaJia(gua.ben, gua.shangGua, gua.xiaGua, benVals, xk));
          if(gua.bian){
            const bv = newRecs.map(r=>r.isDong?(r.value===6?7:8):r.value);
            const bsBits = bv.slice(3).map((v:number)=>v===7||v===9?'1':'0').join('');
            const bxBits = bv.slice(0,3).map((v:number)=>v===7||v===9?'1':'0').join('');
            const bs = GUA_MAP[bsBits]||'?', bx = GUA_MAP[bxBits]||'?';
            setBianNaJiaResult(getNaJia(gua.bian, bs, bx, bv, xk));
          } else { setBianNaJiaResult([]); }
          const result = { ...buildCoinResult({ question: questionRef.current, questionType: questionTypeRef.current, records: newRecs, now: tossNow }), solar: toss.info };
          sessionStorage.setItem('liuyao_result', JSON.stringify(result));
          router.push('/liuyao/result/' + result.id);
          setAutoRunning(false);
        } else {
          executeTossRound(rnd + 1, newRecs);
        }
      }, 1500);
    }, 2000);
  }, []);
  const startAutoToss = () => {
    if (!question.trim()) { setError('请填写所问之事'); return; }
    setError('');
    setStep('tossing');
    setRecords([]);
    setRound(0);
    setCoins([]);
    setAnim('idle');
    setAutoRunning(true);
  };

  useEffect(() => {
    if (step === 'tossing' && autoRunning && round === 0) {
      executeTossRound(1, []);
    }
  }, [step, autoRunning, round, executeTossRound]);

  const startToss = () => {
    if (method === 'coin') startAutoToss();
    else if (method === 'time') doTimeGua();
    else doNumGua();
  };

  const resetAll = () => {
    setStep('input');setRound(0);setRecords([]);setAnim('idle');setCoins([]);
    setError('');setNumInput('');
    setAutoRunning(false);setNaJiaResult([]);setBianNaJiaResult([]);
    if(timer.current)clearTimeout(timer.current);
    if(autoSeq.current)clearTimeout(autoSeq.current);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; if(timer.current)clearTimeout(timer.current); if(autoSeq.current)clearTimeout(autoSeq.current); };
  }, []);

  // 铜钱是舞台主体，尺寸必须跟着视口走，不能靠 transform 缩放（会留白）。
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 430px)');
    const apply = () => setCoinSz(mq.matches ? 84 : 100);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);


  const yaoLine = (v:number, dong:boolean) => {
    const c = dong?'#b2955d':'#1d1d1f';
    const isYang = v===7||v===9;
    const dongMark = dong ? (v===9?'○':'×') : null;
    return (
      <span style={{display:'inline-flex',alignItems:'center',verticalAlign:'middle',gap:3}}>
        {isYang ? (
          <span style={{display:'inline-block',width:44,height:4,background:c,borderRadius:99,verticalAlign:'middle'}}/>
        ) : (
          <span style={{display:'inline-flex',alignItems:'center',gap:10}}>
            <span style={{display:'inline-block',width:17,height:4,background:c,borderRadius:99}}/>
            <span style={{display:'inline-block',width:17,height:4,background:c,borderRadius:99}}/>
          </span>
        )}
        {dongMark && <span style={{fontSize:11,fontWeight:700,color:'#b2955d'}}>{dongMark}</span>}
      </span>
    );
  };
  const line = (v:number,w=80,c?:string) => {
    const dong = v===6||v===9;
    const col = c ?? (dong?'#b2955d':'#1d1d1f');
    if(v===7||v===9) return <div style={{width:w,height:3,background:col,borderRadius:99}}/>;
    return <div style={{display:'flex',gap:8,width:w}}><div style={{flex:1,height:3,background:col,borderRadius:99}}/><div style={{flex:1,height:3,background:col,borderRadius:99}}/></div>;
  };

  const coinSummary = (cs: CoinFace[]) => {
    const zi = cs.filter(c=>c==='字').length;
    if(zi===3) return '三字 → 老阴';
    if(zi===2) return '两字一花 → 少阳';
    if(zi===1) return '一字两花 → 少阴';
    return '三花 → 老阳';
  };

  const INK_STROKE = 'rgba(255,255,255,0.88)';
  const METHODS = [
    {id:'coin',num:'壹',title:'铜钱摇卦',tag:'推荐',desc:'三枚铜钱自动摇六次，最传统的起卦方式。'},
    {id:'time',num:'贰',title:'时间起卦',desc:'以当前年月日时自动成卦，方便快捷。'},
    {id:'number',num:'叁',title:'报数起卦',desc:'您报 2 个正整数，第一数定上卦、第二数定下卦，动爻取两数之和。'},
  ] as const;

  return (<main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>

    {/* ── STEP 1: INPUT ── */}
    {step==='input'&&(<>
      <header className="qn-rise" style={{textAlign:'center',marginBottom:24}}>
        <p className="qn-eyebrow" style={{margin:0}}>六爻占卜</p>
        <h1 className="qn-hero" style={{margin:'12px 0 6px'}}>六爻起卦</h1>
        <p className="qn-meta" style={{letterSpacing:'0.14em'}}>诚心默念 · 一事一问</p>
      </header>

      <section className="qn-card qn-rise qn-rise--2">
        <label className="qn-label" htmlFor="ly-question">你想问什么？</label>
        <textarea id="ly-question" className="qn-textarea" value={question} rows={3} maxLength={200}
          placeholder="例如：这次投资是否顺利？换工作时机如何？..."
          onChange={e=>{setQuestion(e.target.value);setError('');}}/>
        <div style={{marginTop:16}}>
          <span className="qn-cap" style={{display:'block',marginBottom:8}}>占问类型</span>
          {/* 只加 row-gap 不加 column-gap：.qn-chip 的 44 命中带在 34 高的盒子上上下各伸出
              5px，换行时两带间距必须 > 10 才不互相偷可点区。column-gap 保持 8 —— 撑到 12 会让
              桌面端第 9 个 chip 折到第二行，横排断掉，而那个方向本来就没有碰撞。 */}
          <div style={{display:'flex',flexWrap:'wrap',gap:'12px 8px'}}>
            {(['财运','事业','感情','婚姻','考试','健康','出行','合作','其他'] as const).map(t=>(
              <button key={t} type="button" className={`qn-chip${questionType===t?' qn-chip--on':''}`}
                onClick={()=>setQuestionType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <p className="qn-cap" style={{marginTop:14}}>六爻讲究一事一问，问题越具体，卦象越清晰</p>
        {error&&<p className="qn-alert" role="alert" style={{marginTop:14}}>{error}</p>}
      </section>

      <button type="button" className="qn-btn qn-btn--solid qn-btn--block qn-rise qn-rise--3" style={{marginTop:20}}
        onClick={()=>{if(!question.trim()){setError('请填写所问之事');return;}setError('');setStep('method');}}>
        下一步：选择起卦方式
      </button>
    </>)}

    {/* ── STEP 2: METHOD ── */}
    {step==='method'&&(<>
      <header className="qn-rise" style={{textAlign:'center',marginBottom:20}}>
        <p className="qn-eyebrow" style={{margin:0}}>选择起卦方式</p>
        <p className="qn-title" style={{marginTop:12,overflowWrap:'break-word'}}>「{question}」</p>
      </header>

      <div role="radiogroup" aria-label="起卦方式" className="qn-rise qn-rise--2" style={{display:'grid',gap:12}}>
        {METHODS.map(opt=>{
          const on = method===opt.id;
          return (
            <button key={opt.id} type="button" role="radio" aria-checked={on}
              onClick={()=>{setMethod(opt.id);setError('');}} className="qn-card"
              style={{width:'100%',textAlign:'left',fontFamily:'inherit',cursor:'pointer',
                display:'flex',alignItems:'flex-start',gap:14,padding:'20px 22px',
                border:on?'1px solid var(--color-accent-gold)':'var(--qn-hairline)',
                background:'var(--color-bg-card)',
                boxShadow:on?'0 4px 20px rgba(178,149,93,0.12)':'var(--qn-shadow)',
                transition:'border-color .2s, background-color .2s, box-shadow .2s'}}>
              <span className="qn-axis" style={{marginTop:5,fontFamily:'"Noto Serif SC", "STSong", serif'}}>{opt.num}</span>
              <span style={{flex:'1 1 auto',minWidth:0}}>
                <span style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span className="qn-title">{opt.title}</span>
                  {'tag'in opt&&<span className="qn-cap" style={{color:'var(--color-accent-gold-text)',border:'0.5px solid rgba(178,149,93,0.35)',borderRadius:999,padding:'2px 9px'}}>{opt.tag}</span>}
                </span>
                <p className="qn-meta" style={{marginTop:4}}>{opt.desc}</p>
              </span>
            </button>
          );
        })}
      </div>

      {method==='number'&&(
        <div className="qn-card" style={{marginTop:12}}>
          <label className="qn-label" htmlFor="ly-nums">请输入 2 个正整数（逗号分隔）</label>
          <input id="ly-nums" className="qn-input" value={numInput} placeholder="例如：3, 8"
            onChange={e=>setNumInput(e.target.value)}/>
          {error&&<p className="qn-alert" role="alert" style={{marginTop:12}}>{error}</p>}
        </div>
      )}

      {/* 起卦时刻口径：摇卦地经度会改时柱日柱，必须让用户看见并选择，不允许静默假设 */}
      <div className="qn-card" style={{marginTop:12}}>
        <label className="qn-label" htmlFor="ly-prov">起卦地点（可留空 = 按北京时间不校正）</label>
        <div className="grid grid-cols-2 gap-3">
          <select id="ly-prov" className="qn-select" value={placeProv}
            onChange={e=>{const np=e.target.value; setPlaceProv(np); setPlaceCity(np?(regionProvinces.find(p=>p.name===np)?.cities[0]?.name)||'':'' );}}>
            <option value="">省份</option>
            {regionProvinces.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select className="qn-select" value={placeCity} disabled={!placeProv}
            onChange={e=>setPlaceCity(e.target.value)}>
            <option value="">城市</option>
            {(regionProvinces.find(p=>p.name===placeProv)?.cities||[]).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {basis&&(
          <p className="qn-meta" style={{marginTop:10}}>
            <span style={{color:'var(--color-text-secondary)'}}>时间口径：</span>
            {basis.mode==='true-solar'
              ? `${basis.label} · 钟表 ${basis.clockText} → 真太阳时 ${basis.solarText}（${basis.correctionMinutes > 0 ? '+' : ''}${basis.correctionMinutes} 分钟）`
              : basis.label}
          </p>
        )}
        {basis?.crossedDay && <p className="qn-cap" style={{marginTop:6}}>校正后跨日，日柱按真太阳时所在日取</p>}
        {!basis?.crossedDay && basis?.crossedHour && <p className="qn-cap" style={{marginTop:6}}>校正后跨时辰，时柱按真太阳时所在时辰取</p>}
      </div>

      <div className="qn-rise qn-rise--3" style={{display:'flex',gap:12,justifyContent:'center',marginTop:20,flexWrap:'wrap'}}>
        <button type="button" className="qn-btn qn-btn--ghost" onClick={()=>setStep('input')}>返回修改问题</button>
        <button type="button" className="qn-btn qn-btn--solid" onClick={startToss}>{method==='coin'?'开始摇卦':'生成卦象'}</button>
      </div>
    </>)}

    {/* ── STEP 3: TOSSING ── */}
    {step==='tossing'&&(<section className="qn-ink qn-rise"
      style={{padding:'22px 24px 24px',display:'flex',flexDirection:'column',
        minHeight:'max(480px, calc(100vh - 160px))'}}>

      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <p className="qn-meta" style={{margin:0,letterSpacing:'0.1em'}}>第 {Math.min(round,6)} / 6 爻</p>
      </div>
      <div style={{marginTop:12,height:2,borderRadius:99,background:'rgba(255,255,255,0.14)',overflow:'hidden'}}>
        <div style={{height:'100%',borderRadius:99,background:'var(--color-accent-gold)',width:(Math.min(round,6)/6*100)+'%',transition:'width .5s ease'}}/>
      </div>

      <div style={{flex:'1 1 auto',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20,padding:'10px 0'}}>
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:coinSz>90?14:10}}>
          {coins.length===3 ? coins.map((face,i)=>(
            <div key={i}>{anim==='spinning'?<FlipCoin sz={coinSz} spinning={true}/>:<Coin face={face} sz={coinSz}/>}</div>
          )) : [0,1,2].map(i=>(
            <div key={i} style={{opacity:0.22}}><Coin face="字" sz={coinSz}/></div>
          ))}
        </div>

        <div style={{minHeight:96,textAlign:'center'}}>
          {anim==='result'&&records.length>0?(()=>{const last=records[records.length-1];return(<>
            <p className="qn-note" style={{margin:0,letterSpacing:'0.1em'}}>{YAO_NAMES[last.position-1]}</p>
            <p className="qn-title" style={{margin:'4px 0 8px',color:last.isDong?'var(--color-accent-gold-light)':'#fff'}}>
              {last.label}{last.isDong&&<span className="qn-cap" style={{letterSpacing:'0.1em',marginLeft:6}}>动爻</span>}
            </p>
            <div style={{display:'flex',justifyContent:'center'}}>{line(last.value,64,INK_STROKE)}</div>
            <p className="qn-note" style={{margin:'8px 0 0'}}>{coinSummary(last.coins)}</p>
          </>);})()
          :<p className="qn-note" style={{margin:0,visibility:anim==='idle'&&round===0&&autoRunning?'visible':'hidden'}}>起卦中...</p>}
        </div>
      </div>

      <div style={{borderTop:'0.5px solid rgba(255,255,255,0.12)',paddingTop:14}}>
        <p className="qn-cap" style={{textAlign:'center',marginBottom:8}}>卦象记录（从下往上）</p>
        <div style={{display:'grid',gap:5}}>
          {[6,5,4,3,2,1].map(pos=>{
            const r = records.find(x=>x.position===pos);
            const lit = anim==='result'&&records.length>0&&records[records.length-1].position===pos;
            return (
              <div key={pos} style={{display:'flex',alignItems:'center',gap:10,minHeight:28,
                padding:'0 8px',borderRadius:8,background:lit?'rgba(178,149,93,0.12)':'transparent'}}>
                <span className="qn-cap" style={{width:32,flex:'0 0 auto'}}>{YAO_NAMES[pos-1]}</span>
                <span style={{flex:'1 1 auto',display:'flex',justifyContent:'center'}}>
                  {r?line(r.value,64,INK_STROKE):<span style={{width:64,height:1,background:'rgba(255,255,255,0.16)'}}/>}
                </span>
                <span className="qn-note" style={{width:38,textAlign:'right',flex:'0 0 auto',
                  color:r?(r.isDong?'var(--color-accent-gold-light)':INK_STROKE):'rgba(255,255,255,0.3)'}}>{r?r.label:'—'}</span>
                <span style={{width:24,flex:'0 0 auto',textAlign:'center'}}>
                  {r?.isDong&&<span className="qn-cap" style={{display:'inline-block',border:'0.5px solid rgba(212,184,122,0.45)',color:'var(--color-accent-gold-light)',borderRadius:999,padding:'1px 6px'}}>动</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>)}

    <style jsx global>{`@keyframes coinSpin3D{0%{transform:rotateY(0deg);animation-timing-function:cubic-bezier(0.15,0.85,0.25,1)}100%{transform:rotateY(1800deg)}}@keyframes coinFlip3D{0%{transform:rotateY(0deg)}25%{transform:rotateY(90deg)}50%{transform:rotateY(180deg)}75%{transform:rotateY(270deg)}100%{transform:rotateY(360deg)}}`}</style>
  </main>);
}
