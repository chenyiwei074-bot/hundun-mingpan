'use client';

import { useMemo, useRef, useState, type FormEvent, type Ref } from 'react';
import Link from 'next/link';
import styles from './avatar-design.module.css';
import { provinces } from '@/app/lib/region-data';
import { getVisitorId } from '@/lib/auth/visitor';

type Calendar = '公历' | '农历';
type MotifId = 'sunrise' | 'mountain' | 'ascending_path';
type Palette = { background: string; base: string; accent: string; highlight: string };
type Meaning = { motif: MotifId; label: string; plainText: string };
type AvatarBrief = {
  expiresAt: string;
  concept: {
    title: string;
    plainSummary: string;
    visual: {
      theme: 'dawn-mountain-path';
      palette: Palette;
      motifs: MotifId[];
      composition: string;
    };
    meaning: Meaning[];
    basisNote: string;
  };
  chartSummary?: { year?: string; month?: string; day?: string; hour?: string; dayMaster?: string };
};
type FormState = {
  calendar: Calendar;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  isLeapMonth: boolean;
  province: string;
  city: string;
  district: string;
  occupation: string;
  consent: boolean;
};

const INITIAL_FORM: FormState = {
  calendar: '公历', year: '', month: '', day: '', hour: '', minute: '', isLeapMonth: false,
  province: '', city: '', district: '', occupation: '', consent: false,
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_birth_info: '出生日期、时刻或地点无效，请核对后重试。',
  invalid_occupation: '请填写职业，长度控制在 2–40 个字。',
  consent_required: '请先确认本次主题提炼的数据用途。',
  invalid_visitor: '暂时无法确认本机身份，请刷新页面后重试。',
  calculation_unavailable: '主题暂时无法提炼，请稍后再试。',
  rate_limited: '请求有些频繁，请稍等片刻再试。',
};

const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

