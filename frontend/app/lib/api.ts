const API_BASE = "/api";

export async function createChart(data: {
  visitor_id: string;
  name: string;
  gender: string;
  calendar: string;
  birthday: string;
  /** 农历闰月位。additive：老客户端不传，后端未接收时按平月处理。 */
  isLeapMonth?: boolean;
  birthPlace: string;
  currentPlace: string;
}) {
  const res = await fetch(API_BASE + "/chart/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getChartStatus(id: string) {
  const res = await fetch(API_BASE + "/chart/status/" + id);
  return res.json();
}

export async function getChartResult(id: string) {
  const url = API_BASE + "/chart/result/" + id;
  console.log("[DEBUG getChartResult] Fetching:", url);
  const res = await fetch(url);
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




