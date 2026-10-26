'use client';

import { useState } from 'react';
import Link from 'next/link';
import { availableZones, toUtc, type MomentOk } from '@/lib/astro/moment';
import { computePlanets, PLANETS, type PlanetsResult } from '@/lib/astro/planets';
import { computeAspects, type PlanetAspect } from '@/lib/astro/aspects';
import { computeAngles, type AnglesResult } from '@/lib/astro/angles';
import { computeHouseCusps, HOUSE_SYSTEMS, type HouseSystem } from '@/lib/astro/houses';
import { provinces } from '@/app/lib/region-data';
import { lookupGeo } from '@/app/lib/true-solar/birth-wiring';
import { calculateCompositeMidpoints, mapPlanetsToHouses } from '@/lib/synastry/calculations';

import ToolInterpretation from '@/components/ai/ToolInterpretation';
const ZONES = availableZones();
type BirthInput = { date: string; clock: string; zone: string; province: string; city: string; latitude: string; longitude: string };
const emptyInput = (): BirthInput => ({ date: '', clock: '', zone: 'Asia/Shanghai', province: '', city: '', latitude: '', longitude: '' });
type Chart = { input: BirthInput; moment: MomentOk; planets: PlanetsResult; angles: AnglesResult | null; locationNote: string };
type Result = { first: Chart; second: Chart; aspects: PlanetAspect[] };

