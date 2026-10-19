// 问事的一次调用：先问服务端，问不到就用本机目录路由，并且把"为什么没用到模型"带回去。
//
// 这一层刻意不做任何"看起来更聪明"的事：服务端没上线（现在就是没上线）、超时、
// 返回形状不对，一律回落，并且回落的原因要能在页面上读出来。
// 把目录关键词匹配显示成"AI 的结果"，是这一整条链路上最容易犯、也最难看出的假。

import type { ToolEntry } from '@/lib/tools/catalog';
import { ASSISTANT_PROTOCOL, parseRouteResult, reconcile } from './types';
import type { AssistantRouteResult, Mode } from './types';
import { routeLocal } from './intent';

const ROUTE_ENDPOINT = '/api/assistant/route';
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
    const parsed = json && typeof json === 'object'
      ? parseRouteResult((json as { data?: unknown }).data ?? json) : null;
    if (!parsed) return { ...local(), degraded: '服务端返回的形状不符合 ' + ASSISTANT_PROTOCOL };
    if (parsed.mode !== args.mode) return { ...local(), degraded: '服务端答的是另一套体系，按没答处理' };
    return { result: reconcile(parsed, args.mode, args.catalog), source: 'server', degraded: null };
  } catch (e) {
    const why = (e as Error)?.name === 'AbortError' ? `服务端 ${TIMEOUT_MS / 1000}s 没回话` : '服务端不可达';
    return { ...local(), degraded: why };
  } finally {
    clearTimeout(timer);
  }
}
