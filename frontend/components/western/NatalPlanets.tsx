'use client';

// 「本命行星位置」的工作区。一屏里说清三件事：算了什么、按什么口径算的、哪些没算。
//
// 计算全在这台设备上：日期/时间/时区只用来在本地算一个绝对时刻，不发请求、不落任何库。
// 这也是这一项能做而"AI 报告"那类不能做的原因 —— 没有原文要保护。
import { useMemo, useState } from 'react';
import { computePlanets, ASTRO_BASIS, PLANETS, SIGNS, type PlanetsFailed, type PlanetsResult } from '@/lib/astro/planets';
import { toUtc, availableZones, MOMENT_BASIS, type MomentFail, type MomentOk } from '@/lib/astro/moment';
import { WESTERN_TOOL_BY_SLUG } from '@/lib/tools/western-catalog';
import Callout from '@/components/ui/Callout';

const ZONES = availableZones();
// 已做/未做那两张清单来自目录，不在这里重抄 —— 目录卡面与工作页各写一份，
// 早晚一句"没算宫位"和另一句"宫位在路上"同时出现在同一个站上（缺陷6 的原形状）。
const ENTRY = WESTERN_TOOL_BY_SLUG['astro-natal'];
const DONE = ENTRY.done ?? [];
const NOT_DONE = ENTRY.notDone ?? [];
const deviceZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

/** 一个固定样例：给 harness 与"先看看长什么样"用，不含任何真人信息。 */
const SAMPLE = { year: 2000, month: 1, day: 1, hour: 12, minute: 0, timeZone: 'UTC' };

// 带标签的联合：'planets' in x 那种结构化收窄在这一层会被 TS 推成"可能 undefined"，
// 于是每个读数都要 !. —— 用 kind 判别，收窄是确定的，屏上少一堆断言。
type Outcome =
  | { kind: 'fail'; why: MomentFail | PlanetsFailed }
  | { kind: 'ok'; moment: MomentOk; planets: PlanetsResult };

export default function NatalPlanets() {
  const [zone, setZone] = useState(deviceZone());
  const [date, setDate] = useState('2000-01-01');
  const [clock, setClock] = useState('12:00');
  const [已算, set已算] = useState<typeof SAMPLE | null>(null);

  const 结果 = useMemo<Outcome | null>(() => {
    if (!已算) return null;
    const m = toUtc(已算);
    if (!m.ok) return { kind: 'fail', why: m };
    const p = computePlanets(m.utcMs);
    return p.ok ? { kind: 'ok', moment: m, planets: p } : { kind: 'fail', why: p };
  }, [已算]);

  const run = () => {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = clock.split(':').map(Number);
    set已算({ year: y, month: mo, day: d, hour: h, minute: mi, timeZone: zone });
  };

  const why = 结果 && 结果.kind === 'fail' ? 结果.why : null;
  const got = 结果 && 结果.kind === 'ok' ? 结果 : null;

  return (
    <>
      <section className="qn-card" style={{ marginTop: 18 }}>
        <p className="qn-cap" style={{ margin: 0 }}>按什么口径</p>
        <p className="qn-meta" style={{ margin: '4px 0 0' }}>
          地心、回归黄道（当日真春分点）、不作恒星黄道（岁差）换算；时刻换算用这台设备自带的时区数据库（含夏令时与历史偏移）。
          口径戳 {ASTRO_BASIS} 与时间口径 {MOMENT_BASIS}：改任何一条都要升戳，否则老截图分不出是哪一版算的。
        </p>
      </section>

      <section className="qn-card" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label className="qn-label" htmlFor="astro-date">出生日期（公历）
            <input id="astro-date" type="date" className="qn-input" value={date} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => setDate(e.target.value)} />
          </label>
          <label className="qn-label" htmlFor="astro-clock">当地时间（钟面）
            <input id="astro-clock" type="time" className="qn-input" value={clock} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => setClock(e.target.value)} />
          </label>
          <label className="qn-label" htmlFor="astro-zone">出生地时区
            <select id="astro-zone" className="qn-input" value={zone} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => setZone(e.target.value)}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
        </div>
        <p className="qn-cap" style={{ margin: '10px 0 0' }}>
          填的是当地墙上钟面时间，不是世界时；不勾夏令时与否 —— 时区自己按那一天决定。
        </p>
        <button type="button" className="qn-btn qn-btn--solid" style={{ marginTop: 12, minHeight: 44 }} onClick={run}>
          算行星位置
        </button>
      </section>

      {why && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="danger">{why.reason}：{why.detail}</Callout>
        </div>
      )}

      {got && (
        <>
          <section className="qn-card" style={{ marginTop: 14 }}>
            <p className="qn-meta" style={{ margin: 0 }}>
              世界时 {got.moment.isoUtc}（当地相对 UTC {got.moment.offsetMin >= 0 ? '+' : '−'}
              {Math.abs(got.moment.offsetMin / 60).toFixed(2).replace(/\.?0+$/, '')} 小时）· 十颗星的黄道位置都落在下面这张表里。
            </p>
            <p className="qn-title" style={{ margin: '12px 0 0' }}>
              太阳 {got.planets.sun.星座} {got.planets.sun.signDeg}°{String(got.planets.sun.signMin).padStart(2, '0')}′
              　月亮 {got.planets.moon.星座} {got.planets.moon.signDeg}°{String(got.planets.moon.signMin).padStart(2, '0')}′
            </p>
          </section>

          <section className="qn-card" style={{ marginTop: 14, overflowX: 'auto' }} data-vh-scroll="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
              <caption className="qn-cap" style={{ textAlign: 'left', marginBottom: 6 }}>
                黄道经度按当日真春分点起算；"星座内"那两列就是占星写法 12°34′。
              </caption>
              <thead>
                <tr>
                  {['星', '落座', '星座内', '黄经', '黄纬'].map(h => (
                    <th key={h} scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLANETS.map((p, i) => {
                  const r = got.planets.positions[i];
                  return (
                    <tr key={p.key}>
                      <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>{p.名称}</th>
                      <td style={{ padding: '6px 8px' }}>{r.星座}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{r.signDeg}°{String(r.signMin).padStart(2, '0')}′</td>
                      <td style={{ padding: '6px 8px' }}>{r.lon.toFixed(3)}°</td>
                      <td style={{ padding: '6px 8px' }}>{r.lat >= 0 ? '+' : '−'}{Math.abs(r.lat).toFixed(3)}°</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {!结果 && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="info">还没算。这张表只在你在这一页按下按钮之后由本机算出；日期、时刻与时区都不离开这台设备。</Callout>
        </div>
      )}

      <section className="qn-card" style={{ marginTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>已做（{DONE.length} 项）</p>
        <ul className="qn-meta" style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
          {DONE.map(s => <li key={s}>{s}</li>)}
        </ul>
        <p className="qn-cap" style={{ margin: '10px 0 0' }}>未做（{NOT_DONE.length} 项）</p>
        <p className="qn-cap" style={{ margin: '2px 0 0' }}>缺的哪几样都写在门上，不藏在"部分可用"这四个字后面。</p>
        <ul className="qn-meta" style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
          {NOT_DONE.map(s => <li key={s}>{s}</li>)}
        </ul>
        <p className="qn-note" style={{ margin: '10px 0 0' }}>
          因此这里给的是「本命行星位置」，不叫星盘 —— 没有宫位与相位的盘，叫盘会让人以为缺的那几样也算了。
          黄纬按同一口径一并给出（{SIGNS.length} 个 30° 区间就是上面那张表的落座边界）。
        </p>
      </section>
    </>
  );
}
