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

import type { LiuyaoResult, CoinCommitment } from '@/types/liuyao';
import { bitsFromSeedHex } from '@/lib/crypto/random';
import { COIN_COMMIT_BITS, calcYao, tossesFromSeed } from '@/lib/liuyao/methods/coinFaces';

/** v1 = 没有随机承诺的那套内核；v2 = 内核里多一个 randomness。
 *  两版共用同一套规范化与摘要规则，只差那一个字段，所以旧回执按 v1 重算仍是同一个 hash。 */
export const RECEIPT_VERSION_V1 = 'hundun-receipt-v1';
export const RECEIPT_VERSION_V2 = 'hundun-receipt-v2';
/** 出盘时按内容挑版本：没有承诺就用 v1，不为了"看起来新"把同一盘的重算 hash 换掉。 */
export const RECEIPT_VERSION = RECEIPT_VERSION_V1;
export const RECEIPT_VERSIONS = [RECEIPT_VERSION_V1, RECEIPT_VERSION_V2] as const;

/** 随机承诺的派生口径戳：seed 取 bit 的方式、bit→面值→爻值的对应关系。 */
export const COIN_COMMIT_SCHEMA = 'coin-commit-v1';
export const RECEIPT_ANCHOR_STATE_UNANCHORED = '未锚定';

/** 盘身白名单：逐条对应 LiuyaoResult 的键。新增键时下面那行类型检查会先报错。 */
export const PLATE_FIELDS = [
  'id', 'method', 'questionType', 'date', 'ganZhi', 'dayGZ', 'monthZhi', 'xunKong',
  'ganzhiBasis', 'najiaBasis', 'solar', 'qiShu',
  'benGua', 'bianGua', 'yaoRecords', 'naJia', 'bianNaJia', 'dongYao', 'shiYing', 'liuShen',
] as const;

/** 明确不进盘身投影的键 —— 写出来，免得以后有人以为是漏掉了。
 *  randomness 刻意不在 PLATE_FIELDS 里：它是「承诺」不是「盘」，进盘身就等于同一个事实被
 *  摘要两次（plateHash 与 core.randomness 各一次），改一处会让两处互相矛盾而看不出哪处是原件。 */
export const PLATE_EXCLUDED = ['question', 'randomness'] as const;

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
  version: typeof RECEIPT_VERSION_V1 | typeof RECEIPT_VERSION_V2;
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
  /** v2 才有：掷钱之前的那份承诺。它在内核里，所以拆掉承诺就会改 recordHash —— 放在外面等于可拆。 */
  randomness?: CoinCommitment;
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

