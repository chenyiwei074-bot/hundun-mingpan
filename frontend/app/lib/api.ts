import type { CreateChartPayload } from '@/lib/api/contract';
import { getVisitorId } from '@/lib/auth/visitor';
import type { DirectPillarsInput, DirectPillarsResult } from '@/lib/bazi/direct-pillars';

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

/** 仅按用户提供的四柱计算八字增强结果；不创建完整命盘或持久化记录。 */
export async function calculateDirectPillars(siZhu: DirectPillarsInput): Promise<DirectPillarsResult> {
  const res = await fetch(API_BASE + '/bazi/pillars/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siZhu }),
  });
  const json = await res.json().catch(() => null);
  const data = json?.data;
  if (!res.ok || json?.success === false || !data || typeof data !== 'object' || !data.siZhu || !data.enrichment) {
    throw new Error(json?.error || '四柱结构暂时无法计算，请稍后重试。');
  }
  return data as DirectPillarsResult;
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

export type ChartShareLink = {
  shareId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};

export async function listChartShareLinks(id: string) {
  const res = await fetch(API_BASE + "/chart/" + encodeURIComponent(id) + "/share-links", {
    headers: visitorHeaders(),
  });
  const json = await res.json();
  return { ...json, httpStatus: res.status };
}

export async function revokeAllChartShareLinks(id: string) {
  const res = await fetch(API_BASE + "/chart/" + encodeURIComponent(id) + "/share-links", {
    method: 'DELETE',
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





export type ChinaGeoLookup = { lng: number; lat: number; tz: string; src: 'city' | 'county' | 'province'; precision?: 'district' | 'city' | 'province'; districtMatched?: boolean };

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
    return { lng: d.lng, lat: d.lat, tz: d.tz, src: d.src,
      precision: d.precision, districtMatched: d.districtMatched === true };
  } catch { return null; }
}


export type TarotSpreadId = 'single' | 'three-card' | 'five-card' | 'celtic-cross';
export type TarotPosition = '指引' | '过去' | '现在' | '未来' | '建议' | '结果' | '现状' | '挑战' | '目标' | '潜在' | '态度' | '环境' | '希望与恐惧';
export type TarotReadingCard = {
  cardId: string; nameZh: string; position: TarotPosition;
  orientation: '正位' | '逆位'; text: string; source: string; sourceIds: string[];
};
export type TarotReadingResponse = {
  readingId: string; spread: TarotSpreadId; spreadLabel: string;
  mode: 'ai' | 'rules-only' | 'rules-fallback'; aiReady: boolean; model?: string;
  createdAt: string; cards: TarotReadingCard[]; summary: string; notes: string[];
};
export type TarotSavedReading = {
  spread: TarotSpreadId; spreadLabel?: string;
  mode?: 'ai' | 'rules-only' | 'rules-fallback'; aiReady?: boolean;
  cards: { cardId: string; nameZh?: string; position: TarotPosition; orientation: '正位' | '逆位'; text: string; source?: string; sourceIds?: string[] }[];
  summary: string; notes: string[];
};
export type TarotSavedReadingListItem = { id: string; title: string; createdAt: string };
export type TarotSavedReadingDetail = TarotSavedReadingListItem & { reading: TarotSavedReading };

export async function createTarotReading(input: {
  question?: string; spread: TarotSpreadId;
  cards: { cardId: string; position: TarotPosition; orientation: '正位' | '逆位' }[];
}): Promise<TarotReadingResponse> {
  const res = await fetch(API_BASE + '/tarot/reading', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) throw new Error(json?.error || '综合解读暂时不可用');
  return json.data as TarotReadingResponse;
}

async function requestTarotRecord<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(API_BASE + path, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || fallback);
  return json.data as T;
}

export async function saveTarotReading(visitorId: string, question: string, reading: TarotSavedReading) {
  if (!visitorId) throw new Error('无法识别本机记录身份，请刷新页面后重试');
  return requestTarotRecord<{ id: string; createdAt: string }>('/tarot/readings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, question, reading }),
  }, '保存塔罗记录失败');
}

export async function listTarotReadings(visitorId: string) {
  if (!visitorId) throw new Error('无法识别本机记录身份，请刷新页面后重试');
  return requestTarotRecord<TarotSavedReadingListItem[]>('/tarot/readings', { headers: visitorHeaders() }, '加载塔罗记录失败');
}

export async function getTarotReading(visitorId: string, id: string) {
  if (!visitorId) throw new Error('无法识别本机记录身份，请刷新页面后重试');
  return requestTarotRecord<TarotSavedReadingDetail>(`/tarot/readings/${encodeURIComponent(id)}`, { headers: visitorHeaders() }, '记录不存在或已过期');
}

export async function deleteTarotReading(visitorId: string, id: string) {
  if (!visitorId) throw new Error('无法识别本机记录身份，请刷新页面后重试');
  return requestTarotRecord<{ deleted: true }>(`/tarot/readings/${encodeURIComponent(id)}`, { method: 'DELETE', headers: visitorHeaders() }, '删除塔罗记录失败');
}
