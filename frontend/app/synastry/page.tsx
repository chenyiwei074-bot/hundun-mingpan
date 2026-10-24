'use client';

import { useState } from 'react';
import Link from 'next/link';
import { availableZones, toUtc, type MomentOk } from '@/lib/astro/moment';
import { computePlanets, PLANETS, type PlanetsResult } from '@/lib/astro/planets';
import { computeAspects, type PlanetAspect } from '@/lib/astro/aspects';

const ZONES = availableZones();
type BirthInput = { date: string; clock: string; zone: string };
const emptyInput = (): BirthInput => ({ date: '', clock: '', zone: 'Asia/Shanghai' });
type Chart = { input: BirthInput; moment: MomentOk; planets: PlanetsResult };
type Result = { first: Chart; second: Chart; aspects: PlanetAspect[] };

function BirthFields({ value, onChange, title, prefix }: {
  value: BirthInput; onChange: (next: BirthInput) => void; title: string; prefix: string;
}) {
  return <fieldset className="qn-card" style={{ minWidth: 0, margin: 0 }}>
    <legend className="qn-title" style={{ padding: '0 8px' }}>{title}</legend>
    <div style={{ display: 'grid', gap: 10 }}>
      <label className="qn-label" htmlFor={`${prefix}-date`}>出生日期（公历）
        <input id={`${prefix}-date`} type="date" className="qn-input" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} style={{ marginTop: 4, minHeight: 44 }} />
      </label>
      <label className="qn-label" htmlFor={`${prefix}-clock`}>当地出生时间
        <input id={`${prefix}-clock`} type="time" className="qn-input" value={value.clock} onChange={e => onChange({ ...value, clock: e.target.value })} style={{ marginTop: 4, minHeight: 44 }} />
      </label>
      <label className="qn-label" htmlFor={`${prefix}-zone`}>出生地时区
        <select id={`${prefix}-zone`} className="qn-input" value={value.zone} onChange={e => onChange({ ...value, zone: e.target.value })} style={{ marginTop: 4, minHeight: 44 }}>
          {ZONES.map(zone => <option value={zone} key={zone}>{zone}</option>)}
        </select>
      </label>
    </div>
  </fieldset>;
}

function chartFrom(input: BirthInput): Chart | string {
  const [year, month, day] = input.date.split('-').map(Number);
  const [hour, minute] = input.clock.split(':').map(Number);
  const moment = toUtc({ year, month, day, hour, minute, timeZone: input.zone });
  if (!moment.ok) return `出生时间无法确定：${moment.reason}。请核对当地时间与时区。`;
  const planets = computePlanets(moment.utcMs);
  if (!planets.ok) return `行星位置无法计算：${planets.reason}。请调整日期后重试。`;
  return { input, moment, planets };
}

function OrbitDial({ result }: { result: Result }) {
  const point = (lon: number, radius: number) => {
    const angle = (lon - 90) * Math.PI / 180;
    return { x: 160 + Math.cos(angle) * radius, y: 160 + Math.sin(angle) * radius };
  };
  return <svg viewBox="0 0 320 320" width="320" height="320" style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label="两人行星在回归黄道上的双环位置示意">
    <circle cx="160" cy="160" r="132" fill="none" stroke="var(--color-hairline)" />
    <circle cx="160" cy="160" r="108" fill="none" stroke="var(--color-accent-gold)" strokeOpacity=".5" />
    <circle cx="160" cy="160" r="78" fill="none" stroke="var(--color-hairline)" />
    {Array.from({ length: 12 }, (_, index) => {
      const inner = point(index * 30, 70);
      const outer = point(index * 30, 132);
      return <line key={index} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--color-hairline)" />;
    })}
    {result.first.planets.positions.map((planet, index) => {
      const p = point(planet.lon, 108);
      return <g key={`first-${planet.key}`}><circle cx={p.x} cy={p.y} r="7" fill="var(--color-accent-gold)" /><text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="7" fill="var(--color-bg-primary)">{index + 1}</text><title>甲方{planet.名称} {planet.星座} {planet.lon.toFixed(2)}°</title></g>;
    })}
    {result.second.planets.positions.map((planet, index) => {
      const p = point(planet.lon, 78);
      return <g key={`second-${planet.key}`}><circle cx={p.x} cy={p.y} r="7" fill="var(--color-text-primary)" /><text x={p.x} y={p.y + 3} textAnchor="middle" fontSize="7" fill="var(--color-bg-primary)">{index + 1}</text><title>乙方{planet.名称} {planet.星座} {planet.lon.toFixed(2)}°</title></g>;
    })}
    <text x="160" y="155" textAnchor="middle" fill="var(--color-text-primary)" fontSize="13">甲 · 外环</text>
    <text x="160" y="176" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="13">乙 · 内环</text>
  </svg>;
}

