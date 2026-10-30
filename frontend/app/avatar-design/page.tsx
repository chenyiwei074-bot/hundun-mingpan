'use client';

import { useMemo, useRef, useState, type FormEvent, type Ref } from 'react';
import Link from 'next/link';
import styles from './avatar-design.module.css';
import { provinces } from '@/app/lib/region-data';
import { getVisitorId } from '@/lib/auth/visitor';
import { TIANGAN_WUXING } from '@/app/lib/core/yiqi-core/ganzhi';

type Calendar = '公历' | '农历';
type Wuxing = '木' | '火' | '土' | '金' | '水';
type CareerMark = 'venture' | 'creative' | 'knowledge' | 'technical' | 'care' | 'craft' | 'general';
type AvatarBrief = {
  concept: { basisNote?: string };
  chartSummary: { year?: string; month?: string; day?: string; hour?: string; dayMaster: string };
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

const ELEMENT_STYLE: Record<Wuxing, { label: string; imageMeaning: string; background: string; base: string; accent: string; highlight: string }> = {
  木: { label: '木 · 生长', imageMeaning: '枝干向上舒展，表达持续生长。', background: '#17261F', base: '#496B55', accent: '#91B982', highlight: '#E7EBC3' },
  火: { label: '火 · 光亮', imageMeaning: '日轮与火焰成为画面的中心。', background: '#291619', base: '#813E34', accent: '#E07849', highlight: '#FFE4A5' },
  土: { label: '土 · 根基', imageMeaning: '层叠山体表达稳固的基础。', background: '#282119', base: '#796047', accent: '#C49D66', highlight: '#F1DDB0' },
  金: { label: '金 · 锻造', imageMeaning: '圆环与切面表达清晰、利落的造型。', background: '#1E2226', base: '#5C6268', accent: '#CBB77A', highlight: '#F3E2B2' },
  水: { label: '水 · 流动', imageMeaning: '水纹与河道构成画面的主要走向。', background: '#141E2A', base: '#3F6278', accent: '#70B4BF', highlight: '#D8E9E7' },
};

const CAREER_STYLE: Record<CareerMark, { label: string; meaning: string }> = {
  venture: { label: '经营开拓', meaning: '阶梯形建筑代表把计划逐步落地。' },
  creative: { label: '创作表达', meaning: '笔锋与色带代表创意的形成和表达。' },
  knowledge: { label: '知识传递', meaning: '展开的书页代表学习、研究与分享。' },
  technical: { label: '技术建造', meaning: '圆规与结构线代表设计、推演和建造。' },
  care: { label: '支持服务', meaning: '灯与叶片代表照料、支持和服务。' },
  craft: { label: '手艺实践', meaning: '工具与材料形状代表动手制作。' },
  general: { label: '职业印记', meaning: '以职业首字作为个人识别印记。' },
};

function getWuxing(dayMaster?: string): Wuxing | null {
  const stem = Array.from(dayMaster || '')[0] || '';
  const value = TIANGAN_WUXING[stem as keyof typeof TIANGAN_WUXING];
  return value && ['木', '火', '土', '金', '水'].includes(value) ? value as Wuxing : null;
}

function getCareerMark(occupation: string): CareerMark {
  const value = occupation.replace(/\s/g, '').toLowerCase();
  if (['创业', '老板', '企业', '经营', '商业', '管理', '运营', '销售', '金融', '投资', '市场'].some(word => value.includes(word))) return 'venture';
  if (['设计', '艺术', '美术', '摄影', '写作', '作家', '文案', '媒体', '导演', '创意', '插画', '音乐', '创作者'].some(word => value.includes(word))) return 'creative';
  if (['教师', '老师', '教育', '培训', '研究', '学者', '讲师', '教授', '学校', '导师'].some(word => value.includes(word))) return 'knowledge';
  if (['工程', '技术', '程序', '开发', '科技', '数据', '建筑', '制造', '工程师', '产品经理'].some(word => value.includes(word))) return 'technical';
  if (['医生', '医疗', '护士', '护理', '心理', '社工', '律师', '法律', '服务', '公益', '咨询'].some(word => value.includes(word))) return 'care';
  if (['厨师', '餐饮', '烘焙', '手艺', '工艺', '维修', '木工', '装修', '园艺'].some(word => value.includes(word))) return 'craft';
  return 'general';
}

function getOccupationStamp(occupation: string): string {
  return Array.from(occupation.replace(/\s/g, '').trim()).slice(0, 2).join('') || '职';
}

function getAvatarSummary(occupation: string, dayMaster: string | undefined, element: Wuxing | null, careerMark: CareerMark): string {
  const chartText = dayMaster && element
    ? `排盘结果中的日主是${dayMaster}，本图据此采用${element}行的形态与配色。`
    : '本图根据排盘主题采用对应的视觉形态与配色。';
  return `${chartText}职业「${occupation.trim()}」以${CAREER_STYLE[careerMark].label}图形呈现。这里只说明图形如何对应输入，不代表职业评价或运势判断。`;
}

function getOccupationHash(value: string): number {
  return Array.from(value).reduce((hash, char) => ((hash * 31) + char.codePointAt(0)!) >>> 0, 7);
}

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
  if (!data.concept || !data.chartSummary || !getWuxing(data.chartSummary.dayMaster)) {
    throw new Error('排盘主题信息不完整，暂时无法生成专属头像。');
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

function AvatarIllustration({ brief, occupation, svgRef }: { brief: AvatarBrief; occupation: string; svgRef: Ref<SVGSVGElement> }) {
  const element = getWuxing(brief.chartSummary.dayMaster);
  if (!element) return null;
  const elementStyle = ELEMENT_STYLE[element];
  const careerMark = getCareerMark(occupation);
  const careerInitial = Array.from(occupation.trim())[0] || '业';
  const careerStamp = getOccupationStamp(occupation);
  const occupationHash = getOccupationHash(occupation.trim());
  const sealShape = occupationHash % 3;
  const background = elementStyle.background;
  const base = elementStyle.base;
  const accent = elementStyle.accent;
  const highlight = elementStyle.highlight;
  return (
    <svg
      ref={svgRef}
      className={styles.avatarSvg}
      viewBox="0 0 512 512"
      role="img"
      aria-labelledby="avatar-svg-title avatar-svg-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="avatar-svg-title">{occupation} · {element ? ELEMENT_STYLE[element].label : '命盘'}职业头像</title>
      <desc id="avatar-svg-desc">{elementStyle.imageMeaning}职业符号：{CAREER_STYLE[careerMark].label}，职业印记为{careerStamp}</desc>
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
        <linearGradient id="avatar-mountain" x1="0" y1="0" x2=".75" y2="1">
          <stop offset="0" stopColor={base} />
          <stop offset="1" stopColor={background} />
        </linearGradient>
      </defs>
      <g clipPath="url(#avatar-circle)">
        <rect width="512" height="512" fill="url(#avatar-sky)" />
        <circle cx="256" cy="214" r="142" fill={accent} opacity=".12" className={styles.sunAura} />
        {element === '木' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
          <path d="M256 392V139M256 218c-42-12-70-39-82-78 39 4 67 22 82 56M256 260c42-12 70-39 82-78-39 4-67 22-82 56M256 310c-31-6-55-22-72-50 33-2 57 8 72 31M256 333c31-6 55-22 72-50-33-2-57 8-72 31" strokeWidth="10" />
          <path d="M256 171c-18-23-20-47-7-71 22 20 31 43 24 68" fill={accent} strokeWidth="3" />
          <path d="M173 143c21-3 38 6 51 24-23 4-40-4-51-24ZM339 183c-21-3-38 6-51 24 23 4 40-4 51-24Z" fill={accent} strokeWidth="2" />
        </g>}
        {element === '火' && <g className={styles.sunDisc}>
          <circle cx="256" cy="232" r="82" fill="url(#avatar-sun)" />
          <path d="M256 178c32 33 8 51 0 70-9-19-32-37 0-70ZM210 222c18 17 8 31 4 43-11-12-22-25-4-43ZM302 222c-18 17-8 31-4 43 11-12 22-25 4-43Z" fill={highlight} opacity=".78" />
          <circle cx="256" cy="232" r="96" fill="none" stroke={highlight} strokeWidth="2" opacity=".55" />
        </g>}
        {element === '土' && <g>
          <path d="M42 372 126 287l42 35 88-130 85 126 39-46 100 101v150H42z" fill="url(#avatar-mountain)" />
          <path d="m126 287 42 35 88-130 85 126M73 408c82-25 148-18 204 1 67 23 126 20 201-8" fill="none" stroke={accent} strokeWidth="3" opacity=".84" />
          <path d="M111 420h290M149 438h214" stroke={highlight} strokeWidth="2" opacity=".5" />
          <circle cx="256" cy="187" r="41" fill="url(#avatar-sun)" opacity=".9" />
        </g>}
        {element === '金' && <g>
          <circle cx="256" cy="231" r="112" fill="none" stroke={accent} strokeWidth="4" opacity=".86" />
          <circle cx="256" cy="231" r="91" fill="none" stroke={highlight} strokeWidth="1.5" opacity=".56" />
          <path d="M213 188h86v86h-86z" fill="url(#avatar-sun)" />
          <path d="M239 214h34v34h-34z" fill={background} />
          <path d="M256 99v28M256 335v28M124 231h28M360 231h28M164 139l20 20M328 303l20 20M348 139l-20 20M184 303l-20 20" stroke={highlight} strokeWidth="3" strokeLinecap="round" opacity=".82" />
        </g>}
        {element === '水' && <g fill="none" strokeLinecap="round">
          <circle cx="256" cy="193" r="61" fill="url(#avatar-sun)" stroke={highlight} strokeWidth="2" />
          <path d="M0 306c73-39 141-36 208 2 54 31 103 31 156-1 51-30 100-33 148-9M-8 346c68-32 130-29 189 4 58 33 112 33 171-1 54-31 107-31 173 2M-10 389c70-30 127-27 184 4 62 34 120 34 183-2 53-30 100-29 165-1" stroke={accent} strokeWidth="8" opacity=".8" />
          <path d="M258 249c-17 30-35 47-41 71-6 24 9 38 32 45 27-7 40-23 34-47-4-19-15-38-25-69z" fill={highlight} opacity=".72" />
        </g>}
        {element === '木' && <g fill="none" stroke={accent} strokeLinecap="round" opacity=".8">
          <path d="M256 364c-2 49-38 58-66 91m66-65c12 40 48 51 73 87m-101-47c-39 3-61 23-84 50m151-40c39 4 58 24 79 48" strokeWidth="5" />
        </g>}
        {element === '火' && <g fill={accent} opacity=".68">
          <path d="M0 512c41-62 67-70 98-34 26-61 54-88 88-50 23-78 48-106 70-64 27-63 56-64 82-6 23-47 53-41 82 7 32-33 61-17 92 27v120z" />
          <path d="M100 512c35-39 59-45 80-18 31-57 48-70 71-31 30-48 58-48 83-7 32-34 59-22 82 14v42z" fill={highlight} opacity=".42" />
        </g>}
        {element === '土' && <g fill="none" stroke={accent} strokeLinecap="round" opacity=".82">
          <path d="M42 407c76-36 151-37 214-3 71 39 142 37 214-1M55 442c74-27 137-26 197 5 67 34 133 32 205-3M87 478c67-18 119-13 169 12 53 26 107 24 166-5" strokeWidth="5" />
        </g>}
        {element === '金' && <g fill="none" stroke={accent} opacity=".82">
          <path d="m50 480 206-102 206 102M80 512l176-86 176 86M120 512l136-66 136 66" strokeWidth="4" />
          <path d="M58 407h396M93 428h326" stroke={highlight} strokeWidth="1.5" opacity=".65" />
        </g>}
        {element === '水' && <g fill="none" stroke={accent} strokeLinecap="round" opacity=".85">
          <path d="M-10 407c76-38 138-35 201 2s123 41 187 2 112-40 144-21M-10 449c76-38 138-35 201 2s123 41 187 2 112-40 144-21M-10 491c76-38 138-35 201 2s123 41 187 2 112-40 144-21" strokeWidth="7" />
        </g>}
        <g transform="translate(364 350)">
          {sealShape === 0 && <circle r="82" fill={background} stroke={accent} strokeWidth="5" />}
          {sealShape === 1 && <path d="M0-89 77-45 77 45 0 89-77 45-77-45z" fill={background} stroke={accent} strokeWidth="5" />}
          {sealShape === 2 && <path d="M0-89 82 0 0 89-82 0z" fill={background} stroke={accent} strokeWidth="5" />}
          <circle r="68" fill="none" stroke={highlight} strokeWidth="1.5" opacity=".68" />
          <g transform="scale(1.35)">
          {careerMark === 'venture' && <g fill={highlight}>
            <path d="M-25 21h50v8h-50zM-18 7h17v11h-17zM4-8h18v33H4zM-18-16h17v19h-17z" />
            <path d="M-22-23v-5m22 6v-8m21 6v-5" stroke={highlight} strokeWidth="3" />
          </g>}
          {careerMark === 'creative' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
            <path d="m-21 18 30-34 13 12-31 30-13 4z" strokeWidth="5" />
            <path d="M-25-18c9-8 18-8 27 0M-11 24c10-6 20-6 30 0" strokeWidth="2" />
          </g>}
          {careerMark === 'knowledge' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
            <path d="M-27-18c12-4 21-1 27 7 6-8 15-11 27-7v39c-12-4-21-1-27 7-6-8-15-11-27-7z" strokeWidth="3" />
            <path d="M0-10v37m-19-18h12m14 0h12" strokeWidth="2" />
          </g>}
          {careerMark === 'technical' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
            <circle r="17" strokeWidth="3" /><circle r="5" strokeWidth="3" />
            <path d="M0-30v8m0 44v8m-30-30h8m44 0h8m-41-21 6 6m30 30 6 6m0-42-6 6m-30 30-6 6" strokeWidth="4" />
          </g>}
          {careerMark === 'care' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
            <path d="M0 23V-1m0 1c-18-2-25-13-22-25 14 1 22 8 22 25m0 0c1-18 9-26 23-27 2 13-5 25-23 27" strokeWidth="3" />
            <path d="M-14 25h28" strokeWidth="3" />
          </g>}
          {careerMark === 'craft' && <g fill="none" stroke={highlight} strokeLinecap="round" strokeLinejoin="round">
            <path d="m-18 17 25-25m-6-14 15 15-8 8-15-15zM-24 24l9-3" strokeWidth="4" />
            <path d="M-24-22h8m-4-4v8" strokeWidth="2" />
          </g>}
          {careerMark === 'general' && <text x="0" y="11" textAnchor="middle" fill={highlight} fontFamily="serif" fontSize="32" fontWeight="600">{careerInitial}</text>}
          </g>
          <path d="M-31 48h62" stroke={highlight} strokeWidth="1" opacity=".6" />
          <text x="0" y="65" textAnchor="middle" fill={highlight} fontFamily="serif" fontSize="13" fontWeight="600" letterSpacing="2">{careerStamp}</text>
        </g>
        {[0, 1, 2].map(index => {
          const angle = ((occupationHash % 360) + index * 120) * Math.PI / 180;
          const x = 256 + Math.cos(angle) * 190;
          const y = 256 + Math.sin(angle) * 190;
          return <circle key={index} cx={x} cy={y} r={index === occupationHash % 3 ? 5 : 2.5} fill={index === occupationHash % 3 ? highlight : accent} opacity=".9" />;
        })}
      </g>
      <circle cx="256" cy="256" r="236" fill="none" stroke={accent} strokeWidth="7" />
      <circle cx="256" cy="256" r="225" fill="none" stroke={highlight} strokeWidth="1.2" opacity=".62" />
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
  const element = useMemo(() => getWuxing(brief?.chartSummary?.dayMaster), [brief?.chartSummary?.dayMaster]);
  const elementStyle = useMemo(() => element ? ELEMENT_STYLE[element] : null, [element]);
  const careerMark = useMemo(() => getCareerMark(form.occupation), [form.occupation]);

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
              <div className={styles.elementOrbit} aria-hidden="true">{(['木', '火', '土', '金', '水'] as Wuxing[]).map(item => <span key={item} data-element={item}>{item}</span>)}</div>
              <p className={styles.outputEyebrow}>主题预览</p>
              <h2>按你的五行与职业组合构图</h2>
              <p>日主五行会改变主画面，职业会改变识别符号。图形含义会用白话标明。</p>
              <div className={styles.emptyLegend}><span>五行主画面</span><span>职业识别符号</span><span>本地绘制下载</span></div>
            </div>
          )}

          {brief && (
            <div className={styles.resultState}>
              <div className={styles.resultHeading}>
                <div>
                  <p className={styles.outputEyebrow}>根据本次输入绘制</p>
                  <h2>{form.occupation.trim()} × {element ? `${element}行` : '命盘'}视觉</h2>
                  <p className={styles.inspirationTitle}>{elementStyle?.label || '命盘意象'} · {CAREER_STYLE[careerMark].label} · 印记「{getOccupationStamp(form.occupation)}」</p>
                </div>
                <button className={styles.textButton} type="button" onClick={resetAll}>重新填写</button>
              </div>

              <div className={styles.previewStage}>
                <div className={styles.avatarFrame}>
                  <AvatarIllustration brief={brief} occupation={form.occupation} svgRef={svgRef} />
                </div>
                <p className={styles.composition}>{element ? ELEMENT_STYLE[element].imageMeaning : '排盘主题图形'} 职业「{form.occupation.trim()}」以{CAREER_STYLE[careerMark].label}图形呈现。</p>
              </div>

              <div className={styles.interpretationCard}>
                <p className={styles.cardLabel}>这张图怎么对应你的输入</p>
                <p className={styles.summary}>{getAvatarSummary(form.occupation, brief.chartSummary?.dayMaster, element, careerMark)}</p>
                <ul className={styles.meaningList}>
                  <li><strong>{element ? `${element}行图形` : '命盘图形'}</strong><span>{element ? ELEMENT_STYLE[element].imageMeaning : '按主题方案绘制命盘视觉意象。'} 这只是视觉映射，不代表五行喜忌或运势判断。</span></li>
                  <li><strong>{CAREER_STYLE[careerMark].label}</strong><span>{CAREER_STYLE[careerMark].meaning}</span></li>
                </ul>
                {brief.concept.basisNote && <p className={styles.basisNote}>{brief.concept.basisNote}</p>}
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
