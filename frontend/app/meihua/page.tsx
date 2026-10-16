'use client';

import { useCallback, useMemo, useState } from 'react';
import { qiGuaByNumbers, qiGuaByTime, trigramInfo } from '@/lib/meihua/engine';
import type { HexagramInfo, MeiHuaMethod, MeiHuaResult } from '@/lib/meihua/engine';

// 五行色是冻结的数据编码，只当圆点用，不落进文字（与八字卡同一纪律）。
const WX_COLOR: Record<string, string> = {
  木: 'var(--color-wx-mu)', 火: 'var(--color-wx-huo)', 土: 'var(--color-wx-tu)',
  金: 'var(--color-wx-jin)', 水: 'var(--color-wx-shui)',
};

const TABS: { id: MeiHuaMethod; title: string; hint: string }[] = [
  { id: 'time', title: '时间起卦', hint: '以问事年月日时起数，农历月日 + 年支时支。' },
  { id: 'number', title: '数字起卦', hint: '报两个数：一号定上卦，二号定下卦，两数之和定动爻。' },
  { id: 'report', title: '报数起卦', hint: '报三个数：顺次定上卦、下卦、动爻。' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toInputValue = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** 一爻：阳为整条，阴为断条；动爻加标记。 */
function YaoLine({ yang, dong, width }: { yang: boolean; dong: boolean; width: string }) {
  const color = dong ? 'var(--color-accent-gold-text)' : 'var(--color-text-primary)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6, width, minWidth: 0, flex: '1 1 auto' }}>
        {yang ? (
          <div style={{ flex: '1 1 auto', height: 3, background: color, borderRadius: 99 }} />
        ) : (
          <>
            <div style={{ flex: '1 1 auto', height: 3, background: color, borderRadius: 99 }} />
            <div style={{ flex: '1 1 auto', height: 3, background: color, borderRadius: 99 }} />
          </>
        )}
      </div>
      <span className="qn-cap" style={{ width: 12, flex: '0 0 auto', textAlign: 'center', color: 'var(--color-accent-gold-text)' }}>
        {dong ? (yang ? '○' : '×') : ''}
      </span>
    </div>
  );
}

function GuaColumn({ gua, caption, dongYao }: { gua: HexagramInfo; caption: string; dongYao?: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p className="qn-cap" style={{ textAlign: 'center' }}>{caption}</p>
      <p className="qn-title" style={{ textAlign: 'center', marginTop: 6, overflowWrap: 'break-word' }}>{gua.name}</p>
      <div style={{ display: 'grid', gap: 7, margin: '14px auto 10px', width: 'fit-content', minWidth: 0 }}>
        {[5, 4, 3, 2, 1, 0].map(i => (
          <YaoLine key={i} yang={gua.lines[i] === 1} dong={dongYao === i + 1} width="100%" />
        ))}
      </div>
      <p className="qn-meta" style={{ textAlign: 'center' }}>
        {gua.shangGua}{trigramInfo(gua.shangGua).symbol} / {gua.xiaGua}{trigramInfo(gua.xiaGua).symbol}
      </p>
    </div>
  );
}

function WxDot({ wuxing, label }: { wuxing: string; label: string }) {
  return (
    <span className="qn-badge">
      <span className="qn-badge__dot" style={{ background: WX_COLOR[wuxing] || 'var(--color-text-muted)' }} />
      {label}
    </span>
  );
}

export default function MeiHuaPage() {
  const [method, setMethod] = useState<MeiHuaMethod>('time');
  const [ask, setAsk] = useState('');
  const [when, setWhen] = useState(() => toInputValue(new Date()));
  const [nums, setNums] = useState(['', '', '']);
  const [result, setResult] = useState<MeiHuaResult | null>(null);
  const [error, setError] = useState('');

  const tab = useMemo(() => TABS.find(t => t.id === method)!, [method]);
  const needNums = method === 'report' ? 3 : 2;

  const setNum = (i: number, v: string) =>
    setNums(prev => prev.map((x, idx) => (idx === i ? v.replace(/[^\d]/g, '') : x)));

  const doQiGua = useCallback(() => {
    setError('');
    try {
      if (method === 'time') {
        const d = new Date(when);
        if (Number.isNaN(d.getTime())) { setError('请选择有效的问事时间'); return; }
        setResult(qiGuaByTime(d));
        return;
      }
      const picked = nums.slice(0, needNums).map(n => Number(n));
      if (picked.some(n => !Number.isFinite(n) || n <= 0)) {
        setError(`请输入 ${needNums} 个正整数`);
        return;
      }
      setResult(qiGuaByNumbers(picked, method));
    } catch (e) {
      setError(e instanceof Error ? e.message : '起卦失败');
    }
  }, [method, when, nums, needNums]);

  const resetAll = () => {
    setResult(null);
    setError('');
    setAsk('');
    setNums(['', '', '']);
    setWhen(toInputValue(new Date()));
  };

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>梅花易数</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>即物起卦 · 体用为纲</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>年月日时皆可成卦 · 一爻既动三卦自生</p>
      </header>

      {!result && (
        <>
          <section className="qn-card qn-rise qn-rise--2">
            <label className="qn-label" htmlFor="mh-ask">所问之事（可选）</label>
            <textarea id="mh-ask" className="qn-textarea" rows={2} maxLength={120} value={ask}
              placeholder="例如：这单合作值不值得跟进？"
              onChange={e => setAsk(e.target.value)} />

            {/* row-gap 12：chip 的 44 命中带上下各伸出 5px，折行时两带必须分开，
                否则下一行会盖掉上一行的可点区（与 liuyao/create 同一条约束）。 */}
            <div role="tablist" aria-label="起卦方式" style={{ display: 'flex', gap: '12px 8px', marginTop: 18, flexWrap: 'wrap' }}>
              {TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={method === t.id}
                  className={`qn-chip${method === t.id ? ' qn-chip--on' : ''}`}
                  onClick={() => { setMethod(t.id); setError(''); }}>
                  {t.title}
                </button>
              ))}
            </div>
            <p className="qn-cap" style={{ marginTop: 10 }}>{tab.hint}</p>

            {method === 'time' ? (
              <div style={{ marginTop: 16 }}>
                <label className="qn-label" htmlFor="mh-when">问事时间</label>
                <input id="mh-when" className="qn-input" type="datetime-local" value={when}
                  onChange={e => setWhen(e.target.value)} />
                <button type="button" className="qn-chip" style={{ marginTop: 10 }}
                  onClick={() => setWhen(toInputValue(new Date()))}>用此刻</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${needNums}, minmax(0, 1fr))`, gap: 12, marginTop: 16 }}>
                {Array.from({ length: needNums }, (_, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <label className="qn-label" htmlFor={`mh-n${i}`}>
                      {method === 'number'
                        ? (i === 0 ? '第一个数' : '第二个数')
                        : ['上卦数', '下卦数', '动爻数'][i]}
                    </label>
                    <input id={`mh-n${i}`} className="qn-input" inputMode="numeric" value={nums[i]}
                      placeholder={i === 0 ? '如 7' : '如 3'}
                      onChange={e => setNum(i, e.target.value)} />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="qn-alert" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            <p className="qn-cap" style={{ marginTop: 14 }}>梅花不讲摇钱，取的是当下这一象；心里默念所问，再起卦。</p>
          </section>

          <button type="button" className="qn-btn qn-btn--solid qn-btn--block qn-rise qn-rise--3"
            style={{ marginTop: 20 }} onClick={doQiGua}>起卦</button>
        </>
      )}

      {result && (
        <>
          <section className="qn-card qn-rise">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <p className="qn-eyebrow" style={{ margin: 0 }}>
                {TABS.find(t => t.id === result.method)?.title}
                {result.when ? ` · ${result.when.civil}` : ''}
              </p>
              <p className="qn-cap" style={{ margin: 0 }}>{result.when ? `农历${result.when.lunar}` : ''}</p>
            </div>
            {ask.trim() && (
              <p className="qn-body" style={{ marginTop: 10 }}>所问：{ask.trim()}</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 12px', marginTop: 18 }}>
              <GuaColumn gua={result.ben} caption="本卦" dongYao={result.dongYao} />
              <GuaColumn gua={result.hu} caption="互卦" />
              <GuaColumn gua={result.bian} caption="变卦" />
            </div>
            <p className="qn-cap" style={{ textAlign: 'center', marginTop: 6 }}>
              动爻在第{result.dongYao}爻 · ○ 阳爻动 × 阴爻动
            </p>
          </section>

          <section className="qn-card qn-rise qn-rise--2" style={{ marginTop: 16 }}>
            <p className="qn-eyebrow" style={{ margin: 0 }}>体用</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <WxDot wuxing={result.ti.wuxing} label={`体 ${result.ti.name}${result.ti.symbol} ${result.ti.wuxing}`} />
              <span className="qn-cap">→</span>
              <WxDot wuxing={result.yong.wuxing} label={`用 ${result.yong.name}${result.yong.symbol} ${result.yong.wuxing}`} />
              <span className="qn-badge">{result.relation}</span>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <p className="qn-cap" style={{ margin: 0 }}>倾向指数（自研）</p>
                <p className="qn-title" style={{ margin: 0 }}>{result.level} · {result.score}</p>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 8 }}>
                <div style={{ height: '100%', borderRadius: 99, background: 'var(--color-accent-gold)', width: `${result.score}%` }} />
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {result.readings.map(r => (
                <div key={r.label} style={{ borderTop: 'var(--qn-hairline)', paddingTop: 12, marginTop: 12 }}>
                  <p className="qn-axis" style={{ margin: 0 }}>{r.label}</p>
                  <p className="qn-body" style={{ marginTop: 6 }}>{r.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }}>
            <p className="qn-eyebrow" style={{ margin: 0 }}>取数过程</p>
            <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {result.steps.map((s, i) => (
                <li key={i} className="qn-meta" style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                  <span className="qn-axis" style={{ marginTop: 2 }}>{i + 1}</span>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{s}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="qn-legal" style={{ marginTop: 24 }}>
            <h2>起卦口径</h2>
            {result.basis.map(b => <p key={b}>{b}</p>)}
            <h2>关于这份断语</h2>
            <p>趋势指数与上面的断语出自本站自建规则，本模型为自研，非还原：权重写在
              frontend/lib/meihua/engine.ts 顶部注释里，可以直接读。同类产品的评分模型与解读文案
              均未公开，也没有被取用。</p>
            <p>象义取自《说卦传》一类公版基础概念。占卜供参照与思考之用，不构成医疗、法律、投资建议。</p>
          </section>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button type="button" className="qn-btn qn-btn--ghost" onClick={resetAll}>再占一问</button>
          </div>
        </>
      )}
    </main>
  );
}
