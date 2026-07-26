'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

// ========== Types ==========
interface YaoInfo {
  position: number; value: number; yinYang: string; isDong: boolean;
  naGan: string; naZhi: string; liuQin: string; liuShen: string;
  shiYing: string | null; xunKong: boolean;
}
interface GuaInfo {
  name: string; shangGua: string; xiaGua: string;
  gongWei: string; gongWuXing: string; guaType: string;
}
interface TianPanResult {
  yaoXiu: { position: number; xiuName: string; qinXiang: string; wuXing: string; boWei: string }[];
  shiXiu: string; yingXiu: string; tunTie: string; geJu: string[];
}
interface DiPanResult {
  neiGua: string; waiGua: string; neiShu: number; waiShu: number;
  operations: { type: string; formula: string; result: number; meaning: string }[];
  huaGua: string;
}
interface FullResult {
  question: string;
  qiGua: { method: string; dongYaoPositions: number[] };
  pan: {
    benGua: GuaInfo; bianGua: GuaInfo | null; yaoList: YaoInfo[];
    riChen: { gan: string; zhi: string }; yueJian: string; xunKongZhi: string[];
  };
  analysis: string;
  tianPan: TianPanResult;
  diPan: DiPanResult;
}

const GUA_EMOJI: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };
const POS_NAMES = ['','初','二','三','四','五','上'];
const COIN_FACES = { flower: '⚊', word: '⚋' };

