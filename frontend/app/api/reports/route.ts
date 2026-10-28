import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('POST /api/reports error:', e.message);
    return NextResponse.json({ success: false, error: '服务暂不可用' }, { status: 503 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const visitorId = req.headers.get('x-visitor-id') || searchParams.get('visitorId');
    const type = searchParams.get('type');
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    const headers: Record<string,string> = {};
    if (visitorId) headers['x-visitor-id'] = visitorId;

    const res = await fetch(`${BACKEND}/reports${params.size ? `?${params.toString()}` : ''}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('GET /api/reports error:', e.message);
    return NextResponse.json({ success: false, error: '服务暂不可用' }, { status: 503 });
  }
}