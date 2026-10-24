import crypto from 'node:crypto';

/** 分享链接有效期固定 168 小时，不接受客户端自定义。 */
export const SHARE_TTL_HOURS = 168;

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
const COMPLETE_STATUSES = new Set(['complete', 'completed']);

export function isChartComplete(status: string): boolean {
  return COMPLETE_STATUSES.has(status);
}

export function isValidShareToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** 32 字节 CSPRNG → base64url（43 字符）。 */
export function newShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** 库里只存 token 的 SHA-256 裸 hex，不存原始令牌。 */
export function hashShareToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function shareExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SHARE_TTL_HOURS * 3600 * 1000);
}

export function isShareActive(share: { expiresAt: Date | string; revokedAt: Date | string | null }, now = new Date()): boolean {
  if (share.revokedAt) return false;
  const expires = share.expiresAt instanceof Date ? share.expiresAt : new Date(share.expiresAt);
  return Number.isFinite(expires.getTime()) && expires.getTime() > now.getTime();
}

const DROP_KEYS = new Set([
  'visitorId', 'visitor_id',
  'birthInfo', 'birth_info',
  'birthPlace', 'birth_place',
  'currentPlace', 'current_place',
  'errorMessage', 'error_message',
  'posterHtml', 'poster_html',
  'posterUrl', 'poster_url',
]);

/**
 * 分享响应的白名单清洗：
 * - 递归丢掉访客标识、原始出生资料、出生地/现居地、内部错误与海报字段；
 * - 把用户姓名、visitorId 在任意字符串里替换成占位（AI 解读正文可能带姓名）；
 * - 只返回 chartData / analysisData / aiAnalysis 三个展示字段。
 */
export function sanitizeSharedChart(input: {
  chartData: unknown;
  analysisData: unknown;
  aiAnalysis: unknown;
  name?: string;
  visitorId?: string;
}): { chartData: unknown; analysisData: unknown; aiAnalysis: unknown } {
  const secrets = [input.name, input.visitorId].filter((s): s is string => typeof s === 'string' && s.length >= 2);

  const scrub = (value: unknown): unknown => {
    if (typeof value === 'string') {
      let out = value;
      for (const secret of secrets) out = out.split(secret).join('（已隐藏）');
      return out;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (DROP_KEYS.has(k)) continue;
        out[k] = scrub(v);
      }
      return out;
    }
    return value;
  };

  return {
    chartData: scrub(input.chartData),
    analysisData: scrub(input.analysisData),
    aiAnalysis: scrub(input.aiAnalysis),
  };
}
