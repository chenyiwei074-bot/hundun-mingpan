import type { CreateChartPayload } from '@/lib/api/contract';
import { getVisitorId } from '@/lib/auth/visitor';

/** chart status/result 现在要求本人标识；没有标识时请求会 401（而不是拿到别人的盘）。 */
function visitorHeader(): Record<string, string> {
  const id = getVisitorId();
  return id ? { 'x-visitor-id': id } : {};
}

const API_BASE = "/api";

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
  const res = await fetch(API_BASE + "/chart/status/" + id, { headers: visitorHeader() });
  return res.json();
}

export async function getChartResult(id: string) {
  const res = await fetch(API_BASE + "/chart/result/" + id, { headers: visitorHeader() });
  const json = await res.json();
  return { ...json, httpStatus: res.status };
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




