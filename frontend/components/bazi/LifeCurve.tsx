'use client';

// 人生K线（A 案：类别轴）。x=年份，y=十神十条泳道，格子里只写「那一年引动了哪颗星」。
// 没有 y 轴方向：不排高低、不计轻重、不出分、不预测 —— 页面第一行就把这句写出来。
// 事件标注只能来自你自己输入，存在本机 localStorage，不上传；没输入就写「无事件」。

import { useEffect, useMemo, useState } from 'react';
import type { BaziChart } from '@/app/lib/core/yiqi-core/types';
import { buildKline } from '@/lib/bazi/kline';
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

export default function LifeCurve({ chart, independentHref }: { chart?: BaziChart; independentHref?: string }) {
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="qn-title" style={{ margin: 0 }}>人生K线 · 十神视图</h2>
          {independentHref && <a className="qn-link" href={independentHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}>独立查看</a>}
        </div>
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
        <h2 className="qn-title" style={{ margin: 0 }}>人生K线 · 十神视图</h2>
        {independentHref && <a className="qn-link" href={independentHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 }}>独立查看</a>}
      </div>

      <p className="qn-meta" id="kline-axis-note" style={{ marginTop: 8 }}>
        按年份查看流年干支与十神之间的对应关系。这里只展示盘面结构，不作吉凶评分或预测。
      </p>

      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, rowGap: 12 }}>
        {view.段.map((s, i) => (
          <button key={s.段序} type="button" data-seg={s.段序}
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

      <p className="qn-cap" style={{ marginTop: 14 }}>选一年：下面的格子只读，写的是那一年引动了哪一颗。</p>
      {/* 选年的唯一入口（2026-10-19 裁定 #88）。格子改成只读之后，"点格子选年"这条路
          就没了，所以年票必须自己够大：44×44 起、横向排不下就换行，不引横向滚动。
          row-gap 12 是 globals.css 里那条老规矩：会换行的 .qn-chip 容器行距必须 >10，
          因为 ::after 的 44px 命中带上下各伸出 5px，8 的行距会让下一行盖掉上一行的可点区
          （harness 分段扫在运段那一排实测到的 miss2 就是这个）。年票自己已经 44 高，
          ::after 的 min-height:100% 不再外扩，两处都不欠。 */}
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, rowGap: 12 }}
        role="group" aria-label="选一年看它的岁运事实">
        {seg.流年.map((m, i) => (
          <button key={m.年纪} type="button" data-tick={m.年纪}
            className={`qn-chip${i === yearIdx ? ' qn-chip--on' : ''}`}
            style={{ minWidth: 44, minHeight: 44, padding: '0 10px' }}
            aria-pressed={i === yearIdx}
            onClick={() => setYearIdx(i)}>
            {m.年纪}
          </button>
        ))}
      </div>

      {/* 表格语义而不是 110 个按钮（裁定：只读≠不可读）。列头是年份、行头是十神，
          屏幕阅读器念一格就能念出「1996 · 正官 · 丙子」；格子不进 Tab 焦点序。
          table-layout:fixed + width:100%：列宽由这张表自己算，10 列在 375px 上也放不下横向滚动。 */}
      <div style={{ marginTop: 12 }}>
        <table className="qn-kline-grid" aria-describedby="kline-axis-note"
          style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 3 }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: '3em', whiteSpace: 'nowrap' }}>
                <span className="qn-axis">十神</span>
              </th>
              {seg.流年.map((m, i) => (
                <th key={m.年纪} scope="col" data-tick-head={m.年纪}
                  style={{ fontSize: 'var(--qn-fs-eyebrow)', letterSpacing: '0.08em', fontWeight: i === yearIdx ? 500 : 400,
                    color: 'var(--color-text-secondary)', overflowWrap: 'anywhere' }}>
                  {m.年纪.slice(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seg.泳道.map(lane => <FragmentRow key={lane.十神} lane={lane} seg={seg} />)}
          </tbody>
        </table>
      </div>

      <p className="qn-note" style={{ marginTop: 10 }}>
        {seg.段序} {seg.干支}（{seg.区间}，{seg.起岁} 起）：运干见{seg.运干十神}、运支主气见{seg.运支主气十神}。
        这两级是盘面已发的事实，整段都在，不逐格重复画。
      </p>
      {seg.落点.length > 0 && (
        <ul className="qn-meta" style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
          {seg.落点.map(x => <li key={x}>{x}</li>)}
        </ul>
      )}

      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          {mark.年纪} 年 · {mark.岁纪} · {mark.干支}：
          天干见{mark.干十神}；地支藏干见 {mark.支藏十神.join('、') || '（无藏干）'}。
        </p>
        {mark.落点.length > 0 ? (
          <ul className="qn-meta" style={{ margin: 0, paddingLeft: '1.1em' }}>
            {mark.落点.map(x => <li key={x}>{x}</li>)}
          </ul>
        ) : (
          <p className="qn-meta" style={{ margin: 0 }}>这一年那一支与四柱各支之间没有成对关系可报。</p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="qn-label" htmlFor="kline-event" style={{ margin: 0 }}>为这一年添加个人备注</label>
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
          <p className="qn-alert" role="alert">这条备注暂时无法保留；离开当前页面后可能无法找回。</p>
        )}
      </div>

      {/* 边界声明由数据那一侧给（view.边界），页面只负责照读 ——
          两处各写一份就必然漂移，而"页面上说的"与"算的"对不上正是这批最贵的错法。 */}
      <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
        {view.边界.map(x => <p className="qn-note" key={x} style={{ margin: 0 }}>{x}</p>)}
        <p className="qn-note" style={{ margin: 0 }}>
          个人备注只保存在当前设备，不会公开展示或加入命盘报告。清理浏览器数据后，备注可能无法找回。
        </p>
      </div>
    </section>
  );
}

function FragmentRow({ lane, seg }: {
  lane: { 十神: string; 分组: string; 标注: string[] };
  seg: KlineSegment;
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
    <tr>
      <th scope="row" style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
        <span className="qn-axis" data-lane={lane.十神}>{lane.十神}</span>
      </th>
      {seg.流年.map(m => {
        const hits = byYear.get(m.年纪) || [];
        return (
          // 只读格：没有 onClick、不是 button、不进 Tab 焦点序（#88）。
          // 上一版这里是 110 个 button，每个用 ::after 把自己扩到 44px —— 分段扫实测
          // 375px 上 110 格全部 <44，其中只有 21 格自己的中心点还归自己，另 89 格被邻居的
          // 扩展带抢走；剩下那 21 格的 44px 四角也全解析到别人身上（miss4）。补命中区这条路
          // 在十列网格里是走不通的，所以格子改回"读"的东西。
          <td key={m.年纪} data-lane={lane.十神} data-year={m.年纪}
            title={hits.length ? `${m.干支}：${hits.join('、')}` : `${m.年纪} ${m.干支}：这一道无`}
            style={{ overflowWrap: 'anywhere', textAlign: 'center', padding: 0 }}>
            <span style={{
              display: 'block', minHeight: 30, lineHeight: 1.6,
              border: '0.5px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
              borderRadius: 8, padding: '4px 0',
              // 有 = 墨色 500，无 = 次级灰 400。不用 --color-text-muted：它在卡底只有 3.30:1，
              // 一个孤零零的中点也会被对比度扫描当成文字。
              color: hits.length ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: hits.length ? 500 : 400,
              fontSize: 'var(--qn-fs-eyebrow)', letterSpacing: '0.08em',
            }}>{hits.length ? m.干支 : '·'}</span>
          </td>
        );
      })}
    </tr>
  );
}
