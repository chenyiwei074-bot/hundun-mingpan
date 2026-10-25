import { FreeModelProvider } from './ai/FreeModelProvider';
import { DeepSeekProvider } from './ai/DeepSeekProvider';
import type { AIProvider } from './ai/AIProvider';

export const AI_TOOLS = {
  meihua: '梅花易数', liuyao: '六爻纳甲', xiu: '二十八宿', hepan: '合盘对照',
  huangli: '黄历宜忌', 'name-compat': '姓名五格', numerology: '数字命理',
  moon: '月相周期', synastry: '跨盘相位', astro: '本命行星位置',
  dayun: '大运流年', fengshui: '户型九宫',
} as const;
export type AiTool = keyof typeof AI_TOOLS;
export interface ToolProfile {
  system: string;
  scope: string;
  avoid: string[];
  sections: string[];
}

/** 每个术数只讲自己的体系；跨体系不是“补充”，是冲突。 */
export const TOOL_PROFILES: Record<AiTool, ToolProfile> = {
  meihua: {
    system: '梅花易数',
    scope: '只读本卦、互卦、变卦、体用与动爻的关系，按梅花取象解释。',
    avoid: ['六爻纳甲', '世应六亲', '八字十神', '紫微斗数', '奇门遁甲', '塔罗牌义'],
    sections: ['卦象结构', '体用关系', '动爻与变卦', '适用边界'],
  },
  liuyao: {
    system: '六爻纳甲',
    scope: '只读六爻盘的世应、六亲、用神、动爻变爻、月建日辰与旬空。',
    avoid: ['梅花体用', '八字十神', '紫微斗数', '奇门遁甲', '塔罗牌义'],
    sections: ['卦与世应', '用神与六亲', '动变与月日', '结论边界'],
  },
  xiu: {
    system: '二十八宿',
    scope: '只读本命宿、宿性、吉凶意象与合宿关系，按星宿体系解释。',
    avoid: ['六爻纳甲', '八字十神', '紫微斗数', '塔罗牌义'],
    sections: ['宿性与本命', '合宿关系', '现实取用', '边界'],
  },
  hepan: {
    system: '东方双盘对照',
    scope: '只并列读取两张命盘的天干地支、十神与宫位对应，不计算匹配分。',
    avoid: ['西方合盘相位', '塔罗牌义', '六爻纳甲', '奇门遁甲'],
    sections: ['盘面结构', '对应关系', '差异与不确定', '边界'],
  },
  huangli: {
    system: '黄历通书',
    scope: '只读当日干支、宜忌、神煞与节气，说明历法信息；不把它当个人命盘判断。',
    avoid: ['八字十神', '紫微斗数', '六爻纳甲', '塔罗牌义'],
    sections: ['当日结构', '宜忌取用', '神煞说明', '边界'],
  },
  'name-compat': {
    system: '姓名五格',
    scope: '只读填写者确认的笔画、五格数、五行与生克关系；不自动猜笔画。',
    avoid: ['八字十神', '紫微斗数', '六爻纳甲', '塔罗牌义', '未核验的 81 数理吉凶表'],
    sections: ['五格结构', '五行关系', '双方对照', '边界'],
  },
  numerology: {
    system: '数字命理',
    scope: '只读出生日期化简与姓名拉丁拼写取数，展示每一步算式。',
    avoid: ['八字十神', '紫微斗数', '六爻纳甲', '塔罗牌义', '汉字自动转写'],
    sections: ['生命灵数', '姓名数', '取数解释', '边界'],
  },
  moon: {
    system: '天文月相',
    scope: '只读月相角、照亮比例、朔望时刻与时区；这是天文计算，不做个人吉凶。',
    avoid: ['黄历宜忌', '个人吉凶', '八字十神', '塔罗牌义'],
    sections: ['当前月相', '朔望周期', '时区与观测', '边界'],
  },
  synastry: {
    system: '西方跨盘相位',
    scope: '只读双方行星黄经之间的合、六分、四分、三分、对分相位与容许度。',
    avoid: ['东方合盘', '六爻纳甲', '八字十神', '紫微斗数', '塔罗牌义', '匹配分数'],
    sections: ['跨盘结构', '主要相位', '关系中的张力', '边界'],
  },
  astro: {
    system: '西方本命行星',
    scope: '只读行星落座、度数、主要相位、上升点、宫制、凯龙、交点与所选黄道参考系。',
    avoid: ['八字十神', '紫微斗数', '六爻纳甲', '塔罗牌义', '未纳入的其他宫制'],
    sections: ['本命结构', '主要相位', '宫位与轴线', '边界'],
  },
  dayun: {
    system: '八字岁运',
    scope: '只读四柱、大运、流年与十神对应，解释岁运结构；不把它写成宿命预测。',
    avoid: ['紫微斗数', '六爻纳甲', '梅花易数', '塔罗牌义'],
    sections: ['四柱与起运', '当前大运', '流年结构', '边界'],
  },
  fengshui: {
    system: '户型九宫',
    scope: '只读已确认的户型几何、房间用途、门窗、朝向与九宫判定；不把识别候选当事实。',
    avoid: ['八字十神', '紫微斗数', '六爻纳甲', '塔罗牌义', '罗盘理气未给出的数据'],
    sections: ['几何与九宫', '采光与动线', '判定强弱', '边界'],
  },
};


