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

/** UTF-8 字节数。原来用 text.length 当"字节上限"，中文一个字算 1 而实际占 3 字节，
 *  上限被悄悄放大三倍 —— 闸门的宽度必须由它自己声称的单位来量。 */
export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

export type FieldCode =
  | 'body_shape' | 'body_too_large'
  | 'protocol_missing' | 'protocol_mismatch'
  | 'mode_missing' | 'mode_invalid'
  | 'text_missing' | 'text_type' | 'text_empty' | 'text_too_long' | 'text_control_char';

export interface FieldError { field: 'body' | 'protocol' | 'mode' | 'text'; code: FieldCode; msg: string }

export type Validation =
  | { ok: true; mode: Mode; text: string }
  | { ok: false; errors: FieldError[]; status: number };

/**
 * 手写校验（不引 zod：零新依赖是默认规矩，这里用到的只有"形状 + 枚举 + 长度 + 控制字符"）。
 * 结构化错误码 + 一次报全：只回一句人话，客户端就没法按字段定位，
 * 而"发现第一个错就返回"会让人一屏一屏地试错。
 */
export function validateRequest(raw: unknown): Validation {
  const errors: FieldError[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: 'body', code: 'body_shape', msg: '请求体必须是 JSON 对象' }], status: 400 };
  }
  const o = raw as Record<string, unknown>;

  if (o.protocol === undefined || o.protocol === null || o.protocol === '')
    errors.push({ field: 'protocol', code: 'protocol_missing', msg: '缺 protocol' });
  else if (typeof o.protocol !== 'string' || o.protocol !== PROTOCOL)
    errors.push({ field: 'protocol', code: 'protocol_mismatch', msg: `protocol 必须是 ${PROTOCOL}` });

  if (o.mode === undefined || o.mode === null || o.mode === '')
    errors.push({ field: 'mode', code: 'mode_missing', msg: '缺 mode' });
  else if (o.mode !== 'oriental' && o.mode !== 'western')
    errors.push({ field: 'mode', code: 'mode_invalid', msg: 'mode 只认 oriental / western' });

  if (o.text === undefined || o.text === null)
    errors.push({ field: 'text', code: 'text_missing', msg: '缺 text' });
  else if (typeof o.text !== 'string')
    errors.push({ field: 'text', code: 'text_type', msg: 'text 必须是字符串' });
  else {
    const text = o.text.trim();
    if (text.length === 0) errors.push({ field: 'text', code: 'text_empty', msg: 'text 不能为空' });
    else {
      // 按码点计字：emoji 用 .length 会被数两遍，先咬的是贴一句带 emoji 的话的真人
      if (Array.from(text).length > MAX_TEXT)
        errors.push({ field: 'text', code: 'text_too_long', msg: `text 最长 ${MAX_TEXT} 字（实得 ${Array.from(text).length}）` });
      // 控制字符与换行不进 prompt：它们是最容易把一段话变成两条指令的东西
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))
        errors.push({ field: 'text', code: 'text_control_char', msg: 'text 含控制字符' });
    }
  }

  if (errors.length) {
    const big = errors.some(e => e.code === 'text_too_long' || e.code === 'body_too_large');
    return { ok: false, errors, status: big ? 413 : 400 };
  }
  return { ok: true, mode: o.mode as Mode, text: (o.text as string).trim() };
}

/** 请求体字节闸。放在 parse 之前：先量体积再解析，否则"用一个超大 body 拖垮解析"这条还在。
 *  返回 null 表示通过；不返回 Validation 是因为它没有"成功时的 mode/text"可给。 */
export function checkBodyBytes(text: string): { errors: FieldError[]; status: number } | null {
  const n = utf8Length(text);
  if (n > MAX_BODY)
    return { status: 413, errors: [{ field: 'body', code: 'body_too_large', msg: `请求体 ${n} 字节，上限 ${MAX_BODY}` }] };
  return null;
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
