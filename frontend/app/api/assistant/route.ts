import { NextResponse } from 'next/server';
import {
  MAX_BODY, PROTOCOL, acceptModelResult, askModel, checkBodyBytes, localFallback, readUpstream, validateRequest,
} from '@/lib/assistant/server-route';
import type { Mode } from '@/lib/assistant/types';

// POST /api/assistant —— 问事路由的服务端入口。
//
// 线上要通还差运维那一半：需要一条
// `location = /api/assistant { proxy_pass frontend; proxy_read_timeout 120s; limit_req zone=api_expensive; }`。
// 模型实测 94–116s，默认 60s 必 504，所以这条超时不能省。
// 在这一条加上之前，本 handler 是否可达不作主张：仓库里那份 nginx 副本与线上不一致（运维已确认），
// 判可达性只能打线上，不能读仓库副本。不可达时前端会回落本机路由，页面照常可用。
//
// 模型不可用（没配 key、超时、回歪）不是错误，是回落：响应里 source 会写 local，
// 页面上明写"这一轮由本机目录匹配给出，未经模型"。

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const started = Date.now();
  let raw: unknown = null;
  try {
    // content-length 先看一眼：明显的超大请求不必读进内存再丢。这是软闸，
    // 硬闸在 nginx 的 client_max_body_size；两者都拦不住"分块传输不带 length"，
    // 所以读完之后还要按真实 UTF-8 字节再量一次（checkBodyBytes）。
    const clen = Number(req.headers.get('content-length') || '0');
    if (clen > 0 && clen > MAX_BODY) {
      return NextResponse.json({ success: false, error: '请求体过大',
        errors: [{ field: 'body', code: 'body_too_large', msg: `content-length ${clen} > ${MAX_BODY}` }] }, { status: 413 });
    }
    const body = await req.text();
    const over = checkBodyBytes(body);
    if (over) return NextResponse.json({ success: false, error: over.errors[0].msg, errors: over.errors }, { status: over.status });
    raw = body ? JSON.parse(body) : null;
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是合法 JSON',
      errors: [{ field: 'body', code: 'body_shape', msg: '请求体不是合法 JSON' }] }, { status: 400 });
  }

  const v = validateRequest(raw);
  if (!v.ok) {
    // 结构化错误一次报全：只回一句人话，客户端就没法按字段定位，
    // 而"发现第一个错就返回"会让人一屏一屏地试错。
    return NextResponse.json({ success: false, error: v.errors[0].msg, errors: v.errors }, { status: v.status });
  }

  const u = readUpstream();
  if (!u) {
    // 没配 key：仍然给一个可用答案（本机路由），并说明来源。
    return respond(v.mode, v.text, localFallback(v.mode, v.text), 'local', '未配置 AI API Key', started);
  }
  const up = await askModel(u, v.mode, v.text);
  if (!up.ok) {
    return respond(v.mode, v.text, localFallback(v.mode, v.text), 'local', up.why, started);
  }
  // 兜底再核一次：就算 askModel 那关放过了，出口这里仍然过白名单
  return respond(v.mode, v.text, acceptModelResult(v.mode, up.result) ?? localFallback(v.mode, v.text),
    'server', null, started);
}

function respond(mode: Mode, question: string, result: ReturnType<typeof localFallback>,
  source: 'local' | 'server', degraded: string | null, started: number) {
  // 日志里只有长度、模式、来源与耗时 —— 问题原文一个字都不落。
  console.log(`[assistant] mode=${mode} source=${source} degraded=${degraded || '-'}`
    + ` chars=${Array.from(question).length} ms=${Date.now() - started}`);
  return NextResponse.json({ success: true, data: { protocol: PROTOCOL, ...result, source, degraded } });
}
