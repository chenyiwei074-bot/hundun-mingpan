import type { CreateChartPayload } from '@/lib/api/contract';
import { getVisitorId } from '@/lib/auth/visitor';

const API_BASE = "/api";

function visitorHeaders(): Record<string, string> {
  const visitorId = getVisitorId();
  return visitorId ? { 'x-visitor-id': visitorId } : {};
}

/** 类型直接引契约层：`gender`/`calendar` 以前是裸 string，
 *  于是 '四柱' 这种后端枚举里没有的值也能通过类型检查发出去（D6 就是这么中的）。 */
export async function createChart(data: CreateChartPayload) {
  const res = await fetch(API_BASE + "/chart/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getChartStatus(id: string) {
  const res = await fetch(API_BASE + "/chart/status/" + encodeURIComponent(id), {
    headers: visitorHeaders(),
  });
  return res.json();
}

export async function getChartResult(id: string) {
  const res = await fetch(API_BASE + "/chart/result/" + encodeURIComponent(id), {
    headers: visitorHeaders(),
  });
  const json = await res.json();
  return { ...json, httpStatus: res.status };
}

export async function createChartShareLink(id: string) {
  const res = await fetch(API_BASE + "/chart/" + encodeURIComponent(id) + "/share-links", {
    method: 'POST',
    headers: visitorHeaders(),
  });
  const json = await res.json();
  return { ...json, httpStatus: res.status };
}

export async function getSharedChart(token: string) {
  const res = await fetch(API_BASE + "/chart/share/" + encodeURIComponent(token));
  const json = await res.json();
  return { ...json, httpStatus: res.status };
}

export async function revokeChartShareLink(id: string, shareId: string) {
  const res = await fetch(
    API_BASE + "/chart/" + encodeURIComponent(id) + "/share-links/" + encodeURIComponent(shareId),
    { method: 'DELETE', headers: visitorHeaders() },
  );
  const json = await res.json();
  return { ...json, httpStatus: res.status };
}

export type ClassicSource = {
  sourceId: string;
  book: string;
  chapter: string;
  edition: string;
  language: 'zh' | 'en';
  quote: string;
};

export async function getClassicSources(ids: string[]) {
  if (ids.length === 0) return [] as ClassicSource[];
  if (ids.length > 50) throw new Error('单次最多读取 50 条出处');
  const query = new URLSearchParams({ ids: ids.join(',') });
  const res = await fetch(API_BASE + '/classics/sources?' + query.toString());
  const json = await res.json();
  if (!res.ok || json?.success === false) throw new Error('文献出处暂时无法读取');
  const sources = json?.data?.sources;
  if (!Array.isArray(sources)) throw new Error('文献出处暂时无法读取');
  return sources as ClassicSource[];
}

export async function trackEvent(event_name: string, visitor_id: string, chart_id?: string) {
  try {
    await fetch(API_BASE + "/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name, visitor_id, chart_id }),
    });
  } catch {}
}





export type ChinaGeoLookup = { lng: number; lat: number; tz: string; src: 'city' | 'county' | 'province' };

/** 后端地点/时区接口。失败时返回 null，调用方回退到本地数据，不阻塞页面。 */
export async function lookupChinaGeo(province: string, city?: string, district?: string): Promise<ChinaGeoLookup | null> {
  const q = new URLSearchParams({ province });
  if (city) q.set('city', city);
  if (district) q.set('district', district);
  try {
    const res = await fetch(API_BASE + '/geo/lookup?' + q.toString());
    const json = await res.json();
    if (!res.ok || json?.success === false) return null;
    const d = json?.data;
    if (!d || !Number.isFinite(d.lng) || !Number.isFinite(d.lat) || typeof d.tz !== 'string') return null;
    return { lng: d.lng, lat: d.lat, tz: d.tz, src: d.src };
  } catch { return null; }
}


export type TarotReadingCard = {
  cardId: string; nameZh: string; position: '过去' | '现在' | '未来';
  orientation: '正位' | '逆位'; text: string; source: string; sourceIds: string[];
};
export type TarotReadingResponse = {
  readingId: string; mode: 'rules-only'; aiReady: false; model: 'hundun-tarot-rules-v1';
  createdAt: string; cards: TarotReadingCard[]; summary: string; notes: string[];
};
export async function createTarotReading(input: {
  question?: string; spread: 'three-card';
  cards: { cardId: string; position: '过去' | '现在' | '未来'; orientation: '正位' | '逆位' }[];
}): Promise<TarotReadingResponse> {
  const res = await fetch(API_BASE + '/tarot/reading', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) throw new Error(json?.error || '综合解读暂时不可用');
  return json.data as TarotReadingResponse;
}
