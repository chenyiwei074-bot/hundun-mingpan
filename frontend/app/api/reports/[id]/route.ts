import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await fetch(`${BACKEND}/reports/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    console.error('GET /api/reports/[id] error:', e.message);
    return NextResponse.json({ success: false, error: '服务暂不可用' }, { status: 503 });
  }
}