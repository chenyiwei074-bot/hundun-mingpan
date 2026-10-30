import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// In local Next development, forward the same-origin browser request to the
// Express API. Production normally routes /api directly to Express at Nginx;
// if it reaches this handler, the same internal API origin is used.
const API_BASE = (process.env.HUNDUN_BACKEND_API_BASE || 'http://127.0.0.1:3000/api').replace(/\/$/, '');
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ success: false, code: 'invalid_request', error: '请求内容无法读取。' }, { status: 400 });
  }

  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, code: 'request_too_large', error: '请求内容过长。' }, { status: 413 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/avatar/brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('x-visitor-id') ? { 'x-visitor-id': request.headers.get('x-visitor-id')! } : {}),
      },
      body,
      cache: 'no-store',
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ success: false, code: 'service_unavailable', error: '主题服务暂时无法连接，请稍后重试。' }, { status: 503 });
  }
}
