'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createChart, getQuota, trackEvent } from '@/app/lib/api';
import { provinces, City } from '@/app/lib/region-data';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('hundun_visitor_id');
  if (!id) {
    id = 'visitor_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('hundun_visitor_id', id);
  }
  return id;
}

// ========== 时辰计算 ==========
const SHICHEN: [string, number, number][] = [
  ['子时', 23, 24], ['子时', 0, 1], ['丑时', 1, 3], ['寅时', 3, 5],
  ['卯时', 5, 7], ['辰时', 7, 9], ['巳时', 9, 11], ['午时', 11, 13],
  ['未时', 13, 15], ['申时', 15, 17], ['酉时', 17, 19], ['戌时', 19, 21],
  ['亥时', 21, 23],
];

function getShichen(hour: number): string {
  for (const [name, start, end] of SHICHEN) {
    if (hour >= start && hour < end) return name;
    if (start === 23 && hour === 23) return '子时';
  }
  return '';
}

// ========== 日期工具 ==========
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }));
const hours24 = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${String(i).padStart(2, '0')}:00` }));
const minutes60 = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, '0') }));

function getDaysInMonth(year: number, month: number, isLunar: boolean): number {
  if (isLunar) {
    // 农历月份 29 或 30 天，简化处理：大月30小月29，这里统一给30
    return 30;
  }
  return new Date(year, month, 0).getDate();
}

function getDays(year: string, month: string, isLunar: boolean) {
  if (!year || !month) return [];
  const y = parseInt(year), m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return [];
  const maxDay = getDaysInMonth(y, m, isLunar);
  return Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: `${i + 1}日` }));
}

// ========== Picker 弹窗组件 ==========
function PickerModal({ title, options, value, onChange, onClose, height = 'h-64' }: {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  height?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#1a1614] border border-[#2a2520] rounded-t-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2520]">
          <span className="text-xs text-[#6b5f52] tracking-[2px]">请选择</span>
          <span className="text-[#e8e0d5] text-sm tracking-[2px]">{title}</span>
          <button onClick={onClose} className="text-[#a89a85] text-sm px-2 hover:text-[#e0c878]">完成</button>
        </div>
        <div className={`overflow-y-auto ${height} overscroll-contain`}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-[#1f1b18] transition-colors
                ${opt.value === value
                  ? 'text-[#e0c878] bg-[#c9a84c]/10 border-l-2 border-l-[#c9a84c]'
                  : 'text-[#a89a85] hover:bg-[#201a16]'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 地区选择器 ==========
function RegionPicker({ title, value, province, city, district, onChange, onClose }: {
  title: string;
  value: { province: string; city: string; district: string };
  onChange: (v: { province: string; city: string; district: string }) => void;
  onClose: () => void;
  province: string;
  city: string;
  district: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selProvince, setSelProvince] = useState(province);
  const [selCity, setSelCity] = useState(city);
  const [selDistrict, setSelDistrict] = useState(district);

  const selectedProvince = provinces.find(p => p.name === selProvince);
  const selectedCity = selectedProvince?.cities.find(c => c.name === selCity);

  const handleProvinceSelect = (p: string) => {
    setSelProvince(p);
    setSelCity('');
    setSelDistrict('');
    setStep(2);
  };

  const handleCitySelect = (c: string) => {
    setSelCity(c);
    setSelDistrict('');
    const cityObj = provinces.find(p => p.name === selProvince)?.cities.find(ct => ct.name === c);
    if (cityObj && cityObj.districts.length <= 1) {
      // 只有一个区（如直辖市、省直辖县级市），自动选
      const d = cityObj.districts[0].name;
      setSelDistrict(d);
      onChange({ province: selProvince, city: c, district: d });
      onClose();
      return;
    }
    setStep(3);
  };

  const handleDistrictSelect = (d: string) => {
    setSelDistrict(d);
    onChange({ province: selProvince, city: selCity, district: d });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#1a1614] border border-[#2a2520] rounded-t-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        {/* Steps indicator */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2520]">
          <button onClick={() => setStep(s => (s > 1 ? (s - 1) as 1 | 2 | 3 : s))} className="text-[#a89a85] text-sm">
            {step > 1 ? '← 返回' : ''}
          </button>
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-[#c9a84c]' : 'bg-[#2a2520]'}`} />
            ))}
          </div>
          <button onClick={onClose} className="text-[#a89a85] text-sm px-2 hover:text-[#e0c878]">取消</button>
        </div>

        <div className="text-center py-2 text-xs text-[#6b5f52] tracking-[2px]">
          {step === 1 ? '选择省份' : step === 2 ? '选择城市' : `${selProvince} ${selCity} - 选择区县`}
        </div>

        <div className="overflow-y-auto h-72 overscroll-contain">
          {step === 1 && provinces.map(p => (
            <button key={p.name} onClick={() => handleProvinceSelect(p.name)}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-[#1f1b18] transition-colors
                ${p.name === selProvince ? 'text-[#e0c878] bg-[#c9a84c]/10' : 'text-[#a89a85] hover:bg-[#201a16]'}`}>
              {p.name}
            </button>
          ))}

          {step === 2 && selectedProvince?.cities.map(c => (
            <button key={c.name} onClick={() => handleCitySelect(c.name)}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-[#1f1b18] transition-colors
                ${c.name === selCity ? 'text-[#e0c878] bg-[#c9a84c]/10' : 'text-[#a89a85] hover:bg-[#201a16]'}`}>
              {c.name}
            </button>
          ))}

          {step === 3 && selectedCity?.districts.map(d => (
            <button key={d.name} onClick={() => handleDistrictSelect(d.name)}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-[#1f1b18] transition-colors
                ${d.name === selDistrict ? 'text-[#e0c878] bg-[#c9a84c]/10' : 'text-[#a89a85] hover:bg-[#201a16]'}`}>
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 主页面 ==========
export default function CreatePage() {
  const router = useRouter();
  const [visitorId, setVisitorId] = useState('');

  useEffect(() => { setVisitorId(getVisitorId()); }, []);

  const [form, setForm] = useState({
    name: '',
    gender: '男' as '男' | '女',
    calendar: '农历' as '农历' | '公历',
    year: '',
    month: '',
    day: '',
    hour: '12',
    minute: '00',
    birthProvince: '', birthCity: '', birthDistrict: '',
    currentProvince: '', currentCity: '', currentDistrict: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState({ used: 0, remaining: 3 });
  const [activePicker, setActivePicker] = useState<string | null>(null);

  useEffect(() => {
    if (!visitorId) return;
    getQuota(visitorId).then(res => { if (res.success) setQuota(res.data); });
  }, [visitorId]);

  const isLunar = form.calendar === '农历';
  const dayOptions = useMemo(() => getDays(form.year, form.month, isLunar), [form.year, form.month, isLunar]);
  const shichen = useMemo(() => getShichen(parseInt(form.hour)), [form.hour]);

  const validate = (): string | null => {
    if (!form.name.trim()) return '请输入姓名';
    if (!form.year || !form.month || !form.day) return '请选择完整出生日期';
    const y = parseInt(form.year), m = parseInt(form.month), d = parseInt(form.day);
    if (y > currentYear) return '出生年份不能是未来';
    if (y === currentYear) {
      const now = new Date();
      if (m > now.getMonth() + 1) return '出生月份不能是未来';
      if (m === now.getMonth() + 1 && d > now.getDate()) return '出生日期不能是未来';
    }
    if (!form.hour) return '请选择出生时间';
    if (!form.birthProvince || !form.birthCity) return '请选择出生地区';
    if (!form.currentProvince || !form.currentCity) return '请选择现居地区';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);

    try {
      const month = form.month.padStart(2, '0');
      const day = form.day.padStart(2, '0');
      const birthday = form.year + '-' + month + '-' + day + ' ' + form.hour + ':' + form.minute;
      const birthPlace = [form.birthProvince, form.birthCity, form.birthDistrict].filter(Boolean).join(' ');
      const currentPlace = [form.currentProvince, form.currentCity, form.currentDistrict].filter(Boolean).join(' ');

      const res = await createChart({
        visitor_id: visitorId,
        name: form.name.trim(),
        gender: form.gender,
        calendar: form.calendar,
        birthday,
        birthPlace,
        currentPlace,
      });

      if (res.success) {
        trackEvent('create_click', visitorId);
        sessionStorage.setItem('chart_result_' + res.data.id, JSON.stringify(res.data));
        router.push('/chart/' + res.data.id);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const update = (k: string, v: string) => setForm(prev => {
    const next = { ...prev, [k]: v };
    // 切换农历/公历时重置日
    if (k === 'calendar') { next.year = ''; next.month = ''; next.day = ''; }
    // 切换年/月时重置日
    if (k === 'year' || k === 'month') next.day = '';
    return next;
  });

  const displayValue = (v: string, placeholder: string) =>
    v ? <span className="text-[#e8e0d5]">{v}</span> : <span className="text-[#5a5045]">{placeholder}</span>;

  return (
    <div className="min-h-screen bg-texture pb-20 relative overflow-hidden"><div className="absolute inset-0 pointer-events-none"><div className="absolute top-10 left-5 w-48 h-48 bg-[#7b5ea7] rounded-full opacity-[0.04] blur-3xl"></div><div className="absolute bottom-40 right-5 w-64 h-64 bg-[#c9a84c] rounded-full opacity-[0.04] blur-3xl"></div></div>
      {/* Header */}
      <div className="border-b border-[#2a2520] py-6 px-4 text-center">
        <a href="/" className="text-[#c9a84c] text-sm tracking-[4px] no-underline hover:text-[#e0c878] transition-colors">
          混沌阁
        </a>
        <h1 className="text-xl text-[#e8e0d5] tracking-[6px] mt-3 font-normal">生成命盘</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 姓名 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">姓名</label>
            <input type="text" className="input-field" placeholder="请输入姓名" inputMode="text"
              value={form.name} onChange={e => update('name', e.target.value)} maxLength={10} />
          </div>

          {/* 性别 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">性别</label>
            <div className="flex gap-3">
              {['男', '女'].map(g => (
                <button key={g} type="button" onClick={() => update('gender', g)}
                  className={'flex-1 py-3 rounded text-sm tracking-[3px] transition-all border ' +
                    (form.gender === g
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#e0c878]'
                      : 'border-[#2a2520] bg-[#141110] text-[#a89a85] hover:border-[#3a3530]')}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 历法 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">历法</label>
            <div className="flex gap-3">
              {['农历', '公历'].map(c => (
                <button key={c} type="button" onClick={() => update('calendar', c)}
                  className={'flex-1 py-3 rounded text-sm tracking-[3px] transition-all border ' +
                    (form.calendar === c
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#e0c878]'
                      : 'border-[#2a2520] bg-[#141110] text-[#a89a85] hover:border-[#3a3530]')}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 出生日期 - 年/月/日 三选 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生日期</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setActivePicker('year')}
                className="picker-btn">
                {displayValue(form.year ? form.year + '年' : '', '年份')}
              </button>
              <button type="button" onClick={() => { if (form.year) setActivePicker('month'); }}
                className={`picker-btn ${!form.year ? 'opacity-50' : ''}`}>
                {displayValue(form.month ? parseInt(form.month) + '月' : '', '月份')}
              </button>
              <button type="button" onClick={() => { if (form.year && form.month) setActivePicker('day'); }}
                className={`picker-btn ${!form.year || !form.month ? 'opacity-50' : ''}`}>
                {displayValue(form.day ? parseInt(form.day) + '日' : '', '日期')}
              </button>
            </div>
          </div>

          {/* 出生时间 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生时间</label>
            <button type="button" onClick={() => setActivePicker('time')}
              className="picker-btn w-full text-left flex justify-between items-center">
              <span className={form.hour ? 'text-[#e8e0d5]' : 'text-[#5a5045]'}>
                {form.hour ? `${form.hour}:${form.minute}` : '选择时间'}
              </span>
              {shichen && (
                <span className="text-xs text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-0.5 rounded">{shichen}</span>
              )}
            </button>
          </div>

          {/* 出生地点 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生地点</label>
            <button type="button" onClick={() => setActivePicker('birthPlace')}
              className="picker-btn w-full text-left">
              {displayValue(
                [form.birthProvince, form.birthCity, form.birthDistrict].filter(Boolean).join(' ') || '',
                '点击选择省/市/区'
              )}
            </button>
          </div>

          {/* 现居地点 */}
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">现居地点</label>
            <button type="button" onClick={() => setActivePicker('currentPlace')}
              className="picker-btn w-full text-left">
              {displayValue(
                [form.currentProvince, form.currentCity, form.currentDistrict].filter(Boolean).join(' ') || '',
                '点击选择省/市/区'
              )}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="text-[#e05a45] text-sm text-center py-3 border border-[#e05a45]/30 rounded bg-[#e05a45]/5">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button type="submit" disabled={loading}
            className="btn-gold w-full text-base py-4 tracking-[4px] disabled:opacity-50">
            {loading ? '命盘生成中...' : '生成命盘'}
          </button>

          <p className="text-center text-xs text-[#6b5f52] tracking-[2px]">
            今日剩余 {quota.remaining} / {quota.used + quota.remaining} 次免费排盘
          </p>
        </form>
      </div>

      {/* ========== Picker Modals ========== */}
      {activePicker === 'year' && (
        <PickerModal title="选择年份" options={years.map(y => ({ value: y, label: y + '年' }))}
          value={form.year} onChange={v => update('year', v)} onClose={() => setActivePicker(null)} />
      )}
      {activePicker === 'month' && (
        <PickerModal title="选择月份" options={months}
          value={form.month} onChange={v => update('month', v)} onClose={() => setActivePicker(null)} height="h-60" />
      )}
      {activePicker === 'day' && (
        <PickerModal title="选择日期" options={dayOptions}
          value={form.day} onChange={v => update('day', v)} onClose={() => setActivePicker(null)} />
      )}

      {activePicker === 'time' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setActivePicker(null)}>
          <div className="w-full max-w-lg bg-[#1a1614] border border-[#2a2520] rounded-t-2xl overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2520]">
              <span className="text-xs text-[#6b5f52]">时:分</span>
              <span className="text-[#e0c878] text-sm">{shichen}</span>
              <button onClick={() => setActivePicker(null)} className="text-[#a89a85] text-sm px-2 hover:text-[#e0c878]">完成</button>
            </div>
            <div className="flex h-64">
              <div className="flex-1 overflow-y-auto overscroll-contain border-r border-[#2a2520]">
                {hours24.map(h => (
                  <button key={h.value} onClick={() => update('hour', h.value)}
                    className={`w-full text-center py-3 text-sm transition-colors
                      ${h.value === form.hour ? 'text-[#e0c878] bg-[#c9a84c]/10' : 'text-[#a89a85] hover:bg-[#201a16]'}`}>
                      {h.label}
                    </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {minutes60.map(m => (
                  <button key={m.value} onClick={() => update('minute', m.value)}
                    className={`w-full text-center py-3 text-sm transition-colors
                      ${m.value === form.minute ? 'text-[#e0c878] bg-[#c9a84c]/10' : 'text-[#a89a85] hover:bg-[#201a16]'}`}>
                      {m.label}
                    </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activePicker === 'birthPlace' && (
        <RegionPicker title="出生地区"
          province={form.birthProvince} city={form.birthCity} district={form.birthDistrict}
          value={{ province: form.birthProvince, city: form.birthCity, district: form.birthDistrict }}
          onChange={v => { update('birthProvince', v.province); update('birthCity', v.city); update('birthDistrict', v.district); }}
          onClose={() => setActivePicker(null)} />
      )}

      {activePicker === 'currentPlace' && (
        <RegionPicker title="现居地区"
          province={form.currentProvince} city={form.currentCity} district={form.currentDistrict}
          value={{ province: form.currentProvince, city: form.currentCity, district: form.currentDistrict }}
          onChange={v => { update('currentProvince', v.province); update('currentCity', v.city); update('currentDistrict', v.district); }}
          onClose={() => setActivePicker(null)} />
      )}
    </div>
  );
}
