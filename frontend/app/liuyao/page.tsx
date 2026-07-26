'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';

// ── Types ──
type YaoInfo = { position:number; value:number; yinYang:string; isDong:boolean; naGan:string; naZhi:string; liuQin:string; liuShen:string; shiYing:string|null; xunKong:boolean };
type GuaInfo = { name:string; shangGua:string; xiaGua:string; gongWei:string; gongWuXing:string; guaType:string };
type FullResult = { question:string; qiGua:{method:string; dongYaoPositions:number[]}; pan:{benGua:GuaInfo; bianGua:GuaInfo|null; yaoList:YaoInfo[]; riChen:{gan:string;zhi:string}; yueJian:string; xunKongZhi:string[]}; analysis:string; tianPan:any; diPan:any };

var GUA_EMOJI: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };
var POS_NAMES = ['','初','二','三','四','五','上'];
var GUA_NAMES = ['乾','兑','离','震','巽','坎','艮','坤'];

// ── Yao line values for each gua (from bottom up) ──
var API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'https://hundunmp.vip/api' : '/api';
var GUA_YAO: Record<string,number[]> = {
  '乾':[7,7,7], '兑':[8,7,7], '离':[7,8,7], '震':[8,8,7],
  '巽':[7,7,8], '坎':[8,7,8], '艮':[7,8,8], '坤':[8,8,8]
};

// ── Loading ──
function Spinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-20">
      <div className="relative" style={{ width:100, height:100 }}>
        <div className="absolute inset-0 rounded-full border border-hu-po-jin/20 animate-spin" style={{ animationDuration:'3s' }} />
        <div className="absolute inset-[12px] rounded-full border border-hu-po-jin/10 animate-spin" style={{ animationDuration:'2s', animationDirection:'reverse', borderStyle:'dashed' }} />
        <div className="absolute inset-0 flex items-center justify-center text-2xl text-hu-po-jin/60">☯</div>
      </div>
      <p className="text-dai-qing/40 text-xs tracking-[2px] mt-6">{text}</p>
    </div>
  );
}

