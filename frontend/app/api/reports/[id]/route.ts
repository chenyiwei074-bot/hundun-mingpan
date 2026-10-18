import { NextResponse } from 'next/server';

// NEXT_PUBLIC_API_URL 在不同环境可能是绝对地址或相对路径（/api）：
// 相对路径不能在服务端 fetch（会 Failed to parse URL），而丢掉 /api 前缀又会打到 Express 404（返回 HTML）。
// 统一规范成「后端 origin + /api」。
const RAW = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const BASE = /^https?:\/\//.test(RAW)
  ? RAW
  : `http://127.0.0.1:3000${RAW.startsWith('/') ? RAW : '/api'}`;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const visitorId = new URL(req.url).searchParams.get('visitorId') || '';
      const res = await fetch(`${BASE}/reports/${id}?visitorId=${encodeURIComponent(visitorId)}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('GET /api/reports/[id] error:', e.message);
    return NextResponse.json({ success: false, error: '服务暂不可用' }, { status: 503 });
  }
}