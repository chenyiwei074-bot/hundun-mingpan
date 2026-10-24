import type { Request } from 'express';

/** 从请求里读"本人标识"：优先请求头，兼容 query。
 *  这是持有型凭据（visitorId cookie 的同名值），不是登录态；只在服务端做归属比对，
 *  不在这里做任何"可信"假设。 */
export function readVisitorId(req: Request): string {
  const header = req.header('x-visitor-id');
  const query = req.query.visitor_id ?? req.query.visitorId;
  const value = (typeof header === 'string' && header)
    || (typeof query === 'string' && query)
    || (Array.isArray(query) && typeof query[0] === 'string' ? query[0] : '')
    || '';
  const trimmed = value.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(trimmed) ? trimmed : '';
}
