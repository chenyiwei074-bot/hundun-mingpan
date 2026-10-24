'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  leapMonthOfYear,
  lunarDayCount,
  toCivilInput,
} from '@/app/lib/core/yiqi-core/lunar-input';
import { queryBenMingXiu, XIU_ORDER } from '@/lib/xiu/engine';
import type { XiuResult } from '@/lib/xiu/engine';

// 五行色是冻结的数据编码，只当圆点/色块用，不落进文字（与八字卡、梅花页同一纪律）。
const WX_COLOR: Record<string, string> = {
  木: 'var(--color-wx-mu)', 火: 'var(--color-wx-huo)', 土: 'var(--color-wx-tu)',
  金: 'var(--color-wx-jin)', 水: 'var(--color-wx-shui)',
};

/** 四象顺读次序，也是 28 宿序的分段：每象 7 宿。 */
const QUADRANTS: { gong: string; name: string; from: number }[] = [
  { gong: '东', name: '苍龙', from: 0 },
  { gong: '北', name: '玄武', from: 7 },
  { gong: '西', name: '白虎', from: 14 },
  { gong: '南', name: '朱雀', from: 21 },
];

// 宿表仍只有站里六爻内核那一份，这里只取单字用于铺表。
const XIUZI = XIU_ORDER.map(n => n[0]);

type Mode = 'solar' | 'lunar';

interface DateDraft {
  mode: Mode;
  solar: string;
  lunarY: string;
  lunarM: string;
  lunarD: string;
  leap: boolean;
}

const emptyDraft = (): DateDraft => ({ mode: 'solar', solar: '', lunarY: '', lunarM: '', lunarD: '', leap: false });

const digits = (v: string) => v.replace(/[^\d]/g, '');

/** 一栏生日：公历走单个日期控件，农历走年/月/日 + 闰月，换算交给站里同一套 toCivilInput。 */
function DateFields({ id, draft, set, showLeap }: {
  id: string;
  draft: DateDraft;
  set: (next: DateDraft) => void;
  showLeap: boolean;
}) {
  return (
    <>
      <div role="tablist" aria-label="历法" style={{ display: 'flex', gap: '12px 8px', flexWrap: 'wrap' }}>
        {(['solar', 'lunar'] as Mode[]).map(m => (
          <button key={m} type="button" role="tab" aria-selected={draft.mode === m}
            className={`qn-chip${draft.mode === m ? ' qn-chip--on' : ''}`}
            onClick={() => set({ ...draft, mode: m, leap: false })}>
            {m === 'solar' ? '公历' : '农历'}
          </button>
        ))}
      </div>

      {draft.mode === 'solar' ? (
        <div style={{ marginTop: 12 }}>
          <label className="qn-label" htmlFor={`${id}-s`}>出生日期</label>
          <input id={`${id}-s`} className="qn-input" type="date" min="1901-01-01" max="2099-12-31"
            value={draft.solar} onChange={e => set({ ...draft, solar: e.target.value })} />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {([['农历年', 'lunarY', '如 1994'], ['农历月', 'lunarM', '1-12'], ['农历日', 'lunarD', '1-30']] as const)
              .map(([label, key, ph]) => (
                <div key={key} style={{ minWidth: 0 }}>
                  <label className="qn-label" htmlFor={`${id}-${key}`}>{label}</label>
                  <input id={`${id}-${key}`} className="qn-input" inputMode="numeric" value={draft[key]}
                    placeholder={ph} onChange={e => set({ ...draft, [key]: digits(e.target.value) })} />
                </div>
              ))}
          </div>
          {showLeap && (
            <button type="button" className={`qn-chip${draft.leap ? ' qn-chip--on' : ''}`}
              style={{ marginTop: 12 }} onClick={() => set({ ...draft, leap: !draft.leap })}>
              闰{draft.lunarM || '?'}月
            </button>
          )}
        </div>
      )}
    </>
  );
}

function XiuHeadline({ r }: { r: XiuResult }) {
  const b = r.ben;
  return (
    <div style={{ textAlign: 'center' }}>
      {r.input.fromLunar && (
        <p className="qn-cap" style={{ margin: '0 0 6px' }}>
          输入为农历{r.input.original}，经本站命盘同一套换算得公历{r.input.civil}，命宿按此日取
        </p>
      )}
      <p className="qn-cap" style={{ margin: 0 }}>{b.civil} · {b.lunar} · {b.dayGanZhi}日 · 星期{b.week}</p>
      <p style={{
        fontFamily: '"Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif',
        fontSize: 'var(--qn-fs-display)', fontWeight: 600, lineHeight: 1.08,
        color: 'var(--color-text-primary)', margin: '10px 0 4px', letterSpacing: '0.04em',
      }}>{b.fullName}</p>
      <p className="qn-meta" style={{ margin: 0 }}>{b.gong}方{b.sixiang}第 {(b.index % 7) + 1} 宿 · {b.yao}曜 · {b.qin} · 五行属{b.wuxing}</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <span className="qn-badge">
          <span className="qn-badge__dot" style={{ background: WX_COLOR[b.wuxing] || 'var(--color-text-muted)' }} />
          {b.wuxing}
        </span>
        <span className="qn-badge">
          <span className="qn-badge__dot"
            style={{ background: b.luck === '吉' ? 'var(--color-ji)' : 'var(--color-xiong)' }} />
          通书值日{b.luck}
        </span>
      </div>
    </div>
  );
}

