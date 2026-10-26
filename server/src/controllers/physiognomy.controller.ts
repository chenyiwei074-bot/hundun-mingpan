import type { Request, Response } from 'express';
import { recognizePhysiognomy, type HandSide, type PhysiognomyKind } from '../services/physiognomy.service';

const MAX_BYTES = 5 * 1024 * 1024;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAGIC = [
  { mime: 'image/jpeg', matches: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', matches: (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { mime: 'image/webp', matches: (b: Buffer) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
] as const;

function error(res: Response, status: number, code: string, message: string) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ ok: false, code, message });
}

export async function recognizePhysiognomyImage(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
    ? req.body as Record<string, unknown>
    : {};
  let imageDataUrl = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  try {
    const kind = body.kind;
    if (Object.keys(body).some(key => !['kind', 'consent', 'hand', 'imageBase64'].includes(key))) {
      return error(res, 400, 'invalid_request', '请求字段不符合要求。');
    }
    if (kind !== 'face' && kind !== 'palm') return error(res, 400, 'invalid_request', '请选择面相或手相识别。');
    if (body.consent !== true) return error(res, 400, 'consent_required', '请先确认照片使用与授权说明。');
    let hand: HandSide | undefined;
    if (kind === 'palm') {
      if (body.hand !== 'left' && body.hand !== 'right') return error(res, 400, 'invalid_request', '请选择左手或右手。');
      hand = body.hand;
    } else if (Object.prototype.hasOwnProperty.call(body, 'hand')) {
      return error(res, 400, 'invalid_request', '面相请求不能包含手掌选项。');
    }
    if (!imageDataUrl) return error(res, 400, 'invalid_request', '请选择照片后再开始识别。');
    const match = DATA_URL_RE.exec(imageDataUrl);
    if (!match) return error(res, 415, 'bad_type', '只接受与文件内容一致的 JPG、PNG 或 WebP 图片。');
    if (match[2].length > Math.ceil(MAX_BYTES * 4 / 3) + 4) return error(res, 413, 'too_large', '单张图片不能超过 5 MB。');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length) return error(res, 415, 'bad_type', '图片内容无法读取，请重新选择文件。');
    if (bytes.length > MAX_BYTES) return error(res, 413, 'too_large', '单张图片不能超过 5 MB。');
    const detected = MAGIC.find(item => item.matches(bytes));
    if (!detected || detected.mime !== match[1]) return error(res, 415, 'bad_type', '图片格式与文件内容不一致，请重新选择 JPG、PNG 或 WebP。');

    const result = await recognizePhysiognomy({ kind: kind as PhysiognomyKind, hand, imageDataUrl });
    if (!result.ok) {
      const status = result.code === 'timeout' ? 504
        : result.code === 'vision_unavailable' ? 503
        : result.code === 'low_confidence' ? 422
        : 422;
      return error(res, status, result.code, result.message);
    }
    return res.status(200).json(result);
  } catch {
    // Never log request bodies or provider errors: the payload can contain a face/palm image.
    return error(res, 500, 'vision_unavailable', '图片识别暂时不可用，请稍后再试。');
  } finally {
    imageDataUrl = '';
    if (typeof body.imageBase64 === 'string') body.imageBase64 = '';
  }
}