export default function SynastryPage() {
  const [first, setFirst] = useState<BirthInput>(emptyInput);
  const [second, setSecond] = useState<BirthInput>(emptyInput);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const updateFirst = (next: BirthInput) => { setFirst(next); setResult(null); };
  const updateSecond = (next: BirthInput) => { setSecond(next); setResult(null); };
  const calculate = () => {
    const a = chartFrom(first);
    const b = chartFrom(second);
    if (typeof a === 'string' || typeof b === 'string') {
      setResult(null);
      setError(`甲方：${typeof a === 'string' ? a : '已确认'} 乙方：${typeof b === 'string' ? b : '已确认'}`);
      return;
    }
    setResult({ first: a, second: b, aspects: computeAspects(a.planets.positions, b.planets.positions) });
    setError('');
  };
  const ready = [first, second].every(input => /^\d{4}-\d{2}-\d{2}$/.test(input.date) && /^\d{2}:\d{2}$/.test(input.clock));

  return <main className="qn-shell" data-mode="western">
    <header className="qn-rise" style={{ paddingTop: 24 }}>
      <Link href="/western" className="domain-back">← 返回西方目录</Link>
      <p className="qn-eyebrow" style={{ marginTop: 14 }}>西方 · 看关系</p>
      <h1 className="qn-hero">西洋占星 · 跨盘相位</h1>
      <p className="qn-meta">两个人的行星黄经放在同一圆盘，逐条列出跨盘角距。只展示可核对的角度关系，不给匹配分。</p>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, marginTop: 18 }}>
      <BirthFields value={first} onChange={updateFirst} title="甲方" prefix="synastry-first" />
      <BirthFields value={second} onChange={updateSecond} title="乙方" prefix="synastry-second" />
    </section>
    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-note" style={{ marginTop: 0 }}>请先取得对方同意。本页只算地心行星位置，所以需要当地时间和时区，不需要出生地经纬度；宫位叠合暂不包含在内。输入仅在本机计算，不上传或保存。</p>
      <button className="qn-btn qn-btn--solid" type="button" disabled={!ready} onClick={calculate} style={{ minHeight: 44 }}>计算跨盘相位</button>
      {error && <p className="qn-note" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </section>

    {result && <div aria-live="polite">
      <section className="qn-card qn-rise" style={{ marginTop: 14, textAlign: 'center' }}>
        <h2 className="qn-title">两张行星环</h2>
        <OrbitDial result={result} />
        <p className="qn-note">环上数字 1–10 对应下方的十颗行星；角度位置按黄经绘制。外环是甲方，内环是乙方。</p>
      </section>
      <section className="qn-card" style={{ marginTop: 14, overflowX: 'auto' }} data-vh-scroll="synastry-table">
        <h2 className="qn-title">双方行星位置</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
          <thead><tr><th scope="col" style={{ textAlign: 'left' }}>行星</th><th scope="col" style={{ textAlign: 'left' }}>甲方</th><th scope="col" style={{ textAlign: 'left' }}>乙方</th></tr></thead>
          <tbody>{PLANETS.map((planet, index) => <tr key={planet.key}>
            <th scope="row" style={{ textAlign: 'left', padding: '6px 8px' }}>{index + 1}. {planet.名称}</th>
            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{result.first.planets.positions[index].星座} {result.first.planets.positions[index].lon.toFixed(2)}°</td>
            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{result.second.planets.positions[index].星座} {result.second.planets.positions[index].lon.toFixed(2)}°</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section className="qn-card" style={{ marginTop: 14 }}>
        <h2 className="qn-title">跨盘主要相位 · {result.aspects.length} 条</h2>
        {result.aspects.length ? <div style={{ display: 'grid', gap: 8 }}>
          {result.aspects.map(aspect => <article className="qn-row" key={`${aspect.first.key}-${aspect.second.key}-${aspect.name}`} style={{ padding: 12 }}>
            <strong style={{ fontSize: 'var(--qn-fs-body)' }}>甲方{aspect.first.名称} {aspect.glyph} 乙方{aspect.second.名称} · {aspect.name}</strong>
            <p className="qn-meta" style={{ margin: '3px 0 0' }}>实际角距 {aspect.separation.toFixed(2)}° · 标准角 {aspect.exactAngle}° · 偏差 {aspect.orb.toFixed(2)}°（范围 ±{aspect.allowedOrb}°）</p>
          </article>)}
        </div> : <p className="qn-meta">按当前容许度，没有检出主要相位。双方行星位置仍可在上表核对。</p>}
      </section>
    </div>}

    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-cap" style={{ margin: 0 }}>本页口径</p>
      <p className="qn-meta">采用回归黄道的地心行星黄经；主要相位是 0°、60°、90°、120°、180°。合相/对分相或涉及日月时容许 ±8°，其余 ±6°。容许度是本站固定的现代实现选择。</p>
      <p className="qn-note">这里只展示跨盘行星相位，不推断谁适合谁，也不包含宫位叠合、合盘中点或未来走势。古典角度定义可在 <Link href="/astro" className="qn-link" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>本命行星位置页</Link>的依据区查看。</p>
    </section>
    <p className="qn-linkrow"><Link className="qn-link" href="/tools">查看全部工具</Link></p>
  </main>;
}
