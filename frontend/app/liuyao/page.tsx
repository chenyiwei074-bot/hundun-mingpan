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
  const [method, setMethod] = useState<'random'|'manual'>('random');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullResult | null>(null);
  const [error, setError] = useState('');
  const [manualNums, setManualNums] = useState<string[]>(['','','','','','']);

    const handleSubmit = async () => {
    setError('');
    if (!question.trim()) { setError('请填写占问事项'); return; }
    setLoading(true);
    try {
      const body: any = { question: question.trim(), method };
      if (method === 'manual') {
        const nums = manualNums.map(n => parseInt(n));
        if (nums.some(n => isNaN(n) || ![6,7,8,9].includes(n))) {
          setError('请输入有效的爻值 (6=老阴, 7=少阳, 8=少阴, 9=老阳)'); setLoading(false); return;
        }
        body.manualData = nums;
      }
      const res = await fetch('/api/liuyao/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { setResult(json.data); setStep('result'); }
      else { setError(json.error || '起卦失败'); }
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
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

  const reset = () => { setStep('input'); setResult(null); setQuestion(''); setManualNums(['','','','','','']); };

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
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value:'random', label:'随机起卦', desc:'系统随机模拟铜钱摇卦', icon:'🎲' },
                  { value:'manual', label:'报数起卦', desc:'从初爻到上爻输入6个数字', icon:'🔢' },
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

            {/* 报数起卦：六爻输入 */}
            {method === 'manual' && (
              <section className="bg-xuan-zhi-dark/30 border border-dai-qing/8 rounded-xl p-6">
                <p className="text-[10px] text-dai-qing/50 tracking-[2px] mb-3">手 动 输 爻 (初→上)</p>
                <p className="text-[10px] text-dai-qing/40 mb-4">6=老阴(动) 7=少阳 8=少阴 9=老阳(动)</p>
                <div className="grid grid-cols-6 gap-2">
                  {manualNums.map((n, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] text-dai-qing/40 mb-1">{['初','二','三','四','五','上'][i]}</p>
                      <input
                        type="number" min={6} max={9} value={n}
                        onChange={e => {
                          const v = e.target.value.slice(-1);
                          const newNums = [...manualNums];
                          newNums[i] = v;
                          setManualNums(newNums);
                        }}
                        className="w-full text-center bg-xuan-zhi border border-dai-qing/15 rounded-lg py-2 text-sm text-dai-qing outline-none focus:border-hu-po-jin/40"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {error && <div className="bg-dai-qing-dark/20/30 border border-dai-qing-dark/30 rounded-lg p-3 text-center text-sm text-hu-po-jin-dark">{error}</div>}

            <div className="text-center">
              <button onClick={handleSubmit}
                className="bg-hu-po-jin text-xuan-zhi text-base px-12 py-4 rounded-lg tracking-[4px] font-medium hover:bg-hu-po-jin transition-all"
              >{method === 'manual' ? '提 交 卦 象' : '开 始 起 卦'}</button>
              <p className="mt-4 text-[10px] text-dai-qing/40 tracking-[2px]">心念一动即起卦 · 免费体验</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block w-10 h-10 border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin mb-4" />
            <p className="text-sm text-dai-qing/60 tracking-[2px]">起卦中...</p>
          </div>
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
  const { analysis, pan, tianPan, diPan } = result;
  const benGua = pan.benGua;
  const yaoList = pan.yaoList;

  return (
    <div className="space-y-6">
      {/* ===== 卦象概览 ===== */}
      <section className="bg-gradient-to-br from-dai-qing to-dai-qing-dark border border-xuan-zhi/8 rounded-2xl p-8 text-center">
        <p className="text-[10px] tracking-[0.4em] text-xuan-zhi/35 mb-4">卦 象 结 果</p>
        <div className="text-6xl mb-4">{GUA_EMOJI[benGua.shangGua]}{GUA_EMOJI[benGua.xiaGua]}</div>
        <h2 className="font-serif text-2xl text-xuan-zhi tracking-[0.05em]">
          {benGua.name}
          <span className="text-hu-po-jin/60 text-base ml-2">{benGua.guaType}</span>
        </h2>
        <p className="mt-2 text-sm text-xuan-zhi/50">
          {benGua.shangGua}{GUA_EMOJI[benGua.shangGua]}上 · {benGua.xiaGua}{GUA_EMOJI[benGua.xiaGua]}下
          <span className="mx-2">|</span>
          {benGua.gongWei}宫 · {benGua.gongWuXing}
        </p>
        <p className="mt-3 text-[13px] text-xuan-zhi/70 max-w-md mx-auto leading-relaxed">{analysis}</p>
        {pan.bianGua && (
          <div className="mt-6 pt-5 border-t border-xuan-zhi/10">
            <p className="text-[10px] text-xuan-zhi/35 tracking-[0.3em] mb-3">变 卦</p>
            <div className="text-4xl mb-2">{GUA_EMOJI[pan.bianGua.shangGua]}{GUA_EMOJI[pan.bianGua.xiaGua]}</div>
            <p className="font-serif text-lg text-xuan-zhi/80">{pan.bianGua.name}</p>
          </div>
        )}
      </section>

      {/* ===== 人盘 ===== */}
      <section className="bg-xuan-zhi border border-dai-qing/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">人盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">六爻纳甲 · 用神分析</span>
          <span className="ml-auto text-[10px] text-dai-qing/40">日辰 {pan.riChen.gan}{pan.riChen.zhi} · 月建 {pan.yueJian}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-dai-qing/8 text-dai-qing/50 text-xs">
                <th className="py-2.5 px-2 font-normal">爻</th>
                <th className="py-2.5 px-2 font-normal">纳甲</th>
                <th className="py-2.5 px-2 font-normal">六亲</th>
                <th className="py-2.5 px-2 font-normal">六神</th>
                <th className="py-2.5 px-2 font-normal">世应</th>
                <th className="py-2.5 px-2 font-normal">空亡</th>
              </tr>
            </thead>
            <tbody>
              {[...yaoList].reverse().map(yao => (
                <tr key={yao.position} className="border-b border-dai-qing/5 text-center">
                  <td className="py-2.5 px-2">
                    <span className="text-dai-qing/60">{POS_NAMES[yao.position]}</span>
                    <span className={yao.yinYang === "阳" ? "ml-1 text-hu-po-jin" : "ml-1 text-dai-qing/40"}>
                      {yao.yinYang === "阳" ? "▬▬▬" : "▬ ▬"}
                    </span>
                    {yao.isDong && <span className="ml-1 text-[10px] text-hu-po-jin">○动</span>}
                  </td>
                  <td className="py-2.5 px-2 text-dai-qing/70">{yao.naGan}{yao.naZhi}</td>
                  <td className="py-2.5 px-2 text-dai-qing/70">{yao.liuQin}</td>
                  <td className="py-2.5 px-2 text-dai-qing/70">{yao.liuShen}</td>
                  <td className="py-2.5 px-2">{yao.shiYing&&<span className="text-hu-po-jin text-xs">{yao.shiYing}</span>}</td>
                  <td className="py-2.5 px-2">{yao.xunKong&&<span className="text-hu-po-jin-dark text-xs">空</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== 天盘 ===== */}
      <section className="bg-xuan-zhi border border-dai-qing/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">天盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">星宿演禽 · 吞啖格局</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-xuan-zhi-dark/30 rounded-xl p-4 text-center border border-dai-qing/5">
            <p className="text-[10px] text-dai-qing/40 mb-1">世爻星宿</p>
            <p className="text-xl text-hu-po-jin font-serif">{tianPan.shiXiu||"?"}</p>
          </div>
          <div className="bg-xuan-zhi-dark/30 rounded-xl p-4 text-center border border-dai-qing/5">
            <p className="text-[10px] text-dai-qing/40 mb-1">应爻星宿</p>
            <p className="text-xl text-hu-po-jin-dark font-serif">{tianPan.yingXiu||"?"}</p>
          </div>
        </div>
        <div className="bg-dai-qing-dark/10 rounded-xl p-4 mb-4 border border-dai-qing/5">
          <p className="text-xs text-dai-qing/60 mb-1">吞啖关系</p>
          <p className="text-sm text-dai-qing/80">{tianPan.tunTie}</p>
        </div>
        {tianPan.geJu.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tianPan.geJu.map(g => (
              <span key={g} className="text-[10px] text-hu-po-jin bg-hu-po-jin/10 border border-hu-po-jin/20 rounded-full px-3 py-1">{g}</span>
            ))}
          </div>
        )}
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
                <tr key={x.position} className="border-b border-dai-qing/5 text-dai-qing/65 text-center">
                  <td className="py-2 px-2">{POS_NAMES[x.position]}</td>
                  <td className="py-2 px-2">{x.xiuName}</td>
                  <td className="py-2 px-2">{x.qinXiang}</td>
                  <td className="py-2 px-2 text-[10px]">{x.boWei}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== 地盘 ===== */}
      <section className="bg-xuan-zhi border border-dai-qing/8 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-hu-po-jin border border-hu-po-jin/30 rounded px-2 py-0.5">地盘</span>
          <span className="text-xs text-dai-qing/60 tracking-[2px]">卦象数理 · 化卦推演</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5 text-center">
          <div className="bg-xuan-zhi-dark/30 rounded-xl p-4 border border-dai-qing/5">
            <p className="text-[10px] text-dai-qing/40">内数（{diPan.neiGua}）</p>
            <p className="text-2xl text-hu-po-jin font-serif mt-1">{diPan.neiShu}</p>
          </div>
          <div className="bg-xuan-zhi-dark/30 rounded-xl p-4 border border-dai-qing/5">
            <p className="text-[10px] text-dai-qing/40">外数（{diPan.waiGua}）</p>
            <p className="text-2xl text-hu-po-jin font-serif mt-1">{diPan.waiShu}</p>
          </div>
        </div>
        <div className="space-y-2 mb-5">
          {diPan.operations.map(op => (
            <div key={op.type} className="bg-dai-qing-dark/5 rounded-xl p-3 flex items-center justify-between border border-dai-qing/5">
              <div>
                <span className="text-xs text-dai-qing/60 font-mono">{op.formula}</span>
                <span className="text-[10px] text-dai-qing/40 ml-2">{op.meaning}</span>
              </div>
              <span className="text-sm text-hu-po-jin font-serif">{op.result}</span>
            </div>
          ))}
        </div>
        <div className="text-center pt-3 border-t border-dai-qing/8">
          <span className="text-[10px] text-dai-qing/50">化卦 </span>
          <span className="text-lg text-hu-po-jin font-serif ml-1">{diPan.huaGua}</span>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-2 pb-8">
        <button onClick={onBack} className="px-6 py-3 text-xs text-dai-qing/60 border border-dai-qing/15 rounded-xl tracking-[2px] hover:border-hu-po-jin/30 transition-colors">
          ← 重新提问
        </button>
        <Link href="/create" className="px-6 py-3 text-xs text-hu-po-jin border border-hu-po-jin/30 rounded-xl tracking-[2px] hover:bg-hu-po-jin/10 transition-colors no-underline">
          完整命盘 →
        </Link>
      </div>

      <p className="text-center text-[10px] text-dai-qing/30 tracking-[2px] pb-8">
        仅供参考 · 不构成决策建议
      </p>
    </div>
  );
}