function BirthFields({ value, onChange, title, prefix }: {
  value: BirthInput; onChange: (next: BirthInput) => void; title: string; prefix: string;
}) {
  const selectedProvince = provinces.find(item => item.name === value.province);
  const placeGeo = value.city
    ? lookupGeo({ province: value.province, city: value.city })
    : value.province ? lookupGeo({ province: value.province }) : null;
  return <fieldset className="qn-card" style={{ minWidth: 0, margin: 0 }}>
    <legend className="qn-title" style={{ padding: '0 8px' }}>{title}</legend>
    <div style={{ display: 'grid', gap: 10 }}>
      <label className="qn-label" htmlFor={`${prefix}-province`}>出生地（国内可选）
        <select id={`${prefix}-province`} className="qn-input" value={value.province} onChange={e => {
          const province = e.target.value;
          const geo = province ? lookupGeo({ province }) : null;
          onChange({ ...value, province, city: '', latitude: '', longitude: '', zone: geo?.tz ?? value.zone });
        }} style={{ marginTop: 4, minHeight: 44 }}>
          <option value="">不选地点 / 境外手动填写坐标</option>
          {provinces.map(item => <option value={item.name} key={item.name}>{item.name}</option>)}
        </select>
      </label>
      {selectedProvince && <label className="qn-label" htmlFor={`${prefix}-city`}>城市
        <select id={`${prefix}-city`} className="qn-input" value={value.city} onChange={e => {
          const city = e.target.value;
          const geo = city ? lookupGeo({ province: value.province, city }) : lookupGeo({ province: value.province });
          onChange({ ...value, city, latitude: '', longitude: '', zone: geo?.tz ?? value.zone });
        }} style={{ marginTop: 4, minHeight: 44 }}>
          <option value="">按省级坐标近似</option>
          {selectedProvince.cities.map(item => <option value={item.name} key={item.name}>{item.name}</option>)}
        </select>
      </label>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label className="qn-label" htmlFor={`${prefix}-latitude`}>纬度 · 北纬为正
          <input id={`${prefix}-latitude`} type="number" min="-90" max="90" step="any" inputMode="decimal" className="qn-input" value={value.latitude}
            placeholder={placeGeo ? String(placeGeo.lat) : '如 39.9042'} onChange={e => onChange({ ...value, latitude: e.target.value })}
            style={{ marginTop: 4, minHeight: 44, width: '100%' }} />
        </label>
        <label className="qn-label" htmlFor={`${prefix}-longitude`}>经度 · 东经为正
          <input id={`${prefix}-longitude`} type="number" min="-180" max="180" step="any" inputMode="decimal" className="qn-input" value={value.longitude}
            placeholder={placeGeo ? String(placeGeo.lng) : '如 116.4074'} onChange={e => onChange({ ...value, longitude: e.target.value })}
            style={{ marginTop: 4, minHeight: 44, width: '100%' }} />
        </label>
      </div>
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
  const geo = input.city
    ? lookupGeo({ province: input.province, city: input.city })
    : input.province ? lookupGeo({ province: input.province }) : null;
  const latText = input.latitude.trim() || (geo ? String(geo.lat) : '');
  const lonText = input.longitude.trim() || (geo ? String(geo.lng) : '');
  let angles: AnglesResult | null = null;
  const coordinateSource = input.latitude.trim() || input.longitude.trim()
    ? '手动坐标'
    : geo?.src === 'province' ? '省级近似坐标' : input.city ? '城市中心坐标' : '出生地坐标';
  let locationNote = '未提供出生地坐标；本次只计算跨盘相位和行星中点。';
  if (latText || lonText) {
    const lat = Number(latText);
    const lon = Number(lonText);
    if (!latText || !lonText || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      locationNote = '出生地坐标不完整或超出范围；相位和行星中点仍可查看。';
    } else {
      const computedAngles = computeAngles(moment.utcMs, lat, lon);
      if (computedAngles.ok) {
        angles = computedAngles;
        locationNote = `已按${coordinateSource} ${lat.toFixed(4)}°, ${lon.toFixed(4)}° 计算宫位。`;
      } else locationNote = `${computedAngles.detail}；相位和行星中点仍可查看。`;
    }
  }
  return { input, moment, planets, angles, locationNote };
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
  const [houseSystem, setHouseSystem] = useState<HouseSystem>('whole-sign');
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
  const firstHouses = result?.first.angles ? computeHouseCusps(result.first.angles, houseSystem) : null;
  const secondHouses = result?.second.angles ? computeHouseCusps(result.second.angles, houseSystem) : null;
  const firstIntoSecond = result && secondHouses?.ok
    ? mapPlanetsToHouses(result.first.planets.positions, secondHouses.cusps) : [];
  const secondIntoFirst = result && firstHouses?.ok
    ? mapPlanetsToHouses(result.second.planets.positions, firstHouses.cusps) : [];
  const composite = result ? calculateCompositeMidpoints(result.first.planets.positions, result.second.planets.positions) : [];

  return <main className="qn-shell" data-mode="western">
    <header className="qn-rise" style={{ paddingTop: 24 }}>
      <Link href="/western" className="domain-back">← 返回西方目录</Link>
      <p className="qn-eyebrow" style={{ marginTop: 14 }}>西方 · 看关系</p>
      <h1 className="qn-hero">西洋占星 · 跨盘相位</h1>
      <p className="qn-meta">把两人的行星相位、行星落入对方宫位，以及行星黄经中点放在一起查看。不计算关系分数，也不替双方判断是否合适。</p>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, marginTop: 18 }}>
      <BirthFields value={first} onChange={updateFirst} title="甲方" prefix="synastry-first" />
      <BirthFields value={second} onChange={updateSecond} title="乙方" prefix="synastry-second" />
    </section>
    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-note" style={{ marginTop: 0 }}>请先取得对方同意。出生时间与坐标用于本机计算；国内可选省市，境外可手动填经纬度。生成 AI 解读时只提交计算后的行星位置与相位摘要，不提交原始出生日期、时间或坐标。</p>
      <label className="qn-label" htmlFor="synastry-house-system" style={{ display: 'block', maxWidth: 520, marginBottom: 10 }}>宫位叠加采用的宫制
        <select id="synastry-house-system" className="qn-input" value={houseSystem} onChange={e => setHouseSystem(e.target.value as HouseSystem)} style={{ display: 'block', marginTop: 4, minHeight: 44, width: '100%' }}>
          {HOUSE_SYSTEMS.map(system => <option key={system.id} value={system.id}>{system.label}</option>)}
        </select>
      </label>
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
      <section className="qn-card" style={{ marginTop: 14 }}>
        <h2 className="qn-title">行星宫位叠加</h2>
        <p className="qn-meta">采用{HOUSE_SYSTEMS.find(system => system.id === houseSystem)?.label}；甲方行星落入乙方宫位、乙方行星落入甲方宫位分别列出。此处只报告位置，不附加吉凶或关系判断。</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12, marginTop: 12 }}>
          {[
            { title: '甲方行星落入乙方宫位', rows: firstIntoSecond, note: result.second.locationNote, failure: secondHouses && !secondHouses.ok ? secondHouses.detail : '' },
            { title: '乙方行星落入甲方宫位', rows: secondIntoFirst, note: result.first.locationNote, failure: firstHouses && !firstHouses.ok ? firstHouses.detail : '' },
          ].map(group => <div className="qn-row" key={group.title} style={{ padding: 12 }}>
            <h3 className="qn-title" style={{ fontSize: 'var(--qn-fs-body)' }}>{group.title}</h3>
            {group.rows.length ? <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
              {group.rows.map(row => <li key={row.key} style={{ marginTop: 5 }}>{row.name} · {row.sign} {row.longitude.toFixed(2)}° → {row.house ? `${row.house} 宫` : '无法归宫'}</li>)}
            </ul> : <p className="qn-meta" style={{ marginBottom: 0 }}>{group.failure || group.note}</p>}
          </div>)}
        </div>
      </section>
      <section className="qn-card" style={{ marginTop: 14, overflowX: 'auto' }} data-vh-scroll="synastry-composite">
        <h2 className="qn-title">组合中点 · 行星黄经</h2>
        <p className="qn-meta">每颗行星取双方黄经之间的最短弧中点。这里只列行星中点，不推导组合盘宫头、上升点或中天。</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
          <thead><tr><th scope="col" style={{ textAlign: 'left' }}>行星</th><th scope="col" style={{ textAlign: 'left' }}>中点位置</th></tr></thead>
          <tbody>{composite.map(item => <tr key={item.key}>
            <th scope="row" style={{ textAlign: 'left', padding: '6px 8px' }}>{item.name}</th>
            <td style={{ padding: '6px 8px' }}>{item.ambiguous ? '双方黄经正好相差 180°，中点有两个可能方向，本站不任意选取。' : `${item.sign} ${item.longitude?.toFixed(2)}°`}</td>
          </tr>)}</tbody>
        </table>
      </section>
    </div>}

          {result && <ToolInterpretation tool="synastry" title="跨盘相位 · 混沌自研 AI 解读" payload={{
            first: result.first.planets.positions.map(({ 名称, 星座, lon, lat }) => ({ 名称, 星座, 黄经: lon, 黄纬: lat })),
            second: result.second.planets.positions.map(({ 名称, 星座, lon, lat }) => ({ 名称, 星座, 黄经: lon, 黄纬: lat })),
            aspects: result.aspects.map(a => ({
              甲方行星: a.first.名称, 乙方行星: a.second.名称, 相位: a.name,
              标准角度: a.exactAngle, 实际角距: a.separation, 容许差: a.orb, 容许度: a.allowedOrb,
            })),
            houseOverlays: {
              houseSystem,
              firstPlanetsInSecond: {
                available: Boolean(secondHouses?.ok),
                rows: firstIntoSecond.map(({ key, name, sign, longitude, house }) => ({ key, name, sign, longitude, house })),
              },
              secondPlanetsInFirst: {
                available: Boolean(firstHouses?.ok),
                rows: secondIntoFirst.map(({ key, name, sign, longitude, house }) => ({ key, name, sign, longitude, house })),
              },
            },
            compositeMidpoints: composite.map(({ key, name, longitude, sign, ambiguous }) => ({ key, name, longitude, sign, ambiguous })),
          }} />}
    <section className="qn-card" style={{ marginTop: 14 }}>
      <details>
        <summary className="qn-meta" style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          计算口径、AI 解读范围与参考依据
        </summary>
        <div style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
          <p className="qn-meta" style={{ margin: 0 }}>采用回归黄道的地心行星黄经；主要相位是 0°、60°、90°、120°、180°。合相/对分相或涉及日月时容许 ±8°，其余 ±6°。宫位叠加复用本命页的七种宫制；中点只计算十颗行星的黄经短弧中点。</p>
          <p className="qn-note" style={{ margin: 0 }}>本页不推断谁适合谁，也不计算关系分数或未来走势。解读结合双方行星位置、跨盘相位、双向宫位叠加与行星黄经中点；古典角度定义可在 <Link href="/astro" className="qn-link" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>本命行星位置页</Link>的依据区查看。</p>
        </div>
      </details>
    </section>
    <p className="qn-linkrow"><Link className="qn-link" href="/tools">查看全部工具</Link></p>
      </main>;
}
