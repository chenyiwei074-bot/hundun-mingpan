/**
 * 命盘职业头像：只把排盘事实整理成“可解释的视觉主题参数”。
 * 不画图、不调用任何生图/文本模型、不写数据库、不记录输入正文。
 *
 * 复用现有 generateChart 的八字排盘链路（节气、区县坐标、时区、历史夏令时、
 * 真太阳时）。generateChart 的既有入参需要 gender；本功能的公开请求不接收性别，
 * 这里只用它的四柱/日主/十神事实，不读取或返回大运方向等依赖性别的字段。
 */
import { z } from 'zod';
import { generateChart } from './chart.service';
import { lookupGeoV2 } from './geo.service';

const ELEMENT_OF: Record<string, { element: string; label: string }> = {
  甲: { element: 'wood', label: '木' }, 乙: { element: 'wood', label: '木' },
  丙: { element: 'fire', label: '火' }, 丁: { element: 'fire', label: '火' },
  戊: { element: 'earth', label: '土' }, 己: { element: 'earth', label: '土' },
  庚: { element: 'metal', label: '金' }, 辛: { element: 'metal', label: '金' },
  壬: { element: 'water', label: '水' }, 癸: { element: 'water', label: '水' },
};

const PALETTES: Record<string, { background: string; base: string; accent: string; highlight: string }> = {
  wood: { background: '#1F2A22', base: '#5D7355', accent: '#C8B56A', highlight: '#F0DF9C' },
  fire: { background: '#28191C', base: '#745048', accent: '#D9B875', highlight: '#F2D89B' },
  earth: { background: '#2A2118', base: '#7A5E42', accent: '#C9A35E', highlight: '#F0D7A5' },
  metal: { background: '#1E2226', base: '#5C6268', accent: '#CBB77A', highlight: '#F3E2B2' },
  water: { background: '#17232C', base: '#3F5F6B', accent: '#A9C4C8', highlight: '#E2F0EF' },
};

const THEME = 'dawn-mountain-path';
const MOTIFS = ['sunrise', 'mountain', 'ascending_path'] as const;

export const AvatarBriefSchema = z.object({
  calendar: z.enum(['公历', '农历']),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
  isLeapMonth: z.boolean().optional().default(false),
  birthPlace: z.string().trim().min(3).max(80),
  occupation: z.string().trim().min(2).max(40).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  consent: z.literal(true),
}).strict();

export type AvatarBriefInput = z.infer<typeof AvatarBriefSchema>;

export type AvatarBrief = {
  concept: {
    title: string;
    plainSummary: string;
    visual: {
      theme: typeof THEME;
      palette: { background: string; base: string; accent: string; highlight: string };
      motifs: readonly string[];
      composition: string;
    };
    meaning: Array<{ motif: string; label: string; plainText: string }>;
    basisNote: string;
  };
  chartSummary: Record<string, string>;
};

export type AvatarBriefResult =
  | { ok: true; data: AvatarBrief }
  | { ok: false; status: number; code: string; error: string };

function occupationKind(value: string): 'builder' | 'maker' | 'guide' | 'creator' | 'other' {
  const text = value.toLowerCase();
  if (/创业|经营|管理|市场|销售|商务|商业|项目/.test(text)) return 'builder';
  if (/技术|工程|研究|产品|开发|数据|分析|科学/.test(text)) return 'maker';
  if (/教育|教师|培训|咨询|医护|医生|护理|照护|公益/.test(text)) return 'guide';
  if (/设计|创作|艺术|媒体|内容|写作|摄影|音乐/.test(text)) return 'creator';
  return 'other';
}

function titleFor(element: string, kind: ReturnType<typeof occupationKind>, occupation: string): string {
  if (kind === 'builder') return '稳步登峰';
  if (kind === 'maker') return '沿脊开路';
  if (kind === 'guide') return '沿路点灯';
  if (kind === 'creator') return '向光取景';
  if (element === 'wood') return '向林而行';
  if (element === 'fire') return '向阳而行';
  if (element === 'earth') return '稳步成峰';
  if (element === 'metal') return '沿脊而上';
  if (element === 'water') return '沿河向远';
  return occupation.length > 5 ? '向远而行' : '稳步向前';
}

function summaryFor(elementLabel: string, occupation: string, kind: ReturnType<typeof occupationKind>): string {
  const kindText = kind === 'builder' ? '把已有能力变成可持续的成果'
    : kind === 'maker' ? '把复杂问题拆成可复用的步骤'
    : kind === 'guide' ? '把经验整理成能帮助别人的路径'
    : kind === 'creator' ? '保持观察，并把感受变成表达'
    : '在长期积累中找到可持续的方向';
  return `这组画面把“日主属${elementLabel}”的排盘事实，和你填写的“${occupation}”放在同一条山路上：先稳住基础，再${kindText}。它是命盘与职业的视觉创作，不是运势判断。`;
}

