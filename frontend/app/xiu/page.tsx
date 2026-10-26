'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  leapMonthOfYear,
  lunarDayCount,
  toCivilInput,
} from '@/app/lib/core/yiqi-core/lunar-input';
import { calculateSanJiuXiu, queryBenMingXiu, XIU_ORDER } from '@/lib/xiu/engine';
import type { SanJiuXiuResult, XiuResult } from '@/lib/xiu/engine';
import { availableZones, toUtc } from '@/lib/astro/moment';

import ToolInterpretation from '@/components/ai/ToolInterpretation';
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
const TIME_ZONES = availableZones();

type Mode = 'solar' | 'lunar';

interface DateDraft {
  mode: Mode;
  solar: string;
  lunarY: string;
  lunarM: string;
  lunarD: string;
  leap: boolean;
  birthTime: string;
  timeZone: string;
}

const emptyDraft = (): DateDraft => ({
  mode: 'solar', solar: '', lunarY: '', lunarM: '', lunarD: '', leap: false,
  birthTime: '', timeZone: 'Asia/Shanghai',
});

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

      <div style={{ borderTop: 'var(--qn-hairline)', marginTop: 16, paddingTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>
          三九秘宿需出生时刻与时区；留空仍可查上面的通书二十八宿值日。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10, marginTop: 10 }}>
          <label className="qn-label" htmlFor={`${id}-birth-time`}>出生时刻（选填）
            <input id={`${id}-birth-time`} className="qn-input" type="time" value={draft.birthTime}
              onChange={e => set({ ...draft, birthTime: e.target.value })} style={{ marginTop: 4, minHeight: 44 }} />
          </label>
          <label className="qn-label" htmlFor={`${id}-time-zone`}>出生地时区
            <select id={`${id}-time-zone`} className="qn-input" value={draft.timeZone}
              onChange={e => set({ ...draft, timeZone: e.target.value })} style={{ marginTop: 4, minHeight: 44 }}>
              {TIME_ZONES.map(zone => <option value={zone} key={zone}>{zone}</option>)}
            </select>
          </label>
        </div>
      </div>
    </>
  );
}

function sanJiuFor(draft: DateDraft, date: { y: number; m: number; d: number }, who: string): SanJiuXiuResult | null {
  if (!draft.birthTime) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(draft.birthTime);
  if (!match) throw new Error(`${who}出生时刻格式无效，请重新选择`);
  const moment = toUtc({
    year: date.y, month: date.m, day: date.d,
    hour: Number(match[1]), minute: Number(match[2]), timeZone: draft.timeZone,
  });
  if (!moment.ok) throw new Error(`${who}时刻无法按${draft.timeZone}唯一换算：${moment.detail}`);
  const result = calculateSanJiuXiu(moment.utcMs);
  if (!result.ok) throw new Error(`${who}${result.detail}`);
  return result;
}

