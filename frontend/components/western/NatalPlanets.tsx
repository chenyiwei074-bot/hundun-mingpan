'use client';

// 「本命行星位置」的工作区。一屏里说清三件事：算了什么、按什么口径算的、哪些没算。
//
// 日期/时间在本机换算；国内地点名称可向本站查询坐标，接口不可用时回退本地表。
import { useEffect, useMemo, useState } from 'react';
import { computePlanets, ASTRO_CROSS_CHECK, PLANETS, type PlanetsFailed, type PlanetsResult } from '@/lib/astro/planets';
import { computeAngles, angleText, ANGLE_CROSS_CHECK, type AnglesResult, type AnglesFailed } from '@/lib/astro/angles';
import { computeAspects } from '@/lib/astro/aspects';
import { toUtc, availableZones, type MomentFail, type MomentOk } from '@/lib/astro/moment';
import { provinces } from '@/app/lib/region-data';
import { lookupChinaGeo } from '@/app/lib/api';
import { REGION_TZ } from '@/app/lib/true-solar/city-geo';
import { lookupGeo, type GeoLookup } from '@/app/lib/true-solar/birth-wiring';
import { TROPICAL_SIGNS_BASIS, ASPECT_GEOMETRY_BASIS } from '@/lib/astro/classics';
import { WESTERN_TOOL_BY_SLUG } from '@/lib/tools/western-catalog';
import BasisQuote from '@/components/western/BasisQuote';
import Callout from '@/components/ui/Callout';

