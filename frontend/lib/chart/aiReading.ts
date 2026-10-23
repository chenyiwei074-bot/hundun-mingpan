/**
 * 把模型产出的解读对象翻成"人话章节"。
 *
 * 背景（2026-10-23 用户反馈"AI 解读乱码"）：结果页原来把 aiAnalysis 的顶层键
 * 直接当标题（meta / axes / section_01…），数组里的对象再 JSON.stringify 上屏，
 * 用户看到的是 {"title":"…","desc":"…"}。这不是编码坏，是渲染层把内部结构暴露了。
 *
 * 规则：**任何情况下都不把 JSON、字段名、英文键给用户看**。
 * - 新格式（sections:[{title, body}]）直接渲染；
 * - 旧格式（brief-analysis 的 11 个键）逐段翻译成中文标题；
 * - 认不出的结构走 humanize 扁平化，只留文字，不留括号引号。
 */

export interface ReadingSection {
  title: string;
  body: string;
}

const DIM_LABEL: Record<string, string> = {
  career: '事业',
  wealth: '财运',
  marriage: '感情',
  children: '子女',
  family: '家庭',
  health: '健康',
};

const LEVEL = (v: unknown) => (typeof v === 'string' ? v : '');

/** 去掉句末标点，便于 join 时统一补一个，避免出现「。。」「。；」 */
const trimEnd = (s: string) => s.replace(/[。；;，,、\s]+$/u, '');

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 只把文字留下来：数组用「、」连接，对象取它的值，绝不输出键名/括号/引号。 */
export function humanize(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(v => humanize(v, depth + 1)).filter(Boolean).join('、');
  }
  if (typeof value === 'object') {
    if (depth > 2) return '';
    return Object.values(value as Record<string, unknown>)
      .map(v => humanize(v, depth + 1))
      .filter(Boolean)
      .join('；');
  }
  return '';
}

function listBody(items: unknown): string {
  if (!Array.isArray(items)) return '';
  const lines: string[] = [];
  for (const it of items) {
    if (typeof it === 'string') { lines.push(it); continue; }
    if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>;
      const title = str(o.title) || str(o.point) || str(o.range) || str(o.age);
      const desc = str(o.desc) || str(o.impact) || str(o.event) || str(o.advice) || humanize(o);
      if (title && desc) lines.push(`${title}：${desc}`);
      else if (title || desc) lines.push(title || desc);
    }
  }
  return lines.join('\n');
}

