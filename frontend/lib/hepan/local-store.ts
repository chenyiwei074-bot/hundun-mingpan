// 合盘对方数据的本机存放。
//
// 裁定：对方生辰默认不保存，只活在本机内存或 localStorage；不进 API、不进报告、
// 不进回执、不进台账、不上链。所以这个模块**没有任何网络调用**，也不被 server 侧读到。
//
// 默认写 sessionStorage（关掉标签页就没了）。只有用户显式勾了"留在这台设备上"，
// 才写 localStorage，并且带一个自我过期的时间戳 —— 存下来的东西必须能自己消失，
// 否则"默认不保存"这句话在第一次勾选之后就永久失效了。

export const HEPAN_STORE_KEY = 'hundun.hepan.partner.v1';
/** localStorage 里最长留存：7 天后自己作废，与户型图的清理窗口同一口径。 */
export const HEPAN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PartnerDraft {
  称呼: string;
  性别: '男' | '女';
  year: string; month: string; day: string;
  hour: string; minute: string;
  isLunar: boolean; isLeapMonth: boolean;
  /** 出生地只用来推真太阳时，与我自己排盘走同一个 buildTrueSolarWiring。 */
  省份: string; 城市: string; 区县: string;
  /** 存下来时盖的时间戳，用来做上面的 TTL。 */
  savedAt: number;
}

const blank = (): PartnerDraft => ({
  称呼: '', 性别: '女', year: '', month: '', day: '', hour: '12', minute: '00',
  isLunar: false, isLeapMonth: false, 省份: '北京', 城市: '北京', 区县: '', savedAt: 0,
});

const safe = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };
const isExpired = (d: PartnerDraft) => d.savedAt > 0 && Date.now() - d.savedAt > HEPAN_TTL_MS;

function parse(raw: string | null): PartnerDraft | null {
  if (!raw) return null;
  const o = safe(() => JSON.parse(raw) as Partial<PartnerDraft>);
  if (!o || typeof o.year !== 'string' || typeof o.month !== 'string' || typeof o.day !== 'string') return null;
  if (!o.year || !o.month || !o.day) return null;
  return { ...blank(), ...o, savedAt: Number(o.savedAt) || 0 } as PartnerDraft;
}

/** 读：两处存储都检查 7 天 TTL；任何一处过期就同时清掉，避免会话副本绕过。 */
export function loadPartner(): PartnerDraft | null {
  const s = safe(() => sessionStorage.getItem(HEPAN_STORE_KEY));
  const fromSession = parse(s);
  if (fromSession) {
    if (isExpired(fromSession)) { clearPartner(); return null; }
    return fromSession;
  }
  const l = safe(() => localStorage.getItem(HEPAN_STORE_KEY));
  const fromLocal = parse(l);
  if (!fromLocal || isExpired(fromLocal)) { if (fromLocal) clearPartner(); return null; }
  return fromLocal;
}

/** 写。persist=false 时只进 sessionStorage，关掉标签页就没了。 */
export function savePartner(d: PartnerDraft, persist: boolean): void {
  // 会话副本也盖时间戳：标签页长期不关时，7 天 TTL 仍然生效。
  const stamped: PartnerDraft = { ...d, savedAt: Date.now() };
  safe(() => { sessionStorage.setItem(HEPAN_STORE_KEY, JSON.stringify(stamped)); });
  if (persist) safe(() => { localStorage.setItem(HEPAN_STORE_KEY, JSON.stringify(stamped)); });
  else safe(() => { localStorage.removeItem(HEPAN_STORE_KEY); });
}

/** 两个存储都清。UI 上必须有一个按得到得到的钮，"不保存"才不是一句空话。 */
export function clearPartner(): void {
  safe(() => { sessionStorage.removeItem(HEPAN_STORE_KEY); });
  safe(() => { localStorage.removeItem(HEPAN_STORE_KEY); });
}

/** 长期留存是否真的落到了磁盘上 —— 页面要按实情显示"存在这台设备上"还是"只在本标签页"。 */
export function isPersisted(): boolean {
  const local = safe(() => parse(localStorage.getItem(HEPAN_STORE_KEY)));
  return !!local && !isExpired(local);
}
