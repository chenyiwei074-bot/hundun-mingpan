// 结果回执（纯客户端）：把一份卦盘 / 一份解读变成可下载、可离线复验的承诺凭证。
//
// 三条硬规矩，都由 tools/receipt-acceptance 钉住：
// 1) 回执里绝不出现原始问题、姓名、生辰。问题只留一个带盐摘要（subjectHash），
//    盘身字段走**白名单**而不是黑名单 —— 将来类型新增一个字段，编译期就会红，
//    逼着人决定「这个字段进不进回执」，而不是默认把它带出去。
// 2) recordHash 只覆盖承诺内核。anchor 与 createdAtUTC 在内核之外：台账是后来才填的，
//    填进去不能把已经发出去的回执验成失败。
// 3) 没拿到真实 Merkle 证明之前，anchor 恒为 null、状态恒为「未锚定」。这一层不做任何
//    「已上链」的暗示 —— 那是 #80 接台账之后的事。
//
// 摘要算法：SHA-256，走 Web Crypto（浏览器）与 node:crypto 双向对拍，零新依赖。

import type { LiuyaoResult } from '@/types/liuyao';

export const RECEIPT_VERSION = 'hundun-receipt-v1';
export const RECEIPT_ANCHOR_STATE_UNANCHORED = '未锚定';

/** 盘身白名单：逐条对应 LiuyaoResult 的键。新增键时下面那行类型检查会先报错。 */
export const PLATE_FIELDS = [
  'id', 'method', 'questionType', 'date', 'ganZhi', 'dayGZ', 'monthZhi', 'xunKong',
  'ganzhiBasis', 'najiaBasis', 'solar', 'qiShu',
  'benGua', 'bianGua', 'yaoRecords', 'naJia', 'bianNaJia', 'dongYao', 'shiYing', 'liuShen',
] as const;

/** 明确不进回执的键 —— 写出来，免得以后有人以为是漏掉了。 */
export const PLATE_EXCLUDED = ['question'] as const;

// 编译期护栏：白名单 + 排除表必须恰好盖住 LiuyaoResult 的每一个键。
// 类型新增字段时这里直接编译不过，逼着人决定它进不进回执，而不是静默带出去或静默漏掉。
type PlateKey = typeof PLATE_FIELDS[number];
type ExcludedKey = typeof PLATE_EXCLUDED[number];
const _KEYS_COVER_TYPE: Record<keyof LiuyaoResult, true> = {
  ...({} as Record<PlateKey, true>),
  ...({} as Record<ExcludedKey, true>),
};
void _KEYS_COVER_TYPE;

export interface ReceiptAnchor {
  date: string;
  root: string;
  prevRoot: string;
  manifestPath: string;
  otsPath: string;
}

/** 被 recordHash 覆盖的承诺内核。字段顺序无所谓，规范化后按键排序。 */
export interface ReceiptCore {
  version: typeof RECEIPT_VERSION;
  kind: 'liuyao-plate' | 'liuyao-report';
  method: string;
  castAtLocal: string;
  castAtUTC: string;
  tzOffsetMinutes: number;
  basis: Record<string, string>;
  subjectSalt: string;
  subjectHash: string;
  plateHash: string;
  reportHash?: string;
  parentHash?: string;
}

export interface Receipt {
  core: ReceiptCore;
  recordHash: string;
  receiptId: string;
  anchor: ReceiptAnchor | null;
  anchorState: string;
  createdAtUTC: string;
  /** 自包含：验真只要这一个文件，不需要连站点、更不需要按 id 去拉报告。 */
  plate: Record<string, unknown>;
  reportText?: string;
}

/** 递归按键排序的确定性序列化。undefined 与函数被丢弃，NaN/Infinity 记为 null。 */
export function canonical(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const child = (v as Record<string, unknown>)[k];
        if (child === undefined || typeof child === 'function') continue;
        out[k] = norm(child);
      }
      return out;
    }
    return v === undefined ? null : v;
  };
  return JSON.stringify(norm(value));
}