/** 28 宿直日表：按四象分段铺开，标出命宿落点，一眼看到自己在循环里的位置。 */
function XiuRibbon({ active }: { active: number }) {
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
      {QUADRANTS.map(q => (
        <div key={q.gong} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="qn-axis" style={{ width: 40, flex: '0 0 auto' }}>{q.name}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, flex: '1 1 auto', minWidth: 0 }}>
            {XIUZI.slice(q.from, q.from + 7).map((zi, i) => {
              const idx = q.from + i;
              const on = idx === active;
              return (
                <span key={zi} className="qn-meta" style={{
                  minWidth: 0, padding: '5px 0', textAlign: 'center', borderRadius: 6,
                  color: 'var(--color-text-primary)',
                  background: on ? 'rgba(178, 149, 93, 0.16)' : 'transparent',
                  boxShadow: on ? 'inset 0 0 0 1px var(--color-accent-gold)' : 'inset 0 0 0 1px rgba(0,0,0,0.07)',
                  fontWeight: on ? 700 : 400,
                }}>{zi}</span>
              );
            })}
          </div>
        </div>
      ))}
      <p className="qn-cap" style={{ marginTop: 2 }}>二十八宿按公历日循环直日，28 日一周；上表按四象分段，金框即命宿。</p>
    </div>
  );
}

