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




