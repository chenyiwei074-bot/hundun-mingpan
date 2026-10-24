// 回执摘要入账与台账状态（P1 的客户端半边）。
//
// 三条规矩，都由 tools/receipt-acceptance §13 钉住：
// 1) 出门的只有摘要。问题原文、subjectSalt、盘身、生辰一律不发 —— 台账要的是"这一盘存在过"，
//    不是"这一盘说了什么"。盐尤其不能发：摘要抗字典反查靠的就是它不外泄。
// 2) 查询只按 recordHash，绝不按报告 id。GET /api/reports/:id 那条能取回 inputJson 的路子
//    是本站已知最老的隐私洞，这里不能借任何名义重开。
// 3) 台账状态是独立读取，不写回回执本体。回执的 anchor 按契约恒为 null —— 如果查一次状态
//    就把文件里的字段改了，同一份回执会因为查询时点不同而得到不同摘要，那才是真的自相矛盾。
//
// 措辞上限：服务端目前只会返回 unanchored / pending（本机无 bitcoind，ots 无法独立确认，
// 所以 anchored 不会下发）。就算哪天返回了 anchored，这里也一律落到「状态未知」——
// 页面不替运维确认区块链事实，"已上链/已写入区块链"这类字样在本模块与面板里都不许出现。

import type { Receipt } from './receipt';

/** 提交信封的版本。注意它不等于回执内核的 version（v1/v2）：
 *  服务端把信封 schemaVersion 钉死成这一个串（`server/src/controllers/receipt.controller.ts`
 *  里的 SCHEMA），改内核版本不该让已经上线的端点突然 400。两边由验收逐字比对。 */
export const RECEIPT_ENVELOPE_SCHEMA = 'hundun-receipt-v1';

/** 台账能给出的状态，以及本站愿意替它说的话。 */
export type AnchorView = 'unsubmitted' | 'unanchored' | 'pending' | 'unknown';

export const ANCHOR_LABEL: Record<AnchorView, string> = {
  unsubmitted: '未提交',
  unanchored: '未锚定',
  pending: '等待锚定',
  unknown: '状态未知',
};

/** 只出摘要的那份请求体。字段集是白名单，多一个都没有。 */
export function receiptSubmissionPayload(receipt: Receipt): Record<string, unknown> {
  const c = receipt.core;
  return {
    schemaVersion: RECEIPT_ENVELOPE_SCHEMA,
    kind: c.kind,
    method: c.method,
    castAtUTC: c.castAtUTC,
    tzOffsetMinutes: c.tzOffsetMinutes,
    recordHash: receipt.recordHash,
    plateHash: c.plateHash,
    ...(c.reportHash ? { reportHash: c.reportHash } : {}),
    ...(c.parentHash ? { parentHash: c.parentHash } : {}),
    subjectHash: c.subjectHash,
    basis: c.basis,
  };
}

/** 摘要去掉 sha256: 前缀 —— 台账内一律裸 hex，回执 JSON 里保留前缀（契约 §4/§6）。
 *  归一化由提交方做，不靠对端兜：少归一化一个字段就是两边各改一半。 */
export const bareHex = (h: string) => h.replace(/^sha256:/i, '').toLowerCase();

/** 真正出门的那份请求体：白名单字段 + 全部摘要归一化成裸 hex。 */
export function receiptSubmissionBody(receipt: Receipt): Record<string, unknown> {
  const p = receiptSubmissionPayload(receipt);
  for (const k of ['recordHash', 'plateHash', 'subjectHash', 'reportHash', 'parentHash']) {
    if (typeof p[k] === 'string') p[k] = bareHex(p[k] as string);
  }
  return p;
}

export type SubmitResult =
  | { ok: true; day: string; already: boolean; leaf: string }
  | { ok: false; error: string };

export type StatusResult =
  | { ok: true; view: AnchorView; day?: string; leaf?: string; reason?: string; root?: string; prevRoot?: string }
  | { ok: false; error: string; view: 'unknown' };

/** 提交一份回执的摘要。visitorId 与报告归属同一凭据，不新造 id。 */
export async function submitReceiptSummary(receipt: Receipt, visitorId: string): Promise<SubmitResult> {
  const id = (visitorId || '').trim();
  if (!id) return { ok: false, error: '当前浏览器无法确认回执归属，暂时不能提交。' };
  let res: Response;
  try {
    res = await fetch('/api/receipts?visitorId=' + encodeURIComponent(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptSubmissionBody(receipt)),
    });
  } catch {
    return { ok: false, error: '暂时无法连接台账，请稍后重试。' };
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) return { ok: false, error: '暂时无法提交回执摘要，请稍后重试。' };
  return { ok: true, day: String(j.day || ''), already: !!j.already, leaf: String(j.leaf || '') };
}

/** 服务端 state → 本站措辞。单独抽出来是因为它必须能离线断言：
 *  只认识 unanchored / pending 两态，其它一律「状态未知」—— 包括将来可能出现的 anchored。 */
export function anchorViewOf(state: unknown): AnchorView {
  return state === 'unanchored' || state === 'pending' ? state : 'unknown';
}

/** 查一份摘要在台账里的状态。只按 recordHash。 */
export async function fetchAnchorStatus(receipt: Receipt): Promise<StatusResult> {
  const hash = bareHex(receipt.recordHash);
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: '回执信息有误，暂时无法查询。', view: 'unknown' };
  let res: Response;
  try {
    res = await fetch('/api/receipts/' + hash);
  } catch {
    return { ok: false, error: '暂时无法连接台账，请稍后重试。', view: 'unknown' };
  }
  const j = await res.json().catch(() => null);
  if (res.status === 404) {
    return { ok: true, view: 'unsubmitted', reason: '这份摘要尚未提交' };
  }
  if (!res.ok || !j?.ok) return { ok: false, error: '暂时无法读取台账状态，请稍后重试。', view: 'unknown' };
  const view = anchorViewOf(j.state);
  return {
    ok: true, view,
    day: j.day ? String(j.day) : undefined,
    leaf: j.leaf ? String(j.leaf) : undefined,
    root: j.root ? String(j.root) : undefined,
    prevRoot: j.prevRoot ? String(j.prevRoot) : undefined,
  };
}

/** 状态行的一句话。日期与 leaf 是事实，其余措辞不超出服务端给的范围。 */
export function anchorSentence(view: AnchorView, extra?: { day?: string; already?: boolean; reason?: string }): string {
  const tail = view === 'pending' && extra?.day ? `（已进入 ${extra.day} 批次）`
    : view === 'unanchored' && extra?.day ? `（${extra.day} 尚未封账）`
    : extra?.reason ? `（${extra.reason}）` : '';
  return ANCHOR_LABEL[view] + tail;
}