// ========== Copper Coin Component ==========
function CopperCoin({ face }: { face: 'flower'|'word'|'spinning' }) {
  if (face === 'spinning') {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-hu-po-jin/20 border border-hu-po-jin/30 animate-spin"
        style={{ animationDuration: '0.3s' }}>
        <span className="text-xs">◎</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
      face === 'flower' ? 'bg-hu-po-jin/20 border-hu-po-jin text-hu-po-jin' : 'bg-xuan-zhi-dark/50 border-dai-qing/20 text-dai-qing/50'
    }`}>
      <span className="text-xs">{face === 'flower' ? '背' : '字'}</span>
    </span>
  );
}

// ========== Yao Animation ==========
function YaoAnimation({ onComplete }: { onComplete: (yaoData: number[]) => void }) {
  const [round, setRound] = useState(0);
  const [coins, setCoins] = useState<('flower'|'word'|'spinning')[]>(['spinning','spinning','spinning']);
  const [yaoResult, setYaoResult] = useState<number[]>([]);
  const [phase, setPhase] = useState<'spinning'|'reveal'>('spinning');

  const startRound = useCallback(() => {
    if (round >= 6) {
      onComplete(yaoResult);
      return;
    }
    setPhase('spinning');
    setCoins(['spinning','spinning','spinning']);
    
    const backs = Array.from({length:3}, () => Math.floor(Math.random()*2));
    const totalBacks = backs.reduce((a,b)=>a+b,0);
    const value = totalBacks === 0 ? 9 : totalBacks === 1 ? 7 : totalBacks === 2 ? 8 : 6;
    
    setTimeout(() => {
      setCoins(backs.map(b => b ? 'flower' : 'word') as ('flower'|'word')[]);
      setYaoResult(prev => [...prev, value]);
      setPhase('reveal');
      
      setTimeout(() => {
        setRound(r => r + 1);
      }, 400);
    }, 600);
  }, [round, yaoResult, onComplete]);

  // Auto-start on mount
  useState(() => {
    setTimeout(startRound, 300);
    return () => {};
  });

  // Auto-continue
  const prevRound = useState(0)[0];
  if (round > prevRound && round < 6) {
    setTimeout(startRound, 200);
  }
  if (round >= 6 && yaoResult.length === 6) {
    setTimeout(() => onComplete(yaoResult), 500);
  }

  const yaoLabel = (val: number) => {
    switch(val) {
      case 6: return { label: '老阴', tag: '动' };
      case 7: return { label: '少阳', tag: '' };
      case 8: return { label: '少阴', tag: '' };
      case 9: return { label: '老阳', tag: '动' };
      default: return { label: '', tag: '' };
    }
  };

  return (
    <div className="text-center py-8">
      <p className="text-hu-po-jin text-sm tracking-[3px] mb-6">摇 卦 中 ...</p>
      
      {/* Coins */}
      <div className="flex justify-center gap-3 mb-4">
        {coins.map((f, i) => <CopperCoin key={i} face={f} />)}
      </div>

      {/* Progress */}
      <div className="space-y-2 mt-6">
        {yaoResult.map((val, i) => {
          const { label, tag } = yaoLabel(val);
          return (
            <div key={i} className="flex items-center justify-center gap-3 text-sm animate-fade-in">
              <span className="text-dai-qing/50 w-8 text-right">{POS_NAMES[i+1]}</span>
              <span className={`${tag ? 'text-hu-po-jin' : 'text-dai-qing/65'}`}>
                {val % 2 === 1 ? '▬▬▬' : '▬ ▬'} {label}
              </span>
              {tag && <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-1">{tag}</span>}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-dai-qing/30 mt-6">
        第 {Math.min(round + 1, 6)} / 6 爻
      </p>
    </div>
  );
}

// ========== Main Page ==========
export default function LiuYaoPage() {
  const [step, setStep] = useState<'input'|'animating'|'result'>('input');
  const [question, setQuestion] = useState('');
  const [method, setMethod] = useState<'random'|'time'|'coin'>('random');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!question.trim()) { setError('请填写占问事项'); return; }
    setStep('animating');
  };

  const handleAnimationComplete = async (yaoData: number[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/liuyao/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), method, manualData: yaoData }),
      });
      const json = await res.json();
      if (json.success) { setResult(json.data); setStep('result'); }
      else { setError(json.error || '起卦失败'); setStep('input'); }
    } catch { setError('网络错误'); setStep('input'); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep('input'); setResult(null); setQuestion(''); };

  return (
    <div className="min-h-screen bg-xuan-zhi text-dai-qing font-sans">
      {/* Nav */}
      <nav className="border-b border-dai-qing/8 px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-hu-po-jin text-lg font-bold tracking-[3px] no-underline">混沌</Link>
          <span className="text-dai-qing/20">/</span>
          <span className="text-dai-qing/60 text-sm tracking-[2px]">六爻决策</span>
        </div>
        <Link href="/create" className="text-xs text-dai-qing/50 tracking-[2px] border border-dai-qing/15 rounded px-3 py-1 hover:border-hu-po-jin/30 transition-colors no-underline">
          命盘排盘 →
        </Link>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-6">
        {step === 'input' && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="inline-flex items-center gap-2 text-hu-po-jin text-3xl mb-3">
                <span>☰</span><span>☵</span><span>☶</span>
              </div>
              <h1 className="text-2xl text-dai-qing tracking-[4px] font-normal mb-2">混沌问卦</h1>
              <p className="text-xs text-dai-qing/60 tracking-[2px] leading-relaxed">
                投钱成卦 · 一事一占 · 三盘合断
              </p>
            </div>

            {/* 推演问题 */}
            <section className="bg-xuan-zhi-dark/30 border border-dai-qing/8 rounded-xl p-6">
              <p className="text-[10px] text-dai-qing/50 tracking-[2px] mb-3">推 演 问 题</p>
              <textarea
                value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="例如：这个工作机会适合我吗？"
                rows={3} maxLength={200}
                className="w-full bg-xuan-zhi border border-dai-qing/15 rounded-lg p-4 text-sm text-dai-qing placeholder-dai-qing/30 resize-none outline-none focus:border-hu-po-jin/40 transition-colors"
              />
            </section>

            {/* 起卦方式 */}
            <section className="bg-xuan-zhi-dark/30 border border-dai-qing/8 rounded-xl p-6">
              <p className="text-[10px] text-dai-qing/50 tracking-[2px] mb-4">起 卦 方 式</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value:'random', label:'系统摇卦', desc:'随机生成卦象', icon:'🎲' },
                  { value:'time', label:'时间起卦', desc:'以当下时刻起卦', icon:'🕐' },
                  { value:'coin', label:'铜钱摇卦', desc:'模拟三枚铜钱', icon:'🪙' },
                ].map(m => (
                  <button key={m.value} onClick={() => setMethod(m.value as typeof method)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                      method === m.value ? 'border-hu-po-jin bg-hu-po-jin/5 text-hu-po-jin' : 'border-dai-qing/8 bg-xuan-zhi text-dai-qing/50 hover:border-dai-qing/20'
                    }`}
                  ><span className="text-xl">{m.icon}</span>
                   <span className="text-xs tracking-[1px]">{m.label}</span>
                   <span className="text-[10px] opacity-60">{m.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {error && <div className="bg-dai-qing-dark/20/30 border border-dai-qing-dark/30 rounded-lg p-3 text-center text-sm text-hu-po-jin-dark">{error}</div>}

            <div className="text-center">
              <button onClick={handleSubmit}
                className="bg-hu-po-jin text-xuan-zhi text-base px-12 py-4 rounded-lg tracking-[4px] font-medium hover:bg-hu-po-jin transition-all"
              >开 始 摇 卦</button>
              <p className="mt-4 text-[10px] text-dai-qing/40 tracking-[2px]">心念一动即起卦 · 免费体验</p>
            </div>
          </div>
        )}

        {step === 'animating' && (
          <YaoAnimation onComplete={handleAnimationComplete} />
        )}

        {step === 'result' && result && (
          <ResultView result={result} onBack={reset} />
        )}
      </main>
    </div>
  );
}

