// 游客身份管理 — Cookie 持久化

const COOKIE_NAME = 'hundun_vid';
const COOKIE_DAYS = 365;

function generateId(): string {
  return 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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