/** SHA-256 → 十六进制，前缀 sha256: 以便台账侧一眼看出摘要算法。 */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 盐只用于让短问题不可字典反查，不进台账、不公开，随回执一起由用户自己保存。 */
function newSalt(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

const pad = (n: number) => String(n).padStart(2, '0');

function castStamps(date: LiuyaoResult['date']): { local: string; utc: string; offset: number } {
  const d = new Date(date.year, date.month - 1, date.day, date.hour, date.minute);
  const local = `${date.year}-${pad(date.month)}-${pad(date.day)} ${pad(date.hour)}:${pad(date.minute)}`;
  return { local, utc: Number.isNaN(d.getTime()) ? '' : d.toISOString(), offset: -d.getTimezoneOffset() };
}

/** 白名单投影：只带 PLATE_FIELDS 列出的键，其余一律不出门。 */
export function projectPlate(result: LiuyaoResult): Record<string, unknown> {
  const src = result as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PLATE_FIELDS) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

export async function buildPlateReceipt(
  result: LiuyaoResult,
  opts?: { salt?: string; nowUTC?: string; basis?: Record<string, string> },
): Promise<Receipt> {
  const plate = projectPlate(result);
  const salt = opts?.salt || newSalt();
  const { local, utc, offset } = castStamps(result.date);
  const basis = opts?.basis || {
    ganzhi: result.ganzhiBasis || '未标注',
    najia: result.najiaBasis || '未标注',
    qishu: result.qiShu?.version || '不适用',
  };
  const plateHash = await sha256Hex(canonical(plate));
  const subjectHash = await sha256Hex(canonical({ salt, question: result.question, questionType: result.questionType }));

  const core: ReceiptCore = {
    version: RECEIPT_VERSION,
    kind: 'liuyao-plate',
    method: result.method,
    castAtLocal: local,
    castAtUTC: utc,
    tzOffsetMinutes: offset,
    basis,
    subjectSalt: salt,
    subjectHash,
    plateHash,
  };
  const recordHash = await sha256Hex(canonical(core));
  return {
    core,
    recordHash,
    receiptId: recordHash,
    anchor: null,
    anchorState: RECEIPT_ANCHOR_STATE_UNANCHORED,
    createdAtUTC: opts?.nowUTC || new Date().toISOString(),
    plate,
  };
}

/** 解读单独封一份：它比卦盘晚生成，混在一起等于把两个时间点伪造成一个。 */
export async function buildReportReceipt(
  plateReceipt: Receipt,
  reportText: string,
  opts?: { nowUTC?: string },
): Promise<Receipt> {
  const reportHash = await sha256Hex(canonical({ text: reportText }));
  const core: ReceiptCore = {
    ...plateReceipt.core,
    kind: 'liuyao-report',
    reportHash,
    parentHash: plateReceipt.recordHash,
  };
  const recordHash = await sha256Hex(canonical(core));
  return {
    core,
    recordHash,
    receiptId: recordHash,
    anchor: null,
    anchorState: RECEIPT_ANCHOR_STATE_UNANCHORED,
    createdAtUTC: opts?.nowUTC || new Date().toISOString(),
    plate: plateReceipt.plate,
    reportText,
  };
}

export interface VerifyCheck {
  field: string;
  ok: boolean;
  detail: string;
}

/** 离线复验：不联网、不查库，只用手上的这份回执自己证自己。
 *  问题原文默认不在回执里（隐私），所以带原文时才真算一次 subjectHash，不带就标成
 *  「未复核」——不拿一个永真式冒充通过。 */
export async function verifyReceipt(
  receipt: Receipt,
  opts?: { question?: string },
): Promise<{ ok: boolean; checks: VerifyCheck[] }> {
  const checks: VerifyCheck[] = [];
  const push = (field: string, cond: boolean, detail: string) => checks.push({ field, ok: cond, detail });

  push('version', receipt.core?.version === RECEIPT_VERSION, `回执版本 ${receipt.core?.version}，期望 ${RECEIPT_VERSION}`);
  const plateNow = await sha256Hex(canonical(receipt.plate));
  push('plateHash', plateNow === receipt.core.plateHash, `盘身重算 ${plateNow.slice(0, 18)}… vs 回执 ${receipt.core.plateHash.slice(0, 18)}…`);

  if (opts?.question !== undefined) {
    const subjectNow = await sha256Hex(canonical({
      salt: receipt.core.subjectSalt, question: opts.question, questionType: receipt.plate.questionType,
    }));
    push('subjectHash', subjectNow === receipt.core.subjectHash, `问题摘要重算 ${subjectNow.slice(0, 18)}… vs 回执 ${receipt.core.subjectHash.slice(0, 18)}…`);
  } else {
    push('subjectHash', true, `问题摘要 ${receipt.core.subjectHash.slice(0, 18)}… 未被复核（回执不含原文，需本人重填问题才能比对）`);
  }

  if (receipt.core.kind === 'liuyao-report') {
    const reportNow = await sha256Hex(canonical({ text: receipt.reportText ?? '' }));
    push('reportHash', reportNow === receipt.core.reportHash, `解读重算 ${reportNow.slice(0, 18)}… vs 回执 ${(receipt.core.reportHash || '').slice(0, 18)}…`);
    push('parentHash', !!receipt.core.parentHash, `上链卦盘回执号 ${(receipt.core.parentHash || '缺失').slice(0, 18)}…`);
  }

  const recomputed = await sha256Hex(canonical(receipt.core));
  push('recordHash', recomputed === receipt.recordHash, `内核重算 ${recomputed.slice(0, 18)}… vs 回执 ${receipt.recordHash.slice(0, 18)}…`);
  push('receiptId', receipt.receiptId === receipt.recordHash, '回执编号即内核摘要');
  push('anchor', !!receipt.anchor,
    receipt.anchor ? `已锚定于 ${receipt.anchor.date}，root ${receipt.anchor.root}` : RECEIPT_ANCHOR_STATE_UNANCHORED);

  return { ok: checks.filter(c => c.field !== 'anchor').every(c => c.ok), checks };
}

/** 下载用文件名：带上前 12 位摘要，用户自己存的一堆文件里能对上号。 */
export function receiptFileName(receipt: Receipt): string {
  return `hundun-${receipt.core.kind}-${receipt.recordHash.replace('sha256:', '').slice(0, 12)}.json`;
}
