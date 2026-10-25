'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  leapMonthOfYear,
  lunarDayCount,
  toCivilInput,
} from '@/app/lib/core/yiqi-core/lunar-input';
import { queryHuangli, queryHuangliRange } from '@/lib/huangli/engine';
import type { HuangliDay } from '@/lib/huangli/engine';

import ToolInterpretation from '@/components/ai/ToolInterpretation';
// 黄历页只做一件事：把通书逐日推算出来的宜忌与神煞按可读的顺序排出来。
// 取数全在 lib/huangli/engine.ts（页面不许直接 import 八字引擎，验收 §7 钉住），
// 干支走站里唯一干支层、值宿走宿引擎，这里不新建第二份历法，也不自建吉凶评分。

type Mode = 'solar' | 'lunar';

interface DateDraft {
  mode: Mode;
  solar: string;
  lunarY: string;
  lunarM: string;
  lunarD: string;
  leap: boolean;
}

const digits = (v: string) => v.replace(/[^\d]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');

/** 只给公历日历日，时刻一律正午，避免子时换日与时钟前跳把日推走一天。 */
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const emptyDraft = (): DateDraft => ({ mode: 'solar', solar: '', lunarY: '', lunarM: '', lunarD: '', leap: false });

/** 一栏日期：公历走单个日期控件，农历走年/月/日 + 闰月，换算交给站里同一套 toCivilInput。 */
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
          <label className="qn-label" htmlFor={`${id}-s`}>查询日期</label>
          <input id={`${id}-s`} className="qn-input" type="date" min="1901-01-01" max="2099-12-31"
            value={draft.solar} onChange={e => set({ ...draft, solar: e.target.value })} />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {([['农历年', 'lunarY', '如 2026'], ['农历月', 'lunarM', '1-12'], ['农历日', 'lunarD', '1-30']] as const)
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

/** 宜 / 忌 两块：词条原样上屏，通书原话（诸事不宜、馀事勿取）不做改写也不删。
 *  宜/忌的吉凶色只作圆点用（与五行/六神/四化同一纪律），不落进文字。 */
function YiJiBlock({ h }: { h: HuangliDay }) {
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {([['宜', h.yi, 'var(--color-ji)'], ['忌', h.ji, 'var(--color-xiong)']] as const).map(([label, items, dot]) => (
        <div key={label} className="qn-row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <span className="qn-title" style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.06em' }}>
            <span className="qn-badge__dot" style={{ background: dot }} />
            {label}
          </span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 6px', minWidth: 0 }}>
            {items.map(v => <li key={v} className="qn-chip" style={{ cursor: 'default' }}>{v}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** 一行一项的通书条目，全部原样转录。 */
function FactRows({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gap: 0, marginTop: 16 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="qn-row" style={{ padding: '9px 0' }}>
          <span className="qn-axis" style={{ flex: '0 0 auto' }}>{k}</span>
          <span className="qn-body" style={{ minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/** 前后各 5 天的速览条：按公历日连续排，点一下即换日。窄屏靠横向滑动，不靠裁切。
 *  条内文字用墨色：13px 的次要灰落在卡片底上只有 4.48:1，过不了 AA（harness 实测）。 */
function DayStrip({ strip, active, onPick }: { strip: HuangliDay[]; active: string; onPick: (h: HuangliDay) => void }) {
  return (
    <div data-vh-scroll="前后各五日的速览条按公历日横向排列，窄屏可左右滑动查看全部 11 天"
      style={{ display: 'flex', gap: 4, marginTop: 14, overflowX: 'auto', paddingBottom: 4 }}>
      {strip.map(h => {
        const on = h.civil === active;
        return (
          <button key={h.civil} type="button" onClick={() => onPick(h)} aria-current={on ? 'date' : undefined}
            className={`qn-chip${on ? ' qn-chip--on' : ''}`}
            style={{ flex: '0 0 auto', minWidth: 58, padding: '6px 4px', display: 'grid', gap: 2, justifyItems: 'center', color: 'var(--color-text-primary)' }}>
            <span className="qn-meta" style={{ letterSpacing: 0, color: 'inherit' }}>{Number(h.civil.slice(8))}日</span>
            <span className="qn-meta" style={{ letterSpacing: 0, color: 'inherit' }}>{h.ganZhi.day}</span>
            <span className="qn-meta" style={{ letterSpacing: 0, color: 'inherit' }}>{h.tianShen.dao === '黄道' ? '黄' : '黑'}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function HuangliPage() {
  const [draft, setDraft] = useState<DateDraft>(emptyDraft);
  const [result, setResult] = useState<HuangliDay | null>(null);
  const [strip, setStrip] = useState<HuangliDay[]>([]);
  const [error, setError] = useState('');
  const [today, setToday] = useState('');

  const show = useCallback((y: number, m: number, d: number, opts?: { originalInput?: string; fromLunar?: boolean }) => {
    const h = queryHuangli(y, m, d, opts);
    setResult(h);
    setStrip(queryHuangliRange({ y, m, d }, 5, 5));
    setError('');
    return h;
  }, []);

  // 首屏取「今日」只在客户端做，避免服务端与浏览器跨日造成的 hydration 差异。
  useEffect(() => {
    const now = new Date();
    const iso = isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
    setToday(iso);
    setDraft(v => ({ ...v, solar: iso }));
    show(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, [show]);

  const resolve = (d: DateDraft): { y: number; m: number; d: number; original: string; fromLunar: boolean } => {
    if (d.mode === 'solar') {
      const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.solar);
      if (!mt) throw new Error('请填写要查询的公历日期');
      return { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]), original: mt[0], fromLunar: false };
    }
    const y = Number(d.lunarY); const m = Number(d.lunarM); const day = Number(d.lunarD);
    if (!(y >= 1901 && y <= 2099)) throw new Error('农历年需在 1901 至 2099 之间');
    if (!(m >= 1 && m <= 12)) throw new Error('农历月需为 1 至 12');
    const count = lunarDayCount(y, m, d.leap);
    if (!count) throw new Error(`该农历年没有${d.leap ? '闰' : ''}${m}月`);
    if (!(day >= 1 && day <= count)) throw new Error(`农历${d.leap ? '闰' : ''}${m}月只有 ${count} 天`);
    const cv = toCivilInput({ year: y, month: m, day, hour: 0, minute: 0, isLunar: true, isLeapMonth: d.leap });
    return {
      y: cv.year, m: cv.month, d: cv.day,
      original: `${y}年${d.leap ? '闰' : ''}${m}月${day}日`,
      fromLunar: true,
    };
  };

  const query = useCallback(() => {
    try {
      const a = resolve(draft);
      show(a.y, a.m, a.d, { originalInput: a.original, fromLunar: a.fromLunar });
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    }
  }, [draft, show]);

  const shift = useCallback((delta: number) => {
    if (!result) return;
    const [y, m, d] = result.civil.split('-').map(Number);
    const cursor = new Date(y, m - 1, d + delta, 12, 0);
    const iso = isoOf(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    setDraft(v => ({ ...v, mode: 'solar', solar: iso }));
    show(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
  }, [result, show]);

  const leapHint = useMemo(() => {
    if (draft.mode !== 'lunar') return false;
    const y = Number(draft.lunarY);
    if (!(y >= 1901 && y <= 2099)) return false;
    const leap = leapMonthOfYear(y);
    return leap > 0 && leap === Number(draft.lunarM);
  }, [draft]);

  const marks = result ? [
    ...result.solarFestivals.map(v => ({ k: '公历节', v })),
    ...result.festivals.map(v => ({ k: '农历节', v })),
    ...result.otherFestivals.map(v => ({ k: '传统日', v })),
    ...(result.jieQiToday ? [{ k: '节气', v: result.jieQiToday }] : []),
  ] : [];

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>黄历宜忌</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>逐日宜忌 · 通书取值</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>建除黄黑道 · 吉神凶煞 · 冲煞胎神 · 一日一换</p>
      </header>

      <section className="qn-card qn-rise qn-rise--2">
        <DateFields id="hl" draft={draft} set={setDraft} showLeap={leapHint} />
        {error && <p className="qn-alert" role="alert" style={{ marginTop: 14 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" className="qn-btn qn-btn--solid" style={{ flex: '1 1 auto' }} onClick={query}>查这一天</button>
          {today && (
            <button type="button" className="qn-btn qn-btn--ghost" onClick={() => {
              const [y, m, d] = today.split('-').map(Number);
              setDraft(v => ({ ...v, mode: 'solar', solar: today }));
              show(y, m, d);
            }}>回到今日</button>
          )}
        </div>
        <p className="qn-cap" style={{ marginTop: 12 }}>黄历只认日历日，不认时辰；填到日即可。农历生日一类输入会先换成公历再取数，换算与本站命盘同一套。</p>
      </section>

      {result && (
        <>
          <section className="qn-card qn-rise" style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              {result.fromLunar && (
                <p className="qn-cap" style={{ margin: '0 0 6px' }}>
                  输入为农历{result.originalInput}，经本站命盘同一套换算得公历{result.civil}，以下按此日取数
                </p>
              )}
              <p className="qn-meta" style={{ margin: 0 }}>
                {result.civil} · 星期{result.week} · {result.lunarText}
              </p>
              <p style={{
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", "STSong", Georgia, serif',
                fontSize: 'var(--qn-fs-hero)', fontWeight: 600, lineHeight: 1.15,
                color: 'var(--color-text-primary)', margin: '10px 0 4px', letterSpacing: '0.06em',
              }}>{result.ganZhi.day}日 · {result.zhiXing}日</p>
              <p className="qn-meta" style={{ margin: 0 }}>
                年{result.ganZhi.year} · 月{result.ganZhi.month} · {result.naYin} · 旬空{result.xunKong} · 日支{result.ganZhi.day[1]}（{result.shengXiao}）
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span className="qn-badge">
                  <span className="qn-badge__dot"
                    style={{ background: result.tianShen.dao === '黄道' ? 'var(--color-ji)' : 'var(--color-xiong)' }} />
                  {result.tianShen.name}（{result.tianShen.dao}，{result.tianShen.luck}）
                </span>
                <span className="qn-badge">
                  <span className="qn-badge__dot"
                    style={{ background: result.xiu.luck === '吉' ? 'var(--color-ji)' : 'var(--color-xiong)' }} />
                  值宿{result.xiu.fullName}·{result.xiu.luck}
                </span>
                {marks.map(m => (
                  <span key={m.k + m.v} className="qn-badge">
                    <span className="qn-badge__dot" style={{ background: 'var(--color-accent-gold)' }} />
                    {m.k}：{m.v}
                  </span>
                ))}
              </div>
            </div>

            <YiJiBlock h={result} />

            <div style={{ borderTop: 'var(--qn-hairline)', marginTop: 16 }}>
              <FactRows rows={[
                ['吉神宜趋', result.jiShen.join('、') || '无'],
                ['凶煞宜忌', result.xiongSha.join('、') || '无'],
                ['冲煞', `冲${result.chong} 煞${result.sha}`],
                ['彭祖百忌', `${result.pengZu.gan}；${result.pengZu.zhi}`],
                ['胎神占方', result.taiShen],
                ['日禄', result.lu],
                ['喜神方位', result.positions.xi],
                ['财神方位', result.positions.cai],
                ['福神方位', result.positions.fu],
                ['阳贵神方位', result.positions.yangGui],
                ['阴贵神方位', result.positions.yinGui],
                ['节气前后', [
                  result.prevJieQi ? `距${result.prevJieQi.name}后 ${Math.abs(result.prevJieQi.offsetDays)} 日` : null,
                  result.jieQiToday ? `今日交${result.jieQiToday}` : null,
                  result.nextJieQi ? `${result.nextJieQi.name}在 ${result.nextJieQi.offsetDays} 日后（${result.nextJieQi.civil}）` : null,
                ].filter(Boolean).join(' · ') || '无'],
              ]} />
            </div>

            <p className="qn-cap" style={{ marginTop: 14 }}>
              速览前后各五日（黄 = 黄道值神，黑 = 黑道值神，只标当日天神归属，不是本站给的分数）
            </p>
            <DayStrip strip={strip} active={result.civil} onPick={h => {
              setDraft(v => ({ ...v, mode: 'solar', solar: h.civil }));
              const [y, m, d] = h.civil.split('-').map(Number);
              show(y, m, d);
            }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className="qn-btn qn-btn--ghost" onClick={() => shift(-1)}>前一日</button>
              <button type="button" className="qn-btn qn-btn--ghost" onClick={() => shift(1)}>后一日</button>
            </div>
          </section>

          <section className="qn-card qn-rise qn-rise--3" style={{ marginTop: 16 }}>
            <p className="qn-eyebrow" style={{ margin: 0 }}>推导步骤</p>
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
            <h2>参考依据</h2>
            {result.basis.map(b => <p key={b}>{b}</p>)}
            <h2>关于这一页</h2>
            <p>每日宜忌与神煞参考传统通书规则，用于了解历法信息，与个人命盘判断不同。本页不替你决定事项，也不构成医疗、法律、投资或其他专业建议。</p>
          </section>
        </>
      )}
            {result && <ToolInterpretation tool="huangli" title="黄历宜忌 · 混沌自研 AI 解读" payload={result} />}
      </main>
  );
}
