import { NextResponse } from 'next/server';

// NEXT_PUBLIC_API_URL 在部分环境里是相对路径（如 /api），fetch 会解析失败 → 只接受绝对 URL，否则兜底本机后端
const RAW = process.env.NEXT_PUBLIC_API_URL || '';
const BACKEND = /^https?:\/\//.test(RAW) ? RAW.replace(/\/$/, '') : 'http://127.0.0.1:3000';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const visitorId = new URL(req.url).searchParams.get('visitorId') || '';
      const res = await fetch(`${BACKEND}/reports/${id}?visitorId=${encodeURIComponent(visitorId)}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('GET /api/reports/[id] error:', e.message);
    return NextResponse.json({ success: false, error: '服务暂不可用' }, { status: 503 });
  }
}