export function buildAvatarBrief(raw: unknown): AvatarBriefResult {
  const parsed = AvatarBriefSchema.safeParse(raw);
  if (!parsed.success) {
    // consent 缺失/为 false 时给独立错误码，便于前端显示“先同意”。
    const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    if (candidate.consent !== true) return { ok: false, status: 400, code: 'consent_required', error: '请先确认本次头像创作的数据用途。' };
    if (typeof candidate.occupation !== 'string' || candidate.occupation.trim().length < 2 || candidate.occupation.trim().length > 40) {
      return { ok: false, status: 400, code: 'invalid_occupation', error: '请填写职业，长度控制在 2–40 个字。' };
    }
    return { ok: false, status: 400, code: 'invalid_birth_info', error: '请检查出生日期、时间和地点。' };
  }
  const input = parsed.data;
  if (input.calendar === '公历' && input.isLeapMonth) {
    return { ok: false, status: 400, code: 'invalid_birth_info', error: '公历出生资料不能标记闰月。' };
  }
  const [year, month, day] = input.birthday.slice(0, 10).split('-').map(Number);
  const [hour, minute] = input.birthday.slice(11).split(':').map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, status: 400, code: 'invalid_birth_info', error: '请检查出生日期、时间和地点。' };
  }
  const parts = String(input.birthPlace || '').trim().split(/\s+/).filter(Boolean);
  const preciseGeo = parts.length === 3 ? lookupGeoV2({ province: parts[0], city: parts[1], district: parts[2] }) : null;
  if (parts.length !== 3 || !preciseGeo || !preciseGeo.districtMatched) {
    return { ok: false, status: 400, code: 'invalid_birth_info', error: '出生地点需要完整的省、市、区/县，且区县能在本站地点库中精确查到。' };
  }

  let chart: any;
  try {
    // gender 仅为满足现有 generateChart 的既有签名；本功能的主题只读四柱/日主/十神，
    // 不读取大运方向，也不把性别返回给前端。
    chart = generateChart({
      visitor_id: 'avatar-brief', name: 'avatar-brief', gender: '男',
      calendar: input.calendar, birthday: input.birthday, isLeapMonth: input.isLeapMonth,
      birthPlace: input.birthPlace, currentPlace: '',
      persona: 'standard', depth: 'brief',
    });
  } catch {
    return { ok: false, status: 400, code: 'invalid_birth_info', error: '这组出生资料暂时无法排盘，请核对日期、时间和地点。' };
  }
  const bazi = chart?.bazi;
  const siZhu = bazi?.siZhu;
  if (!siZhu?.year || !siZhu?.month || !siZhu?.day || !siZhu?.hour || typeof bazi.dayMaster !== 'string') {
    return { ok: false, status: 503, code: 'calculation_unavailable', error: '排盘暂时不可用，请稍后再试。' };
  }
  const dayMaster = bazi.dayMaster;
  const element = ELEMENT_OF[dayMaster] || ELEMENT_OF['戊'];
  const kind = occupationKind(input.occupation);
  const title = titleFor(element.element, kind, input.occupation);
  const summary = summaryFor(element.label, input.occupation, kind);
  const palette = PALETTES[element.element] || PALETTES.earth;
  const monthGod = typeof bazi.shiShen?.month === 'string' ? bazi.shiShen.month : '';
  const chartSummary = {
    year: `${siZhu.year.gan}${siZhu.year.zhi}`,
    month: `${siZhu.month.gan}${siZhu.month.zhi}`,
    day: `${siZhu.day.gan}${siZhu.day.zhi}`,
    hour: `${siZhu.hour.gan}${siZhu.hour.zhi}`,
    dayMaster: `${dayMaster}${element.label}`,
  };
  return {
    ok: true,
    data: {
      concept: {
        title,
        plainSummary: summary,
        visual: {
          theme: THEME,
          palette,
          motifs: [...MOTIFS],
          composition: '太阳从山后升起，一条金色路径从近处穿过山谷，向山峰延伸。',
        },
        meaning: [
          { motif: 'mountain', label: '山峰', plainText: `山峰表示把“${element.label}”日主的基础放在长期积累上；这是视觉比喻，不是命定高度。` },
          { motif: 'sunrise', label: '朝阳', plainText: `朝阳表示职业“${input.occupation}”所对应的持续方向；它只是画面中的方向感，不代表运势上升。` },
          { motif: 'ascending_path', label: '上行路径', plainText: '上行路径表示把已有能力拆成可执行的步骤；这是本站的视觉叙事，不是结果预测。' },
        ],
        basisNote: `视觉创作参考了本站排盘的四柱（${chartSummary.year} ${chartSummary.month} ${chartSummary.day} ${chartSummary.hour}）、日主${chartSummary.dayMaster}${monthGod ? `、月干十神${monthGod}` : ''}以及职业“${input.occupation}”，不构成运势判断。`,
      },
      chartSummary,
    },
  };
}