/** 锁定时刻的本地文本（到秒）。只作展示：本地时钟不可信，把它进摘要等于给自己伪造时间。 */
function localText(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 铸承诺：seed → seedHash + 那 18 个 bit。首掷之前调用一次，整卦共用一份，中途换 seed 就是换一卦。 */
export async function sealSeed(seedHex: string, now: Date = new Date()): Promise<CoinCommitment> {
  return {
    schema: COIN_COMMIT_SCHEMA,
    seedHex,
    seedHash: await sha256Hex(seedHex),
    bits: bitsFromSeedHex(seedHex, COIN_COMMIT_BITS).join(''),
    committedAtLocal: localText(now),
  };
}

/** 露前 12 位就够对上号：一屏放不下 64 位十六进制，而全露与不露在揭晓前没有区别。 */
export function shortHash(h: string): string {
  return h.replace(/^sha256:/, '').slice(0, 12);
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

/** 盘身取摘要时喂进去的东西。v2 起 **不含 id**：id 是客户端现铸的定位符
 *  （'coin_' + Date.now + 随机后缀），把它算进承诺会让同一盘两次回执得到两个 plateHash，
 *  用户重开一次就"内容变了"。v1 仍按含 id 的旧规则算 —— 已发出的 v1 回执与已入台账的
 *  leaf 不能因为这条改动作废，所以规则按版本分叉，不做"顺手统一"。 */
export function plateForDigest(plate: Record<string, unknown>, version: string): Record<string, unknown> {
  if (version !== RECEIPT_VERSION_V2) return plate;
  const { id, ...rest } = plate;
  return rest;
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
  // 只有铜钱摇卦带承诺：时间与报数是确定性输入，给它们编一个 seed 是装样子。
  const randomness = result.method === 'coin' ? result.randomness : undefined;
  const version = randomness ? RECEIPT_VERSION_V2 : RECEIPT_VERSION_V1;
  const plateHash = await sha256Hex(canonical(plateForDigest(plate, version)));
  const subjectHash = await sha256Hex(canonical({ salt, question: result.question, questionType: result.questionType }));

  const core: ReceiptCore = {
    version,
    kind: 'liuyao-plate',
    method: result.method,
    castAtLocal: local,
    castAtUTC: utc,
    tzOffsetMinutes: offset,
    basis,
    subjectSalt: salt,
    subjectHash,
    plateHash,
    ...(randomness ? { randomness } : {}),
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
  /** 这一项压根没被检验（回执里没有可比对的东西）。既不算通过也不算不通过。 */
  na?: boolean;
}

/** 离线复验：不联网、不查库，只用手上的这份回执自己证自己。
 *  问题原文默认不在回执里（隐私），所以带原文时才真算一次 subjectHash，不带就标成
 *  「未复核」——不拿一个永真式冒充通过。随机承诺同理：v1 的老盘标「未承诺」，
 *  时间与报数标「不适用」，都是没测过，不是测过了。 */
export async function verifyReceipt(
  receipt: Receipt,
  opts?: { question?: string },
): Promise<{ ok: boolean; checks: VerifyCheck[] }> {
  const checks: VerifyCheck[] = [];
  const push = (field: string, cond: boolean, detail: string, na = false) =>
    checks.push(na ? { field, ok: cond, detail, na: true } : { field, ok: cond, detail });

  const version = receipt.core?.version;
  const known = (RECEIPT_VERSIONS as readonly string[]).includes(version);
  push('version', known, known
    ? `回执版本 ${version}（${version === RECEIPT_VERSION_V2 ? '内核含随机承诺' : '承诺之前的格式'}）`
    : `回执版本 ${version || '缺失'}，本站只认 ${RECEIPT_VERSIONS.join(' / ')}`);
  const plateNow = await sha256Hex(canonical(plateForDigest(receipt.plate, receipt.core?.version)));
  push('plateHash', plateNow === receipt.core.plateHash, `盘身重算 ${plateNow.slice(0, 18)}… vs 回执 ${receipt.core.plateHash.slice(0, 18)}…`);

  if (opts?.question !== undefined) {
    const subjectNow = await sha256Hex(canonical({
      salt: receipt.core.subjectSalt, question: opts.question, questionType: receipt.plate.questionType,
    }));
    push('subjectHash', subjectNow === receipt.core.subjectHash, `问题摘要重算 ${subjectNow.slice(0, 18)}… vs 回执 ${receipt.core.subjectHash.slice(0, 18)}…`);
  } else {
    push('subjectHash', true, `问题摘要 ${receipt.core.subjectHash.slice(0, 18)}… 未被复核（回执不含原文，需本人重填问题才能比对）`, true);
  }

  const rnd = receipt.core.randomness;
  if (version === RECEIPT_VERSION_V2 && rnd) {
    // 双向：seedHash 要对得上 seed，回执里的 bit 也要对得上 seed —— 只校一边就能改另一边。
    const hashNow = await sha256Hex(rnd.seedHex);
    push('seedHash', hashNow === rnd.seedHash,
      `承诺重算 ${shortHash(hashNow)}… vs 回执 ${shortHash(rnd.seedHash)}…（seedHash 就是揭晓前公布的那一个）`);
    let bitsNow: string;
    try {
      bitsNow = bitsFromSeedHex(rnd.seedHex, COIN_COMMIT_BITS).join('');
    } catch (e) {
      bitsNow = `seed 解析失败：${e instanceof Error ? e.message : '非法 seed'}`;
    }
    push('commitBits', bitsNow === rnd.bits, `seed 派生 ${bitsNow} vs 回执 ${rnd.bits}（1=花 0=字，六轮各三枚）`);
    // 最要紧的一头：bit 与 seed 自洽还不够，得一路重放到盘上那六个爻值。
    let replayOk = false;
    let replayDetail = '';
    try {
      const fromSeed = tossesFromSeed(rnd.seedHex).map(t => calcYao(t).value).join('');
      const onPlate = (Array.isArray(receipt.plate?.yaoRecords) ? receipt.plate.yaoRecords as { value: number }[] : [])
        .map(r => r.value).join('');
      replayOk = fromSeed === onPlate;
      replayDetail = `seed 重放爻值 ${fromSeed} vs 盘上 ${onPlate}`;
    } catch (e) {
      replayDetail = `无法重放：${e instanceof Error ? e.message : 'seed 或盘身不完整'}`;
    }
    push('tossReplay', replayOk, `这六个爻值确实由承诺过的 seed 推出 —— ${replayDetail}`);
    if (rnd.schema !== COIN_COMMIT_SCHEMA) {
      push('commitSchema', false, `承诺口径 ${rnd.schema}，本站只按 ${COIN_COMMIT_SCHEMA} 重放，不认识的就判失败`);
    }
  } else if (receipt.core.method === 'coin') {
    push('randomness', true, '未承诺 —— 这份回执是 v1 格式，那时摇卦还没有 commit-reveal；盘身与摘要照常复核，但"爻值来自一次诚实的随机"这一条它证明不了', true);
  } else {
    push('randomness', true, '不适用 —— 时间起卦与报数起卦是确定性输入，没有随机过程需要承诺', true);
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

  return { ok: checks.filter(c => c.field !== 'anchor' && !c.na).every(c => c.ok), checks };
}

/** 下载用文件名：带上前 12 位摘要，用户自己存的一堆文件里能对上号。 */
export function receiptFileName(receipt: Receipt): string {
  return `hundun-${receipt.core.kind}-${receipt.recordHash.replace('sha256:', '').slice(0, 12)}.json`;
}