function legacySections(ai: Record<string, unknown>): ReadingSection[] {
  const out: ReadingSection[] = [];
  const meta = (ai.meta || {}) as Record<string, unknown>;
  const axes = (ai.axes || {}) as Record<string, unknown>;
  const final = (ai.final || {}) as Record<string, unknown>;
  const conf = (ai.confidence || {}) as Record<string, unknown>;

  const headline = [str(meta.archetype_name), str(meta.axis_oneliner)].filter(Boolean).map(trimEnd).join('。');
  if (headline) out.push({ title: '命局速览', body: headline + '。' });

  const axisParts: string[] = [];
  if (str(axes.bazi_main)) axisParts.push(`八字：${str(axes.bazi_main)}`);
  if (str(axes.ziwei_main)) axisParts.push(`紫微：${str(axes.ziwei_main)}`);
  if (axisParts.length) out.push({ title: '双盘主线', body: axisParts.join('\n') });

  const strengths = listBody(ai.strengths);
  if (strengths) out.push({ title: '你的优势', body: strengths });
  const weaknesses = listBody(ai.weaknesses);
  if (weaknesses) out.push({ title: '需要留意', body: weaknesses });

  const s1 = (ai.section_01 || {}) as Record<string, unknown>;
  if (str(s1.text)) out.push({ title: '主轴印证', body: str(s1.text) });
  const s2 = (ai.section_02 || {}) as Record<string, unknown>;
  if (str(s2.conclusion)) out.push({ title: '阶段印证', body: str(s2.conclusion) });

  const dim = (ai.dim || {}) as Record<string, Record<string, unknown>>;
  const dimLines: string[] = [];
  for (const [key, label] of Object.entries(DIM_LABEL)) {
    const d = dim[key];
    if (!d) continue;
    const parts: string[] = [];
    if (str(d.bazi)) parts.push(`八字：${str(d.bazi)}`);
    if (str(d.ziwei)) parts.push(`紫微：${str(d.ziwei)}`);
    if (str(d.fused)) parts.push(`综合：${str(d.fused)}`);
    if (str(d.verdict)) parts.push(`结论：${str(d.verdict)}`);
    if (parts.length) dimLines.push(`${label}\n${parts.map(trimEnd).join('；')}`);
  }
  if (dimLines.length) out.push({ title: '分领域解读', body: dimLines.join('\n\n') });

  const conflicts = listBody(ai.conflicts);
  if (conflicts) out.push({ title: '两盘不一致的地方', body: conflicts });

  const finalLines: string[] = [];
  if (str(final.life_axis)) finalLines.push(str(final.life_axis));
  const nodes = listBody(final.nodes);
  if (nodes) finalLines.push(`关键节点\n${nodes}`);
  const risks = listBody(final.risks);
  if (risks) finalLines.push(`需要提前准备的阶段\n${risks}`);
  const leverage = listBody(final.leverage);
  if (leverage) finalLines.push(`可以借的力\n${leverage}`);
  const advice = listBody(final.advice);
  if (advice) finalLines.push(`行动建议\n${advice}`);
  if (finalLines.length) out.push({ title: '接下来怎么走', body: finalLines.join('\n') });

  const confLines: string[] = [];
  const baziLevel = LEVEL(conf.bazi_level);
  const ziweiLevel = LEVEL(conf.ziwei_level);
  const consLevel = LEVEL(conf.consistency_level);
  const stabLevel = LEVEL(conf.stability_level);
  if (baziLevel) confLines.push(`八字把握：${baziLevel}`);
  if (ziweiLevel) confLines.push(`紫微把握：${ziweiLevel}`);
  if (consLevel) confLines.push(`两盘一致性：${consLevel}`);
  if (stabLevel) confLines.push(`稳定度：${stabLevel}`);
  if (str(conf.note)) confLines.push(str(conf.note));
  if (str(ai.consistency)) confLines.push(str(ai.consistency));
  if (confLines.length) out.push({ title: '这份解读的依据', body: confLines.join('\n') });

  return out;
}

/** 主入口：任何 aiAnalysis 形状进来，都只出中文标题 + 正文。 */
export function aiReadingSections(aiAnalysis: unknown): ReadingSection[] {
  if (!aiAnalysis || typeof aiAnalysis !== 'object') return [];
  const ai = aiAnalysis as Record<string, unknown>;

  // 新格式：sections:[{title, body}]
  if (Array.isArray(ai.sections)) {
    const sections: ReadingSection[] = [];
    for (const raw of ai.sections) {
      if (!raw || typeof raw !== 'object') continue;
      const s = raw as Record<string, unknown>;
      const title = str(s.title) || str(s.heading);
      const body = str(s.body) || str(s.text) || str(s.content);
      if (title || body) sections.push({ title: title || '解读', body });
    }
    const summary = str(ai.summary);
    if (summary) sections.unshift({ title: '一句话总断', body: summary });
    if (sections.length) return sections;
  }

  // 旧格式（brief-analysis 的键）
  if (ai.meta || ai.axes || ai.dim || ai.final || ai.section_01) {
    const sections = legacySections(ai);
    if (sections.length) return sections;
  }

  // 兜底：扁平化所有文字，标题就叫「解读」。绝不把键名/JSON 给用户。
  const flat = humanize(ai);
  return flat ? [{ title: '解读', body: flat }] : [];
}