/** 每个工具只接受这些顶层字段；客户端多传的一律拒绝，不作为 prompt 输入。 */
export const ALLOWED_KEYS: Record<AiTool, string[]> = {
  meihua: ['method', 'dongYao', 'ben', 'hu', 'bian', 'ti', 'yong', 'relation', 'huRelation', 'bianRelation', 'huTi', 'huYong', 'readings'],
  liuyao: ['method', 'questionType', 'ganZhi', 'dayGZ', 'monthZhi', 'xunKong', 'benGua', 'bianGua', 'yaoRecords', 'naJia', 'bianNaJia', 'dongYao', 'shiYing', 'liuShen', 'analysis'],
  xiu: ['ben', 'pair'],
  hepan: ['basis', 'observations'],
  huangli: ['civil', 'lunarDate', 'ganZhi', 'yi', 'ji', 'jiShen', 'xiongSha', 'chong', 'sha', 'zhiXing', 'tianShen', 'xiu'],
  'name-compat': ['grids', 'scope'],
  numerology: ['lifePath', 'nameNumber', 'masterNumberPreserved'],
  moon: ['utcMs', 'phaseName', 'phaseAngle', 'illumination', 'nextNewMoonUtcMs', 'nextFullMoonUtcMs'],
  synastry: ['first', 'second', 'aspects'],
  astro: ['positions', 'aspects', 'houses', 'ascendant', 'midheaven', 'frame', 'nodeMode'],
  dayun: ['siZhu', 'dayMaster', 'shiShen', 'naYin', 'dayunStart', 'dayun'],
  fengshui: ['判定', '未判定', '跨宫', '朝向', '关心点', '格数', '跨度'],
};

export interface ToolInterpretation {
  mode: 'ai' | 'unavailable';
  aiReady: boolean;
  title: string;
  summary: string;
  sections: Array<{ id: string; title: string; body: string; factRefs: string[]; sourceIds: string[] }>;
  notes: string[];
}
export type AiValidation = { ok: true; tool: AiTool; payload: unknown; question: string } | { ok: false; status: number; error: string };

const allowed = new Set(Object.keys(AI_TOOLS));
const TIMEOUT_MS = Number(process.env.TOOL_AI_TIMEOUT_MS || 30000);

export function validateAiRequest(body: unknown): AiValidation {
  const b = (body || {}) as Record<string, unknown>;
  const tool = String(b.tool || '');
  if (!allowed.has(tool)) return { ok: false, status: 400, error: '这个工具暂未接入 AI 解读' };
  const question = String(b.question || '').trim().slice(0, 300);
  const payload = b.payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 400, error: '缺少工具结果数据' };
  }
  const keys = Object.keys(payload as Record<string, unknown>);
  const allow = ALLOWED_KEYS[tool as AiTool];
  const extras = keys.filter(k => !allow.includes(k));
  if (extras.length) return { ok: false, status: 400, error: '结果里包含不允许的字段：' + extras.slice(0, 5).join('、') };
  let text = '';
  try { text = JSON.stringify(payload); } catch { return { ok: false, status: 400, error: '结果数据无法解析' }; }
  if (text.length > 40_000) return { ok: false, status: 413, error: '结果数据过大' };
  return { ok: true, tool: tool as AiTool, payload, question };
}

