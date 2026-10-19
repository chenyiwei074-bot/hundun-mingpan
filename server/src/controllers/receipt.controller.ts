// 回执摘要入账与状态查询（P1）。
// 契约：docs/receipt-v1.md（§6 服务端契约、§4 摘要定义、§7 台账集成）。
// 设计约束：
//  - 只存摘要，不存问题/姓名/生辰/报告原文；
//  - 台账内一律裸 hex（anchor_ledger 的 leaf 是 sha256(canon(record)) 裸 hex）；
//  - 幂等键 recordHash；文件按提交日（UTC）分片，锚定由 anchor_ledger 按"已过完的 UTC 日"处理；
//  - 不新增 DB 表，不改 Merkle 算法。
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const RECEIPTS_DIR = '/srv/chaos/output/receipts';
const ANCHORS_DIR = '/srv/chaos/output/anchors';
const SCHEMA = 'hundun-receipt-v1';
const HASH_RE = /^[0-9a-f]{64}$/;

/** 去 sha256: 前缀并小写；非法返回 null。 */
function normHash(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/^sha256:/i, '').toLowerCase();
  return HASH_RE.test(s) ? s : null;
}

/** 与 anchor_ledger.py 的 canon() 逐字节一致：键排序、无空格、非 ASCII 不转义。 */
function canonical(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(x as Record<string, unknown>).sort()) {
        const child = (x as Record<string, unknown>)[k];
        if (child === undefined) continue;
        out[k] = norm(child);
      }
      return out;
    }
    return x;
  };
  return JSON.stringify(norm(v));
}

const leafOf = (rec: unknown) =>
  crypto.createHash('sha256').update(canonical(rec), 'utf8').digest('hex');

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readLines(file: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) return [];
  const out: Record<string, unknown>[] = [];
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const rec = JSON.parse(s);
      if (rec && typeof rec === 'object') out.push(rec);
    } catch { /* 坏行跳过：不因一条坏行让整日不可查 */ }
  }
  return out;
}

export async function submitReceipt(req: Request, res: Response) {
  try {
    const visitorId = String(req.query.visitorId || req.query.visitor_id || req.headers['x-visitor-id'] || '').trim();
    if (!visitorId) return res.status(400).json({ ok: false, error: '缺少 visitorId' });

    const b = req.body || {};
    if (b.schemaVersion && b.schemaVersion !== SCHEMA) {
      return res.status(400).json({ ok: false, error: `不支持的 schemaVersion：${b.schemaVersion}` });
    }
    const recordHash = normHash(b.recordHash);
    const plateHash = normHash(b.plateHash);
    const subjectHash = normHash(b.subjectHash);
    const reportHash = b.reportHash == null ? null : normHash(b.reportHash);
    const parentHash = b.parentHash == null ? null : normHash(b.parentHash);
    if (!recordHash) return res.status(400).json({ ok: false, error: 'recordHash 必须是 64 位 hex（可带 sha256: 前缀）' });
    if (!plateHash) return res.status(400).json({ ok: false, error: 'plateHash 必须是 64 位 hex' });
    if (!subjectHash) return res.status(400).json({ ok: false, error: 'subjectHash 必须是 64 位 hex' });
    if (b.reportHash != null && !reportHash) return res.status(400).json({ ok: false, error: 'reportHash 非法' });
    if (b.parentHash != null && !parentHash) return res.status(400).json({ ok: false, error: 'parentHash 非法' });

    const day = utcDay();
    const dir = path.join(RECEIPTS_DIR, day.slice(0, 7));
    const file = path.join(dir, `${day}.jsonl`);
    ensureDir(dir);

    // 幂等：同 recordHash 不重复追加
    for (const rec of readLines(file)) {
      if (rec.recordHash === recordHash) {
        return res.json({ ok: true, day, already: true, leaf: leafOf(rec) });
      }
    }

    const rec: Record<string, unknown> = {
      schemaVersion: SCHEMA,
      kind: typeof b.kind === 'string' ? b.kind.slice(0, 40) : 'liuyao-plate',
      method: typeof b.method === 'string' ? b.method.slice(0, 20) : '',
      castAtUTC: typeof b.castAtUTC === 'string' ? b.castAtUTC.slice(0, 40) : '',
      tzOffsetMinutes: Number.isFinite(Number(b.tzOffsetMinutes)) ? Number(b.tzOffsetMinutes) : null,
      recordHash,
      plateHash,
      reportHash,
      parentHash,
      subjectHash,
      basis: b.basis && typeof b.basis === 'object' ? b.basis : {},
      submittedAtUTC: new Date().toISOString(),
    };
    fs.appendFileSync(file, JSON.stringify(rec) + '\n');
    return res.json({ ok: true, day, already: false, leaf: leafOf(rec) });
  } catch (e: any) {
    console.error('submitReceipt error:', e?.message);
    return res.status(500).json({ ok: false, error: '服务器错误' });
  }
}

export async function getReceiptStatus(req: Request, res: Response) {
  try {
    const recordHash = normHash(req.params.recordHash);
    if (!recordHash) return res.status(400).json({ ok: false, error: 'recordHash 非法' });

    // 在最近 45 天的分片里找这条记录
    const want = new Set<string>();
    const now = Date.now();
    for (let i = 0; i < 45; i++) want.add(utcDay(new Date(now - i * 86400000)));

    let found: { day: string; rec: Record<string, unknown> } | null = null;
    if (fs.existsSync(RECEIPTS_DIR)) {
      for (const month of fs.readdirSync(RECEIPTS_DIR)) {
        for (const name of fs.readdirSync(path.join(RECEIPTS_DIR, month))) {
          if (!name.endsWith('.jsonl')) continue;
          const day = name.slice(0, 10);
          if (!want.has(day)) continue;
          for (const rec of readLines(path.join(RECEIPTS_DIR, month, name))) {
            if (rec.recordHash === recordHash) { found = { day, rec }; break; }
          }
          if (found) break;
        }
        if (found) break;
      }
    }
    if (!found) return res.status(404).json({ ok: false, error: '回执摘要未提交或已过期（仅保留 45 天查询窗口；台账永久有效）' });

    const leaf = leafOf(found.rec);
    const manifestPath = path.join(ANCHORS_DIR, `${found.day}.json`);
    if (!fs.existsSync(manifestPath)) {
      return res.json({ ok: true, state: 'unanchored', day: found.day, leaf, reason: '当日尚未封账（锚定在次日 04:20 进行）' });
    }
    const man = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const inManifest = Array.isArray(man.leaves) && man.leaves.includes(leaf);
    if (!inManifest) {
      return res.json({ ok: true, state: 'unanchored', day: found.day, leaf, reason: '当日 manifest 不含此摘要（提交晚于封账时点）' });
    }
    const otsPath = path.join(ANCHORS_DIR, `${found.day}.ots`);
    return res.json({
      ok: true,
      state: 'pending', // 已入 manifest，但未经 ots verify 确认前不称"已锚定"
      day: found.day,
      leaf,
      root: man.root,
      prevRoot: man.prevRoot,
      manifestPath,
      otsPath: fs.existsSync(otsPath) ? otsPath : null,
      reason: '已进入当日 Merkle 台账；比特币证明确认后由运维置为 anchored',
    });
  } catch (e: any) {
    console.error('getReceiptStatus error:', e?.message);
    return res.status(500).json({ ok: false, error: '服务器错误' });
  }
}
