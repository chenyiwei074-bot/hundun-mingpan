'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createChart as apiCreateChart, trackEvent } from '@/app/lib/api';
import { provinces as regionProvinces } from '@/app/lib/region-data';
import { createChart, BirthInfo } from '@/app/lib/core/yiqi-core';
import { buildTrueSolarWiring } from '@/app/lib/true-solar/birth-wiring';
import { toCivilInput, lunarDayCount, leapMonthOfYear } from '@/app/lib/core/yiqi-core/lunar-input';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('hundun_visitor_id');
  if (!id) {
    id = 'visitor_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('hundun_visitor_id', id);
  }
  return id;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

function getDaysInMonth(year: number, month: number): number { return new Date(year, month, 0).getDate(); }
function getDayOptions(year: string, month: string, isLunar = false, isLeapMonth = false) {
  if (!year || !month) return [];
  const y = parseInt(year), m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return [];
  // 农历月只有 29 或 30 天。按公历月长给选项会让用户选到「三十」这种不存在的
  // 日子，换算层直接抛错、整条链路退化成失败页。
  const n = isLunar ? lunarDayCount(y, m, isLeapMonth) : getDaysInMonth(y, m);
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

export default function CreatePage() {
  const router = useRouter();
  const [visitorId, setVisitorId] = useState('');
  const [tab, setTab] = useState<'single'|'double'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', gender: '男' as '男'|'女', calendar: '公历' as '公历'|'农历'|'四柱',
    year: '', month: '', day: '', hour: '12', minute: '00', unknownTime: false, isLeapMonth: false,
    birthProvince: '北京', birthCity: '北京', birthDistrict: '',
    currentProvince: '北京', currentCity: '北京', currentDistrict: '',
    yearGan: '', yearZhi: '', monthGan: '', monthZhi: '',
    dayGan: '', dayZhi: '', hourGan: '', hourZhi: '',
    partnerName: '', partnerGender: '女' as '男'|'女',
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerHour: '12', partnerMinute: '00',
    partnerBirthProvince: '北京', partnerBirthCity: '北京', partnerBirthDistrict: '',
    partnerCurrentProvince: '北京', partnerCurrentCity: '北京', partnerCurrentDistrict: '',
  });

  useEffect(() => { setVisitorId(getVisitorId()); }, []);
  // 换年或换月就把闰月标记清掉：标记本身只在「所选月正好是该年闰月」时才生效，
  // 但留着 true 会让用户改回那个月时发现自己悄悄回到了闰月盘。可见的输入不该藏状态。
  const setField = (f: string, v: string) => setForm(p => ({
    ...p, [f]: v, ...(f === 'month' || f === 'year' ? { isLeapMonth: false } : null),
  }));
  const switchTab = (t: 'single'|'double') => { setTab(t); if (t === 'double' && form.calendar === '四柱') setField('calendar', '公历'); };

  const isLunar = form.calendar === '农历';
  // 闰月标志只按「派生」方式使用：年或月一变，stale 的 isLeapMonth 立刻被判为
  // false，永远凑不出 month ≠ 该年闰月 这种换算层会直接抛错的组合。
  const lunarLeap = isLunar && form.year ? leapMonthOfYear(parseInt(form.year)) : 0;
  const isLeapOn = lunarLeap > 0 && form.isLeapMonth && parseInt(form.month) === lunarLeap;

  const dayOptions = useMemo(() => getDayOptions(form.year, form.month, isLunar, isLeapOn), [form.year, form.month, isLunar, isLeapOn]);
  const partnerDayOptions = useMemo(() => getDayOptions(form.partnerYear, form.partnerMonth), [form.partnerYear, form.partnerMonth]);

  const validate = (): string | null => {
    const nameTrimmed = form.name.trim();
    if (!nameTrimmed) return '请输入有缘人的称谓';
    if (nameTrimmed.length > 10) return '姓名不超过10个字符';
    if (!/^[一-龥·ꀀ-꓿]+$/.test(nameTrimmed)) return '请输入中文姓名';
    if (tab === 'single') {
      if (form.calendar !== '四柱' && (!form.year || !form.month || !form.day)) return '请选择完整出生日期';
      if (form.calendar === '四柱' && (!form.yearGan || !form.yearZhi || !form.monthGan || !form.monthZhi || !form.dayGan || !form.dayZhi || !form.hourGan || !form.hourZhi)) return '请完整填写八字四柱';
      if (form.calendar !== '四柱' && !isNaN(parseInt(form.year)) && parseInt(form.year) > currentYear) return '出生年份不能是未来';
      if (!form.hour) return '请选择出生时间';
    } else {
      if (!form.partnerName.trim()) return '请输入对方称谓';
      if (!form.year || !form.month || !form.day) return '请选择您的完整出生日期';
      if (!form.partnerYear || !form.partnerMonth || !form.partnerDay) return '请选择对方的完整出生日期';
    }
    // 改了月/闰月之后日期可能留在上一月的「三十」上：select 的 options 里已经
    // 没有它，界面看着是空的，state 里却还是 30 —— 换算层会抛错或跳月。
    if (isLunar && form.year && form.month && form.day) {
      const n = lunarDayCount(parseInt(form.year), parseInt(form.month), isLeapOn);
      if (n <= 0) return '该农历年没有这个闰月';
      if (parseInt(form.day) > n) return '该农历月没有这一天，请重选日期';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);

    try {
      const pad = (s: string | number) => String(s).padStart(2, '0');
      const hourNum = parseInt(form.hour);
      const minuteNum = form.unknownTime ? 0 : parseInt(form.minute || '0');
      const hourSafe = isNaN(hourNum) ? 12 : hourNum;
      const minuteSafe = isNaN(minuteNum) ? 0 : minuteNum;

      // 农历必须先换算成公历，因为后面每一步都活在公历轴上：发给后端的 birthday
      // 字符串、按日期判定历史夏令时、真太阳时校正。把农历数字直接喂给它们，
      // 会按错误的日期取到错误的时区/夏令时，四柱即使碰对了也是侥幸。
      const civil = toCivilInput({
        year: parseInt(form.year), month: parseInt(form.month), day: parseInt(form.day),
        hour: hourSafe, minute: minuteSafe, isLunar, isLeapMonth: isLeapOn,
      });
      const birthday = form.calendar === '四柱'
        ? `四柱:${form.yearGan}${form.yearZhi},${form.monthGan}${form.monthZhi},${form.dayGan}${form.dayZhi},${form.hourGan}${form.hourZhi}`
        : `${civil.year}-${pad(civil.month)}-${pad(civil.day)} ${pad(civil.hour)}:${pad(civil.minute)}`;
      const birthPlace = [form.birthProvince, form.birthCity, form.birthDistrict].filter(Boolean).join(' ');
      const currentPlace = [form.currentProvince, form.currentCity, form.currentDistrict].filter(Boolean).join(' ');

      // 前端秒算排盘
      // 真太阳时（2026-10 接入）：由出生地得经度，由内置 IANA 数据得历史夏令时
      // 顺序：农历→公历换算 → 真太阳时校正（引擎内部在 Solar 构造前做）→ 晚子时换日
      const tstWiring = buildTrueSolarWiring(
        { province: form.birthProvince, city: form.birthCity, district: form.birthDistrict },
        { year: civil.year, month: civil.month, day: civil.day, hour: civil.hour, minute: civil.minute },
      );
      const birthInfo: BirthInfo = {
        year: parseInt(form.year), month: parseInt(form.month), day: parseInt(form.day),
        hour: hourSafe, minute: minuteSafe,
        isLunar,
        isLeapMonth: isLeapOn,
        gender: form.gender === '男' ? 'male' : 'female',
        timeZone: tstWiring.timeZone,
        longitude: tstWiring.longitude,
        dstOffset: tstWiring.dstOffset,
        enableTrueSolarTime: true,
      };
      const chart = createChart(birthInfo);
      chart.bazi.birthInfo = birthInfo;
      const chartName = form.name.trim();
      sessionStorage.setItem('chart_preview', JSON.stringify({
        chart, chartName,
        trueSolarWiring: { geo: tstWiring.geo, dstOffset: tstWiring.dstOffset, ambiguousDst: tstWiring.ambiguousDst, warning: tstWiring.warning },
      }));

      // 后端持久化
      // birthday 已经是换算后的公历时刻，所以 calendar 必须跟着报「公历」——
      // 否则等于告诉后端这是一个农历字符串，而接口的 birthday 字段没有闰月位、
      // 契约又不允许改，后端无从换算。四柱模式维持原样（后端 schema 本就不收）。
      const res = await apiCreateChart({
        visitor_id: visitorId, name: chartName, gender: form.gender,
        calendar: isLunar ? '公历' : form.calendar, birthday,
        birthPlace: birthPlace || '未指定', currentPlace: currentPlace || '未指定',
      });

      if (res.success && res.data?.id) {
        trackEvent('create_click', visitorId, res.data.id);
        router.push('/chart/loading/' + res.data.id);
      } else {
        const fallbackId = 'local_' + Date.now().toString(36);
        router.push('/chart/loading/' + fallbackId);
      }
    } catch (err: any) {
      const fallbackId = 'local_' + Date.now().toString(36);
      router.push('/chart/loading/' + fallbackId);
    }
  };

  const cycleSelect = (e: React.KeyboardEvent<HTMLSelectElement> | React.WheelEvent<HTMLSelectElement>) => {
    const isKey = 'key' in e;
    if (isKey && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const el = e.currentTarget;
    const dir = isKey ? (e.key === 'ArrowUp' ? -1 : 1) : (e.deltaY > 0 ? 1 : -1);
    let idx = el.selectedIndex + dir;
    if (idx < 0) idx = el.options.length - 1;
    if (idx >= el.options.length) idx = 0;
    el.selectedIndex = idx;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const renderDateGroup = (prefix: string) => {
    const isP = prefix === 'partner';
    const y = (form as any)[isP ? 'partnerYear' : 'year'] as string;
    const m = (form as any)[isP ? 'partnerMonth' : 'month'] as string;
    const d = (form as any)[isP ? 'partnerDay' : 'day'] as string;
    const h = (form as any)[isP ? 'partnerHour' : 'hour'] as string;
    const min = (form as any)[isP ? 'partnerMinute' : 'minute'] as string;
    const days = isP ? partnerDayOptions : dayOptions;
    const pf = (f: string) => isP ? ('partner' + f.charAt(0).toUpperCase() + f.slice(1)) : f;

    if (form.calendar === '四柱' && !isP) {
      return (
        <div className="grid grid-cols-4 gap-3">
          {(['年','月','日','时'] as const).map((label, idx) => {
            const gk = (['yearGan','monthGan','dayGan','hourGan'] as const)[idx];
            const zk = (['yearZhi','monthZhi','dayZhi','hourZhi'] as const)[idx];
            return (
              <div key={label} className="text-center">
                <span className="qn-cap block mb-1.5">{label}柱</span>
                <select className="qn-select" style={{ marginBottom: 6 }} value={(form as any)[gk] || ''} onChange={e => setField(gk, e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
                  <option value="">天干</option>
                  {['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="qn-select" value={(form as any)[zk] || ''} onChange={e => setField(zk, e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
                  <option value="">地支</option>
                  {['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      );
    }
    // minmax 下限是命中区要求：时间列两个 select 各要 44，若只给它们设下限，
    // 1fr 会把 年/月 挤到 43 —— 修好一处偷走另一处。四列同时设下限后
    // 375 上 44*3 + 100 + 3*12 = 268 ≤ 291 可用宽，不产生横向溢出。
    return (
      <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(44px, 1fr) minmax(44px, 1fr) minmax(44px, 1fr) minmax(100px, 1.5fr)' }}>
        <div className="text-center">
          <span className="qn-cap block mb-1.5">年</span>
          <select className="qn-select" value={y} onChange={e => setField(pf('year'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
            <option value="">--</option>
            {YEARS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>
        <div className="text-center">
          <span className="qn-cap block mb-1.5">月</span>
          <select className="qn-select" value={m} onChange={e => setField(pf('month'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
            <option value="">--</option>
            {MONTHS.map(mo => <option key={mo} value={mo}>{mo}</option>)}
          </select>
        </div>
        <div className="text-center">
          <span className="qn-cap block mb-1.5">日</span>
          <select className="qn-select" value={d} onChange={e => setField(pf('day'), e.target.value)} disabled={!y || !m} onKeyDown={cycleSelect} onWheel={cycleSelect}>
            <option value="">--</option>
            {days.map(dd => <option key={dd} value={dd}>{dd}</option>)}
          </select>
        </div>
        <div className="text-center">
          <span className="qn-cap block mb-1.5">时间</span>
          {form.unknownTime ? (
            <select className="qn-select" value={h} onChange={e => setField(pf('hour'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {["23-01 子时","01-03 丑时","03-05 寅时","05-07 卯时","07-09 辰时","09-11 巳时","11-13 午时","13-15 未时","15-17 申时","17-19 酉时","19-21 戌时","21-23 亥时"].map((sc, i) => {
                const hv = String(i*2).padStart(2,'0');
                return <option key={i} value={hv}>{sc}</option>;
              })}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
            <select className="qn-select" style={{ flex: '1 1 0', minWidth: 44, padding: '11px 4px' }} value={h} onChange={e => setField(pf('hour'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
            <span className="qn-cap select-none">:</span>
            <select className="qn-select" style={{ flex: '1 1 0', minWidth: 44, padding: '11px 4px' }} value={min} onChange={e => setField(pf('minute'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 60 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
          </div>
          )}
          <button type="button" onClick={() => setForm(p => ({ ...p, unknownTime: !p.unknownTime }))} className="qn-cap qn-hit"
            style={{ color: 'var(--color-accent-gold-text)', letterSpacing: '0.02em', marginTop: 16, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
            {form.unknownTime ? '精确时间' : '时辰选择'}
          </button>
        </div>
      </div>
      {/* 开关只在「所选月份正好是该年闰的那个月」时出现。每个农历年闰的月份不同，
          常显的闰月框会让用户以为任何月都能闰，而选了不存在的闰月换算层会直接抛错。 */}
      {!isP && isLunar && lunarLeap > 0 && parseInt(m || '0') === lunarLeap && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <div style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'rgba(0,0,0,0.04)' }}>
            <button type="button" aria-pressed={isLeapOn} onClick={() => setForm(p => ({ ...p, isLeapMonth: !p.isLeapMonth }))}
              className="qn-chip" style={{ minWidth: 46, padding: '0 12px', minHeight: 30, fontSize: 'var(--qn-fs-meta)',
                border: 'none', borderRadius: 6,
                background: isLeapOn ? '#ffffff' : 'transparent',
                color: isLeapOn ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isLeapOn ? 500 : 400,
                boxShadow: isLeapOn ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>闰{lunarLeap}月</button>
          </div>
        </div>
      )}
    </>
    );
  };

  const renderRegionGroup = (prefix: string, label: string) => {
    const prov = (form as any)[prefix + 'Province'] as string;
    const city = (form as any)[prefix + 'City'] as string;
    const dist = (form as any)[prefix + 'District'] as string;
    const provData = regionProvinces.find(p => p.name === prov);
    const cityData = provData?.cities.find(c => c.name === city);
    const districtOpts = cityData?.districts.map(d => d.name) || [];
    return (
      <div>
        <label className="qn-label">{label}</label>
        <div className="grid grid-cols-3 gap-3">
          <select value={prov} onChange={e => { const np = e.target.value; const nc = (regionProvinces.find(p => p.name === np)?.cities[0]?.name) || np; setForm(p => ({ ...p, [prefix+'Province']: np, [prefix+'City']: nc, [prefix+'District']: '' })); }} className="qn-select"><option value="">省份</option>{regionProvinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
          <select value={city} onChange={e => setForm(p => ({ ...p, [prefix+'City']: e.target.value, [prefix+'District']: '' }))} className="qn-select" disabled={!provData}><option value="">城市</option>{provData?.cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
          <select value={dist} onChange={e => setField(prefix+'District', e.target.value)} className="qn-select" disabled={districtOpts.length === 0}><option value="">区/县</option>{districtOpts.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>

      <main className="qn-shell" style={{ maxWidth: 520 }}>
        <div className="qn-rise" style={{ textAlign: 'center', paddingTop: 18, paddingBottom: 4 }}>
          <h1 className="qn-hero">创建你的专属命理档案</h1>
          <p className="qn-meta" style={{ marginTop: 10 }}>八字 × 紫微双体系 AI 合参</p>
          <div className="w-10 h-px mx-auto" style={{ marginTop: 22, background: 'rgba(178,149,93,0.4)' }} />
        </div>

        <div className="qn-rise qn-rise--2" style={{ display: 'flex', justifyContent: 'center', margin: '26px 0 22px' }}>
          <div role="tablist" style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'rgba(0,0,0,0.05)' }}>
            {([['single', '单人排盘'], ['double', '双人合盘']] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
                className="qn-chip" style={{ minWidth: 116, border: 'none', background: tab === k ? 'var(--color-bg-card)' : 'transparent',
                  color: 'var(--color-text-primary)',
                  fontWeight: tab === k ? 500 : 400, boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="qn-card qn-rise qn-rise--3" style={{ padding: '28px 28px 24px' }}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="qn-label">{tab === 'single' ? '有缘人之称谓' : '您的称谓'}</label>
                <input type="text" placeholder="请输入称呼" className="qn-input" value={form.name} onChange={e => setField('name', e.target.value)} />
              </div>
              {tab === 'double' && (
                <div>
                  <label className="qn-label">对方称谓</label>
                  <input type="text" placeholder="请输入对方称呼" className="qn-input" value={form.partnerName} onChange={e => setField('partnerName', e.target.value)} />
                </div>
              )}
              <div>
                <label className="qn-label">乾坤定性</label>
                <div className="relative w-full rounded-lg p-1 flex items-center" style={{ background: 'rgba(0,0,0,0.04)', height: 52 }}>
                  <div className="absolute rounded-md transition-transform duration-300" style={{ height: 44, width: 'calc(50% - 4px)', transform: form.gender === '男' ? 'translateX(2px)' : 'translateX(calc(100% - 2px))', background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }} />
                  <div className="relative flex w-full z-10" style={{ height: '100%' }}>
                    {['男', '女'].map(g => (
                      <button key={g} type="button" onClick={() => setField('gender', g)} className="flex-1 rounded-md cursor-pointer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--qn-fs-meta)', color: form.gender === g ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: form.gender === g ? 500 : 400, transition: 'color .3s' }}>
                        {g === '男' ? '男（乾造）' : '女（坤造）'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {tab === 'single' && (
                <div>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <label className="qn-label" style={{ marginBottom: 0 }}>诞辰之候</label>
                    <div style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'rgba(0,0,0,0.04)' }}>
                      {['公历','农历','四柱'].map(cal => (
                        <button key={cal} type="button" onClick={() => setField('calendar', cal)} className="qn-chip"
                          style={{ minWidth: 46, padding: '0 12px', minHeight: 30, fontSize: 'var(--qn-fs-meta)',
                            border: 'none', borderRadius: 6,
                            background: form.calendar === cal ? '#ffffff' : 'transparent',
                            color: form.calendar === cal ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            fontWeight: form.calendar === cal ? 500 : 400,
                            boxShadow: form.calendar === cal ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{cal}</button>
                      ))}
                    </div>
                  </div>
                  {renderDateGroup('')}
                </div>
              )}

              {tab === 'double' && (
                <>
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <label className="qn-label" style={{ marginBottom: 0 }}>您的诞辰</label>
                      <div style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'rgba(0,0,0,0.04)' }}>
                        {['公历','农历'].map(cal => (
                          <button key={cal} type="button" onClick={() => setField('calendar', cal as '公历'|'农历')} className="qn-chip"
                            style={{ minWidth: 46, padding: '0 12px', minHeight: 30, fontSize: 'var(--qn-fs-meta)',
                              border: 'none', borderRadius: 6,
                              background: form.calendar === cal ? '#ffffff' : 'transparent',
                              color: form.calendar === cal ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                              fontWeight: form.calendar === cal ? 500 : 400,
                              boxShadow: form.calendar === cal ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{cal}</button>
                        ))}
                      </div>
                    </div>
                    {renderDateGroup('')}
                  </div>
                  <div>
                    <label className="qn-label">对方诞辰</label>
                    {renderDateGroup('partner')}
                  </div>
                </>
              )}

              {form.calendar !== '四柱' && <div className="space-y-4">{renderRegionGroup('birth', '诞生之地')}</div>}
              {tab === 'single' && form.calendar !== '四柱' && <div className="space-y-4">{renderRegionGroup('current', '现居之地')}</div>}
              {tab === 'double' && (<><div className="space-y-4">{renderRegionGroup('partnerBirth', '对方诞生之地')}</div><div className="space-y-4">{renderRegionGroup('partnerCurrent', '对方现居之地')}</div></>)}

              {error && <div className="qn-alert" role="alert">{error}</div>}

              <button type="submit" disabled={loading} className="qn-btn qn-btn--solid qn-btn--block" style={{ minHeight: 50 }}>
                {loading ? '生成中...' : '生成我的双盘命格'}
              </button>
            </form>
        </div>
        <p className="qn-note" style={{ textAlign: 'center', marginTop: 30 }}>混沌 · 玄学一站式 — 古籍数字化 · AI 参详 · 仅供参考</p>
      </main>
    </div>
  );
}