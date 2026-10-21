// 配额的读取与措辞（D1：不再假装有配额）。
//
// 为什么单独成文件：措辞的三条分支要能在 node 里逐条跑（与 upload.ts / recognize.ts /
// edit.ts 同一个理由）。而且"不许凭空造一个数字出来"这件事只有把造数字的那一步
// 关进一个纯函数里，才有地方钉住它。
//
// 三条判据：
//  1. **只有服务端明说 unlimited 才写"免费/不限次"**。读不到、超时、字段缺，都走"未知"，
//     绝不退化成"还剩 3 次"那种看着无害的猜测 —— 那正是这一条要修的毛病。
//  2. 有额度时数字只能来自响应，前端不许有兜底常量（历史上是硬编码 999）。
//  3. 额度读不到**不能拦人排盘**：本机引擎算得出盘，配额只是"能不能存进服务器"那一侧的事，
//     所以这一行是说明，不是闸门。

/** 服务端 GET /api/chart/quota 的 data 形状（`chart.controller.ts` 的 getQuota）。 */
export interface QuotaRaw {
  used?: number;
  remaining?: number | null;
  limit?: number | null;
  unlimited?: boolean;
}

export type QuotaView =
  | { kind: '内测免费'; 文本: string }
  | { kind: '有额度'; 文本: string; 剩余: number; 上限: number; 已用完: boolean }
  | { kind: '未知'; 文本: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 把服务端的 data 翻成一句人话。分支顺序不能反：unlimited 优先，
 *  否则 {unlimited:true, remaining:null, limit:null} 会被当成"剩余 null 次"。 */
export function describeQuota(raw: QuotaRaw | null | undefined): QuotaView {
  if (raw && raw.unlimited === true) {
    return { kind: '内测免费', 文本: '当前内测免费，不限次数。' };
  }
  if (raw && isNum(raw.remaining) && isNum(raw.limit) && raw.limit > 0) {
    const 已用完 = raw.remaining <= 0;
    return {
      kind: '有额度', 剩余: raw.remaining, 上限: raw.limit, 已用完,
      文本: 已用完
        ? `本期额度已用完（${raw.limit} 次已用满）。本机排盘照常，只是暂时不能存进「我的报告」。`
        : `本期还可排 ${raw.remaining} / 共 ${raw.limit} 次。`,
    };
  }
  return {
    kind: '未知',
    文本: '暂时读不到额度信息。这一条不影响本机排盘，只影响能不能存进服务器。',
  };
}

/** 拉一次额度。失败不抛 —— 调用方要的是"读不到就说读不到"，不是一条红掉的页面。 */
export async function fetchQuota(
  visitorId: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<QuotaView> {
  if (!visitorId) return describeQuota(null);
  try {
    const res = await fetcher(`/api/chart/quota?visitor_id=${encodeURIComponent(visitorId)}`);
    if (!res.ok) return describeQuota(null);
    const json = await res.json() as { success?: boolean; data?: QuotaRaw } | null;
    return describeQuota(json && json.success ? json.data : null);
  } catch {
    return describeQuota(null);
  }
}