function SanJiuPanel({ mine, other, error }: {
  mine: SanJiuXiuResult | null;
  other: SanJiuXiuResult | null;
  error: string;
}) {
  const groups = [
    { title: '一九 · 命宿', rows: mine?.rows.slice(0, 9) ?? [] },
    { title: '二九 · 业宿', rows: mine?.rows.slice(9, 18) ?? [] },
    { title: '三九 · 胎宿', rows: mine?.rows.slice(18, 27) ?? [] },
  ];
  const otherInMine = mine && other
    ? mine.rows[(other.natalXiuIndex - mine.natalXiuIndex + 27) % 27] : null;
  const mineInOther = mine && other
    ? other.rows[(mine.natalXiuIndex - other.natalXiuIndex + 27) % 27] : null;

  return (
    <section className="qn-card qn-rise qn-rise--2" style={{ marginTop: 16 }}>
      <p className="qn-eyebrow" style={{ margin: 0 }}>三九秘宿 · 二十七宿</p>
      {error ? <p className="qn-alert" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
      {!mine ? (
        <p className="qn-meta" style={{ marginTop: 10 }}>
          填写本人出生时刻后，可按三九法查看命、业、胎三组宿序。当前结果仍保留通书二十八宿值日与原有合宿计算。
        </p>
      ) : (
        <>
          <p className="qn-meta" style={{ marginTop: 10 }}>
            出生时月球恒星黄经 {mine.siderealMoonLongitude.toFixed(4)}°，按本站 27 等分定位为「{mine.natalXiu}宿」。定位方法与上方二十八宿值日法分别计算。
          </p>
          {otherInMine && mineInOther ? (
            <div className="qn-row" style={{ display: 'grid', gap: 6, marginTop: 12, padding: 12 }}>
              <p className="qn-body" style={{ margin: 0 }}>
                对方「{other?.natalXiu}宿」落在你的三九关系中为「{otherInMine.relation}」；反向看，你的「{mine.natalXiu}宿」在对方关系中为「{mineInOther.relation}」。
              </p>
              <p className="qn-cap" style={{ margin: 0 }}>只列双方在三九序列中的对应宿名，不计算匹配分。</p>
            </div>
          ) : null}
          {mine && !other && <p className="qn-cap" style={{ marginTop: 8 }}>要查看双方三九关系，请启用对象合宿并填写对方的出生时刻与时区。</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12, marginTop: 16 }}>
            {groups.map(group => (
              <div key={group.title} style={{ border: 'var(--qn-hairline)', borderRadius: 12, padding: 12 }}>
                <h3 className="qn-axis" style={{ margin: '0 0 8px' }}>{group.title}</h3>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
                  {group.rows.map(row => (
                    <li key={`${row.offset}-${row.xiu}`} className="qn-meta" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{row.xiu}宿</span><span>{row.relation}宿</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function XiuHeadline({ r }: { r: XiuResult }) {
  const b = r.ben;
  return (
    <div style={{ textAlign: 'center' }}>
      {r.input.fromLunar && (
        <p className="qn-cap" style={{ margin: '0 0 6px' }}>
          输入为农历{r.input.original}，经本站命盘同一套换算得公历{r.input.civil}，通书值日宿按此日取
        </p>
      )}
      <p className="qn-eyebrow" style={{ margin: '0 0 6px' }}>通书二十八宿值日</p>
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

/** 28 宿直日表：按四象分段铺开，标出当日值日宿在循环里的位置。 */
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
      <p className="qn-cap" style={{ marginTop: 2 }}>二十八宿按公历日循环直日，28 日一周；上表按四象分段，金框即当日值日宿。</p>
    </div>
  );
}

export default function XiuPage() {
  const [me, setMe] = useState<DateDraft>(emptyDraft);
  const [other, setOther] = useState<DateDraft>(emptyDraft);
  const [useOther, setUseOther] = useState(false);
  const [result, setResult] = useState<XiuResult | null>(null);
  const [sanJiu, setSanJiu] = useState<{ mine: SanJiuXiuResult | null; other: SanJiuXiuResult | null }>({ mine: null, other: null });
  const [sanJiuError, setSanJiuError] = useState('');
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
      const next = queryBenMingXiu(a.y, a.m, a.d, {
        originalInput: a.original,
        fromLunar: a.fromLunar,
        other: b ? { y: b.y, m: b.m, d: b.d } : undefined,
      });
      setResult(next);
      setSanJiuError('');
      try {
        const mine = sanJiuFor(me, a, '本人');
        const partner = mine && b ? sanJiuFor(other, b, '对方') : null;
        setSanJiu({ mine, other: partner });
        if (b && other.birthTime && !mine) setSanJiuError('要比较双方三九关系，请先填写本人的出生时刻。');
        else if (b && mine && !other.birthTime) setSanJiuError('补充对方出生时刻后，可显示双方三九关系；现有通书合宿结果不受影响。');
      } catch (e) {
        setSanJiu({ mine: null, other: null });
        setSanJiuError(e instanceof Error ? e.message : '三九定位失败');
      }
    } catch (e) {
      setResult(null);
      setSanJiu({ mine: null, other: null });
      setSanJiuError('');
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
        <p className="qn-eyebrow" style={{ margin: 0 }}>二十八宿 · 三九秘宿</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>值日宿与三九命宿</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>通书二十八宿直日 · 宿曜经三九二十七宿</p>
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
            <p className="qn-cap" style={{ marginTop: 14 }}>通书二十八宿值日只认公历日历日；三九命宿另需具体出生时刻与时区。</p>
          </section>

          <button type="button" className="qn-btn qn-btn--solid qn-btn--block qn-rise qn-rise--3"
            style={{ marginTop: 20 }} onClick={query}>查询星宿</button>
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

          <SanJiuPanel mine={sanJiu.mine} other={sanJiu.other} error={sanJiuError} />

          {result.pair && (
            <section className="qn-card qn-rise qn-rise--2" style={{ marginTop: 16 }}>
              <p className="qn-eyebrow" style={{ margin: 0 }}>二十八宿值日合宿 · 本站自研</p>
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
                  <p className="qn-cap" style={{ margin: 0 }}>倾向指数（本站自研）</p>
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

          {result && <ToolInterpretation tool="xiu" title="通书值日、合宿与三九 · 混沌自研 AI 解读" payload={{
            ben: {
              fullName: result.ben.fullName, xiu: result.ben.xiu, yao: result.ben.yao,
              wuxing: result.ben.wuxing, gong: result.ben.gong, sixiang: result.ben.sixiang,
              luck: result.ben.luck, nature: result.ben.nature, index: result.ben.index,
            },
            pair: result.pair ? {
              relationToMe: result.pair.a, relationToOther: result.pair.b,
              sameXiu: result.pair.sameXiu, level: result.pair.level,
              score: result.pair.score,
              other: {
                fullName: result.pair.other.fullName, xiu: result.pair.other.xiu,
                yao: result.pair.other.yao, wuxing: result.pair.other.wuxing,
                gong: result.pair.other.gong, sixiang: result.pair.other.sixiang,
                luck: result.pair.other.luck, nature: result.pair.other.nature,
                index: result.pair.other.index,
              },
            } : null,
            sanJiu: sanJiu.mine ? {
              basis: sanJiu.mine.basis,
              self: {
                natalXiu: sanJiu.mine.natalXiu,
                rows: sanJiu.mine.rows.map(({ xiu, relation }) => ({ xiu, relation })),
              },
              partner: sanJiu.other ? {
                natalXiu: sanJiu.other.natalXiu,
                rows: sanJiu.other.rows.map(({ xiu, relation }) => ({ xiu, relation })),
              } : null,
              pairRelation: sanJiu.other ? {
                partnerInSelf: {
                  xiu: sanJiu.other.natalXiu,
                  relation: sanJiu.mine.rows[(sanJiu.other.natalXiuIndex - sanJiu.mine.natalXiuIndex + 27) % 27].relation,
                },
                selfInPartner: {
                  xiu: sanJiu.mine.natalXiu,
                  relation: sanJiu.other.rows[(sanJiu.mine.natalXiuIndex - sanJiu.other.natalXiuIndex + 27) % 27].relation,
                },
              } : null,
            } : null,
          }} />}
          {result && sanJiu.mine && <section className="qn-card" style={{ marginTop: 12 }}>
            <p className="qn-meta" style={{ marginBottom: 0 }}>
              《宿曜经》提供三九宿序与关系类别；出生宿定位为本站自研：取输入时刻的月球地心黄经，换算至拉希里恒星黄道后均分 27 宿。本口径不声称是古籍原有的天文算法。
            </p>
          </section>}

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
              onClick={() => { setResult(null); setSanJiu({ mine: null, other: null }); setSanJiuError(''); setError(''); }}>换个生日再查</button>
          </div>
        </>
      )}
      </main>
  );
}
