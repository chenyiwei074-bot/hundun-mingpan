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
  /** 本机路由命中两个同分的工具时给出的并列候选（只有 slug）。
   *  add-on 字段：老的服务端不带也照常工作，带了也必须过 reconcile 的白名单才算数 ——
   *  否则一个幻觉 slug 就会变成一个 404 的 chip。 */
  candidates?: string[];
  /** 命中的条目在目录里但状态是未开放时记着它：页面据此走「未开放」那一支，
   *  而不是把它混进「这句话我没对上」。同样是 reconcile 写、页面只读。 */
  closedSlug?: string | null;
}

/** 一轮问答。source 必须上屏：把目录关键词匹配说成"AI 算的"，是本站最不该犯的那种错。 */
export interface AskTurn {
  id: string;
  text: string;
  result: AssistantRouteResult;
  source: 'local' | 'server';
  /** 为什么这一轮没用到服务端。null = 真的用的是服务端。上屏用（缺陷②：拿到了不显示，
   *  "资料不足先问"这条主流程在界面上就是断的）。 */
  degraded: string | null;
  /** 用户在并列里自己挑了一个 —— 这一条不是系统猜的，标注要跟着变。 */
  chosen?: boolean;
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
  // 两个 add-on 字段：不带 = 合法（老服务端），带了但形状不对 = 整份按"不合法"处理。
  // 不在这里放宽：宁可判"没接上"回落本机，也不要半个字段能用。
  if (o.candidates !== undefined && (!Array.isArray(o.candidates) || !o.candidates.every(s => typeof s === 'string'))) return null;
  if (o.closedSlug !== undefined && o.closedSlug !== null && typeof o.closedSlug !== 'string') return null;
  return {
    mode: o.mode,
    toolSlug: (o.toolSlug as string | null) ?? null,
    confidence: o.confidence,
    needsClarification: o.needsClarification,
    clarification: o.clarification as string | null,
    missingFields: o.missingFields,
    available: o.available,
    candidates: o.candidates as string[] | undefined,
    closedSlug: o.closedSlug as string | null | undefined,
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
  // 并列候选先过同一道白名单：只留"目录里有、状态不是未开放、且有 href"的那些 slug。
  // 少于两个就不算并列（一个都不用挑，直接给追问），也不许留着一个假装可以选。
  const open = (s: string) => {
    const t = catalog.find(x => x.slug === s);
    return !!t && t.status !== '未开放' && !!t.href;
  };
  const kept = (raw.candidates ?? []).filter(open);
  out.candidates = kept.length >= 2 ? kept : [];
  const hit = out.toolSlug ? catalog.find(t => t.slug === out.toolSlug) : undefined;
  const isOpen = !!hit && hit.status !== '未开放' && !!hit.href;
  if (!hit || !isOpen) {
    out.toolSlug = null;
    out.available = false;
    out.closedSlug = hit && !isOpen ? hit.slug : null;
    // 抹掉 slug 之后，原来那句"进入它还要补 X、Y"就成了半开的门（harness 的 western-ask
    // 那一态抓到的就是这个）：工具没开放，补什么都无意义，missingFields 一并清空。
    out.missingFields = [];
    out.needsClarification = true;
    if (hit) {
      // 「缺什么才上线」直接引目录自己写的那句（note 优先，没有就用 basis 里带「缺」的那句）：
      // 页面不另写一份解释，两份迟早与目录漂移。
      const why = hit.note || (hit.basis.includes('缺') ? hit.basis : '');
      out.clarification = `「${hit.name}」在这一系里还没开放${why ? `：${why}` : '，因此这里不给入口。'}换个说法再问，或看这一系已经开放的那几项。`;
    } else if (!out.clarification) {
      out.clarification = '这个问题我没能对上这一系里已开放的工具，请换个说法，或直接从下面的目录里挑。';
    }
  } else {
    out.available = true;
    out.closedSlug = null;
  }
  return out;
}
