const API_BASE = "http://localhost:3000/api";

export async function createChart(data: {
  visitor_id: string;
  name: string;
  gender: string;
  calendar: string;
  birthday: string;
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

export async function getQuota(visitorId: string) {
  const res = await fetch(API_BASE + "/chart/quota?visitor_id=" + visitorId);
  return res.json();
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

// ===== 报告订单 API =====

export async function createReportOrder(chartId: string, email: string) {
  const res = await fetch(API_BASE + "/report/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chartId, email }),
  });
  return res.json();
}

export async function getReportStatus(orderId: string) {
  const res = await fetch(API_BASE + "/report/status/" + orderId);
  return res.json();
}

export async function confirmReportPayment(orderId: string) {
  const res = await fetch(API_BASE + "/report/confirm-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  return res.json();
}