const ZONES = availableZones();
const ENTRY = WESTERN_TOOL_BY_SLUG['astro-natal'];
const DONE = ENTRY.done ?? [];

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
const NOT_DONE = ENTRY.notDone ?? [];
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
  const ownAspects = got ? computeAspects(got.planets.positions) : [];

  return (
    <>
      <section className="qn-card" style={{ marginTop: 18 }}>
        <p className="qn-cap" style={{ margin: 0 }}>行星位置与传统文献</p>
        <p className="qn-meta" style={{ margin: '4px 0 0' }}>
          本页展示太阳、月亮与其他行星的星座位置和角度。以下列出星座划分所参考的传统文献。
        </p>
          <p className="qn-meta" style={{ margin: '8px 0 0' }}>
            本页给出行星位置、五类主要相位、上升点与整宫制；其他宫制和小天体仍不在计算范围内。
          </p>
          <p className="qn-meta" style={{ margin: '6px 0 0' }}>
            每颗星都与权威星历逐点核过：公历 {ASTRO_CROSS_CHECK.from} 至 {ASTRO_CROSS_CHECK.to} 这一段，
            黄经与黄纬的偏差不超过 {ASTRO_CROSS_CHECK.toleranceDeg}°。超出此范围的结果尚未达到同等核验标准，本站不打包票。
          </p>
        <BasisQuote basis={TROPICAL_SIGNS_BASIS} />
      </section>

      <section className="qn-card" style={{ marginTop: 14 }}>
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
              {Math.abs(got.moment.offsetMin / 60).toFixed(2).replace(/\.?0+$/, '')} 小时）· 十颗星的黄道位置都落在下面这张表里。
            </p>
            <p className="qn-title" style={{ margin: '12px 0 0' }}>
              太阳 {got.planets.sun.星座} {got.planets.sun.signDeg}°{String(got.planets.sun.signMin).padStart(2, '0')}′
              　月亮 {got.planets.moon.星座} {got.planets.moon.signDeg}°{String(got.planets.moon.signMin).padStart(2, '0')}′
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

          <section className="qn-card" style={{ marginTop: 14 }} data-astro-aspects="1">
            <p className="qn-cap" style={{ margin: 0 }}>行星主要相位 · {ownAspects.length} 条</p>
            <p className="qn-meta" style={{ margin: '5px 0 12px' }}>按两颗行星的最小黄经角距，检查合、六分、四分、三分、对分五类；每条展示实际角距与偏差。</p>
            {ownAspects.length ? <div style={{ display: 'grid', gap: 8 }}>
              {ownAspects.map(aspect => <div className="qn-row" key={`${aspect.first.key}-${aspect.second.key}`} style={{ padding: 10 }}>
                <strong style={{ fontSize: 'var(--qn-fs-body)' }}>{aspect.first.名称} {aspect.glyph} {aspect.second.名称} · {aspect.name}</strong>
                <span className="qn-meta" style={{ display: 'block' }}>角距 {aspect.separation.toFixed(2)}° · 标准 {aspect.exactAngle}° · 偏差 {aspect.orb.toFixed(2)}°（范围 ±{aspect.allowedOrb}°）</span>
              </div>)}
            </div> : <p className="qn-meta">在当前容许度内，没有检出主要相位。</p>}
          </section>

          <section className="qn-card" style={{ marginTop: 14 }} data-astro-angles={got.angles?.ok ? 'ok' : 'unavailable'}>
            <p className="qn-cap" style={{ margin: 0 }}>上升点与整宫制</p>
            {got.angles?.ok ? (
              <>
                <p className="qn-title" style={{ margin: '6px 0 0' }} data-astro-ascendant>
                  上升点 {angleText(got.angles.ascendant)}
                </p>
                <p className="qn-meta" style={{ margin: '4px 0 0' }}>
                  天顶 {angleText(got.angles.midheaven)} · 口径 {got.angles.basis}
                </p>
                <div style={{ overflowX: 'auto', marginTop: 8 }} data-vh-scroll="angles-table">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--qn-fs-body)' }}>
                    <thead>
                      <tr>
                        {['宫位', '宫头星座', '宫头黄经'].map(h => (
                          <th key={h} scope="col" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {got.angles.wholeSignCusps.map(c => (
                        <tr key={c.house}>
                          <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>{c.house} 宫</th>
                          <td style={{ padding: '6px 8px' }}>{c.星座} 0°</td>
                          <td style={{ padding: '6px 8px' }}>{c.lon.toFixed(3)}°</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="qn-note" style={{ margin: '10px 0 0' }}>
                  上升点与整宫制宫位已计算；其他非整宫制宫位、凯龙星、南北交点、恒星黄道仍未纳入本页。
                </p>
                <p className="qn-note" style={{ margin: '6px 0 0' }}>
                  上升点与整宫制已和 {ANGLE_CROSS_CHECK.cases} 组独立对拍数据核对，公差 {ANGLE_CROSS_CHECK.toleranceDeg}°；
                  参考实现：{ANGLE_CROSS_CHECK.authority}。
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
          当前展示十颗行星的位置、主要相位，以及上升点与整宫制宫位。其他非整宫制宫位、凯龙星、南北交点和恒星黄道尚未纳入本页。
        </p>
      </section>
      {!结果 && (
        <div style={{ marginTop: 14 }}>
          <Callout tier="info">还没算。按下按钮后由本机计算行星位置；选国内地点时仅用地点名称向本站查询坐标。</Callout>
        </div>
      )}

      <section className="qn-card" style={{ marginTop: 14 }}>
        <p className="qn-cap" style={{ margin: 0 }}>已做（{DONE.length} 项）</p>
        <ul className="qn-meta" style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
          {DONE.map(s => <li key={s}>{s}</li>)}
        </ul>
        <p className="qn-cap" style={{ margin: '10px 0 0' }}>未做（{NOT_DONE.length} 项）</p>
        <p className="qn-cap" style={{ margin: '2px 0 0' }}>缺的哪几样都写在门上，不藏在「部分可用」这四个字后面。</p>
        <ul className="qn-meta" style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
          {NOT_DONE.map(s => <li key={s}>{s}</li>)}
        </ul>
        <p className="qn-note" style={{ margin: '10px 0 0' }}>
          本页仍称「本命行星位置」，不叫星盘：其他宫制与小天体尚未纳入；每一层已做范围都在上方单列。
        </p>
        <BasisQuote basis={ASPECT_GEOMETRY_BASIS} 标题="依据 · 行星主要相位" />
      </section>

    </>
  );
}
