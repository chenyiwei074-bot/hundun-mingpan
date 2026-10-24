'use client';

import { useState } from 'react';
import Link from 'next/link';
import { availableZones, toUtc } from '@/lib/astro/moment';
import { computeMoonCycle, type MoonCycle } from '@/lib/astro/moon-cycle';

const ZONES = availableZones();
const localTime = (utcMs: number, zone: string) => new Intl.DateTimeFormat('zh-CN', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(utcMs));

export default function MoonPage() {
  const [date, setDate] = useState('');
  const [clock, setClock] = useState('12:00');
  const [zone, setZone] = useState('Asia/Shanghai');
  const [cycle, setCycle] = useState<MoonCycle | null>(null);
  const [error, setError] = useState('');

  const calculate = () => {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = clock.split(':').map(Number);
    const moment = toUtc({ year, month, day, hour, minute, timeZone: zone });
    if (!moment.ok) { setCycle(null); setError(`无法换算这个时刻：${moment.reason}。请核对日期、时间与时区。`); return; }
    const next = computeMoonCycle(moment.utcMs);
    setCycle(next);
    setError(next ? '' : '这一天暂时无法计算月相，请换一个日期重试。');
  };
  const calculateNow = () => {
    const next = computeMoonCycle(Date.now());
    setCycle(next);
    setError(next ? '' : '此刻暂时无法计算月相，请稍后重试。');
  };

  return (
    <main className="qn-shell" data-mode="western">
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/western" className="domain-back">← 返回西方目录</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>西方 · 择时看周期</p>
        <h1 className="qn-hero">月相 · 盈亏周期</h1>
        <p className="qn-meta">选择一个当地时刻，查看月相角、可见照亮比例，以及下一次朔与望。</p>
      </header>

      <section className="qn-card" style={{ marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <label className="qn-label">日期（公历）<input className="qn-input" type="date" value={date} onChange={e => { setDate(e.target.value); setCycle(null); }} style={{ marginTop: 5, minHeight: 44 }} /></label>
          <label className="qn-label">当地钟面时间<input className="qn-input" type="time" value={clock} onChange={e => { setClock(e.target.value); setCycle(null); }} style={{ marginTop: 5, minHeight: 44 }} /></label>
          <label className="qn-label">查看时区<select className="qn-input" value={zone} onChange={e => setZone(e.target.value)} style={{ marginTop: 5, minHeight: 44 }}>
            {ZONES.map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <button className="qn-btn qn-btn--solid" type="button" onClick={calculate} disabled={!date || !clock} style={{ minHeight: 44 }}>查看所选时刻</button>
          <button className="qn-btn qn-btn--ghost" type="button" onClick={calculateNow} style={{ minHeight: 44 }}>查看此刻</button>
        </div>
        {error && <p className="qn-note" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      </section>

      {cycle && <section className="qn-card qn-rise" aria-live="polite" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <svg role="img" aria-label={cycle.phaseName} viewBox="0 0 160 160" width="150" height="150" style={{ maxWidth: '28vw', minWidth: 92, height: 'auto', filter: 'drop-shadow(0 0 26px var(--color-western-gold))' }}>
            <text x="80" y="122" textAnchor="middle" fontSize="130">{cycle.phaseSymbol}</text>
          </svg>
          <div>
            <p className="qn-cap" style={{ margin: 0 }}>{localTime(cycle.utcMs, zone)} · {zone}</p>
            <h2 className="qn-title" style={{ margin: '8px 0' }}>{cycle.phaseName}</h2>
            <p className="qn-meta" style={{ margin: 0 }}>照亮比例 {(cycle.illumination * 100).toFixed(1)}% · 月相角 {cycle.phaseAngle.toFixed(2)}°</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 18 }}>
          <div className="qn-row"><p className="qn-cap">下一次朔（新月）</p><p className="qn-title">{localTime(cycle.nextNewMoonUtcMs, zone)}</p></div>
          <div className="qn-row"><p className="qn-cap">下一次望（满月）</p><p className="qn-title">{localTime(cycle.nextFullMoonUtcMs, zone)}</p></div>
        </div>
        <p className="qn-note" style={{ marginBottom: 0 }}>这两个时刻在你选的时区显示；月相角按地心日月黄经差计算，照亮比例按光照几何计算。图标只表示月相阶段，不按所在地模拟月面朝向。</p>
      </section>}

      <section className="qn-card" style={{ marginTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>规则与来源</p>
        <p className="qn-meta">朔为地心日月黄经差 0°，望为 180°；计算使用 <a className="qn-link" href="https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md" target="_blank" rel="noreferrer">Astronomy Engine 的 MoonPhase、Illumination 与 SearchMoonPhase</a>。阶段图标按 45° 分段，是本站的显示规则。</p>
        <p className="qn-note">这里显示天文月相，不以黄历宜忌替代，也不推断个人吉凶。</p>
      </section>
      <p className="qn-linkrow"><Link className="qn-link" href="/tools">查看全部工具</Link></p>
    </main>
  );
}