export default function XiuPage() {
  const [me, setMe] = useState<DateDraft>(emptyDraft);
  const [other, setOther] = useState<DateDraft>(emptyDraft);
  const [useOther, setUseOther] = useState(false);
  const [result, setResult] = useState<XiuResult | null>(null);
  const [error, setError] = useState('');

  const resolve = (d: DateDraft, who: string): { y: number; m: number; d: number; original: string; fromLunar: boolean } => {
    if (d.mode === 'solar') {
      const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.solar);
      if (!mt) throw new Error(`请填写${who}的公历出生日期`);
      return { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]), original: d.solar, fromLunar: false };
    }
    const y = Number(d.lunarY); const m = Number(d.lunarM); const day = Number(d.lunarD);
    if (!(y >= 1901 && y <= 2099)) throw new Error(`${who}农历年需在 1901 至 2099 之间`);
    if (!(m >= 1 && m <= 12)) throw new Error(`${who}农历月需为 1 至 12`);
    const count = lunarDayCount(y, m, d.leap);
    if (!count) throw new Error(`${who}该农历年没有${d.leap ? '闰' : ''}${m}月`);
    if (!(day >= 1 && day <= count)) throw new Error(`${who}农历${d.leap ? '闰' : ''}${m}月只有 ${count} 天`);
    const c = toCivilInput({ year: y, month: m, day, hour: 0, minute: 0, isLunar: true, isLeapMonth: d.leap });
    return {
      y: c.year, m: c.month, d: c.day,
      original: `${y}年${d.leap ? '闰' : ''}${m}月${day}日`,
      fromLunar: true,
    };
  };

  const query = useCallback(() => {
    setError('');
    try {
      const a = resolve(me, '本人');
      const b = useOther ? resolve(other, '对方') : null;
      setResult(queryBenMingXiu(a.y, a.m, a.d, {
        originalInput: a.original,
        fromLunar: a.fromLunar,
        other: b ? { y: b.y, m: b.m, d: b.d } : undefined,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    }
  }, [me, other, useOther]);

  const leapHint = useMemo(() => {
    if (me.mode !== 'lunar') return false;
    const y = Number(me.lunarY);
    if (!(y >= 1901 && y <= 2099)) return false;
    const leap = leapMonthOfYear(y);
    return leap > 0 && leap === Number(me.lunarM);
  }, [me]);

  const otherLeapHint = useMemo(() => {
    if (other.mode !== 'lunar') return false;
    const y = Number(other.lunarY);
    if (!(y >= 1901 && y <= 2099)) return false;
    const leap = leapMonthOfYear(y);
    return leap > 0 && leap === Number(other.lunarM);
  }, [other]);

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>二十八宿</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>值日一宿 · 命落何处</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>通书二十八宿直日 · 四象七曜一日一宿</p>
      </header>

      {!result && (
        <>
          <section className="qn-card qn-rise qn-rise--2">
            <DateFields id="me" draft={me} set={setMe} showLeap={leapHint} />

            <button type="button" className="qn-chip" style={{ marginTop: 18 }}
              aria-expanded={useOther} onClick={() => setUseOther(v => !v)}>
              {useOther ? '收起合宿' : '加一个对象合宿'}
            </button>

            {useOther && (
              <div style={{ borderTop: 'var(--qn-hairline)', marginTop: 16, paddingTop: 16 }}>
                <p className="qn-axis" style={{ margin: 0 }}>对方</p>
                <div style={{ marginTop: 10 }}>
                  <DateFields id="other" draft={other} set={setOther} showLeap={otherLeapHint} />
                </div>
              </div>
            )}

            {error && <p className="qn-alert" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            <p className="qn-cap" style={{ marginTop: 14 }}>星宿只认生日，不认时辰；填到日即可。</p>
          </section>

          <button type="button" className="qn-btn qn-btn--solid qn-btn--block qn-rise qn-rise--3"
            style={{ marginTop: 20 }} onClick={query}>查命宿</button>
        </>
      )}

      {result && (
        <>
          <section className="qn-card qn-rise">
            <XiuHeadline r={result} />
            <div style={{ borderTop: 'var(--qn-hairline)', marginTop: 18, paddingTop: 14 }}>
              <p className="qn-axis" style={{ margin: 0 }}>宿性</p>
              <p className="qn-body" style={{ marginTop: 6 }}>{result.ben.nature}</p>
            </div>
            <div style={{ borderTop: 'var(--qn-hairline)', marginTop: 14, paddingTop: 14 }}>
              <p className="qn-axis" style={{ margin: 0 }}>通书值日诗</p>
              <p className="qn-meta" style={{ marginTop: 6 }}>{result.ben.song}</p>
            </div>
            <XiuRibbon active={result.ben.index} />
          </section>

          {result.pair && (
            <section className="qn-card qn-rise qn-rise--2" style={{ marginTop: 16 }}>
              <p className="qn-eyebrow" style={{ margin: 0 }}>合宿</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', marginTop: 14 }}>
                {[result.ben, result.pair.other].map((b, i) => (
                  <div key={b.civil + i} style={{ minWidth: 0, textAlign: 'center' }}>
                    <p className="qn-cap" style={{ margin: 0 }}>{i === 0 ? '我' : '对方'}</p>
                    <p className="qn-title" style={{ margin: '6px 0 2px', overflowWrap: 'break-word' }}>{b.fullName}</p>
                    <p className="qn-meta" style={{ margin: 0 }}>{b.civil} · {b.wuxing}</p>
                    <span className="qn-badge" style={{ marginTop: 8, alignSelf: 'center' }}>
                      <span className="qn-badge__dot" style={{ background: WX_COLOR[b.wuxing] || 'var(--color-text-muted)' }} />
                      值日{b.luck}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <p className="qn-cap" style={{ margin: 0 }}>倾向指数（自研）</p>
                  <p className="qn-title" style={{ margin: 0 }}>{result.pair.level} · {result.pair.score}</p>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ height: '100%', borderRadius: 99, background: 'var(--color-accent-gold)', width: `${result.pair.score}%` }} />
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <p className="qn-body" style={{ marginTop: 0 }}>
                  以我为本看彼：{result.ben.wuxing} 遇 {result.pair.other.wuxing} 为「{result.pair.a}」。
                  {result.pair.myText}
                </p>
                <p className="qn-meta" style={{ marginTop: 8 }}>反过来以彼为本：{result.pair.other.wuxing} 遇 {result.ben.wuxing} 为「{result.pair.b}」，他那边感受到的是这一面，与你感受到的未必对称。</p>
                <p className="qn-note" style={{ marginTop: 8 }}>
                  上面这根刻度站在我这一边，所以它不随两个人的输入次序对调 —— 同一段关系，对方查到的分数可以不一样。
                </p>
                {result.pair.sameXiu && (
                  <p className="qn-note" style={{ marginTop: 8 }}>两边同值一宿，同气，也同毛病——谁也不比谁先看开。</p>
                )}
              </div>
            </section>
          )}

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
            <h2>阅读说明</h2>
            <p>本页根据出生日期对应的值日宿与宿性关系整理结果。合宿文字用于传统文化参考，不代表所有流派的共同结论。</p>
            <p>吉凶意象来自传统择日语境，不是对个人命运的定论。结果供研究与个人参考。</p>
          </section>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button type="button" className="qn-btn qn-btn--ghost"
              onClick={() => { setResult(null); setError(''); }}>换个生日再查</button>
          </div>
        </>
      )}
    </main>
  );
}
