'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
const monthsList = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }));
const hours24 = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: `${String(i).padStart(2, '0')}:00` }));
const minutes60 = Array.from({ length: 60 }, (_, i) => ({ value: String(i), label: String(i).padStart(2, '0') }));

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getDays(year: string, month: string) {
  if (!year || !month) return [];
  const y = parseInt(year), m = parseInt(month);
  if (isNaN(y) || isNaN(m)) return [];
  const maxDay = getDaysInMonth(y, m);
  return Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: `${i + 1}日` }));
}

// ========== Picker 弹窗组件 ==========
function PickerModal({ title, options, value, onChange, onClose, height = 'h-64' }: {
  title: string; options: { value: string; label: string }[]; value: string;
  onChange: (v: string) => void; onClose: () => void; height?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-xuan-zhi border border-dai-qing/15 rounded-t-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dai-qing/15">
          <span className="text-xs text-dai-qing/50 tracking-[2px]">请选择</span>
          <span className="text-dai-qing text-sm tracking-[2px]">{title}</span>
          <button onClick={onClose} className="text-dai-qing/70 text-sm px-2 hover:text-hu-po-jin">完成</button>
        </div>
        <div className={`overflow-y-auto ${height} overscroll-contain`}>
          {options.map(opt => (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-dai-qing/5 transition-colors ${
                opt.value === value ? 'text-hu-po-jin bg-hu-po-jin/10 border-l-2 border-l-hu-po-jin' : 'text-dai-qing/70 hover:bg-xuan-zhi-dark/50'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 地区选择器 ==========
function RegionPicker({ value, onChange, onClose }: {
  value: { province: string; city: string; district: string };
  onChange: (v: { province: string; city: string; district: string }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1|2|3>(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selP, setSelP] = useState(value.province);
  const [selC, setSelC] = useState(value.city);
  const [selD, setSelD] = useState(value.district);

  const prov = provinces.find(p => p.name === selP);
  const city = prov?.cities.find(c => c.name === selC);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-xuan-zhi border border-dai-qing/15 rounded-t-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dai-qing/15">
          <button onClick={() => setStep(s => s > 1 ? (s - 1) as 1|2|3 : s)} className="text-dai-qing/70 text-sm">
            {step > 1 ? '← 返回' : ''}
          </button>
          <div className="flex gap-2">{ [1,2,3].map(s => (
            <div key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-hu-po-jin' : 'bg-dai-qing/15'}`} />
          ))}</div>
          <button onClick={onClose} className="text-dai-qing/70 text-sm px-2 hover:text-hu-po-jin">取消</button>
        </div>
        <div className="text-center py-2 text-xs text-dai-qing/50 tracking-[2px]">
          {step === 1 ? '选择省份' : step === 2 ? '选择城市' : `${selP} ${selC} - 选择区县`}
        </div>
        <div ref={scrollRef} className="overflow-y-auto h-72 overscroll-contain">
          {step === 1 && provinces.map(p => (
            <button key={p.name} onClick={() => { setSelP(p.name); setSelC(''); setSelD(''); setStep(2); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-dai-qing/5 transition-colors ${p.name === selP ? 'text-hu-po-jin bg-hu-po-jin/10' : 'text-dai-qing/70 hover:bg-xuan-zhi-dark/50'}`}>{p.name}</button>
          ))}
          {step === 2 && prov?.cities.map(c => (
            <button key={c.name} onClick={() => { setSelC(c.name); setSelD(''); setStep(3); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-dai-qing/5 transition-colors ${c.name === selC ? 'text-hu-po-jin bg-hu-po-jin/10' : 'text-dai-qing/70 hover:bg-xuan-zhi-dark/50'}`}>{c.name}</button>
          ))}
          {step === 3 && city?.districts.map(d => (
            <button key={d.name} onClick={() => { setSelD(d.name); onChange({ province: selP, city: selC, district: d.name }); onClose(); }}
              className={`w-full text-left px-5 py-3.5 text-sm border-b border-dai-qing/5 transition-colors ${d.name === selD ? 'text-hu-po-jin bg-hu-po-jin/10' : 'text-dai-qing/70 hover:bg-xuan-zhi-dark/50'}`}>{d.name}</button>
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
  const [tab, setTab] = useState<'single'|'double'>('single');

  useEffect(() => { setVisitorId(getVisitorId()); }, []);

  const [form, setForm] = useState({
    name: '',
    gender: '男' as '男'|'女',
    calendar: '公历' as '公历'|'农历',
    year: '', month: '', day: '',
    hour: '12', minute: '00',
    birthProvince: '', birthCity: '', birthDistrict: '',
    currentProvince: '', currentCity: '', currentDistrict: '',
    // 双人合盘 - 对方信息
    partnerName: '',
    partnerGender: '女' as '男'|'女',
    partnerYear: '', partnerMonth: '', partnerDay: '',
    partnerHour: '12', partnerMinute: '00',
    partnerBirthProvince: '', partnerBirthCity: '', partnerBirthDistrict: '',
    partnerCurrentProvince: '', partnerCurrentCity: '', partnerCurrentDistrict: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState({ used: 0, remaining: 3 });
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [activeRegionPicker, setActiveRegionPicker] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!visitorId) return;
    getQuota(visitorId).then(res => { if (res.success) setQuota(res.data); });
  }, [visitorId]);

  const isLunar = form.calendar === '农历';
  const dayOptions = useMemo(() => getDays(form.year, form.month), [form.year, form.month]);
  const shichen = useMemo(() => getShichen(parseInt(form.hour)), [form.hour]);

  // Partner day options
  const partnerDayOptions = useMemo(() => getDays(form.partnerYear, form.partnerMonth), [form.partnerYear, form.partnerMonth]);
  const partnerShichen = useMemo(() => getShichen(parseInt(form.partnerHour)), [form.partnerHour]);

  const setField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (tab === 'single') {
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
    } else {
      if (!form.name.trim() || !form.partnerName.trim()) return '请输入双方姓名';
      if (!form.year || !form.month || !form.day) return '请选择您的完整出生日期';
      if (!form.partnerYear || !form.partnerMonth || !form.partnerDay) return '请选择对方的完整出生日期';
      if (!form.birthProvince || !form.birthCity) return '请选择您的出生地区';
      if (!form.partnerBirthProvince || !form.partnerBirthCity) return '请选择对方的出生地区';
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
      const birthday = `${form.year}-${pad(form.month)}-${pad(form.day)} ${pad(form.hour)}:${pad(form.minute)}`;
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
        trackEvent('create_click', visitorId, res.data.id);
        router.push(`/chart/${res.data.id}`);
      } else {
        setError(res.error || '生成失败，请重试');
      }
    } catch {
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  };

  // ========== Render helpers ==========
  const sectionClass = "bg-xuan-zhi-dark/30 border border-dai-qing/8 rounded-xl p-6";
  const fieldLabelClass = "text-[10px] text-dai-qing/50 tracking-[2px] mb-2";
  const selectBtnClass = "w-full bg-xuan-zhi border border-dai-qing/15 rounded-lg px-4 py-3 text-left text-sm hover:border-hu-po-jin/30 transition-colors";
  const selectBtnActiveClass = "text-hu-po-jin border-hu-po-jin/40";
  const selectBtnEmptyClass = "text-dai-qing/30";

  const renderGenderGroup = (gender: string, onChange: (v: string) => void) => (
    <div className="flex gap-3">
      {['男', '女'].map(g => (
        <button key={g} onClick={() => onChange(g)}
          className={`flex-1 py-2.5 rounded-lg border text-sm tracking-[2px] transition-all ${
            gender === g
              ? 'border-hu-po-jin bg-hu-po-jin/10 text-hu-po-jin'
              : 'border-dai-qing/8 bg-xuan-zhi text-dai-qing/50 hover:border-dai-qing/20'
          }`}
        >{g === '男' ? '乾造' : '坤造'} · {g}</button>
      ))}
    </div>
  );

  const renderDateGroup = (prefix: string) => {
    const y = form[prefix + 'Year' as keyof typeof form] as string;
    const m = form[prefix + 'Month' as keyof typeof form] as string;
    const d = form[prefix + 'Day' as keyof typeof form] as string;
    const h = form[prefix + 'Hour' as keyof typeof form] as string;
    const min = form[prefix + 'Minute' as keyof typeof form] as string;
    const days = prefix === 'partner' ? partnerDayOptions : dayOptions;

    return (
      <div className="space-y-3">
        {/* Calendar toggle */}
        {prefix === '' && (
          <div className="flex gap-2 mb-3">
            {['公历', '农历'].map(cal => (
              <button key={cal} onClick={() => setField('calendar', cal)}
                className={`text-xs px-4 py-1.5 rounded border tracking-[1px] transition-all ${
                  form.calendar === cal ? 'border-hu-po-jin text-hu-po-jin bg-hu-po-jin/10' : 'border-dai-qing/8 text-dai-qing/50'
                }`}>{cal}</button>
            ))}
          </div>
        )}
        {/* Year/Month/Day */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setActivePicker(prefix + 'Year')}
            className={`${selectBtnClass} ${y ? selectBtnActiveClass : selectBtnEmptyClass}`}>
            {y || '年'}
          </button>
          <button onClick={() => setActivePicker(prefix + 'Month')}
            className={`${selectBtnClass} ${m ? selectBtnActiveClass : selectBtnEmptyClass}`}>
            {m ? m + '月' : '月'}
          </button>
          <button onClick={() => { if (y && m) setActivePicker(prefix + 'Day'); }}
            className={`${selectBtnClass} ${d ? selectBtnActiveClass : selectBtnEmptyClass} ${!y || !m ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {d ? d + '日' : '日'}
          </button>
        </div>
        {/* Time */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setActivePicker(prefix + 'Hour')}
            className={`${selectBtnClass} ${h ? selectBtnActiveClass : selectBtnEmptyClass}`}>
            {h ? h.padStart(2, '0') + ':00' : '时'}
          </button>
          <button onClick={() => setActivePicker(prefix + 'Minute')}
            className={`${selectBtnClass} ${min ? selectBtnActiveClass : selectBtnEmptyClass}`}>
            {min ? min.padStart(2, '0') + '分' : '分'}
          </button>
        </div>
      </div>
    );
  };

  const renderRegionGroup = (prefix: string, label: string) => {
    const p = form[(prefix + 'Province') as keyof typeof form] as string;
    const c = form[(prefix + 'City') as keyof typeof form] as string;
    const d = form[(prefix + 'District') as keyof typeof form] as string;
    const display = [p, c, d].filter(Boolean).join(' ');
    return (
      <button onClick={() => setActiveRegionPicker(prefix)}
        className={`${selectBtnClass} ${p ? selectBtnActiveClass : selectBtnEmptyClass}`}>
        {display || label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-xuan-zhi text-dai-qing font-sans">
      {/* Nav */}
      <nav className="border-b border-dai-qing/8 px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <a href="/" className="text-hu-po-jin text-lg font-bold tracking-[3px] no-underline">混沌阁</a>
          <span className="text-dai-qing/20">/</span>
          <span className="text-dai-qing/60 text-sm tracking-[2px]">命盘排盘</span>
        </div>
        
      </nav>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-hu-po-jin text-2xl mb-2">
            <span>☰</span><span>☷</span>
          </div>
          <p className="text-xs text-dai-qing/60 tracking-[3px]">八字排盘 · 紫微斗数</p>
          <p className="text-xs text-dai-qing/50 mt-1">录入生辰，按古法自动起盘排柱</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dai-qing/8">
          {[
            { key: 'single', label: '单人排盘', desc: '个人命盘推演' },
            { key: 'double', label: '双人合盘', desc: '缘分契合度分析' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as 'single'|'double')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                tab === t.key ? 'border-hu-po-jin text-hu-po-jin' : 'border-transparent text-dai-qing/50 hover:text-dai-qing/70'
              }`}
            >
              <div className="text-sm tracking-[2px]">{t.label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ===== 主位 ===== */}
          <div className={sectionClass}>
            <p className="text-[10px] text-dai-qing/50 tracking-[2px] mb-4">
              {tab === 'single' ? '命主信息' : '主位 · 您'}
            </p>

            {/* Name */}
            <div className="mb-4">
              <p className={fieldLabelClass}>称谓</p>
              <input
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="请输入姓名"
                className="w-full bg-xuan-zhi border border-dai-qing/15 rounded-lg px-4 py-3 text-sm text-dai-qing placeholder-dai-qing/30 outline-none focus:border-hu-po-jin/40 transition-colors"
              />
            </div>

            {/* Gender */}
            <div className="mb-4">
              <p className={fieldLabelClass}>乾坤定性</p>
              {renderGenderGroup(form.gender, v => setField('gender', v))}
            </div>

            {/* Birth date */}
            <div>
              <p className={fieldLabelClass}>诞辰之候 {shichen && <span className="text-hu-po-jin">· {shichen}</span>}</p>
              {renderDateGroup('')}
            </div>
          </div>

          {/* ===== Birth Place ===== */}
          <div className={sectionClass}>
            <p className={fieldLabelClass}>诞生之地</p>
            {renderRegionGroup('birth', '请选择出生地')}
          </div>

          {/* ===== Current Place ===== */}
          <div className={sectionClass}>
            <p className={fieldLabelClass}>现居之地</p>
            {renderRegionGroup('current', '请选择现居地')}
          </div>

          {/* ===== 双人合盘 - 对方信息 ===== */}
          {tab === 'double' && (
            <div className={sectionClass}>
              <div className="border-l-2 border-hu-po-jin-dark pl-4 mb-4">
                <p className="text-[10px] text-hu-po-jin-dark tracking-[2px]">客位 · 对方</p>
              </div>

              <div className="mb-4">
                <p className={fieldLabelClass}>称谓</p>
                <input
                  value={form.partnerName}
                  onChange={e => setField('partnerName', e.target.value)}
                  placeholder="请输入对方姓名"
                  className="w-full bg-xuan-zhi border border-dai-qing/15 rounded-lg px-4 py-3 text-sm text-dai-qing placeholder-dai-qing/30 outline-none focus:border-hu-po-jin/40 transition-colors"
                />
              </div>

              <div className="mb-4">
                <p className={fieldLabelClass}>乾坤定性</p>
                {renderGenderGroup(form.partnerGender, v => setField('partnerGender', v))}
              </div>

              <div>
                <p className={fieldLabelClass}>诞辰之候 {partnerShichen && <span className="text-hu-po-jin">· {partnerShichen}</span>}</p>
                {renderDateGroup('partner')}
              </div>
            </div>
          )}

          {tab === 'double' && (
            <>
              <div className={sectionClass}>
                <p className={fieldLabelClass}>对方 · 诞生之地</p>
                {renderRegionGroup('partnerBirth', '请选择对方出生地')}
              </div>
              <div className={sectionClass}>
                <p className={fieldLabelClass}>对方 · 现居之地</p>
                {renderRegionGroup('partnerCurrent', '请选择对方现居地')}
              </div>
            </>
          )}

          {/* ===== Advanced ===== */}
          <div className={sectionClass}>
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-sm tracking-[2px] text-dai-qing/60 hover:text-hu-po-jin transition-colors">
              <span>高级排盘选项</span>
              <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-3 pt-4 border-t border-dai-qing/8">
                <label className="flex items-center justify-between py-2">
                  <span className="text-xs text-dai-qing/60 tracking-[1px]">真太阳时校准</span>
                  <span className="text-[10px] text-dai-qing/50">根据出生地经纬度修正平太阳时偏差（默认开启）</span>
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-xs text-dai-qing/60 tracking-[1px]">夜子时换日柱</span>
                  <span className="text-[10px] text-dai-qing/50">23时起按次日日柱排盘（默认开启）</span>
                </label>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-dai-qing-dark/20/30 border border-dai-qing-dark/30 rounded-lg p-3 text-center text-sm text-hu-po-jin-dark">
              {error}
            </div>
          )}

          {/* CTA */}
          <div className="text-center pb-8">
            <button type="submit" disabled={loading}
              className="w-full bg-hu-po-jin text-xuan-zhi text-base py-4 rounded-lg tracking-[4px] font-medium hover:bg-hu-po-jin disabled:opacity-50 disabled:cursor-wait transition-all"
            >
              {loading ? '排盘中...' : tab === 'single' ? '开 启 推 演' : '开 启 合 盘'}
            </button>
            <p className="mt-3 text-[10px] text-dai-qing/50 tracking-[2px]">
              免费体验
            </p>
          </div>
        </form>
      </main>

      {/* ===== Pickers ===== */}
      {activePicker && (
        <PickerModal
          title={activePicker.includes('Year') ? '选择年份' : activePicker.includes('Month') ? '选择月份' : activePicker.includes('Day') ? '选择日期' : activePicker.includes('Hour') ? '选择小时' : '选择分钟'}
          options={
            activePicker.includes('Year') ? years.map(v => ({ value: v, label: v + '年' })) :
            activePicker.includes('Month') ? monthsList :
            activePicker.includes('Day') ? (activePicker.startsWith('partner') ? partnerDayOptions : dayOptions) :
            activePicker.includes('Hour') ? hours24 :
            minutes60
          }
          value={form[activePicker as keyof typeof form] as string || ''}
          onChange={v => setField(activePicker, v)}
          onClose={() => setActivePicker(null)}
        />
      )}

      {activeRegionPicker && (
        <RegionPicker
          value={{
            province: form[(activeRegionPicker + 'Province') as keyof typeof form] as string || '',
            city: form[(activeRegionPicker + 'City') as keyof typeof form] as string || '',
            district: form[(activeRegionPicker + 'District') as keyof typeof form] as string || '',
          }}
          onChange={v => {
            setField(activeRegionPicker + 'Province', v.province);
            setField(activeRegionPicker + 'City', v.city);
            setField(activeRegionPicker + 'District', v.district);
          }}
          onClose={() => setActiveRegionPicker(null)}
        />
      )}
    </div>
  );
}
