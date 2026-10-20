import { NextResponse } from 'next/server';
import {
  MAX_BODY, PROTOCOL, acceptModelResult, askModel, localFallback, readUpstream, validateRequest,
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
    // 字节上限先看 content-length。MAX_BODY 按 JS 字符数算，中文一个字占 3 字节，
    // 只卡字符数等于把真正的体积上限放大了三倍 —— 兜底的硬闸在 nginx（client_max_body_size），
    // 这里这一条只是让明显的超大请求不必先读进内存再丢。
    const clen = Number(req.headers.get('content-length') || '0');
    if (clen > 0 && clen > MAX_BODY * 4) {
      return NextResponse.json({ success: false, error: '请求体过大' }, { status: 413 });
    }
    const text = await req.text();
    if (text.length > MAX_BODY) {
      return NextResponse.json({ success: false, error: '请求体过大' }, { status: 413 });
    }
    raw = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const v = validateRequest(raw);
  if (!v.ok) return NextResponse.json({ success: false, error: v.error }, { status: v.status });

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
