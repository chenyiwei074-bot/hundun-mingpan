'use client';

// 人生K线（A 案：类别轴）。x=年份，y=十神十条泳道，格子里只写「那一年引动了哪颗星」。
// 没有 y 轴方向：不排高低、不计轻重、不出分、不预测 —— 页面第一行就把这句写出来。
// 事件标注只能来自你自己输入，存在本机 localStorage，不上传；没输入就写「无事件」。

import { useEffect, useMemo, useState } from 'react';
import type { BaziChart } from '@/app/lib/core/yiqi-core/types';
import { buildKline, KLINE_BASIS, KLINE_LICHUN_NOTE, KLINE_RELATION_NOTE } from '@/lib/bazi/kline';
import type { KlineSegment } from '@/lib/bazi/kline';

const STORE_PREFIX = 'kline-events-v1:';

type Events = Record<string, string>;

function readEvents(key: string): Events {
  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed as Events : {};
  } catch { return {}; }   // 隐私模式或配额满：读不到就当没有，不炸页面
}

function writeEvents(key: string, ev: Events): boolean {
  try { window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(ev)); return true; }
  catch { return false; }
}

export default function LifeCurve({ chart }: { chart?: BaziChart }) {
  const view = useMemo(() => buildKline(chart), [chart]);
  const [segIdx, setSegIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);
  const [draft, setDraft] = useState('');
  const [events, setEvents] = useState<Events>({});
  const [storageBroken, setStorageBroken] = useState(false);

  const PILLARS = ['year', 'month', 'day', 'hour'] as const;
  const sig = view && chart?.siZhu
    ? PILLARS.map(k => `${chart.siZhu[k].gan}${chart.siZhu[k].zhi}`).join('') + view.日主
    : '';

  useEffect(() => {
    if (!sig || typeof window === 'undefined') return;
    setEvents(readEvents(sig));
    setSegIdx(0); setYearIdx(0); setDraft('');
  }, [sig]);

  const seg = view ? view.段[Math.min(segIdx, view.段.length - 1)] : null;
  const mark = seg ? seg.流年[Math.min(yearIdx, seg.流年.length - 1)] : null;
  const markKey = mark?.年纪 ?? '';

  // 切换运段或年份时，把输入框同步成那一年已存的标注 —— 不用 draft || saved 那种回退，
  // 它会让"清空输入"看起来像没生效（一清空就被旧值顶回来）。
  // 这个 hook 必须排在降级 return 之前：写在 return 之后就是条件 hook，
  // 同一组件在"有盘/无盘"之间切换时 React 会直接报错。
  useEffect(() => { setDraft(events[markKey] || ''); }, [markKey, events]);

  if (!view || !seg || !mark) {
    return (
      <section className="qn-card qn-kline qn-kline--empty" style={{ marginBottom: 16 }}>
        <h2 className="qn-title" style={{ margin: 0 }}>人生K线</h2>
        <p className="qn-meta" style={{ marginTop: 8 }}>
          这一节把大运与流年按十神摆成泳道，读的是八字的大运干支与日主十神。
          当前这份数据里没有可用的岁运序列，所以没有可摆的格子 —— 这里不预置示例盘。
        </p>
        <a className="qn-btn qn-btn--solid" href="/create" style={{ marginTop: 14, display: 'inline-block' }}>先去排一张盘</a>
      </section>
    );
  }

  const save = () => {
    const next = { ...events, [markKey]: draft.trim() };
    if (!draft.trim()) delete next[markKey];
    setStorageBroken(!writeEvents(sig, next));
    setEvents(next);
  };

  return (
    <section className="qn-card qn-kline" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="qn-title" style={{ margin: 0 }}>人生K线 · 类别轴</h2>
        <span className="qn-badge">
          <span className="qn-badge__dot" style={{ background: 'var(--color-accent-gold)' }} />
          {KLINE_BASIS}
        </span>
      </div>

      <p className="qn-meta" style={{ marginTop: 8 }}>
        横着是年份，竖着是十神的十条道（{`比肩·劫财·食神·伤官·偏财·正财·七杀·正官·偏印·正印`}）。
        格子里写的，是那一年的流年天干或地支藏干正好是这一颗星 —— 只有「引动没有」这一件事。
        <strong style={{ fontWeight: 500 }}>本图不构成吉凶评分</strong>：不排高低、不计轻重、不给方向、不做预测；
        十神一律取自盘面同一张表，不另立评分模型。
      </p>

      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {view.段.map((s, i) => (
          <button key={s.段序} type="button"
            className={`qn-chip${i === segIdx ? ' qn-chip--on' : ''}`}
            style={{ minWidth: 84, textAlign: 'center' }}
            aria-pressed={i === segIdx}
            onClick={() => { setSegIdx(i); setYearIdx(0); setDraft(''); }}>
            {s.干支}
            {/* 跟着控件自己的墨色走：.qn-chip 的底是暖米色，把这段区间文字降成 qn-cap 的次级灰
                压上去只有 4.48:1（harness 实测报红的那一条）。轴标签同理留给左侧，不在 chip 里换色。 */}
            <span style={{ marginLeft: 6, fontSize: 'var(--qn-fs-eyebrow)', letterSpacing: '0.06em', color: 'inherit' }}>
              {s.区间}
            </span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, overflowWrap: 'anywhere' }}>
        <div className="qn-kline-grid" style={{ display: 'grid', gridTemplateColumns: '4.2em repeat(10, minmax(0, 1fr))', gap: 4, alignItems: 'center' }}>
          <span className="qn-axis">年份</span>
          {seg.流年.map((m, i) => (
            <button key={m.年纪} type="button" data-tick={m.年纪} className={`qn-hit${i === yearIdx ? ' qn-chip--on' : ''}`}
              style={{ border: '0.5px solid var(--color-border-subtle, rgba(0,0,0,0.10))', borderRadius: 8, background: 'transparent', cursor: 'pointer', padding: '2px 0' }}
              aria-pressed={i === yearIdx}
              onClick={() => setYearIdx(i)}>
              <span className="qn-cap">{m.年纪.slice(2)}</span>
            </button>
          ))}

          {seg.泳道.map(lane => (
            <FragmentRow key={lane.十神} lane={lane} seg={seg} yearIdx={yearIdx}
              onPick={(i) => setYearIdx(i)} />
          ))}
        </div>
      </div>

      <p className="qn-note" style={{ marginTop: 10 }}>
        {seg.段序} {seg.干支}（{seg.区间}，{seg.起岁} 起）：运干见{seg.运干十神}、运支主气见{seg.运支主气十神}。
        这两级是盘面已发的事实，整段都在，不逐格重复画。
      </p>

      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          {mark.年纪} 年 · {mark.岁纪} · {mark.干支}：
          天干见{mark.干十神}；地支藏干见 {mark.支藏十神.join('、') || '（无藏干）'}。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="qn-label" htmlFor="kline-event" style={{ margin: 0 }}>你给这一年标注的事（只存本机）</label>
          <input id="kline-event" className="qn-input" style={{ flex: '1 1 200px', minWidth: 0 }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="不填就写「无事件」" />
          <button type="button" className="qn-btn qn-btn--ghost" onClick={save}
            disabled={draft.trim() === (events[markKey] || '')}>
            {events[markKey] ? '更新／清除' : '记下'}
          </button>
        </div>
        <p className="qn-meta" style={{ margin: 0 }}>
          标注：{draft.trim() ? `${mark.年纪}：${draft.trim()}` : '无事件（未由你标注）'}
        </p>
        {storageBroken && (
          <p className="qn-alert" role="alert">这台浏览器不让本地存（隐私模式或空间满）。标注这次只在当前页面上有效，没有上传。</p>
        )}
      </div>

      <p className="qn-note" style={{ marginTop: 12 }}>
        {KLINE_LICHUN_NOTE}
        {' '}标注只存在这台浏览器的 localStorage（键 {STORE_PREFIX}＋四柱与日主），不进任何接口、不进回执、不进链上存证。
      </p>
      <p className="qn-note" style={{ marginTop: 6 }}>{KLINE_RELATION_NOTE}</p>
    </section>
  );
}

function FragmentRow({ lane, seg, yearIdx, onPick }: {
  lane: { 十神: string; 分组: string; 标注: string[] };
  seg: KlineSegment;
  yearIdx: number;
  onPick: (i: number) => void;
}) {
  // 一条格子属于哪一年，靠标注串开头的年份定 —— 泳道与年份不另存下标，避免两处真相。
  const byYear = new Map<string, string[]>();
  seg.流年.forEach(m => byYear.set(m.年纪, []));
  lane.标注.forEach(t => {
    const y = t.split('·')[0];
    const arr = byYear.get(y);
    if (arr) { arr.push(t.split('·').slice(2).join('·')); byYear.set(y, arr); }
  });
  return (
    <>
      <span className="qn-axis" data-lane={lane.十神}>{lane.十神}</span>
      {seg.流年.map((m, i) => {
        const hits = byYear.get(m.年纪) || [];
        return (
          <button key={m.年纪} type="button" className="qn-hit" data-lane={lane.十神} data-year={m.年纪}
            onClick={() => onPick(i)}
            aria-pressed={i === yearIdx}
            title={hits.length ? `${m.干支}：${hits.join('、')}` : `${m.年纪} ${m.干支}：这一道无`}
            // 不铺底色：qn-cap 的次级灰压在任何 wash 上都会掉出 AA（5% 金 wash 实测 4.33:1，
            // 这是本项目量过三次的既有坑）。有/无只靠墨色与中点分，颜色不当第二层编码。
            style={{
              minHeight: 30, border: '0.5px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
              borderRadius: 8, cursor: 'pointer', padding: '2px 0', background: 'transparent',
            }}>
            <span style={{
              fontSize: 'var(--qn-fs-eyebrow)', lineHeight: 1.6, letterSpacing: '0.08em',
              // 有 = 墨色 500，无 = 次级灰 400。不用 --color-text-muted：它在卡底只有 3.30:1，
              // 一个孤零零的中点也会被对比度扫描当成文字。
              color: hits.length ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: hits.length ? 500 : 400,
            }}>{hits.length ? m.干支 : '·'}</span>
          </button>
        );
      })}
    </>
  );
}
