// 问事的一次调用：先问服务端，问不到就用本机目录路由，并且把"为什么没用到模型"带回去。
//
// 这一层刻意不做任何"看起来更聪明"的事：服务端没上线（现在就是没上线）、超时、
// 返回形状不对，一律回落，并且回落的原因要能在页面上读出来。
// 把目录关键词匹配显示成"AI 的结果"，是这一整条链路上最容易犯、也最难看出的假。

import type { ToolEntry } from '@/lib/tools/catalog';
import { ASSISTANT_PROTOCOL, parseRouteResult, reconcile } from './types';
import type { AssistantRouteResult, Mode } from './types';
import { isMonthlyFortuneQuestion, routeLocal } from './intent';

// 缺陷①（批10 核出、运维已裁）：这里原来打的是 '/api/assistant/route'，
// 而路由文件 app/api/assistant/route.ts 导出的路径是 '/api/assistant' —— 多出来的那一段
// 让服务端那一发永远 404，每次都静默回落本机，页面却把回落说成"这一轮来自本机"。
// 路径与路由必须一致由 tools/assistant-acceptance 的 route/endpoint-matches-route 钉住。
const ROUTE_ENDPOINT = '/api/assistant';
const TIMEOUT_MS = 6000;

export interface RouteOutcome {
  result: AssistantRouteResult;
  source: 'local' | 'server';
  /** 为什么没走服务端。null 表示这次真的用的是服务端。上屏用。 */
  degraded: string | null;
}

export async function askRoute(args: {
  mode: Mode;
  text: string;
  catalog: ToolEntry[];
  otherCatalog: ToolEntry[];
  fetchImpl?: typeof fetch;
}): Promise<RouteOutcome> {
  const local = (): RouteOutcome => ({
    result: reconcile(routeLocal(args.mode, args.text, args.catalog, args.otherCatalog), args.mode, args.catalog),
    source: 'local',
    degraded: null,
  });

  const trimmed = args.text.trim();
  if (trimmed.length === 0) {
    return { ...local(), degraded: '还没输入问题' };
  }
  if (isMonthlyFortuneQuestion(trimmed)) {
    return { ...local(), degraded: '月运问法按本站已实现的节月工具范围匹配，避免混入其他体系' };
  }

  const doFetch = args.fetchImpl ?? globalThis.fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await doFetch(ROUTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: ASSISTANT_PROTOCOL, mode: args.mode, text: trimmed }),
      signal: ctrl.signal,
    });
    // 网关把 /api/* 整段转给后端，路由不存在时回的是 404/502 的 HTML —— 这两种都算"没上线"，
    // 不是错误：页面照常给目录式结果。
    if (!res.ok) return { ...local(), degraded: `服务端返回 ${res.status}` };
    const json = await res.json().catch(() => null);
    const body = json && typeof json === 'object'
      ? (((json as { data?: unknown }).data ?? json) as Record<string, unknown>) : null;
    const parsed = body ? parseRouteResult(body) : null;
    if (!parsed) return { ...local(), degraded: '服务端返回的形状不符合 ' + ASSISTANT_PROTOCOL };
    if (parsed.mode !== args.mode) return { ...local(), degraded: '服务端答的是另一套体系，按没答处理' };
    // 这一轮到底是谁算的，以**响应里说的那一句**为准，不以"HTTP 200"为准。
    // 2026-10-22 实测生产：/api/assistant 回 200，但 data 里带着 source:"local" 与
    // degraded:"上游回的形状不合协议" —— 服务端自己也回落了本机目录。只看 HTTP 状态就标
    // 「这一轮来自服务端路由」，等于把一次本机关键词匹配说成模型算的，正是这条链路最不该犯的错。
    const who = body?.source;
    if (who === 'local') {
      const why = typeof body?.degraded === 'string' && body.degraded ? body.degraded : '服务端说它用的也是本机目录';
      return { result: reconcile(parsed, args.mode, args.catalog), source: 'local', degraded: why };
    }
    if (who !== 'server') {
      // 没报来源 = 不知道是谁算的。宁可退回"本机"这一档并写明原因，也不要替它认下"服务端算的"。
      return { ...local(), degraded: '服务端没说明这一轮是谁算的，按没用到处理' };
    }
    return { result: reconcile(parsed, args.mode, args.catalog), source: 'server', degraded: null };
  } catch (e) {
    const why = (e as Error)?.name === 'AbortError' ? `服务端 ${TIMEOUT_MS / 1000}s 没回话` : '服务端不可达';
    return { ...local(), degraded: why };
  } finally {
    clearTimeout(timer);
  }
}
