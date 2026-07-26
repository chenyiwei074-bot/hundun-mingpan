'use client';

import { useState } from 'react';
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
interface PanData {
  benGua: GuaInfo; bianGua: GuaInfo | null; yaoList: YaoInfo[];
  riChen: { gan: string; zhi: string }; yueJian: string; xunKongZhi: string[];
}
interface LiuYaoResult {
  question: string;
  pan: PanData;
  analysis: string;
  qiGua: { method: string; dongYaoPositions: number[] };
}

const GUA_EMOJI: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };
const POS_NAMES = ['','初','二','三','四','五','上'];
const METHOD_NAMES: Record<string,string> = { coin:'铜钱摇卦', time:'时间起卦', random:'随机起卦', manual:'手动输入' };

// ========== Page ==========
export default function LiuYaoPage() {
  const [step, setStep] = useState<'input'|'result'>('input');
  const [question, setQuestion] = useState('');
  const [method, setMethod] = useState<'random'|'time'|'coin'>('random');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LiuYaoResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!question.trim()) { setError('请填写占问事项'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/liuyao/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), method }),
      });
      const json = await res.json();
      if (json.success) { setResult(json.data); setStep('result'); }
      else setError(json.error || '起卦失败');
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep('input'); setResult(null); setQuestion(''); };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0d5b7] font-sans">
      {/* Nav */}
      <nav className="border-b border-[#1a1814] px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#d4a853] text-lg font-bold tracking-[3px] no-underline">混沌阁</Link>
          <span className="text-[#3a3025]">/</span>
          <span className="text-[#8a7a5a] text-sm tracking-[2px]">六爻决策</span>
        </div>
        <Link href="/create" className="text-xs text-[#6b5f52] tracking-[2px] border border-[#2a2520] rounded px-3 py-1 hover:border-[#c9a84c]/30 transition-colors no-underline">
          命盘排盘 →
        </Link>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8">
        {step === 'input' && (
          <InputStep
            question={question} setQuestion={setQuestion}
            method={method} setMethod={setMethod}
            loading={loading} error={error}
            onSubmit={handleSubmit}
          />
        )}
        {step === 'result' && result && (
          <ResultStep result={result} onBack={reset} />
        )}
      </main>
    </div>
  );
}

