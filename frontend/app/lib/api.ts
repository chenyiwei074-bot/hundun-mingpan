const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface FreeContent {
  bazi: Record<string, unknown>;
  ziwei: Record<string, unknown>;
  keywords: string[];
}

export interface UnlockItem {
  title: string;
  desc: string;
}


export interface ChartCreateResponse {
  id: string;
  status: string;
  freeContent?: FreeContent;
  quota?: { used: number; remaining: number; limit: number };
}
export interface ChartResultData {
  id: string;
  name: string;
  posterHtml: string;
  posterUrl: string;
  freeContent: FreeContent;
  unlockDescription: UnlockItem[];
  freeViews: number;
}

export async function createChart(data: {
  visitor_id: string;
  name: string;
  gender: string;
  calendar: string;
  birthday: string;
  birthPlace: string;
  currentPlace: string;
}) {
  const res = await fetch(API_BASE + '/chart/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getChartStatus(id: string) {
  const res = await fetch(API_BASE + '/chart/status/' + id);
  return res.json();
}

export async function getChartResult(id: string) {
  const url = API_BASE + '/chart/result/' + id;
  console.log('[DEBUG getChartResult] Fetching:', url);
  const res = await fetch(url);
  const json = await res.json();
  const result = { ...json, httpStatus: res.status };
  console.log('[DEBUG getChartResult] Response:', { httpStatus: res.status, success: json.success, hasData: !!json.data, keys: json.data ? Object.keys(json.data) : [] });
  return result;
}

export async function getQuota(visitorId: string) {
  const res = await fetch(API_BASE + '/chart/quota?visitor_id=' + visitorId);
  return res.json();
}

export async function trackEvent(event_name: string, visitor_id: string, chart_id?: string) {
  try {
    await fetch(API_BASE + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name, visitor_id, chart_id }),
    });
  } catch {}
}
