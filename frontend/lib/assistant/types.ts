// AI 问事的协议与"拿到结果之后能信到什么程度"。
//
// 这个文件只放两件事：跨端共用的形状（与实施计划里 POST /api/assistant/route 的响应一致），
// 以及 reconcile() —— 任何一份路由结果（本机的或模型的）在变成页面上的一个链接之前，
// 都必须过这道白名单核对。模型回来的东西不许自带 URL：它只给 slug，入口由本站目录自己查。

import type { ToolEntry } from '@/lib/tools/catalog';

export type Mode = 'oriental' | 'western';

/** 协议版本。服务端上线时带同一个串；对不上就按"没接上"处理，不猜字段。 */
export const ASSISTANT_PROTOCOL = 'assistant-route-v1';

export interface AssistantRouteResult {
  mode: Mode;
  toolSlug: string | null;
  confidence: number;
  needsClarification: boolean;
  clarification: string | null;
  missingFields: string[];
  available: boolean;
}

/** 一轮问答。source 必须上屏：把目录关键词匹配说成"AI 算的"，是本站最不该犯的那种错。 */
export interface AskTurn {
  id: string;
  text: string;
  result: AssistantRouteResult;
  source: 'local' | 'server';
}

export const isMode = (v: unknown): v is Mode => v === 'oriental' || v === 'western';

/** 形状校验：宁可判"不合法"，也不要半个字段能用。 */
export function parseRouteResult(raw: unknown): AssistantRouteResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isMode(o.mode)) return null;
  if (o.toolSlug !== null && typeof o.toolSlug !== 'string') return null;
  if (typeof o.confidence !== 'number' || !Number.isFinite(o.confidence)
    || o.confidence < 0 || o.confidence > 1) return null;
  if (typeof o.needsClarification !== 'boolean') return null;
  if (o.clarification !== null && typeof o.clarification !== 'string') return null;
  if (!Array.isArray(o.missingFields) || !o.missingFields.every(f => typeof f === 'string')) return null;
  if (typeof o.available !== 'boolean') return null;
  return {
    mode: o.mode,
    toolSlug: (o.toolSlug as string | null) ?? null,
    confidence: o.confidence,
    needsClarification: o.needsClarification,
    clarification: o.clarification as string | null,
    missingFields: o.missingFields,
    available: o.available,
  };
}

/**
 * 白名单核对。进来的 result 只允许说"哪个 slug"，能不能给入口由这里判：
 *  - slug 必须在本体系的目录里；
 *  - 状态必须是可进入的（非未开放）且有 href；
 *  - 任何一条不满足 → 抹掉 slug、available=false，并补一句澄清，让页面有下一步可走。
 * 这一步不做，模型幻觉出来的 slug 就会变成一个 404 按钮。
 */
export function reconcile(raw: AssistantRouteResult, mode: Mode, catalog: ToolEntry[]): AssistantRouteResult {
  const out: AssistantRouteResult = { ...raw, mode, missingFields: [...raw.missingFields] };
  const hit = out.toolSlug ? catalog.find(t => t.slug === out.toolSlug) : undefined;
  const open = !!hit && hit.status !== '未开放' && !!hit.href;
  if (!hit || !open) {
    out.toolSlug = null;
    out.available = false;
    // 抹掉 slug 之后，原来那句"进入它还要补 X、Y"就成了半开的门（harness 的 western-ask
    // 那一态抓到的就是这个）：工具没开放，补什么都无意义，missingFields 一并清空。
    out.missingFields = [];
    out.needsClarification = true;
    if (hit) {
      out.clarification = `「${hit.name}」在这一系里还没开放，换一件事问，或者看这一系已经开放的那几项。`;
    } else if (!out.clarification) {
      out.clarification = '这个问题我没能对上这一系里已开放的工具，请换个说法，或直接从下面的目录里挑。';
    }
  } else {
    out.available = true;
  }
  return out;
}
