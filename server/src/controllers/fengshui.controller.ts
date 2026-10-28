/**
 * 户型图上传与识别（Express 侧）。
 *
 * 契约（2026-10-20 裁定）：
 *  - 上传图只用于识别，存 /srv/chaos/uploads/floorplan/<visitorId>/<uuid>.<ext>，
 *    仅本人凭 visitorId 可取；7 天自动删除（tools/floorplan_cleanup.py + cron）；
 *    不进报告/回执/台账，无公开直链。
 *  - 识别只出"候选几何"，用户在 2D 编辑器里确认后才进规则层/3D——这里不替用户下结论。
 *  - 失败必须结构化返回（code + message），前端据此显示"识别服务未开放/失败"，不许静默回落。
 */
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { recognizeFloorPlan, type RecognizedPlan } from '../services/vision.service';

const ROOT = '/srv/chaos/uploads/floorplan';
const MAX_BYTES = 5 * 1024 * 1024;
const VISITOR_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const PUBLIC_FAIL_MESSAGE: Record<string, string> = {
  not_floorplan: '这张图里没有识别出清晰的户型结构，请换一张俯视户型图或手工绘制。',
  timeout: '图片识别超时，请稍后重试或手工绘制。',
  bad_json: '图片识别结果暂时无法解析，请稍后重试或手工绘制。',
  provider_error: '图片识别服务暂时不可用，请稍后重试或手工绘制。',
  no_provider: '图片识别服务暂时不可用，请稍后重试或手工绘制。',
};

/** 对外只保留用户可用的几何与图片元数据，不含模型/供应商/尝试记录。 */
function publicPlan(plan: RecognizedPlan) {
  return {
    rooms: plan.rooms,
    walls: plan.walls,
    doors: plan.doors,
    windows: plan.windows,
    notes: plan.notes,
  };
}

const MAGIC: Array<{ ext: 'jpg' | 'png' | 'webp'; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: 'jpg', mime: 'image/jpeg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'webp', mime: 'image/webp', test: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ ok: false, code, message });
}

export async function recognize(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as { visitorId?: unknown; imageBase64?: unknown };
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
    if (!VISITOR_RE.test(visitorId)) return fail(res, 400, 'bad_visitor', 'visitorId 不合法');
    const raw = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    if (!raw) return fail(res, 400, 'bad_image', '缺 imageBase64');
    // 接受 data URL 或裸 base64；先按字符串长度粗筛，再做字节级校验
    const b64 = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw;
    if (b64.length > Math.ceil(MAX_BYTES * 4 / 3) + 16) return fail(res, 413, 'too_large', '图超过 5MB');
    let buf: Buffer;
    try { buf = Buffer.from(b64, 'base64'); } catch { return fail(res, 400, 'bad_image', 'base64 解不开'); }
    if (!buf.length || buf.length > MAX_BYTES) return fail(res, 413, 'too_large', '图超过 5MB');
    const kind = MAGIC.find(m => m.test(buf));
    if (!kind) return fail(res, 415, 'bad_type', '只接受 jpg / png / webp（按文件头判断，不信扩展名）');

    const dir = path.join(ROOT, visitorId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const id = randomUUID();
    writeFileSync(path.join(dir, `${id}.${kind.ext}`), buf, { mode: 0o600 });

    const outcome = await recognizeFloorPlan(`data:${kind.mime};base64,${b64}`);
    if (!outcome.ok) {
      const status = outcome.code === 'not_floorplan' ? 422 : outcome.code === 'timeout' ? 504 : 503;
      // 公开失败体只留固定 code 与可执行中文；原始错误/供应商/attempts 只留在服务端。
      return res.status(status).json({
        ok: false,
        code: outcome.code || 'provider_error',
        message: PUBLIC_FAIL_MESSAGE[outcome.code || 'provider_error'] || PUBLIC_FAIL_MESSAGE.provider_error,
        imageId: id,
      });
    }
    return res.json({
      ok: true, imageId: id, imageMime: kind.mime, imageBytes: buf.length,
      plan: publicPlan(outcome.plan!),
    });
  } catch (e) {
    console.error('[fengshui/recognize] 失败:', e instanceof Error ? e.message : e);
    return fail(res, 500, 'internal', '识别服务内部错误');
  }
}

/** 取回自己上传的图：只认 visitorId + id，路径全部走白名单拼接。 */
export function getFloorPlanImage(req: Request, res: Response) {
  const visitorId = String(req.query.visitorId || req.header('x-visitor-id') || '').trim();
  const id = String(req.params.id || '').trim();
  if (!VISITOR_RE.test(visitorId)) return fail(res, 400, 'bad_visitor', 'visitorId 不合法');
  if (!UUID_RE.test(id)) return fail(res, 400, 'bad_id', 'id 不合法');
  for (const ext of ['jpg', 'png', 'webp'] as const) {
    const p = path.join(ROOT, visitorId, `${id}.${ext}`);
    if (existsSync(p) && statSync(p).isFile()) {
      res.type(ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
      res.setHeader('Cache-Control', 'private, max-age=0, no-store');
      return res.send(readFileSync(p));
    }
  }
  return fail(res, 404, 'not_found', '找不到这张图（可能已过 7 天保留期）');
}

/** DELETE /api/fengshui/image/:id?visitorId=... —— 立即删除主存储里的图（幂等）。
 *  备份里可能还有一份，最迟随备份保留期（7 天）滚动消失；模型服务侧副本不由本站控制。 */
export function deleteFloorPlanImage(req: Request, res: Response) {
  const visitorId = String(req.query.visitorId || req.header('x-visitor-id') || '').trim();
  const id = String(req.params.id || '').trim();
  if (!VISITOR_RE.test(visitorId)) return fail(res, 400, 'bad_visitor', 'visitorId 不合法');
  if (!UUID_RE.test(id)) return fail(res, 400, 'bad_id', 'id 不合法');
  let removed: string | null = null;
  for (const ext of ['jpg', 'png', 'webp'] as const) {
    const p = path.join(ROOT, visitorId, `${id}.${ext}`);
    if (existsSync(p) && statSync(p).isFile()) {
      try { unlinkSync(p); removed = ext; } catch (e) {
        console.error('[fengshui/delete] 删除失败:', e instanceof Error ? e.message : e);
        return fail(res, 500, 'delete_failed', '删除失败');
      }
      break;
    }
  }
  // 幂等：文件本来就不在（已删/过期）也算成功
  return res.json({ ok: true, removed: !!removed });
}

