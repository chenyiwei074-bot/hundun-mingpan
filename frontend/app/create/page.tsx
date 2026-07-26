'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createChart, getQuota, trackEvent } from '@/app/lib/api';
import { provinces as regionProvinces, Province, City } from '@/app/lib/region-data';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('hundun_visitor_id');
  if (!id) {
    id = 'visitor_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('hundun_visitor_id', id);
  }
  return id;
}

// Province/city/district data (simplified for now, matches qingnang format)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDayOptions(year: string, month: string) {
  if (!year || !month) return [];
  const y = parseInt(year), m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return [];
  return Array.from({ length: getDaysInMonth(y, m) }, (_, i) => String(i + 1));
}

// Icons as inline SVGs
const IconStar = () => (
  <svg className="w-3 h-3 mr-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z"/>
  </svg>
);

const IconCompass = () => (
  <svg className="w-3 h-3 mr-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);

const IconCalendar = () => (
  <svg className="w-3 h-3 mr-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconMapPin = () => (
  <svg className="w-3 h-3 mr-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconSettings = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const ChevronDown = () => (
  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dai-qing/30 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

const ChevronDownSmall = () => (
  <svg className="h-3 w-3 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

export default function CreatePage() {
  const router = useRouter();
  const [visitorId, setVisitorId] = useState('');
  const [tab, setTab] = useState<'single'|'double'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    gender: '男' as '男'|'女',
    calendar: '公历' as '公历'|'农历'|'四柱',
    year: '', month: '', day: '',
    hour: '12', minute: '00',
    birthProvince: '北京', birthCity: '北京', birthDistrict: '',
    currentProvince: '北京', currentCity: '北京', currentDistrict: '',
    // Four Pillars direct input
    yearGan: '', yearZhi: '', monthGan: '', monthZhi: '',
    dayGan: '', dayZhi: '', hourGan: '', hourZhi: '',
    // Partner fields
    partnerName: '',
    partnerGender: '女' as '男'|'女',
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerHour: '12', partnerMinute: '00',
    partnerBirthProvince: '北京', partnerBirthCity: '北京', partnerBirthDistrict: '',
    partnerCurrentProvince: '北京', partnerCurrentCity: '北京', partnerCurrentDistrict: '',
  });

  useEffect(() => { setVisitorId(getVisitorId()); }, []);

  const setField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // When province changes, reset dependent fields
  

  const dayOptions = useMemo(() => getDayOptions(form.year, form.month), [form.year, form.month]);
  const partnerDayOptions = useMemo(() => getDayOptions(form.partnerYear, form.partnerMonth), [form.partnerYear, form.partnerMonth]);

  const validate = (): string | null => {
    if (!form.name.trim()) return '请输入有缘人的称呼';
    if (tab === 'single') {
      if (form.calendar !== '四柱' && (!form.year || !form.month || !form.day)) return '请选择完整出生日期';
      if (form.calendar === '四柱' && (!form.yearGan || !form.yearZhi || !form.monthGan || !form.monthZhi || !form.dayGan || !form.dayZhi || !form.hourGan || !form.hourZhi)) return '请完整填写八字四柱';
      const y = parseInt(form.year);
      if (form.calendar !== '四柱' && !isNaN(y) && y > currentYear) return '出生年份不能是未来';
      if (!form.hour) return '请选择出生时间';
    } else {
      if (!form.partnerName.trim()) return '请输入对方称呼';
      if (!form.year || !form.month || !form.day) return '请选择您的完整出生日期';
      if (!form.partnerYear || !form.partnerMonth || !form.partnerDay) return '请选择对方的完整出生日期';
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
      const pad = (s: string) => s.padStart(2, '0');
      const birthday = form.calendar === '四柱'
        ? `四柱:${form.yearGan}${form.yearZhi},${form.monthGan}${form.monthZhi},${form.dayGan}${form.dayZhi},${form.hourGan}${form.hourZhi}`
        : `${form.year}-${pad(form.month)}-${pad(form.day)} ${pad(form.hour)}:${pad(form.minute)}`;
      const birthPlace = [form.birthProvince, form.birthCity, form.birthDistrict].filter(Boolean).join(' ');
      const currentPlace = [form.currentProvince, form.currentCity, form.currentDistrict].filter(Boolean).join(' ');

      const res = await createChart({
        visitor_id: visitorId,
        name: form.name.trim(),
        gender: form.gender,
        calendar: form.calendar,
        birthday,
        birthPlace: birthPlace || '未指定',
        currentPlace: currentPlace || '未指定',
      });

      if (res.success) {
        sessionStorage.setItem('chart_id_' + res.data.id, '1');
        sessionStorage.setItem('chart_name_' + res.data.id, form.name.trim());
        if (res.data.freeContent) {
          sessionStorage.setItem('chart_free_' + res.data.id, JSON.stringify(res.data.freeContent));
        }
        trackEvent('create_click', visitorId, res.data.id);
        router.push('/chart/' + res.data.id);
      } else {
        setError(res.error || '生成失败，请重试');
      }
    } catch {
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  // Render a select dropdown
  
  const renderDateGroup = (prefix: string) => {
    const isPartner = prefix === 'partner';
    const y = (form as any)[isPartner ? 'partnerYear' : 'year'] as string;
    const m = (form as any)[isPartner ? 'partnerMonth' : 'month'] as string;
    const d = (form as any)[isPartner ? 'partnerDay' : 'day'] as string;
    const h = (form as any)[isPartner ? 'partnerHour' : 'hour'] as string;
    const min = (form as any)[isPartner ? 'partnerMinute' : 'minute'] as string;
    const days = isPartner ? partnerDayOptions : dayOptions;
    const pf = (f: string) => isPartner ? ('partner' + f.charAt(0).toUpperCase() + f.slice(1)) : f;

    if (form.calendar === '四柱' && !isPartner) {
      return (
        <div className="grid grid-cols-4 gap-3">
          {(['年','月','日','时'] as const).map((label, idx) => {
            const ganKey = (['yearGan','monthGan','dayGan','hourGan'] as const)[idx];
            const zhiKey = (['yearZhi','monthZhi','dayZhi','hourZhi'] as const)[idx];
            return (
              <div key={label} className="bg-xuan-zhi-dark/50 p-3 rounded-[4px] border border-dai-qing/15 text-center transition-colors hover:border-hu-po-jin">
                <span className="text-[10px] block text-dai-qing/40 mb-1">{label}柱</span>
                <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm mb-1" value={(form as any)[ganKey] || ''} onChange={e => setField(ganKey, e.target.value)}>
                  <option value="">天干</option>
                  {['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={(form as any)[zhiKey] || ''} onChange={e => setField(zhiKey, e.target.value)}>
                  <option value="">地支</option>
                  {['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-xuan-zhi-dark/50 p-3 rounded-[4px] border border-dai-qing/15 text-center transition-colors hover:border-hu-po-jin">
          <span className="text-[10px] block text-dai-qing/40 mb-1">年</span>
          <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={y} onChange={e => setField(pf('year'), e.target.value)}>
            <option value="">--</option>
            {YEARS.map(yr => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>
        <div className="bg-xuan-zhi-dark/50 p-3 rounded-[4px] border border-dai-qing/15 text-center transition-colors hover:border-hu-po-jin">
          <span className="text-[10px] block text-dai-qing/40 mb-1">月</span>
          <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={m} onChange={e => setField(pf('month'), e.target.value)}>
            <option value="">--</option>
            {MONTHS.map(mo => <option key={mo} value={mo}>{mo}月</option>)}
          </select>
        </div>
        <div className="bg-xuan-zhi-dark/50 p-3 rounded-[4px] border border-dai-qing/15 text-center transition-colors hover:border-hu-po-jin">
          <span className="text-[10px] block text-dai-qing/40 mb-1">日</span>
          <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={d} onChange={e => setField(pf('day'), e.target.value)} disabled={!y || !m}>
            <option value="">--</option>
            {days.map(dd => <option key={dd} value={dd}>{dd}</option>)}
          </select>
        </div>
        <div className="bg-xuan-zhi-dark/50 p-3 rounded-[4px] border border-dai-qing/15 text-center transition-colors hover:border-hu-po-jin">
          <span className="text-[10px] block text-dai-qing/40 mb-1">时间</span>
          <div className="flex items-center gap-0.5">
            <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={h} onChange={e => setField(pf('hour'), e.target.value)}>
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
            <span className="text-dai-qing/40 text-sm font-bold">:</span>
            <select className="bg-transparent w-full outline-none text-center text-dai-qing font-bold appearance-none cursor-pointer text-sm" value={min} onChange={e => setField(pf('minute'), e.target.value)}>
              {Array.from({ length: 60 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
          </div>
        </div>
      </div>
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
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
            <IconMapPin />{label}
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative group">
            <select
              value={prov}
              onChange={e => {
                const newProv = e.target.value;
                const newCity = (regionProvinces.find(p => p.name === newProv)?.cities[0]?.name) || newProv;
                setForm(prev => ({ ...prev, [prefix+'Province']: newProv, [prefix+'City']: newCity, [prefix+'District']: '' }));
              }}
              className="w-full bg-xuan-zhi-dark/50 border border-dai-qing/15 rounded-[4px] py-3 px-4 appearance-none outline-none focus:border-dai-qing text-dai-qing text-sm cursor-pointer"
            >
              <option value="">省份</option>
              {regionProvinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <ChevronDown />
          </div>
          <div className="relative group">
            <select
              value={city}
              onChange={e => {
                setForm(prev => ({ ...prev, [prefix+'City']: e.target.value, [prefix+'District']: '' }));
              }}
              className="w-full bg-xuan-zhi-dark/50 border border-dai-qing/15 rounded-[4px] py-3 px-4 appearance-none outline-none focus:border-dai-qing text-dai-qing text-sm cursor-pointer"
              disabled={!provData}
            >
              <option value="">城市</option>
              {provData?.cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <ChevronDown />
          </div>
          <div className="relative group">
            <select
              value={dist}
              onChange={e => setField(prefix + 'District', e.target.value)}
              className="w-full bg-xuan-zhi-dark/50 border border-dai-qing/15 rounded-[4px] py-3 px-4 appearance-none outline-none focus:border-dai-qing text-dai-qing text-sm cursor-pointer"
              disabled={districtOpts.length === 0}
            >
              <option value="">区/县</option>
              {districtOpts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-xuan-zhi text-dai-qing font-sans">
      {/* Header nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-xuan-zhi/90 backdrop-blur-md border-b border-dai-qing/8">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="text-lg font-bold tracking-[3px] text-hu-po-jin no-underline font-serif">混沌</a>
          <div className="flex items-center gap-3">
            <a href="/liuyao" className="text-xs text-dai-qing/50 hover:text-dai-qing tracking-[2px] no-underline transition-colors">六爻</a>
          </div>
        </div>
      </header>

      <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))]">
        {/* Breadcrumb schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: 'https://hundunmp.vip' },
            { '@type': 'ListItem', position: 2, name: '命盘排盘', item: 'https://hundunmp.vip/create' },
          ]
        })}} />

        {/* Decorative background */}
        <div className="relative flex flex-col items-center justify-center p-6 font-serif select-none">
          <div className="pointer-events-none absolute inset-0 text-dai-qing">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-hu-po-jin/5 blur-[90px]" />

          <div className="relative z-[1] flex w-full flex-col items-center">
            {/* Tab pills */}
            <div className="mx-auto mb-6 flex w-fit items-center gap-1 rounded-full border border-dai-qing/15 bg-xuan-zhi/60 p-1 backdrop-blur-sm">
              <button
                onClick={() => setTab('single')}
                className={`rounded-full px-5 py-1.5 text-xs tracking-widest transition-all ${
                  tab === 'single' ? 'bg-dai-qing text-xuan-zhi shadow-sm' : 'text-dai-qing/55 hover:text-dai-qing'
                }`}
              >单人排盘</button>
              <button
                onClick={() => setTab('double')}
                className={`rounded-full px-5 py-1.5 text-xs tracking-widest transition-all ${
                  tab === 'double' ? 'bg-dai-qing text-xuan-zhi shadow-sm' : 'text-dai-qing/55 hover:text-dai-qing'
                }`}
              >双人合盘</button>
            </div>

            {/* Title card */}
            <div className="relative mt-2 max-w-2xl w-full">
              <div className="relative w-full rounded-md shadow-[0_24px_60px_-20px_rgba(0,51,51,0.28)] border border-dai-qing/15 overflow-hidden">
                <div aria-hidden="true" className="pointer-events-none absolute inset-[7px] z-20 rounded-[4px] border border-hu-po-jin/25" />
                <div className="relative overflow-hidden bg-gradient-to-b from-dai-qing-dark to-dai-qing px-8 pt-9 pb-7 text-center">
                  <div className="flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] text-hu-po-jin/60">
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-hu-po-jin/45" />
                    <span>混 沌 · 庚 帖</span>
                    <span className="h-px w-8 bg-gradient-to-l from-transparent to-hu-po-jin/45" />
                  </div>
                  <h1 className="mt-4 flex justify-center font-serif font-bold gold-foil-text" style={{ fontSize: 'clamp(34px, 5vw, 46px)' }}>
                    八字+紫微命盘
                  </h1>
                  <p className="mt-3 text-sm text-xuan-zhi/55">天道有常，缘者自寻。录入诞辰，共振星寰。</p>
                </div>

                {/* Form */}
                <div className="relative bg-xuan-zhi/95 backdrop-blur-sm">
                  <form className="p-5 sm:p-10 space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
                    {/* Name */}
                    <div className="space-y-3">
                      <label className="text-xs text-dai-qing/50 tracking-widest flex items-center justify-between">
                        <span className="flex items-center">
                          <IconStar />有缘人之称谓
                        </span>
                      </label>
                      <span className="qn-inkline block">
                        <input
                          type="text"
                          placeholder="请输入有缘人的称呼（如：某居士、己身）"
                          className="w-full bg-transparent border-0 border-b border-dai-qing/20 outline-none py-3 px-1 text-dai-qing transition-colors placeholder:text-dai-qing/25 text-lg"
                          value={form.name}
                          onChange={e => setField('name', e.target.value)}
                        />
                        <span aria-hidden="true" className="qn-inkline__ink" />
                      </span>
                    </div>

                    {/* Partner name for double mode */}
                    {tab === 'double' && (
                      <div className="space-y-3">
                        <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
                          <IconStar />对方称谓
                        </label>
                        <span className="qn-inkline block">
                          <input
                            type="text"
                            placeholder="请输入对方称呼"
                            className="w-full bg-transparent border-0 border-b border-dai-qing/20 outline-none py-3 px-1 text-dai-qing transition-colors placeholder:text-dai-qing/25 text-lg"
                            value={form.partnerName}
                            onChange={e => setField('partnerName', e.target.value)}
                          />
                          <span aria-hidden="true" className="qn-inkline__ink" />
                        </span>
                      </div>
                    )}

                    {/* Gender */}
                    <div className="space-y-3">
                      <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
                        <IconCompass />乾坤定性
                      </label>
                      <div className="relative w-full h-14 bg-xuan-zhi-dark rounded-md p-1 flex items-center border border-dai-qing/15">
                        <div
                          className="absolute h-12 bg-dai-qing rounded-[4px] shadow-lg transition-transform duration-300"
                          style={{ width: 'calc(50% - 6px)', transform: form.gender === '男' ? 'translateX(4px)' : 'translateX(calc(100% + 2px))' }}
                        />
                        <div className="relative flex w-full z-10 text-sm tracking-widest">
                          <button type="button" onClick={() => setField('gender', '男')}
                            className={`flex-1 text-center py-2 transition-colors duration-300 cursor-pointer outline-none rounded-[3px] ${
                              form.gender === '男' ? 'text-hu-po-jin font-bold' : 'text-dai-qing/50'
                            }`}
                          >男（乾造）</button>
                          <button type="button" onClick={() => setField('gender', '女')}
                            className={`flex-1 text-center py-2 transition-colors duration-300 cursor-pointer outline-none rounded-[3px] ${
                              form.gender === '女' ? 'text-hu-po-jin font-bold' : 'text-dai-qing/50'
                            }`}
                          >女（坤造）</button>
                        </div>
                      </div>
                    </div>

                    {/* ===== Date: Single person ===== */}
                    {tab === 'single' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
                            <IconCalendar />诞辰之候
                          </label>
                          <div className="flex bg-xuan-zhi-dark/80 rounded-[4px] p-0.5 border border-dai-qing/20 shadow-sm">
                            {['公历','农历','四柱'].map(cal => (
                              <button key={cal} type="button" onClick={() => setField('calendar', cal)}
                                className={`px-3.5 py-1.5 text-[10px] tracking-widest rounded-[3px] transition-colors ${
                                  form.calendar === cal
                                    ? 'bg-dai-qing text-xuan-zhi font-bold shadow'
                                    : 'text-dai-qing/50 hover:text-dai-qing'
                                }`}
                              >{cal}</button>
                            ))}
                          </div>
                        </div>
                        {renderDateGroup('')}
                      </div>
                    )}

                    {/* ===== Date: Double mode ===== */}
                    {tab === 'double' && (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
                              <IconCalendar />您的诞辰
                            </label>
                            <div className="flex bg-xuan-zhi-dark/80 rounded-[4px] p-0.5 border border-dai-qing/20 shadow-sm">
                              {['公历','农历'].map(cal => (
                                <button key={cal} type="button" onClick={() => setField('calendar', cal as '公历'|'农历')}
                                  className={`px-3.5 py-1.5 text-[10px] tracking-widest rounded-[3px] transition-colors ${
                                    form.calendar === cal
                                      ? 'bg-dai-qing text-xuan-zhi font-bold shadow'
                                      : 'text-dai-qing/50 hover:text-dai-qing'
                                  }`}
                                >{cal}</button>
                              ))}
                            </div>
                          </div>
                          {renderDateGroup('')}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-dai-qing/50 tracking-widest flex items-center">
                              <IconCalendar />对方诞辰
                            </label>
                          </div>
                          {renderDateGroup('partner')}
                        </div>
                      </>
                    )}

                    {/* Birth place - hidden for 四柱 mode */}
                    {form.calendar !== '四柱' && (
                      <div className="space-y-4">
                        {renderRegionGroup('birth', '诞生之地')}
                      </div>
                    )}

                    {/* Current place - only for single mode and non-四柱 */}
                    {tab === 'single' && form.calendar !== '四柱' && (
                      <div className="space-y-4">
                        {renderRegionGroup('current', '现居之地')}
                      </div>
                    )}

                    {/* Partner regions for double mode */}
                    {tab === 'double' && (
                      <>
                        <div className="space-y-4">
                          {renderRegionGroup('partnerBirth', '对方诞生之地')}
                        </div>
                        <div className="space-y-4">
                          {renderRegionGroup('partnerCurrent', '对方现居之地')}
                        </div>
                      </>
                    )}

                    {/* Error */}
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 text-center text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    {/* Submit */}
                    <button type="submit" disabled={loading}
                      className="w-full bg-hu-po-jin hover:bg-hu-po-jin-light text-dai-qing-dark py-5 rounded-md font-bold tracking-[0.6em] shadow-[0_10px_30px_rgba(212,175,55,0.3)] transition-all flex items-center justify-center relative overflow-hidden group disabled:opacity-60 disabled:cursor-wait"
                    >
                      {loading ? '推演中...' : '开启推演（免费）'}
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
