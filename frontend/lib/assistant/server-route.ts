// /api/assistant 的服务端逻辑（与 route.ts 分开，是为了能被验收套件直接 import 测到 ——
// 一个只能靠发 HTTP 才能测的校验器，通常没人测）。
//
// 三条不可让的：
//  1. 模型只允许回答"哪个 slug"，本站不接收它给出的任何 URL/href/函数名；
//  2. 模型说的 slug 必须再过一次目录白名单（与前端 reconcile 同一份实现，两处都要过）；
//  3. 问题原文不写日志、不进埋点、不进台账 —— 日志里只放长度与摘要哈希。

import { INTENTS } from '../tools/catalog';
import { WESTERN_INTENTS } from '../tools/western-catalog';
import type { ToolEntry } from '../tools/catalog';
import { parseRouteResult, reconcile } from './types';
import type { AssistantRouteResult, Mode } from './types';
import { routeLocal } from './intent';

export const PROTOCOL = 'assistant-route-v1';
export const MAX_TEXT = 200;          // 与输入框 maxLength 一致；服务端不信任前端
export const MAX_BODY = 4096;         // 字节级上限，先限长再解析
export const MODEL_TIMEOUT_MS = 110_000;  // 网关 120s，这里留 10s 余量

const CATALOGS: Record<Mode, ToolEntry[]> = {
  oriental: INTENTS.flatMap(g => g.tools),
  western: WESTERN_INTENTS.flatMap(g => g.tools),
};
export const catalogFor = (mode: Mode): ToolEntry[] => CATALOGS[mode];

export type Validation = { ok: true; mode: Mode; text: string } | { ok: false; error: string; status: number };

/** 手写校验（不引 zod：前端 package.json 里没有它，为一个路由加依赖不划算）。 */
export function validateRequest(raw: unknown): Validation {
  if (!raw || typeof raw !== 'object') return { ok: false, error: '请求体必须是 JSON 对象', status: 400 };
  const o = raw as Record<string, unknown>;
  if (o.protocol !== PROTOCOL) return { ok: false, error: `protocol 必须是 ${PROTOCOL}`, status: 400 };
  if (o.mode !== 'oriental' && o.mode !== 'western') return { ok: false, error: 'mode 只认 oriental/western', status: 400 };
  if (typeof o.text !== 'string') return { ok: false, error: 'text 必须是字符串', status: 400 };
  const text = o.text.trim();
  if (text.length === 0) return { ok: false, error: 'text 不能为空', status: 400 };
  if (Array.from(text).length > MAX_TEXT) return { ok: false, error: `text 最长 ${MAX_TEXT} 字`, status: 413 };
  // 控制字符与换行不进模型 prompt：它们是最容易把一段话变成两条指令的东西
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return { ok: false, error: 'text 含控制字符', status: 400 };
  return { ok: true, mode: o.mode, text };
}

/** 白名单只进 prompt：模型看不到本站的路由表，也就不可能被诱导说出别的路径。 */
export function buildMessages(mode: Mode, text: string) {
  const allow = CATALOGS[mode].map(t => ({
    slug: t.slug, name: t.name, status: t.status, askable: t.status !== '未开放' && !!t.href,
  }));
  const system = [
    '你是中文命理站的问事路由。任务只有一个：判断用户这句话该用下面哪一个工具，或者该追问什么。',
    '你不排盘、不起卦、不算命、不给任何吉凶结论，也不解释命理。',
    '只能从给定 slug 里选一个；不确定或都对不上就 toolSlug 给 null 并写 clarification。',
    '禁止输出 href、url、路径、函数名或任何工具清单之外的字段。',
    '未开放（askable=false）的工具不能当结论；需要用户补的信息写进 missingFields，不要替他编。',
    `当前体系：${mode === 'oriental' ? '东方' : '西方'}。只允许这些工具：${JSON.stringify(allow)}`,
    '严格输出一个 JSON 对象，字段与顺序：'
    + '{"mode":string,"toolSlug":string|null,"confidence":number,"needsClarification":boolean,'
    + '"clarification":string|null,"missingFields":string[],"available":boolean}',
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: text }];
}

/** 抠出模型回里的 JSON：有的模型会包 ```json 或加一句前言。抠不出来就返回 null 走回落。 */
export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

/** 模型的回 → 可信结果。任何一步不合形状就整体作废（返回 null），由调用方回落本机路由。 */
export function acceptModelResult(mode: Mode, raw: unknown): AssistantRouteResult | null {
  const parsed = parseRouteResult(raw);
  if (!parsed || parsed.mode !== mode) return null;
  return reconcile(parsed, mode, CATALOGS[mode]);
}

export function localFallback(mode: Mode, text: string): AssistantRouteResult {
  const other = mode === 'oriental' ? CATALOGS.western : CATALOGS.oriental;
  return reconcile(routeLocal(mode, text, CATALOGS[mode], other), mode, CATALOGS[mode]);
}

export interface Upstream { base: string; key: string; model: string }

/** 读 env。缺 key 不算异常，只是"模型不可用"，调用方据此回落。 */
export function readUpstream(env: NodeJS.ProcessEnv = process.env): Upstream | null {
  const key = env.OPENAI_API_KEY || '';
  if (!key) return null;
  return { base: env.OPENAI_BASE_URL || 'https://api.openai.com/v1', key, model: env.AI_MODEL || 'gpt-4o-mini' };
}

export async function askModel(u: Upstream, mode: Mode, text: string,
  fetchImpl: typeof fetch = globalThis.fetch): Promise<{ ok: true; result: AssistantRouteResult } | { ok: false; why: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${u.base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.key}` },
      body: JSON.stringify({
        model: u.model, messages: buildMessages(mode, text), temperature: 0, max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, why: `上游 ${res.status}` };
    const json = await res.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null;
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { ok: false, why: '上游没有 content' };
    const result = acceptModelResult(mode, extractJson(content));
    return result ? { ok: true, result } : { ok: false, why: '上游回的形状不合协议' };
  } catch (e) {
    return { ok: false, why: (e as Error)?.name === 'AbortError' ? '上游超时' : '上游不可达' };
  } finally {
    clearTimeout(timer);
  }
}