// ========== Input Step ==========
function InputStep({
  question, setQuestion, method, setMethod,
  loading, error, onSubmit,
}: {
  question: string; setQuestion: (v:string)=>void;
  method: string; setMethod: (v:'random'|'time'|'coin')=>void;
  loading: boolean; error: string; onSubmit: ()=>void;
}) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 text-[#d4a853] text-3xl mb-3">
          <span>☰</span><span>☵</span><span>☶</span>
        </div>
        <h1 className="text-2xl text-[#e8e0d5] tracking-[4px] font-normal mb-2">混沌问卦</h1>
        <p className="text-sm text-[#8a7a5a] tracking-[2px] leading-relaxed">
          一事一占 · 六爻定吉凶 · 三盘合断
        </p>
      </div>

      {/* Step 1: Question */}
      <section className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-[#d4a853] border border-[#d4a853]/30 rounded px-2 py-0.5 tracking-[2px]">壹</span>
          <span className="text-[#e8e0d5] tracking-[3px] text-sm">陈 所 问</span>
        </div>
        <p className="text-xs text-[#6b5f52] mb-4 leading-relaxed">
          六爻「一事一占」——请在心里想清楚你要问的那件事，越具体卦象越精准。
        </p>
        <textarea
          value={question}
          onChange={e => { setQuestion(e.target.value); if (error) setQuestion(e.target.value); }}
          placeholder="例如：这个工作机会适合我吗？这次投资是否可行？"
          rows={3}
          maxLength={200}
          className="w-full bg-[#0a0806] border border-[#2a2520] rounded-lg p-4 text-[#e0d5b7] text-sm placeholder-[#4a4035] resize-none outline-none focus:border-[#c9a84c]/40 transition-colors"
        />
        <p className="text-right text-[10px] text-[#4a4035] mt-1">{question.length}/200</p>
      </section>

      {/* Step 2: Method */}
      <section className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] text-[#d4a853] border border-[#d4a853]/30 rounded px-2 py-0.5 tracking-[2px]">贰</span>
          <span className="text-[#e8e0d5] tracking-[3px] text-sm">择 起 卦 方 式</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value:'random', label:'系统摇卦', desc:'随机生成卦象', icon:'🎲' },
            { value:'time', label:'时间起卦', desc:'以当下时刻起卦', icon:'🕐' },
            { value:'coin', label:'铜钱摇卦', desc:'模拟三枚铜钱', icon:'🪙' },
          ].map(m => (
            <button key={m.value}
              onClick={() => setMethod(m.value as 'random'|'time'|'coin')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                method === m.value
                  ? 'border-[#c9a84c] bg-[#c9a84c]/5 text-[#e0c878]'
                  : 'border-[#1a1814] bg-[#0a0806] text-[#6b5f52] hover:border-[#3a3025]'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span className="text-xs tracking-[1px]">{m.label}</span>
              <span className="text-[10px] opacity-60">{m.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-[#3a1010]/30 border border-[#6b2020]/30 rounded-lg p-3 text-center text-sm text-[#c44]">
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="bg-[#c9a84c] text-[#0d0b09] text-base px-12 py-4 rounded-lg tracking-[4px] font-medium hover:bg-[#e0c878] disabled:opacity-50 disabled:cursor-wait transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="animate-spin">⏳</span> 起卦中...
            </span>
          ) : '起 卦 推 演'}
        </button>
        <p className="mt-4 text-[10px] text-[#5a5040] tracking-[2px]">
          心念一动即起卦 · 当前为免费体验
        </p>
      </div>
    </div>
  );
}

// ========== Result Step ==========
function ResultStep({ result, onBack }: { result: LiuYaoResult; onBack: ()=>void }) {
  const { question, pan, analysis, qiGua } = result;
  const { benGua, bianGua, yaoList, riChen, yueJian, xunKongZhi } = pan;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-3">
        <p className="text-[10px] text-[#6b5f52] tracking-[3px] mb-2">{METHOD_NAMES[qiGua.method] || '起卦'}</p>
        <div className="text-5xl mb-3">
          {GUA_EMOJI[benGua.xiaGua]}{GUA_EMOJI[benGua.shangGua]}
        </div>
        <h2 className="text-xl text-[#d4a853] tracking-[4px] font-normal">{benGua.name}</h2>
        <p className="text-xs text-[#6b5f52] mt-1">
          {benGua.gongWei}宫 · 属{benGua.gongWuXing} · {benGua.guaType}
          {bianGua && <> · 之 {bianGua.name}</>}
        </p>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-[#5a5040]">
          <span>日辰 {riChen.gan}{riChen.zhi}</span>
          <span>月建 {yueJian}</span>
          <span>旬空 {xunKongZhi.join('')}</span>
        </div>
      </div>

      {/* Question */}
      <section className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-5">
        <p className="text-[10px] text-[#6b5f52] tracking-[2px] mb-2">占 问 事 项</p>
        <p className="text-[#d0c8b0] text-sm leading-relaxed">{question}</p>
      </section>

      {/* Analysis */}
      <section className="bg-[#100e0c] border border-[#1a1814] rounded-xl p-5">
        <p className="text-[10px] text-[#6b5f52] tracking-[2px] mb-3">卦 象 初 判</p>
        <p className="text-[#b0a590] text-sm leading-relaxed">{analysis}</p>
        {qiGua.dongYaoPositions.length > 0 && (
          <p className="text-xs text-[#8a7a5a] mt-2">
            动爻: {qiGua.dongYaoPositions.map(p => POS_NAMES[p]+'爻').join('、')}
          </p>
        )}
      </section>

      {/* Liuyao Table */}
      <section className="bg-[#100e0c] border border-[#1a1814] rounded-xl overflow-hidden">
        <p className="text-[10px] text-[#6b5f52] tracking-[2px] px-5 pt-5 pb-3">六 爻 排 盘</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-y border-[#1a1814] text-[#6b5f52]">
                <th className="py-2 px-3 font-normal tracking-[1px]">爻位</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">爻象</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">纳甲</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">六亲</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">六神</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">世应</th>
                <th className="py-2 px-3 font-normal tracking-[1px]">旬空</th>
              </tr>
            </thead>
            <tbody>
              {[...yaoList].reverse().map((yao) => (
                <tr key={yao.position}
                  className={`border-b border-[#0e0c09] ${
                    yao.isDong ? 'bg-[#c9a84c]/5 text-[#e0c878]' : 'text-[#a09580]'
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-medium">{POS_NAMES[yao.position]}</td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {yao.yinYang === '阳' ? '▬▬▬' : '▬ ▬'}
                    {yao.isDong && (yao.value===9 ? ' ○' : ' ×')}
                  </td>
                  <td className="py-2.5 px-3 text-center">{yao.naGan}{yao.naZhi}</td>
                  <td className="py-2.5 px-3 text-center">{yao.liuQin}</td>
                  <td className="py-2.5 px-3 text-center">{yao.liuShen}</td>
                  <td className="py-2.5 px-3 text-center">
                    {yao.shiYing && (
                      <span className={yao.shiYing==='世' ? 'text-[#d4a853]':'text-[#c44]'}>
                        {yao.shiYing}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {yao.xunKong && <span className="text-[#c44]">空</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-2">
        <button onClick={onBack}
          className="px-5 py-2.5 text-xs text-[#8a7a5a] border border-[#2a2520] rounded-lg tracking-[2px] hover:border-[#c9a84c]/30 transition-colors"
        >
          ← 返回重问
        </button>
        <Link href="/create"
          className="px-5 py-2.5 text-xs text-[#d4a853] border border-[#c9a84c]/30 rounded-lg tracking-[2px] hover:bg-[#c9a84c]/10 transition-colors no-underline"
        >
          完整命盘报告 →
        </Link>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-[#4a4035] tracking-[2px] pt-4">
        仅供参考 · 不构成决策建议
      </p>
    </div>
  );
}
