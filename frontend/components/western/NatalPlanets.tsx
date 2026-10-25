'use client';

// 「本命行星位置」的工作区。一屏里说清三件事：算了什么、按什么口径算的、哪些没算。
//
// 日期/时间在本机换算；国内地点名称可向本站查询坐标，接口不可用时回退本地表。
import { useEffect, useMemo, useState } from 'react';
import { computePlanets, ASTRO_CROSS_CHECK, PLANETS, SIGNS, type PlanetsFailed, type PlanetsResult, type PlanetPlace } from '@/lib/astro/planets';
import { computeAngles, type AnglesResult, type AnglesFailed } from '@/lib/astro/angles';
import { computeHouseCusps, HOUSE_CROSS_CHECK, HOUSE_SYSTEMS, type HouseSystem } from '@/lib/astro/houses';
import { computeAspects } from '@/lib/astro/aspects';
import { applyZodiacFrame, CHIRON_EPHEMERIS, computeChironPosition, computeLunarNodes, convertLongitude, lahiriAyanamsha, loadChironEphemeris, type ChironEphemerisData, type LunarNodeMode, type ZodiacFrame } from '@/lib/astro/extensions';
import { toUtc, availableZones, type MomentFail, type MomentOk } from '@/lib/astro/moment';
import { provinces } from '@/app/lib/region-data';
import { lookupChinaGeo } from '@/app/lib/api';
import { REGION_TZ } from '@/app/lib/true-solar/city-geo';
import { lookupGeo, type GeoLookup } from '@/app/lib/true-solar/birth-wiring';
import { TROPICAL_SIGNS_BASIS, ASPECT_GEOMETRY_BASIS } from '@/lib/astro/classics';
import { WESTERN_TOOL_BY_SLUG } from '@/lib/tools/western-catalog';
import BasisQuote from '@/components/western/BasisQuote';
import ToolInterpretation from '@/components/ai/ToolInterpretation';
import Callout from '@/components/ui/Callout';

const ZONES = availableZones();
const ENTRY = WESTERN_TOOL_BY_SLUG['astro-natal'];

function failureText(why: MomentFail | PlanetsFailed): string {
  switch (why.reason) {
    case '缺时刻': return '请补全出生日期、时间和地点。';
    case '无效日期':
    case '时刻无效': return '出生日期或时间无效，请核对后重试。';
    case '时区未知': return '暂时无法确定这个地点的时区，请选择更具体的出生地后重试。';
    case '本地时间不存在': return '这个地点在当天调整夏令时，所填时间不存在；请核对当地出生时间。';
    case '本地时间有两次': return '这个地点在当天回拨时钟，所填时间对应两个时刻，暂时无法唯一确定；请核对出生记录。';
    case '引擎不可用': return '行星位置暂时无法计算，请稍后重试。';
  }
}
function zodiacFields(longitude: number) {
  const lon = ((longitude % 360) + 360) % 360;
  const signIndex = Math.min(11, Math.floor(lon / 30));
  const within = lon - signIndex * 30;
  const degree = Math.floor(within);
  return { lon, signIndex, 星座: SIGNS[signIndex], signDeg: degree, signMin: Math.min(59, Math.floor((within - degree) * 60)) };
}
function formatLongitudePlace(longitude: number) {
  const value = zodiacFields(longitude);
  return `${value.星座} ${value.signDeg}°${String(value.signMin).padStart(2, '0')}′`;
}
const deviceZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

// 出生时刻这一层的输入形状。
// 这里**不预填任何值**（以前预填 2000-01-01 12:00 当样例）：一张已经填好时间的表单，
// 用户改都没改就按下按钮，得到的是一张看起来属于他的盘 —— 那正是本站最不该给的东西。
// 空着就不给算，样例值改由 harness 自己填（tools/visual-harness/census.mjs 的 astro-computed 态）。
type Input = {
  year: number; month: number; day: number; hour: number; minute: number; timeZone: string;
  placeLabel: string; placePrecision: GeoLookup['src'] | null;
  lat: number | null; lon: number | null;
};

// 带标签的联合：'planets' in x 那种结构化收窄在这一层会被 TS 推成"可能 undefined"，
// 于是每个读数都要 !. —— 用 kind 判别，收窄是确定的，屏上少一堆断言。
type Outcome =
  | { kind: 'fail'; why: MomentFail | PlanetsFailed }
  | { kind: 'ok'; moment: MomentOk; planets: PlanetsResult; angles: AnglesResult | AnglesFailed | null; input: Input };

