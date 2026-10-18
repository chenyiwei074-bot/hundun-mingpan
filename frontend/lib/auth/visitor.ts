// 游客身份管理 — Cookie 持久化

import { randomToken } from '@/lib/crypto/random';

const COOKIE_NAME = 'hundun_vid';
const COOKIE_DAYS = 365;

// 这个 id 现在同时是报告的归属凭据（GET /api/reports/:id 按它校验归属），
// 所以随机源必须是 CSPRNG：Math.random 的 128 bit 状态可被少量观测反推。
function generateId(): string {
  return 'v_' + Date.now().toString(36) + randomToken(8);
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

/** 获取或创建游客 ID */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let id = getCookie(COOKIE_NAME);
  if (!id) {
    // fallback to localStorage (迁移旧数据)
    id = localStorage.getItem('hundun_visitor_id') || '';
    if (!id) {
      id = generateId();
    }
    setCookie(COOKIE_NAME, id, COOKIE_DAYS);
    localStorage.setItem('hundun_visitor_id', id);
  }
  return id;
}