async function requestAvatarBrief(body: Record<string, unknown>): Promise<AvatarBrief> {
  const visitorId = getVisitorId();
  if (!visitorId) throw new Error('当前设备身份暂不可用，请刷新页面后重试。');
  const response = await fetch('/api/avatar/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-visitor-id': visitorId },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const envelope = await response.json().catch(() => null);
  if (!response.ok || envelope?.success !== true || !envelope?.data) {
    const code = String(envelope?.code || '');
    throw new Error(ERROR_MESSAGES[code] || envelope?.error || '主题暂时无法提炼，请稍后再试。');
  }
  const data = envelope.data as AvatarBrief;
  const concept = data.concept;
  const palette = concept?.visual?.palette;
  const allowedMotifs: MotifId[] = ['sunrise', 'mountain', 'ascending_path'];
  if (
    concept?.visual?.theme !== 'dawn-mountain-path'
    || !concept.title
    || !concept.plainSummary
    || !concept.visual.composition
    || !Array.isArray(concept.meaning)
    || !Array.isArray(concept.visual.motifs)
    || !allowedMotifs.every(motif => concept.visual.motifs.includes(motif))
    || !isHexColor(palette?.background)
    || !isHexColor(palette?.base)
    || !isHexColor(palette?.accent)
    || !isHexColor(palette?.highlight)
  ) {
    throw new Error('主题方案返回不完整，请稍后重试。');
  }
  return data;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AvatarIllustration({ brief, svgRef }: { brief: AvatarBrief; svgRef: Ref<SVGSVGElement> }) {
  const { background, base, accent, highlight } = brief.concept.visual.palette;
  const motifs = new Set(brief.concept.visual.motifs);
  return (
    <svg
      ref={svgRef}
      className={styles.avatarSvg}
      viewBox="0 0 512 512"
      role="img"
      aria-labelledby="avatar-svg-title avatar-svg-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="avatar-svg-title">{brief.concept.title}</title>
      <desc id="avatar-svg-desc">{brief.concept.visual.composition}</desc>
      <defs>
        <clipPath id="avatar-circle"><circle cx="256" cy="256" r="236" /></clipPath>
        <radialGradient id="avatar-sky" cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor={base} />
          <stop offset=".64" stopColor={background} />
          <stop offset="1" stopColor={background} />
        </radialGradient>
        <linearGradient id="avatar-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={highlight} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <linearGradient id="avatar-road" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={accent} />
          <stop offset="1" stopColor={highlight} />
        </linearGradient>
        <linearGradient id="avatar-mountain" x1="0" y1="0" x2=".75" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={background} />
        </linearGradient>
      </defs>
      <g clipPath="url(#avatar-circle)">
        <rect width="512" height="512" fill="url(#avatar-sky)" />
        {motifs.has('sunrise') && <>
          <circle cx="256" cy="224" r="133" fill={accent} opacity=".14" className={styles.sunAura} />
          <circle cx="256" cy="226" r="79" fill="url(#avatar-sun)" className={styles.sunDisc} />
          <circle cx="256" cy="226" r="91" fill="none" stroke={highlight} strokeWidth="1.5" opacity=".48" />
        </>}
        <path d="M0 304c70-25 127-25 182-8 54 17 102 17 153-1 68-23 121-18 177 5v212H0z" fill={background} opacity=".72" />
        {motifs.has('mountain') && <>
          <path d="M-24 391 80 267l57 66 82-132 82 134 54-58 82 111v155H-24z" fill="url(#avatar-mountain)" />
          <path d="m80 267 57 66 82-132 82 134" fill="none" stroke={accent} strokeWidth="2.4" opacity=".8" />
          <path d="m219 224 18 10-20-2-15 11zM298 334l4-17 18 9" fill={highlight} opacity=".8" />
          <path d="M-18 391 80 352l63 23 76-35 67 29 62-32 74 33 85-26v170H-18z" fill={background} opacity=".88" />
          <path d="m80 352 63 23 76-35 67 29 62-32 74 33" fill="none" stroke={base} strokeWidth="1.6" opacity=".78" />
        </>}
        {motifs.has('ascending_path') && <path
          d="M213 512c2-39 14-69 33-92 17-21 27-38 22-53-4-13-18-23-35-31l19-32c34 15 57 36 62 63 6 30-13 56-34 82-19 23-29 43-30 63z"
          fill="url(#avatar-road)"
          className={styles.goldenRoad}
        />}
        {motifs.has('ascending_path') && <path d="M247 512c4-38 16-68 35-95 17-23 27-39 22-54-3-11-12-20-26-28" fill="none" stroke={highlight} strokeWidth="3" opacity=".9" strokeLinecap="round" />}
        {motifs.has('sunrise') && <>
          <path d="M256 203v-17m-18 38h-16m52 0h16" fill="none" stroke={highlight} strokeWidth="2" strokeLinecap="round" opacity=".78" />
          <circle cx="256" cy="218" r="5" fill={highlight} />
        </>}
      </g>
      <circle cx="256" cy="256" r="236" fill="none" stroke={accent} strokeWidth="5" />
      <circle cx="256" cy="256" r="226" fill="none" stroke={highlight} strokeWidth="1" opacity=".54" />
    </svg>
  );
}

export default function AvatarDesignPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [brief, setBrief] = useState<AvatarBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const province = useMemo(() => provinces.find(item => item.name === form.province), [form.province]);
  const city = useMemo(() => province?.cities.find(item => item.name === form.city), [province, form.city]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setBrief(null);
    setError('');
  };

  const validate = (): string | null => {
    const year = Number(form.year), month = Number(form.month), day = Number(form.day);
    const hour = Number(form.hour), minute = Number(form.minute);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return '出生年份请填写 1900–2100 年。';
    if (!Number.isInteger(month) || month < 1 || month > 12) return '请填写有效的出生月份。';
    if (!Number.isInteger(day) || day < 1 || day > 31) return '请填写有效的出生日期。';
    const parsedDate = new Date(year, month - 1, day);
    if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return '这个日期不存在，请重新核对。';
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59 || form.hour === '' || form.minute === '') return '请填写准确的出生时刻。';
    if (!form.province || !form.city || !form.district) return '请选择完整的出生省、市、区/县。';
    if (form.occupation.trim().length < 2 || form.occupation.trim().length > 40) return '职业请填写 2–40 个字。';
    if (!form.consent) return '请先确认本次主题提炼的数据用途。';
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    setBrief(null);
    const birthday = `${form.year.padStart(4, '0')}-${form.month.padStart(2, '0')}-${form.day.padStart(2, '0')} ${form.hour.padStart(2, '0')}:${form.minute.padStart(2, '0')}`;
    try {
      const data = await requestAvatarBrief({
        calendar: form.calendar,
        birthday,
        isLeapMonth: form.calendar === '农历' ? form.isLeapMonth : false,
        birthPlace: [form.province, form.city, form.district].join(' '),
        occupation: form.occupation.trim(),
        consent: true,
      });
      setBrief(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '主题暂时无法提炼，请稍后再试。');
    } finally {
      setBusy(false);
    }
  };

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const markup = new XMLSerializer().serializeToString(svgRef.current);
    downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), 'hundun-career-avatar.svg');
  };

  const downloadPng = () => {
    if (!svgRef.current) return;
    const markup = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const source = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const context = canvas.getContext('2d');
      if (!context) { URL.revokeObjectURL(source); setError('图片导出失败，请下载 SVG 后使用。'); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(source);
        if (blob) downloadBlob(blob, 'hundun-career-avatar.png');
        else setError('图片导出失败，请下载 SVG 后使用。');
      }, 'image/png');
    };
    image.onerror = () => { URL.revokeObjectURL(source); setError('图片导出失败，请下载 SVG 后使用。'); };
    image.src = source;
  };

  const resetAll = () => {
    setForm(INITIAL_FORM);
    setBrief(null);
    setError('');
  };

  return (
    <main className={styles.page} data-mode="oriental">
      <header className={styles.header}>
        <Link href="/tools" className={styles.backLink}>← 返回工具目录</Link>
        <p className={styles.eyebrow}>命盘意象 · 职业表达</p>
        <h1>把你的经历，画成一条向上的路</h1>
        <p className={styles.lead}>根据出生盘与职业提炼主题，再用朝阳、山峰和登山路讲清它。</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.formPanel} aria-labelledby="avatar-input-title">
          <div className={styles.panelHeading}>
            <span className={styles.stepMark} aria-hidden="true">起</span>
            <div><h2 id="avatar-input-title">告诉我们你的出生信息</h2><p>本站用它排盘，再结合你填写的职业提炼视觉主题。</p></div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <fieldset className={styles.calendarField}>
              <legend>出生历法</legend>
              <div className={styles.calendarChoices}>
                {(['公历', '农历'] as Calendar[]).map(value => (
                  <button key={value} type="button" className={`${styles.calendarChoice} ${form.calendar === value ? styles.calendarChoiceActive : ''}`} aria-pressed={form.calendar === value} onClick={() => updateField('calendar', value)}>{value}</button>
                ))}
              </div>
            </fieldset>

            <div>
              <span className={styles.label}>出生日期</span>
              <div className={styles.dateGrid}>
                <label><span>年</span><input inputMode="numeric" type="number" min="1900" max="2100" value={form.year} onChange={event => updateField('year', event.target.value)} placeholder="1990" aria-label="出生年份" /></label>
                <label><span>月</span><input inputMode="numeric" type="number" min="1" max="12" value={form.month} onChange={event => updateField('month', event.target.value)} placeholder="05" aria-label="出生月份" /></label>
                <label><span>日</span><input inputMode="numeric" type="number" min="1" max="31" value={form.day} onChange={event => updateField('day', event.target.value)} placeholder="15" aria-label="出生日期" /></label>
              </div>
              {form.calendar === '农历' && <label className={styles.checkLine}><input type="checkbox" checked={form.isLeapMonth} onChange={event => updateField('isLeapMonth', event.target.checked)} />出生月份为闰月</label>}
            </div>

            <div>
              <label className={styles.label} htmlFor="avatar-birth-time">出生时刻</label>
              <input id="avatar-birth-time" className={styles.textInput} type="time" value={form.hour !== '' && form.minute !== '' ? `${form.hour.padStart(2, '0')}:${form.minute.padStart(2, '0')}` : ''} onChange={event => { const [hour, minute] = event.target.value.split(':'); setForm(previous => ({ ...previous, hour: hour || '', minute: minute || '' })); setBrief(null); setError(''); }} />
              <p className={styles.fieldHint}>请填写准确的出生时刻，不用默认时间代替。</p>
            </div>

            <div>
              <span className={styles.label}>出生地点</span>
              <div className={styles.placeGrid}>
                <select aria-label="出生省份" value={form.province} onChange={event => { const provinceValue = event.target.value; setForm(previous => ({ ...previous, province: provinceValue, city: '', district: '' })); setBrief(null); setError(''); }}>
                  <option value="">省份</option>{provinces.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <select aria-label="出生城市" value={form.city} disabled={!province} onChange={event => { const cityValue = event.target.value; setForm(previous => ({ ...previous, city: cityValue, district: '' })); setBrief(null); setError(''); }}>
                  <option value="">城市</option>{province?.cities.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <select aria-label="出生区县" value={form.district} disabled={!city} onChange={event => updateField('district', event.target.value)}>
                  <option value="">区/县</option>{city?.districts.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={styles.label} htmlFor="avatar-occupation">职业</label>
              <input id="avatar-occupation" className={styles.textInput} type="text" maxLength={40} value={form.occupation} onChange={event => updateField('occupation', event.target.value)} placeholder="例如：创业者、设计师、教师" />
              <p className={styles.fieldHint}>职业会参与主题提炼，不用于评判职业前景。</p>
            </div>

            <label className={styles.consent}>
              <input type="checkbox" checked={form.consent} onChange={event => updateField('consent', event.target.checked)} />
              <span>我同意本站将出生资料和职业用于本次主题提炼。头像由本页本地绘制，不上传图片。</span>
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              {busy ? '正在提炼主题…' : '生成主题与头像'}
            </button>
            <p className={styles.privacyNote}>出生资料和职业仅用于本次主题计算，不保存。<br /><Link href="/privacy">查看隐私说明</Link></p>
          </form>
        </section>

        <section className={styles.outputPanel} aria-live="polite" aria-label="头像创作结果">
          {!brief && (
            <div className={styles.emptyState}>
              <div className={styles.emptyScene} aria-hidden="true">
                <span className={styles.emptySun} />
                <span className={styles.emptyMountain} />
                <span className={styles.emptyPath} />
              </div>
              <p className={styles.outputEyebrow}>主题预览</p>
              <h2>太阳、山峰、一条向上的路</h2>
              <p>每个图形都会配上一句白话解释。头像表达创作主题，不替你作人生判断。</p>
              <div className={styles.emptyLegend}><span>朝阳 · 成长</span><span>山峰 · 积累</span><span>登山路 · 行动</span></div>
            </div>
          )}

          {brief && (
            <div className={styles.resultState}>
              <div className={styles.resultHeading}>
                <div><p className={styles.outputEyebrow}>你的视觉主题</p><h2>{brief.concept.title}</h2></div>
                <button className={styles.textButton} type="button" onClick={resetAll}>重新填写</button>
              </div>

              <div className={styles.previewStage}>
                <div className={styles.avatarFrame}>
                  <AvatarIllustration brief={brief} svgRef={svgRef} />
                </div>
                <p className={styles.composition}>{brief.concept.visual.composition}</p>
              </div>

              <div className={styles.interpretationCard}>
                <p className={styles.cardLabel}>这张图在说什么</p>
                <p className={styles.summary}>{brief.concept.plainSummary}</p>
                <ul className={styles.meaningList}>
                  {brief.concept.meaning.map(item => <li key={item.motif}><strong>{item.label}</strong><span>{item.plainText}</span></li>)}
                </ul>
                <p className={styles.basisNote}>{brief.concept.basisNote}</p>
              </div>

              {brief.chartSummary && <div className={styles.chartSummary} aria-label="排盘信息核对">
                <span className={styles.chartLabel}>排盘核对</span>
                <div>{(['year', 'month', 'day', 'hour'] as const).map((key, index) => brief.chartSummary?.[key] ? <span key={key}>{['年', '月', '日', '时'][index]}柱 <strong>{brief.chartSummary[key]}</strong></span> : null)}</div>
                {brief.chartSummary.dayMaster && <span className={styles.dayMaster}>日主 {brief.chartSummary.dayMaster}</span>}
              </div>}

              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.actionRow}>
                <button className={styles.primaryButton} type="button" onClick={downloadPng}>下载 PNG</button>
                <button className={styles.secondaryButton} type="button" onClick={downloadSvg}>下载 SVG</button>
              </div>
              <p className={styles.resultFootnote}>头像在本页本地绘制；关闭或刷新页面后，结果会清除。</p>
            </div>
          )}
        </section>
      </div>

      <footer className={styles.footerNote}>
        <p>头像是命盘事实与职业信息的视觉创作，不是运势预测，也不替代八字解读。</p>
      </footer>
    </main>
  );
}