export default function NatalPlanets() {
  const [zone, setZone] = useState(deviceZone());
  const [date, setDate] = useState('');
  const [clock, setClock] = useState('');
  const [houseSystem, setHouseSystem] = useState<HouseSystem>('whole-sign');
  const [zodiacFrame, setZodiacFrame] = useState<ZodiacFrame>('tropical');
  const [nodeMode, setNodeMode] = useState<LunarNodeMode>('true');
  const [chironEphemeris, setChironEphemeris] = useState<{
    utcMs: number; status: 'loading' | 'ready' | 'outside' | 'error'; data?: ChironEphemerisData; error?: string;
  } | null>(null);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [已算, set已算] = useState<Input | null>(null);

  const selectedProvince = provinces.find(item => item.name === province);
  const cityOptions = selectedProvince?.cities ?? [];
  const localGeo = province ? lookupGeo(city ? { province, city } : { province }) : null;
  const geoKey = `${province}|${city}`;
  const [serverGeo, setServerGeo] = useState<{ key: string; geo: GeoLookup | null } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!province) return () => { alive = false; };
    lookupChinaGeo(province, city || undefined).then(g => {
      if (!alive) return;
      setServerGeo({ key: `${province}|${city}`, geo: g ? { ...g } : null });
    });
    return () => { alive = false; };
  }, [province, city]);
  // 后端坐标优先；接口不可用时回退到本地已核对的 382 城数据，不阻塞本页。
  const placeGeo = province && serverGeo?.key === geoKey ? serverGeo.geo ?? localGeo : localGeo;

  const 结果 = useMemo<Outcome | null>(() => {
    if (!已算) return null;
    const m = toUtc(已算);
    if (!m.ok) return { kind: 'fail', why: m };
    const p = computePlanets(m.utcMs);
    const angles = 已算.lat != null && 已算.lon != null ? computeAngles(m.utcMs, 已算.lat, 已算.lon) : null;
    return p.ok ? { kind: 'ok', moment: m, planets: p, angles, input: 已算 } : { kind: 'fail', why: p };
  }, [已算]);

  // 没填完就不给算：宁可按钮是灰的，也不给一张"时间是我们替你挑的"盘。
  const 可算 = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(clock);
  const run = () => {
    if (!可算) return;
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = clock.split(':').map(Number);
    const placeLabel = city === province ? province : [province, city].filter(Boolean).join(' ');
    set已算({
      year: y, month: mo, day: d, hour: h, minute: mi, timeZone: zone,
      placeLabel, placePrecision: placeGeo?.src ?? null,
      lat: placeGeo?.lat ?? null, lon: placeGeo?.lng ?? null,
    });
  };

  const why = 结果 && 结果.kind === 'fail' ? 结果.why : null;
  const got = 结果 && 结果.kind === 'ok' ? 结果 : null;
  useEffect(() => {
    if (!got) return;
    const utcMs = got.moment.utcMs;
    if (utcMs < CHIRON_EPHEMERIS.fromUtcMs || utcMs > CHIRON_EPHEMERIS.throughUtcMs) return;
    let active = true;
    loadChironEphemeris().then(data => {
      if (active) setChironEphemeris({ utcMs, status: 'ready', data });
    }).catch(error => {
      if (active) setChironEphemeris({ utcMs, status: 'error', error: error instanceof Error ? error.message : String(error) });
    });
    return () => { active = false; };
  }, [got]);
  const chironStatus = got
    ? got.moment.utcMs < CHIRON_EPHEMERIS.fromUtcMs || got.moment.utcMs > CHIRON_EPHEMERIS.throughUtcMs
      ? { utcMs: got.moment.utcMs, status: 'outside' as const }
      : chironEphemeris?.utcMs === got.moment.utcMs
        ? chironEphemeris
        : { utcMs: got.moment.utcMs, status: 'loading' as const }
    : null;
  const ayanamsha = got ? lahiriAyanamsha(got.moment.utcMs) : 0;
  const displayedPositions = useMemo<PlanetPlace[]>(() => {
    if (!got) return [];
    const positions = [...got.planets.positions, ...computeLunarNodes(got.moment.utcMs, nodeMode)];
    const chiron = chironEphemeris?.utcMs === got.moment.utcMs && chironEphemeris.status === 'ready' && chironEphemeris.data
      ? computeChironPosition(got.moment.utcMs, chironEphemeris.data) : null;
    if (chiron) positions.push(chiron);
    return positions.map(position => applyZodiacFrame(position, zodiacFrame, ayanamsha));
  }, [got, nodeMode, zodiacFrame, ayanamsha, chironEphemeris]);
  const houseResult = got?.angles?.ok ? computeHouseCusps(got.angles, houseSystem) : null;
  const ownAspects = got ? computeAspects(displayedPositions) : [];
  const displayedAscendant = got?.angles?.ok
    ? formatLongitudePlace(convertLongitude(got.angles.ascendant.lon, zodiacFrame, ayanamsha)) : '';
  const displayedMidheaven = got?.angles?.ok
    ? formatLongitudePlace(convertLongitude(got.angles.midheaven.lon, zodiacFrame, ayanamsha)) : '';
  const validAngles = got?.angles?.ok ? got.angles : null;
  const displayedCusps = houseResult?.ok && validAngles
    ? houseSystem === 'whole-sign' && zodiacFrame === 'sidereal-lahiri'
      ? Array.from({ length: 12 }, (_, index) => ({
        house: index + 1,
        ...zodiacFields(Math.floor(convertLongitude(validAngles.ascendant.lon, zodiacFrame, ayanamsha) / 30) * 30 + index * 30),
      }))
      : houseResult.cusps.map(cusp => ({ ...cusp, ...zodiacFields(convertLongitude(cusp.lon, zodiacFrame, ayanamsha)) }))
    : [];

  return (
    <>
      <section className="qn-card" style={{ marginTop: 18 }}>
        <p className="qn-cap" style={{ margin: 0 }}>行星位置与传统文献</p>
        <p className="qn-meta" style={{ margin: '4px 0 0' }}>
          本页展示太阳、月亮与其他行星的星座位置和角度。以下列出星座划分所参考的传统文献。
        </p>
          <p className="qn-meta" style={{ margin: '8px 0 0' }}>
            本页给出行星位置、五类主要相位、上升点与七种宫制：整宫、等宫、三分、普拉西德、科赫、雷吉奥蒙塔努斯与坎帕纳斯。
          </p>
          <p className="qn-meta" style={{ margin: '6px 0 0' }}>
            每颗星都与权威星历逐点核过：公历 {ASTRO_CROSS_CHECK.from} 至 {ASTRO_CROSS_CHECK.to} 这一段，
            黄经与黄纬的偏差不超过 {ASTRO_CROSS_CHECK.toleranceDeg}°。超出此范围的结果尚未达到同等核验标准，本站不打包票。
          </p>
        <BasisQuote basis={TROPICAL_SIGNS_BASIS} />
        <p className="qn-note astro-source-links" style={{ margin: '8px 0 0' }}>
          计算口径资料：{' '}
          <a className="qn-link" href="https://ssd-api.jpl.nasa.gov/doc/horizons.html" target="_blank" rel="noreferrer">NASA/JPL Horizons 星历说明</a>
          {' · '}<a className="qn-link" href="https://ssd.jpl.nasa.gov/planets/eph_export.html" target="_blank" rel="noreferrer">JPL 行星星历与 DE441</a>
          {' · '}<a className="qn-link" href="https://www.astro.com/swisseph/swisseph.htm" target="_blank" rel="noreferrer">Swiss Ephemeris：交点与拉希里版本说明</a>
          {' · '}<a className="qn-link" href="https://www.iers.org/fileadmin/SharedDocs/Publikationen/EN/IERS/resolutions/IAU/IAU2006_Resolution_B1.pdf" target="_blank" rel="noreferrer">IAU 2006 岁差决议</a>
        </p>
      </section>

      <section className="qn-card" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginBottom: 12 }}>
          <label className="qn-label" htmlFor="astro-zodiac-frame">黃道參考系
            <select id="astro-zodiac-frame" className="qn-input" value={zodiacFrame} style={{ display: 'block', marginTop: 4, minHeight: 44, width: '100%' }}
              onChange={e => setZodiacFrame(e.target.value as ZodiacFrame)}>
              <option value="tropical">回歸黃道 · 春分點起算</option>
              <option value="sidereal-lahiri">恒星黃道 · 拉希里（本站實現）</option>
            </select>
          </label>
          <label className="qn-label" htmlFor="astro-node-mode">月球交點算法
            <select id="astro-node-mode" className="qn-input" value={nodeMode} style={{ display: 'block', marginTop: 4, minHeight: 44, width: '100%' }}
              onChange={e => setNodeMode(e.target.value as LunarNodeMode)}>
              <option value="true">真交点 · 瞬时轨道状态</option>
              <option value="mean">平均交点 · 平滑平均值</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <label className="qn-label" htmlFor="astro-province">出生地省份 / 地区
            <select id="astro-province" className="qn-input" value={province} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => {
                const nextProvince = e.target.value;
                setProvince(nextProvince);
                setCity('');
                const geo = nextProvince ? lookupGeo({ province: nextProvince }) : null;
                const regionZone = REGION_TZ[nextProvince] ?? geo?.tz;
                if (regionZone) setZone(regionZone);
                set已算(null);
              }}>
              <option value="">可选，选择出生地</option>
              {provinces.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label className="qn-label" htmlFor="astro-city">出生城市
            <select id="astro-city" className="qn-input" value={city} disabled={!province} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => {
                const nextCity = e.target.value;
                setCity(nextCity);
                const geo = nextCity ? lookupGeo({ province, city: nextCity }) : null;
                if (geo) setZone(geo.tz);
                set已算(null);
              }}>
              <option value="">{province ? '请选择城市' : '请先选择省份 / 地区'}</option>
              {cityOptions.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label className="qn-label" htmlFor="astro-date">出生日期（公历）
            <input id="astro-date" type="date" className="qn-input" value={date} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => { setDate(e.target.value); set已算(null); }} />
          </label>
          <label className="qn-label" htmlFor="astro-clock">当地时间（钟面）
            <input id="astro-clock" type="time" className="qn-input" value={clock} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => { setClock(e.target.value); set已算(null); }} />
          </label>
          <label className="qn-label" htmlFor="astro-zone">时区（按出生地自动匹配，可调整）
            <select id="astro-zone" className="qn-input" value={zone} style={{ marginTop: 4, minHeight: 44 }}
              onChange={e => { setZone(e.target.value); set已算(null); }}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
        </div>
        <p className="qn-cap" style={{ margin: '10px 0 0' }}>
          选省份和城市后会自动匹配当地时区；境外出生可直接选择时区。填写的是当地钟面时间，日期和时间必须填写。
        </p>
        <p className="qn-note" style={{ margin: '6px 0 0' }}>
          恒星黄道按拉希里 ICRC 1956 零点、IAU 2006 岁差与章动实现；不同拉希里版本可能略有差异。交点可切换平均值与瞬时轨道真值。
        </p>
        <button type="button" className="qn-btn qn-btn--solid" style={{ marginTop: 12, minHeight: 44 }}
          disabled={!可算} aria-disabled={!可算} onClick={run}>
          算行星位置
        </button>
      </section>

      {why && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="danger">{failureText(why)}</Callout>
        </div>
      )}

      {got && (
        <>
          <section className="qn-card" style={{ marginTop: 14 }}>
            {got.input.placeLabel && (
              <p className="qn-meta" style={{ margin: 0 }}>
                出生地 {got.input.placeLabel} · 时区 {got.input.timeZone}
                {got.input.placePrecision === 'province' ? ' · 时区按省级地区资料匹配' : ''}
              </p>
            )}
            <p className="qn-meta" style={{ margin: 0 }}>
              世界时 {got.moment.isoUtc}（当地相对 UTC {got.moment.offsetMin >= 0 ? '+' : '−'}
              {Math.abs(got.moment.offsetMin / 60).toFixed(2).replace(/\.?0+$/, '')} 小时）· 行星位置按所选黄道参考系显示。
            </p>
            <p className="qn-title" style={{ margin: '12px 0 0' }}>
              太阳 {displayedPositions[0]?.星座} {displayedPositions[0]?.signDeg}°{String(displayedPositions[0]?.signMin ?? 0).padStart(2, '0')}′
              　月亮 {displayedPositions[1]?.星座} {displayedPositions[1]?.signDeg}°{String(displayedPositions[1]?.signMin ?? 0).padStart(2, '0')}′
            </p>
          </section>

          <section className="qn-card" style={{ marginTop: 14, overflowX: 'auto' }} data-vh-scroll="table-scroll">
            <table data-astro-planets="1" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
              <caption className="qn-cap" style={{ textAlign: 'left', marginBottom: 6 }}>
              星座内角度采用常见占星表示方式，例如 12°34′。
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

          <section className="qn-card" style={{ marginTop: 14, overflowX: 'auto' }} data-astro-extensions="1">
            <p className="qn-cap" style={{ margin: 0 }}>凯龙星与月球交点 · {zodiacFrame === 'tropical' ? '回归黄道' : '拉希里恒星黄道'}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)', marginTop: 6 }}>
              <thead><tr>{['点位', '落座', '星座内', '黄经', '黄纬'].map(h => <th key={h} scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>{displayedPositions.slice(10).map(point => (
                <tr key={point.key} data-astro-point={point.key}>
                  <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>{point.名称}</th>
                  <td style={{ padding: '6px 8px' }}>{point.星座}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{point.signDeg}°{String(point.signMin).padStart(2, '0')}′</td>
                  <td style={{ padding: '6px 8px' }}>{point.lon.toFixed(3)}°</td>
                  <td style={{ padding: '6px 8px' }}>{point.lat >= 0 ? '+' : '−'}{Math.abs(point.lat).toFixed(3)}°</td>
                </tr>
              ))}</tbody>
            </table>
            {chironStatus?.status === 'loading' && <p className="qn-meta">正在读取本地凯龙星历表…</p>}
            {chironStatus?.status === 'outside' && <p className="qn-meta">凯龙星历表覆盖公历 1900—2100；本次出生日期超出范围，因此不显示凯龙星。其他盘面结果仍可用。</p>}
            {chironStatus?.status === 'error' && <p className="qn-alert" role="status">凯龙星历表暂时不可用：{chironStatus.error} 其他盘面结果仍可用。</p>}
            <p className="qn-note" style={{ marginTop: 8 }}>
              凯龙星位置由随站点部署的每日地心历表在本机插值，不会把出生日期发送到第三方；月球交点按所选平均或真交点方法计算。两者均不代表吉凶判断。
            </p>
          </section>

          <section className="qn-card" style={{ marginTop: 14 }} data-astro-aspects="1">
            <p className="qn-cap" style={{ margin: 0 }}>行星、交点与凯龙星主要相位 · {ownAspects.length} 条</p>
            <p className="qn-meta" style={{ margin: '5px 0 12px' }}>按两颗行星的最小黄经角距，检查合、六分、四分、三分、对分五类；每条展示实际角距与偏差。</p>
            {ownAspects.length ? <div style={{ display: 'grid', gap: 8 }}>
              {ownAspects.map(aspect => <div className="qn-row" key={`${aspect.first.key}-${aspect.second.key}`} style={{ padding: 10 }}>
                <strong style={{ fontSize: 'var(--qn-fs-body)' }}>{aspect.first.名称} {aspect.glyph} {aspect.second.名称} · {aspect.name}</strong>
                <span className="qn-meta" style={{ display: 'block' }}>角距 {aspect.separation.toFixed(2)}° · 标准 {aspect.exactAngle}° · 偏差 {aspect.orb.toFixed(2)}°（范围 ±{aspect.allowedOrb}°）</span>
              </div>)}
            </div> : <p className="qn-meta">在当前容许度内，没有检出主要相位。</p>}
          </section>

          <section className="qn-card" style={{ marginTop: 14 }} data-astro-angles={got.angles?.ok ? 'ok' : 'unavailable'}
            data-astro-house-system={houseResult?.ok ? houseSystem : 'unavailable'}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'end' }}>
              <p className="qn-cap" style={{ margin: 0 }}>上升点与宫制</p>
              {got.angles?.ok && (
                <label className="qn-label" htmlFor="astro-house-system" style={{ margin: 0 }}>
                  选择宫制
                  <select id="astro-house-system" className="qn-input" value={houseSystem}
                    data-astro-house-selector="1" style={{ display: 'block', marginTop: 4, minHeight: 44, width: '100%' }}
                    onChange={e => setHouseSystem(e.target.value as HouseSystem)}>
                    {HOUSE_SYSTEMS.map(system => <option key={system.id} value={system.id}>{system.label}</option>)}
                  </select>
                </label>
              )}
            </div>
            {got.angles?.ok ? (
              <>
                <p className="qn-title" style={{ margin: '6px 0 0' }} data-astro-ascendant>
                  上升点 {displayedAscendant}
                </p>
                <p className="qn-meta" style={{ margin: '4px 0 0' }}>
                  天顶 {displayedMidheaven}
                </p>
                {houseResult?.ok ? (
                  <div style={{ overflowX: 'auto', marginTop: 8 }} data-vh-scroll="angles-table">
                    <table data-astro-house-cusps={houseSystem}
                      style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
                      <thead>
                        <tr>
                          {['宫位', '宫头星座', '宫头黄经'].map(h => (
                            <th key={h} scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedCusps.map(c => (
                          <tr key={c.house}>
                            <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>{c.house} 宫</th>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                              {c.星座} {c.signDeg}°{String(c.signMin).padStart(2, '0')}′
                            </td>
                            <td style={{ padding: '6px 8px' }}>{c.lon.toFixed(3)}°</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : houseResult ? (
                  <Callout tier={houseResult.reason === '极区不适用' ? 'info' : 'danger'}>{houseResult.detail}</Callout>
                ) : null}
                <p className="qn-note" style={{ margin: '10px 0 0' }}>
                  不同宫制会用不同规则划分十二宫。以上只展示计算出的宫头位置，不把宫位转成预测结论。
                </p>
                <p className="qn-note" style={{ margin: '6px 0 0' }}>
                  回归黄道宫头已用 {HOUSE_CROSS_CHECK.cases} 组样例交叉核验，公差 {HOUSE_CROSS_CHECK.toleranceDeg}°；恒星黄道宫头由所选岁差量统一换算。交点模式：{nodeMode === 'true' ? '真交点' : '平均交点'}。
                </p>
              </>
            ) : (
              <p className="qn-meta" style={{ margin: '6px 0 0' }}>
                {got.angles
                  ? `上升点暂时算不出：${got.angles.detail}`
                  : '这次没有出生地经纬度，无法计算上升点与宫位；行星位置仍有效。请选择省份/城市后重算。'}
              </p>
            )}
          </section>
        </>
      )}

      {!结果 && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="info">填写出生日期、当地时间与时区后，即可查看行星位置。</Callout>
        </div>
      )}

      <section className="qn-card" style={{ marginTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>当前结果范围</p>
        <p className="qn-meta" style={{ margin: '4px 0 0' }}>
          当前展示十颗行星、凯龙星与南北交点的位置和相位，并支持回归黄道 / 拉希里恒星黄道及七种宫制。高纬极区的 Placidus、Koch、Regiomontanus 与 Campanus 会按适用范围明确提示，不以近似值替代。
        </p>
      </section>
      {!结果 && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="info">还没算。按下按钮后由本机计算行星位置；选国内地点时仅用地点名称向本站查询坐标。</Callout>
        </div>
      )}

      <section className="qn-card" style={{ marginTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>宫制范围</p>
        <p className="qn-meta" style={{ margin: '4px 0 0' }}>
          整宫、等宫、三分、Placidus、Koch、Regiomontanus、Campanus。不同宫制依各自几何定义计算；极区不适用时会说明原因，不自动替换为另一种宫制。
        </p>
        <p className="qn-note" style={{ margin: '10px 0 0' }}>
        本页仍称「本命行星位置」，不叫星盘；行星、小天体、交点、黄道方式与宫头是分层计算结果，不把宫位划分直接写成确定性预测。
        </p>
        <BasisQuote basis={ASPECT_GEOMETRY_BASIS} 标题="依据 · 行星主要相位" />
      </section>

    
      {got && (
        <ToolInterpretation tool="astro" title="本命行星 · 混沌自研 AI 解读"
          payload={{ positions: displayedPositions, aspects: ownAspects, houses: displayedCusps,
            ascendant: displayedAscendant, midheaven: displayedMidheaven, frame: zodiacFrame, nodeMode }} />
      )}
</>
  );
}