// ── Main ──
export default function LiuYaoPage() {
  var [step, setStep] = useState<'input'|'animating'|'loading'|'result'>('input');
  var [method, setMethod] = useState<'random'|'manual'|'direct'>('random');
  var [question, setQuestion] = useState('');
  var [result, setResult] = useState<FullResult|null>(null);
  var [error, setError] = useState('');

  // Manual input state
  var [manualNums, setManualNums] = useState<string[]>(['','','','','','']);
  // Direct pai gua state
  var [directYaos, setDirectYaos] = useState([7,7,7,7,7,7]); // 6爻 初→上: 7少阳 8少阴 9老阳 6老阴
    // Coin animation state
  var [animYao, setAnimYao] = useState<{round:number; coins:number[]; results:number[]}>({round:0, coins:[0,0,0], results:[]});
  var animTimer = useRef<any>(null);

  // ── Submit helpers ──
  var submitAPI = async function(yaoData: number[], method: string) {
    setStep('loading'); setError('');
    try {
      var res = await fetch(API_BASE + '/liuyao/create', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ question: question.trim(), method, manualData: yaoData }),
      });
      var json = await res.json();
      if (json.success) { setResult(json.data); setStep('result'); }
      else { setError(json.error||'起卦失败'); setStep('input'); }
    } catch { setError('网络错误'); setStep('input'); }
  };

  // ── Random coin ──
  var startCoinAnim = function() {
    if (!question.trim()) { setError('请填写所问之事'); return; }
    setStep('animating'); setAnimYao({round:0, coins:[0,0,0], results:[]});
  };

  useEffect(() => {
    if (step !== 'animating') return;
    if (animYao.round >= 6) { submitAPI(animYao.results, 'random'); return; }
    var t1 = setTimeout(function() {
      var backs = Array.from({length:3}, function(){ return Math.floor(Math.random()*2); });
      var totalBacks = backs.reduce(function(a,b){return a+b;}, 0);
      var value = totalBacks === 0 ? 9 : totalBacks === 1 ? 7 : totalBacks === 2 ? 8 : 6;
      setAnimYao(function(p) { return {round:p.round, coins:backs, results:[...p.results, value]}; });
      var t2 = setTimeout(function() { setAnimYao(function(p) { return {...p, round:p.round+1, coins:[0,0,0]}; }); }, 450);
      animTimer.current = t2;
    }, 550);
    animTimer.current = t1;
    return function() { clearTimeout(t1); if (animTimer.current) clearTimeout(animTimer.current); };
  }, [step, animYao.round]);

  // ── Manual submit ──
  var handleManual = function() {
    if (!question.trim()) { setError('请填写所问之事'); return; }
    var nums = manualNums.map(function(n){ return parseInt(n); });
    if (nums.some(function(n){ return isNaN(n) || ![6,7,8,9].includes(n); })) { setError('请输入有效爻值（6/7/8/9）'); return; }
    submitAPI(nums, 'manual');
  };

  // ── Direct pai gua ──
  var handleDirect = function() { if (!question.trim()) { setError('请填写所问之事'); return; } submitAPI(directYaos, 'direct'); };

  var reset = function() {
    setStep('input'); setResult(null); setQuestion('');
    setManualNums(['','','','','','']); setError('');
    setShangGua('乾'); setXiaGua('乾'); setDongYao(1);
  };

  var yaoLabel = function(val: number) {
    switch(val) {
      case 6: return { label:'老阴', sym:'⚋⚋', c:'text-hu-po-jin' };
      case 7: return { label:'少阳', sym:'⚊', c:'text-dai-qing/70' };
      case 8: return { label:'少阴', sym:'⚋', c:'text-dai-qing/50' };
      case 9: return { label:'老阳', sym:'⚊', c:'text-hu-po-jin' };
      default: return { label:'', sym:'', c:'' };
    }
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-xuan-zhi text-dai-qing">
      <nav className="border-b border-dai-qing/8 px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <Link href="/" className="text-hu-po-jin text-sm tracking-[4px] no-underline">混沌</Link>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8">
        {step === 'input' && (
          <div className="space-y-5">
            {/* Title */}
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-hu-po-jin/50 text-xl mb-2"><span>☰</span><span>☵</span><span>☶</span></div>
              <h1 className="text-lg text-dai-qing tracking-[6px] font-normal">混沌问卦</h1>
              <p className="text-xs text-dai-qing/30 tracking-[2px] mt-2">一事一占 · 三盘合断</p>
            </div>

            {/* Question */}
            <div className="qn-card">
              <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-3 text-center">所 问 之 事</p>
              <textarea
                value={question} onChange={function(e){ setQuestion(e.target.value); }}
                placeholder="例如：这次跳槽去新公司发展好吗？"
                rows={3} maxLength={200}
                className="w-full bg-transparent border border-dai-qing/10 rounded-xl p-4 text-sm text-dai-qing placeholder-dai-qing/20 resize-none outline-none focus:border-hu-po-jin/30 transition-colors"
              />
              <p className="text-[10px] text-dai-qing/25 mt-2 text-right">{question.length}/200</p>
            </div>

            {error && <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4 text-center text-sm text-red-400/80">{error}</div>}

            {/* ── 起卦方式 Tabs ── */}
            <div className="flex bg-xuan-zhi-dark rounded-2xl p-1 border border-dai-qing/10">
              {[
                { id:'random' as const, icon:'🎲', label:'随机起卦', desc:'模拟铜钱' },
                { id:'manual' as const, icon:'🔢', label:'报数起卦', desc:'手动输爻' },
                { id:'direct' as const, icon:'☯', label:'直接排卦', desc:'自选卦爻' },
              ].map(function(tab) {
                return (
                  <button key={tab.id} onClick={function(){ setMethod(tab.id); }}
                    className={"flex-1 flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition-all " + (method === tab.id ? 'bg-xuan-zhi text-hu-po-jin shadow-sm' : 'text-dai-qing/35 hover:text-dai-qing/60')}
                  ><span className="text-base">{tab.icon}</span><span className="tracking-[1px]">{tab.label}</span><span className="text-[9px] opacity-50">{tab.desc}</span></button>
                );
              })}
            </div>

            {/* ── 随机起卦 ── */}
            {method === 'random' && (
              <div className="qn-card text-center">
                <div className="py-4">
                  <div className="flex justify-center gap-3 mb-3">
                    {[0,1,2].map(function(i){ return <div key={i} className="w-9 h-9 rounded-full border border-hu-po-jin/20 bg-hu-po-jin/5 flex items-center justify-center text-sm text-hu-po-jin/50">◎</div>; })}
                  </div>
                  <p className="text-xs text-dai-qing/30">系统模拟铜钱摇卦，共掷 6 次，每次 3 枚铜钱</p>
                </div>
                <button onClick={startCoinAnim} className="qn-btn qn-btn--amber qn-btn--md mt-2" style={{borderRadius:'999px',letterSpacing:'.15em'}}>开 始 摇 卦</button>
              </div>
            )}

            {/* ── 报数起卦 ── */}
            {method === 'manual' && (
              <div className="qn-card">
                <p className="text-[10px] text-dai-qing/30 mb-3">从初爻到上爻，依次输入 6 个数值：6=老阴(动) 7=少阳 8=少阴 9=老阳(动)</p>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {manualNums.map(function(n, i) {
                    return (
                      <div key={i} className="text-center">
                        <p className="text-[10px] text-dai-qing/25 mb-1">{['初','二','三','四','五','上'][i]}</p>
                        <input type="number" min={6} max={9} value={n}
                          onChange={function(e) { var v = e.target.value.slice(-1); setManualNums(function(p) { var a = [...p]; a[i] = v; return a; }); }}
                          className="w-full text-center bg-xuan-zhi border border-dai-qing/10 rounded-lg py-2.5 text-sm text-dai-qing outline-none focus:border-hu-po-jin/30"
                        />
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleManual} className="w-full qn-btn qn-btn--primary qn-btn--md" style={{borderRadius:'999px',letterSpacing:'.15em'}}>提 交 卦 象</button>
              </div>
            )}

            {/* ── 直接排卦 ── */}
            {method === 'direct' && (function() {
              var YAO_LABELS = ['初','二','三','四','五','上'];
              var getTrigram = function(a,b,c) {
                var isYang = function(v){return v===7||v===9;};
                var bits = (isYang(a)?4:0)+(isYang(b)?2:0)+(isYang(c)?1:0);
                return ['坤','艮','坎','巽','震','离','兑','乾'][bits];
              };
              var shang = getTrigram(directYaos[3],directYaos[4],directYaos[5]);
              var xia = getTrigram(directYaos[0],directYaos[1],directYaos[2]);
              var hasDong = directYaos.some(function(v){return v===6||v===9;});
              return (
              <div className="qn-card">
                <p className="text-[10px] text-dai-qing/30 mb-4 text-center tracking-[2px]">点击爻象切换 少阳→少阴→老阳→老阴</p>
                <div className="space-y-1.5 mb-4">
                  {[5,4,3,2,1,0].map(function(yaoIdx) {
                    var v = directYaos[yaoIdx];
                    var isYang = v === 7 || v === 9;
                    var isDong = v === 6 || v === 9;
                    var label = v===7?'少阳':v===8?'少阴':v===9?'老阳':'老阴';
                    return (
                      <button key={yaoIdx} onClick={function(){
                        setDirectYaos(function(p) {
                          var a = [...p];
                          a[yaoIdx] = a[yaoIdx]===7?8 : a[yaoIdx]===8?9 : a[yaoIdx]===9?6 : 7;
                          return a;
                        });
                      }}
                        className={"w-full flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-all " + (isDong ? "border-hu-po-jin/40 bg-hu-po-jin/5" : "border-dai-qing/8 hover:border-dai-qing/20")}
                      >
                        <span className="text-[10px] text-dai-qing/30 w-6 text-left">{YAO_LABELS[yaoIdx]}</span>
                        <span className={"text-xl flex-1 text-center " + (isYang?"":"text-dai-qing/30")}>{isYang ? (isDong?"○":"⚊") : (isDong?"×":"⚋")}</span>
                        <span className={"text-[10px] w-12 text-right " + (isDong?"text-hu-po-jin":"text-dai-qing/30")}>{label}{isDong?"动":""}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-center py-3 border border-dai-qing/8 rounded-xl bg-xuan-zhi/50 mb-4">
                  <span className="text-2xl opacity-80">{GUA_EMOJI[shang]}</span>
                  <span className="text-2xl opacity-80 ml-2">{GUA_EMOJI[xia]}</span>
                  <span className="text-[10px] text-dai-qing/30 ml-3">{shang}上{xia}下{hasDong?" · 有动爻":""}</span>
                </div>
                <button onClick={handleDirect} className="w-full qn-btn qn-btn--primary qn-btn--md" style={{borderRadius:'999px',letterSpacing:'.15em'}}>开 始 排 卦</button>
              </div>
              );
            })()}
            <p className="text-center text-[10px] text-dai-qing/20 tracking-[2px] pb-4">心诚则灵 · 免费体验</p>
          </div>
        )}

        {/* ── Coin Animation ── */}
        {step === 'animating' && <CoinAnimation animYao={animYao} yaoLabel={yaoLabel} />}
        {/* ── Loading ── */}
        {step === 'loading' && <Spinner text="推演卦象中..." />}
        {/* ── Result ── */}
        {step === 'result' && result && <ResultView result={result} onBack={reset} />}
      </main>
    </div>
  );
}

// ── Coin Animation (3D flip + ring + particles) ──
function CoinAnimation({ animYao, yaoLabel }: { animYao:any; yaoLabel:any }) {
  var spinning = animYao.results.length === animYao.round && animYao.coins[0] === 0;
  var done = animYao.round >= 6;
  return (
    <div className="py-6">
      <div className="relative flex items-center justify-center mb-8" style={{height:140}}>
        <div className="absolute rounded-full border border-hu-po-jin/15 animate-spin" style={{width:120,height:120,animationDuration:'4s'}} />
        <div className="absolute rounded-full border border-hu-po-jin/10 animate-spin" style={{width:96,height:96,animationDuration:'3s',animationDirection:'reverse',borderStyle:'dashed'}} />
        <div className="absolute rounded-full border border-hu-po-jin/5" style={{width:64,height:64}} />
        <p className="relative text-hu-po-jin text-xs tracking-[6px] animate-pulse">{done ? '起 卦 完 成' : '摇 卦 中'}</p>
      </div>
      <div className="flex justify-center gap-5 mb-6">
        {animYao.coins.map(function(v:number, i:number) {
          var isSpinning = spinning && animYao.round < 6;
          return (
            <div key={i} className="relative" style={{perspective:'200px'}}>
              <div className={"w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all " + (isSpinning ? 'animate-coin-flip' : '')}
                style={isSpinning ? {animation:'coinFlip 0.6s ease-in-out infinite',backgroundColor:'#c9a14a',color:'#0b1414',border:'2px solid #c9a14a',boxShadow:'0 2px 8px rgba(201,161,74,0.4)'} : v===1 ? {backgroundColor:'#c9a14a',color:'#0b1414',border:'2px solid #c9a14a',boxShadow:'0 2px 6px rgba(201,161,74,0.3)'} : {backgroundColor:'transparent',border:'2px solid var(--color-dai-qing)',opacity:'0.5'}}
              >{isSpinning ? '◎' : v===1 ? '花' : '字'}</div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-black/10 rounded-full blur-sm" />
            </div>
          );
        })}
        <style>{"@keyframes coinFlip{0%{transform:rotateY(0deg)}50%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}.animate-coin-flip{animation:coinFlip .6s ease-in-out infinite}"}</style>
      </div>
      <div className="space-y-1.5 max-w-[220px] mx-auto">
        {animYao.results.map(function(val:number, i:number) {
          var y = yaoLabel(val);
          var isNew = i === animYao.results.length - 1 && !spinning && animYao.round < 6;
          return (
            <div key={i} className={"flex items-center justify-between text-sm py-1 px-2 rounded " + (isNew ? 'animate-fade-in bg-hu-po-jin/5' : '')}>
              <span className="text-dai-qing/25 text-xs w-6">{POS_NAMES[i+1]}</span>
              <span className={y.c + " text-base"}>{y.sym}</span>
              <span className="text-dai-qing/35 text-xs w-10 text-right">{y.label}</span>
              {y.label.includes('动') && <span className="text-[9px] text-hu-po-jin border border-hu-po-jin/30 rounded-full px-1.5 py-0.5">动</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-6 max-w-[200px] mx-auto">
        <div className="h-1 bg-dai-qing/10 rounded-full overflow-hidden">
          <div className="h-full bg-hu-po-jin/40 rounded-full transition-all duration-500" style={{width:(animYao.round/6*100)+'%'}} />
        </div>
        <p className="text-center text-[10px] text-dai-qing/20 mt-2">第 {Math.min(animYao.round+1,6)} / 6 爻</p>
      </div>
    </div>
  );
}

// ── Result View ──
function ResultView({ result, onBack }: { result:FullResult; onBack:()=>void }) {
  var { question, analysis, pan, tianPan, diPan } = result;
  var benGua = pan.benGua, yaoList = pan.yaoList;
  return (
    <div className="space-y-4">
      <div className="qn-card text-center">
        <div className="text-5xl mb-4 opacity-80">{GUA_EMOJI[benGua.shangGua]}{GUA_EMOJI[benGua.xiaGua]}</div>
        <h2 className="text-xl text-dai-qing tracking-[0.1em] font-normal">{benGua.name}<span className="text-hu-po-jin/50 text-sm ml-2">{benGua.guaType}</span></h2>
        <p className="text-xs text-dai-qing/35 mt-2">{benGua.shangGua}上 · {benGua.xiaGua}下 · {benGua.gongWei}宫{benGua.gongWuXing}</p>
        {pan.bianGua && <div className="mt-4 pt-4 border-t border-dai-qing/8"><p className="text-[10px] text-dai-qing/25 tracking-[0.3em] mb-2">变 卦</p><div className="text-3xl opacity-70">{GUA_EMOJI[pan.bianGua.shangGua]}{GUA_EMOJI[pan.bianGua.xiaGua]}</div><p className="text-sm text-dai-qing/50 mt-1">{pan.bianGua.name}</p></div>}
      </div>
      {analysis && <div className="qn-card"><p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-3 text-center">卦 象 解 读</p><p className="text-sm text-dai-qing/75 leading-relaxed whitespace-pre-wrap text-center">{analysis}</p></div>}
      <div className="qn-card">
        <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-4 text-center">六 爻 纳 甲</p>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-y border-dai-qing/8 text-dai-qing/35"><th className="py-2 px-1 font-normal">爻</th><th className="py-2 px-1 font-normal">干支</th><th className="py-2 px-1 font-normal">六亲</th><th className="py-2 px-1 font-normal">六神</th><th className="py-2 px-1 font-normal">世应</th><th className="py-2 px-1 font-normal">空亡</th></tr></thead>
        <tbody>{[...yaoList].reverse().map(function(yao){ return <tr key={yao.position} className="border-b border-dai-qing/5 text-center"><td className="py-2 px-1"><span className="text-dai-qing/35">{POS_NAMES[yao.position]}</span><span className={yao.yinYang==='阳'?'ml-1 text-hu-po-jin':'ml-1 text-dai-qing/25'}>{yao.yinYang==='阳'?'⚊':'⚋'}</span>{yao.isDong&&<span className="text-[10px] text-hu-po-jin ml-0.5">○</span>}</td><td className="py-2 px-1 text-dai-qing/55">{yao.naGan}{yao.naZhi}</td><td className="py-2 px-1 text-dai-qing/55">{yao.liuQin}</td><td className="py-2 px-1 text-dai-qing/55">{yao.liuShen}</td><td className="py-2 px-1">{yao.shiYing&&<span className="text-hu-po-jin text-[10px]">{yao.shiYing}</span>}</td><td className="py-2 px-1">{yao.xunKong&&<span className="text-hu-po-jin-dark text-[10px]">空</span>}</td></tr>; })}</tbody></table></div>
        <p className="text-[10px] text-dai-qing/25 mt-3 text-right">日辰 {pan.riChen.gan}{pan.riChen.zhi} · 月建 {pan.yueJian}</p>
      </div>
      <div className="flex justify-center pt-2 pb-8"><button onClick={onBack} className="qn-btn" style={{borderRadius:"999px",letterSpacing:".15em",background:"#00bb7f",color:"#fff",border:"1px solid #00bb7f",padding:"10px 32px",fontSize:"15px"}}>重 新 摇 卦</button></div>
      <p className="text-center text-[10px] text-dai-qing/15 tracking-[2px] pb-8">仅供参考 · 不构成决策建议</p>
    </div>
  );
}