export function promptFor(tool: AiTool, payload: unknown, question: string): string {
  const p = TOOL_PROFILES[tool];
  return `你是「混沌自研 AI」的${p.system}辅助解读层。你只能解释下面这份由本站规则算出的结果，不能重算、不能改数、不能补造原文/页码/来源。
本页体系：${p.system}
本页范围：${p.scope}
明确禁止混入：${p.avoid.join('、')}。如果用户问题要求用其他体系，请直接说明“本页只做${p.system}，不跨体系下结论”，不要借用其他术数。
本工具允许引用的字段：${ALLOWED_KEYS[tool].join('、')}
用户问题：${question || '（未填写，做整体解读）'}
本站已计算的结果数据（只读）：
${JSON.stringify(payload).slice(0, 30000)}

请只输出严格 JSON（不要 Markdown/代码块）：
{
  "title": "6-18 字的解读标题",
  "summary": "180-320 字总述，先回答用户问题；明确哪些是已算出的，哪些无法从这份数据判断",
  "sections": [
    { "title": "小标题", "body": "80-180 字，必须对应上面的具体字段，不得添加未给出的数字" }
  ],
  "notes": ["1-3 句边界说明"]
}
约束：
- sections 必须 3-5 节，建议围绕：${p.sections.join(' / ')}；
- 数据不足就写“这份数据不足以判断”，不要编造；
- 不预测必然发生的事，不给医疗/投资/法律结论；
- 不出现任何模型或供应商名称；
- 不声称引用古籍原文，除非输入数据里本来就有可核验来源；没有就写“本站自研”；
- 不把本页结果与其他术数互相印证或互相否定；
- 用中文，直接对用户说话，不写“作为 AI”。`;
}

function normalize(raw: Record<string, unknown>): ToolInterpretation | null {
  const summary = String(raw.summary || '').trim();
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((s, index) => {
      const x = s as Record<string, unknown>;
      return {
        id: 'section-' + String(index + 1),
        title: String(x.title || '').trim(),
        body: String(x.body || x.text || '').trim(),
        factRefs: [] as string[],
        sourceIds: [] as string[],
      };
    }).filter(s => s.title && s.body).slice(0, 5)
    : [];
  if (!summary || summary.length < 80 || sections.length < 3) return null;
  const notes = Array.isArray(raw.notes) ? raw.notes.map(String).filter(Boolean).slice(0, 3) : [];
  return {
    mode: 'ai', aiReady: true, title: String(raw.title || '混沌自研 AI 解读').trim().slice(0, 30),
    summary, sections, notes: [...notes, 'AI 解读不等同于计算结果，仅供传统文化参考。'],
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('tool-ai-timeout')), ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function interpretTool(input: { tool: AiTool; payload: unknown; question: string }): Promise<ToolInterpretation> {
  const providers: AIProvider[] = [new FreeModelProvider(), new DeepSeekProvider()];
  for (const provider of providers) {
    try {
      if (!(await provider.isAvailable())) continue;
      const response = await withTimeout(provider.generateAnalysis({
        chartData: { tool: input.tool, result: input.payload },
        type: 'tool-interpretation',
        promptOverride: promptFor(input.tool, input.payload, input.question),
        maxTokens: 2000,
      }), TIMEOUT_MS);
      const normalized = normalize(response.result);
      if (normalized) return normalized;
      console.warn('[ai-interpret] 输出不完整，尝试下一个 provider');
    } catch (err) {
      console.warn('[ai-interpret] provider failed:', err instanceof Error ? err.message : err);
    }
  }
  return {
    mode: 'unavailable', aiReady: false, title: 'AI 解读暂不可用', summary: '',
    sections: [], notes: ['综合 AI 解读暂时不可用；上方规则结果仍然有效，AI 未参与本次解读。'],
  };
}
