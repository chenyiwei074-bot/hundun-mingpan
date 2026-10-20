/**
 * 户型图识别：把一张上传的户型平面图交给视觉模型，产出"候选几何"。
 * 只出候选，不下结论——用户必须在 2D 编辑器里确认，之后才进规则层与 3D。
 *
 * 口径（2026-10-20 裁定）：
 *  - 不新增依赖：Node 22 自带 fetch；校验用已装的 zod。
 *  - 供应商顺序：VISION_* 显式配置 > FREE（智谱 GLM-4V-Flash）> DeepSeek。
 *    每个供应商各自限时，整体不超过 ~110s（nginx 那边给 120s）。
 *  - 返回的坐标一律归一化到 0..1（相对图片），单位换算留给前端。
 */
import { z } from 'zod';

export type VisionProviderName = 'glm-4v' | 'deepseek' | 'custom';

export interface RecognizedPlan {
  rooms: Array<{ name: string; polygon: Array<[number, number]>; confidence: number }>;
  walls: Array<Array<[number, number]>>;
  doors: Array<{ x: number; y: number; width: number; confidence: number }>;
  windows: Array<{ x: number; y: number; width: number; confidence: number }>;
  notes: string[];
  provider: VisionProviderName;
  model: string;
  latencyMs: number;
}

export interface VisionOutcome {
  ok: boolean;
  plan?: RecognizedPlan;
  code?: 'not_floorplan' | 'provider_error' | 'timeout' | 'bad_json' | 'no_provider';
  message?: string;
  attempts: Array<{ provider: VisionProviderName; ok: boolean; ms: number; error?: string }>;
}

const Point = z.tuple([z.number(), z.number()]);
const Room = z.object({
  name: z.string().min(1).max(12),
  polygon: z.array(Point).min(3).max(24),
  confidence: z.number().min(0).max(1),
});
const Opening = z.object({
  x: z.number(), y: z.number(),
  width: z.number().min(0).max(3),
  confidence: z.number().min(0).max(1),
});
const PlanSchema = z.object({
  ok: z.boolean().optional(),
  reason: z.string().optional(),
  rooms: z.array(Room).max(24).default([]),
  walls: z.array(z.array(Point).min(2).max(8)).max(160).default([]),
  doors: z.array(Opening).max(24).default([]),
  windows: z.array(Opening).max(24).default([]),
  notes: z.array(z.string().max(120)).max(8).default([]),
});

const PROMPT = `你是户型平面图的几何提取器。输入是一张俯视户型图（可能是开发商户型图、手绘平面图或扫描件）。
只输出一个 JSON 对象，不要解释：
{"ok":true,"rooms":[{"name":"客厅","polygon":[[0.12,0.20],[0.55,0.20],[0.55,0.62],[0.12,0.62]],"confidence":0.86}],
 "walls":[[[0.10,0.18],[0.57,0.18]],[[0.57,0.18],[0.57,0.64]]],
 "doors":[{"x":0.32,"y":0.20,"width":0.08,"confidence":0.8}],
 "windows":[{"x":0.14,"y":0.62,"width":0.16,"confidence":0.75}],
 "notes":["主卧门朝走廊"]}
规则：
1) 所有坐标归一化到图片宽高（左上角 0,0，右下角 1,1），不要用像素。
2) rooms 给每个封闭房间一个多边形（3~12 个顶点，顺时针或逆时针都可）；name 用图上文字，看不清就写"房间1"。
3) walls 给可见墙体线段（每段一条折线，最多 8 个点）。doors/windows 给中心点与宽度（归一化，宽度相对图片宽度）。
4) 认不出是户型图时输出 {"ok":false,"reason":"not_floorplan"}，不要编造。
5) 不确定的地方写进 notes；不要输出任何评分、吉凶或建议。`;

class TimeoutError extends Error {}