// ========== Result View ==========
function ResultView({ result, onBack }: { result: FullResult; onBack: () => void }) {
  const { question, pan, analysis, tianPan, diPan } = result;
  const { benGua, bianGua, yaoList, riChen, yueJian, xunKongZhi } = pan;
  const sectionClass = "bg-xuan-zhi-dark/30 border border-dai-qing/8 rounded-xl p-5";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center py-3">
        <div className="text-5xl mb-3">{GUA_EMOJI[benGua.xiaGua]}{GUA_EMOJI[benGua.shangGua]}</div>
        <h2 className="text-xl text-hu-po-jin tracking-[4px] font-normal">{benGua.name}</h2>
        <p className="text-xs text-dai-qing/50 mt-1">
          {benGua.gongWei}宫 · 属{benGua.gongWuXing} · {benGua.guaType}
          {bianGua && <> · 之 <span className="text-hu-po-jin">{bianGua.name}</span></>}
        </p>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-dai-qing/40">
          <span>日辰 {riChen.gan}{riChen.zhi}</span>
          <span>月建 {yueJian}</span>
          <span>旬空 {xunKongZhi.join('')}</span>
        </div>
      </div>

      {/* Question */}
      <div className={sectionClass}>
        <p className="text-[10px] text-dai-qing/50 tracking-[2px] mb-2">占 问 事 项</p>
        <p className="text-dai-qing/80 text-sm leading-relaxed">{question}</p>
      </div>

      {/* ===== 人盘 ===== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">人盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">纳甲排盘 · 用神分析</span>
        </div>
        <p className="text-dai-qing/70 text-sm mb-4">{analysis}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-y border-dai-qing/8 text-dai-qing/50">
                <th className="py-2 px-2 font-normal">爻位</th><th className="py-2 px-2 font-normal">爻象</th>
                <th className="py-2 px-2 font-normal">纳甲</th><th className="py-2 px-2 font-normal">六亲</th>
                <th className="py-2 px-2 font-normal">六神</th><th className="py-2 px-2 font-normal">世应</th>
                <th className="py-2 px-2 font-normal">旬空</th>
              </tr>
            </thead>
            <tbody>
              {[...yaoList].reverse().map(yao => (
                <tr key={yao.position} className={`border-b border-dai-qing/5 ${yao.isDong ? 'bg-hu-po-jin/5 text-hu-po-jin' : 'text-dai-qing/65'}`}>
                  <td className="py-2.5 px-2 text-center font-medium">{POS_NAMES[yao.position]}</td>
                  <td className="py-2.5 px-2 text-center font-mono">{yao.yinYang==='阳'?'▬▬▬':'▬ ▬'}{yao.isDong&&(yao.value===9?' ○':' ×')}</td>
                  <td className="py-2.5 px-2 text-center">{yao.naGan}{yao.naZhi}</td>
                  <td className="py-2.5 px-2 text-center">{yao.liuQin}</td>
                  <td className="py-2.5 px-2 text-center">{yao.liuShen}</td>
                  <td className="py-2.5 px-2 text-center">{yao.shiYing&&<span className={yao.shiYing==='世'?'text-hu-po-jin':'text-hu-po-jin-dark'}>{yao.shiYing}</span>}</td>
                  <td className="py-2.5 px-2 text-center">{yao.xunKong&&<span className="text-hu-po-jin-dark">空</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== 天盘 ===== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">天盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">星宿演禽 · 吞啖</span>
        </div>
        {/* 吞啖 */}
        <div className="bg-xuan-zhi rounded-lg p-3 mb-4">
          <p className="text-xs text-dai-qing/60 mb-2">
            世宿 <span className="text-hu-po-jin">{tianPan.shiXiu||'?'}</span>
            {' ↔ '}
            应宿 <span className="text-hu-po-jin-dark">{tianPan.yingXiu||'?'}</span>
          </p>
          <p className="text-sm text-dai-qing/80">{tianPan.tunTie}</p>
        </div>
        {/* 格局 */}
        {tianPan.geJu.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tianPan.geJu.map(g => (
              <span key={g} className="text-[10px] text-hu-po-jin bg-hu-po-jin/10 border border-hu-po-jin/20 rounded px-2 py-0.5">{g}</span>
            ))}
          </div>
        )}
        {/* 星宿表 */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-y border-dai-qing/8 text-dai-qing/50">
                <th className="py-2 px-2 font-normal">爻</th><th className="py-2 px-2 font-normal">星宿</th>
                <th className="py-2 px-2 font-normal">禽象</th><th className="py-2 px-2 font-normal">泊位</th>
              </tr>
            </thead>
            <tbody>
              {[...tianPan.yaoXiu].reverse().map(x => (
                <tr key={x.position} className="border-b border-dai-qing/5 text-dai-qing/65">
                  <td className="py-2 px-2 text-center">{POS_NAMES[x.position]}</td>
                  <td className="py-2 px-2 text-center">{x.xiuName}</td>
                  <td className="py-2 px-2 text-center">{x.qinXiang}</td>
                  <td className="py-2 px-2 text-center text-[10px]">{x.boWei}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== 地盘 ===== */}
      <div className={sectionClass}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">地盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">卦象数理 · 化卦</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 text-center">
          <div className="bg-xuan-zhi rounded-lg p-3">
            <p className="text-[10px] text-dai-qing/50">内数（{diPan.neiGua}）</p>
            <p className="text-2xl text-hu-po-jin">{diPan.neiShu}</p>
          </div>
          <div className="bg-xuan-zhi rounded-lg p-3">
            <p className="text-[10px] text-dai-qing/50">外数（{diPan.waiGua}）</p>
            <p className="text-2xl text-hu-po-jin">{diPan.waiShu}</p>
          </div>
        </div>
        <div className="space-y-2">
          {diPan.operations.map(op => (
            <div key={op.type} className="bg-xuan-zhi rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-dai-qing/60">{op.formula}</span>
                <span className="text-[10px] text-dai-qing/40 ml-2">{op.meaning}</span>
              </div>
              <span className="text-sm text-hu-po-jin font-mono">{op.result}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <span className="text-[10px] text-dai-qing/50">化卦  </span>
          <span className="text-lg text-hu-po-jin ml-1">{diPan.huaGua}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-2 pb-8">
        <button onClick={onBack} className="px-5 py-2.5 text-xs text-dai-qing/60 border border-dai-qing/15 rounded-lg tracking-[2px] hover:border-hu-po-jin/30 transition-colors">
          ← 重新提问
        </button>
        <Link href="/create" className="px-5 py-2.5 text-xs text-hu-po-jin border border-hu-po-jin/30 rounded-lg tracking-[2px] hover:bg-hu-po-jin/10 transition-colors no-underline">
          完整命盘 →
        </Link>
      </div>

      <p className="text-center text-[10px] text-dai-qing/30 tracking-[2px] pb-8">
        仅供参考 · 不构成决策建议
      </p>
    </div>
  );
}
