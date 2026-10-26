import { enrichBazi, type BaziEnrichment } from '../core/bazi-enrich/enrich';

type Pillar = '年' | '月' | '日' | '时';
export type DirectPillar = { gan: string; zhi: string };
export type DirectPillars = Record<Pillar, DirectPillar>;

const PILLARS: Pillar[] = ['年', '月', '日', '时'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export type DirectPillarsParse = { ok: true; siZhu: DirectPillars } | { ok: false; status: number; code: 'invalid_pillars' | 'invalid_ganzhi'; error: string };

/** 严格解析仅四柱的请求：根只允许 siZhu，四柱只允许 年/月/日/时，每柱只允许 gan/zhi。 */
export function parseDirectPillars(body: unknown): DirectPillarsParse {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, code: 'invalid_pillars', error: '请求必须是只包含 siZhu 的对象。' };
  }
  const root = body as Record<string, unknown>;
  const rootKeys = Object.keys(root);
  if (rootKeys.length !== 1 || rootKeys[0] !== 'siZhu') {
    return { ok: false, status: 400, code: 'invalid_pillars', error: '请求只接受 siZhu 字段，不能包含姓名、性别、地点、visitorId 或其他字段。' };
  }
  const source = root.siZhu;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ok: false, status: 400, code: 'invalid_pillars', error: 'siZhu 必须是包含年、月、日、时四柱的对象。' };
  }
  const src = source as Record<string, unknown>;
  const srcKeys = Object.keys(src);
  const missing = PILLARS.filter(p => !srcKeys.includes(p));
  const extra = srcKeys.filter(k => !PILLARS.includes(k as Pillar));
  if (missing.length || extra.length) {
    return { ok: false, status: 400, code: 'invalid_pillars', error: `四柱必须且只能是年、月、日、时；缺少：${missing.join('、') || '无'}；多余：${extra.join('、') || '无'}。` };
  }
  const siZhu = {} as DirectPillars;
  for (const pillar of PILLARS) {
    const raw = src[pillar];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, status: 400, code: 'invalid_pillars', error: `${pillar}柱必须是包含 gan 与 zhi 的对象。` };
    }
    const keys = Object.keys(raw as Record<string, unknown>);
    if (keys.length !== 2 || !keys.includes('gan') || !keys.includes('zhi')) {
      return { ok: false, status: 400, code: 'invalid_pillars', error: `${pillar}柱只允许 gan 与 zhi 两个字段。` };
    }
    const gan = (raw as Record<string, unknown>).gan;
    const zhi = (raw as Record<string, unknown>).zhi;
    if (typeof gan !== 'string' || typeof zhi !== 'string') {
      return { ok: false, status: 400, code: 'invalid_pillars', error: `${pillar}柱的天干和地支必须是字符串。` };
    }
    const gi = GAN.indexOf(gan);
    const zi = ZHI.indexOf(zhi);
    if (gi < 0 || zi < 0) {
      return { ok: false, status: 400, code: 'invalid_ganzhi', error: `${pillar}柱包含未知天干或地支。` };
    }
    if (gi % 2 !== zi % 2) {
      return { ok: false, status: 400, code: 'invalid_ganzhi', error: `${pillar}柱不是合法的六十甲子组合。` };
    }
    siZhu[pillar] = { gan, zhi };
  }
  return { ok: true, siZhu };
}

/** 只计算增强结果；不反推生日、不生成紫微/大运，也不写库。 */
export function calculateDirectPillars(siZhu: DirectPillars): BaziEnrichment {
  return enrichBazi(siZhu as Record<Pillar, { gan: any; zhi: any }>);
}