async function callOnce(opts: {
  baseUrl: string; apiKey: string; model: string; provider: VisionProviderName;
  imageDataUrl: string; timeoutMs: number; maxTokens: number;
}): Promise<{ raw: string; ms: number }> {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await fetch(opts.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.2,
        max_tokens: opts.maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: opts.imageDataUrl } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content || '';
    return { raw, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): unknown {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json object');
  return JSON.parse(t.slice(start, end + 1));
}

export async function recognizeFloorPlan(imageDataUrl: string, opts?: { timeoutMs?: number }): Promise<VisionOutcome> {
  const deadline = Date.now() + (opts?.timeoutMs ?? 110000);
  const candidates: Array<{
    provider: VisionProviderName; baseUrl: string; apiKey: string; model: string; maxTokens: number;
  }> = [];
  if (process.env.VISION_API_KEY && process.env.VISION_MODEL) {
    candidates.push({
      provider: 'custom', apiKey: process.env.VISION_API_KEY,
      baseUrl: process.env.VISION_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.VISION_MODEL, maxTokens: 2048,
    });
  }
  if (process.env.FREE_AI_API_KEY) {
    candidates.push({
      provider: 'glm-4v', apiKey: process.env.FREE_AI_API_KEY,
      baseUrl: process.env.FREE_AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      model: process.env.VISION_FREE_MODEL || 'glm-4v-flash',
      // 智谱 v4 chat completions 对 max_tokens 的上限是 1024（超了直接 1210 报错）
      maxTokens: 1024,
    });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    candidates.push({
      provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.VISION_DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      maxTokens: 2048,
    });
  }
  if (!candidates.length) {
    return { ok: false, code: 'no_provider', message: '没配置视觉模型（VISION_* / FREE_AI_* / DEEPSEEK_*）', attempts: [] };
  }
  const attempts: VisionOutcome['attempts'] = [];
  for (const c of candidates) {
    const remaining = deadline - Date.now();
    if (remaining < 5000) { attempts.push({ provider: c.provider, ok: false, ms: 0, error: 'deadline' }); break; }
    // 首个供应商拿大头，后备留 35s；避免"两个都慢"把 120s 吃穿
    const budget = Math.min(remaining - 3000, attempts.length === 0 ? Math.max(20000, remaining - 35000) : 35000);
    try {
      const { raw, ms } = await callOnce({ ...c, imageDataUrl, timeoutMs: budget });
      attempts.push({ provider: c.provider, ok: true, ms });
      let parsed: unknown;
      try { parsed = extractJson(raw); } catch {
        return { ok: false, code: 'bad_json', message: '模型没回 JSON：' + raw.replace(/\s+/g, ' ').slice(0, 200), attempts };
      }
      const p = PlanSchema.safeParse(parsed);
      if (!p.success) return { ok: false, code: 'bad_json', message: 'JSON 形状不符：' + p.error.issues.slice(0, 3).map(i => i.path.join('.') + ' ' + i.message).join('; ') + ' | 原文：' + raw.replace(/\s+/g, ' ').slice(0, 160), attempts };
      if (p.data.ok === false) return { ok: false, code: 'not_floorplan', message: p.data.reason || '模型认为这不是户型图', attempts };
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      const plan: RecognizedPlan = {
        rooms: p.data.rooms.map(r => ({ name: r.name, confidence: r.confidence, polygon: r.polygon.map(([x, y]) => [clamp(x), clamp(y)] as [number, number]) })),
        walls: p.data.walls.map(w => w.map(([x, y]) => [clamp(x), clamp(y)] as [number, number])),
        doors: p.data.doors.map(d => ({ x: clamp(d.x), y: clamp(d.y), width: clamp(d.width), confidence: d.confidence })),
        windows: p.data.windows.map(d => ({ x: clamp(d.x), y: clamp(d.y), width: clamp(d.width), confidence: d.confidence })),
        notes: p.data.notes, provider: c.provider, model: c.model, latencyMs: ms,
      };
      return { ok: true, plan, attempts };
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 200)) : String(e);
      attempts.push({ provider: c.provider, ok: false, ms: 0, error: msg });
      continue;
    }
  }
  return { ok: false, code: 'provider_error', message: '所有视觉供应商都失败了：' + attempts.map(a => a.provider + ':' + (a.error || '')).join(' | '), attempts };
}
