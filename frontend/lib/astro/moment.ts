// 西方命理的时间轴：把"当地钟表日期 + IANA 时区"换成一个绝对时刻（UTC 毫秒）。
//
// 为什么单独一层：本命行星位置对"出生那一刻"敏感（月亮约 2 分钟走 0.05°），
// 而"当地钟表时间 → UTC"这一步带着夏令时与历史时区偏移，是最容易安静出错的地方。
// catalog 里那句"时区与夏令时怎么取"没裁定之前不排盘 —— 这一层就是那次裁定要的落点：
// 用 IANA 时区数据库（浏览器/Node 自带，不引新依赖），并且把两种歧义**报出来**而不是猜：
//   · 本地时间不存在 —— 夏令时开始那天凌晨跳表（弹簧向前）被跳过的那一小时；
//   · 本地时间有两次 —— 夏令时结束那天回拨（向后）的那一小时，墙钟读了两遍。
// 两种都返回原因码，界面上明说并请用户改时刻或改用 UTC 直接输入。
//
// 换算本体不在这一层：那套"墙上钟面 → 世界时刻"的枚举与自洽检查住在
// app/lib/true-solar/dst-resolver.ts（真太阳时那批已经拿 openfate 的公开验证集回归过）。
// 这一层只做三件事：把 kind 翻成界面上那三句话、把未知时区兜住、把 isoUtc 格式化。
// 自己再写一遍就是第二份"哪儿几点是什么"的真相 —— 而第一版就是这么写、就是这么错的。

import { resolveCivil, type CivilSolve } from '@/app/lib/true-solar/dst-resolver';

export const MOMENT_BASIS = 'astro-moment-iana-v1' as const;

export type MomentFail =
  | { ok: false; reason: '无效日期'; detail: string }
  // 夏令时跳表：那个本地墙钟从未出现
  | { ok: false; reason: '本地时间不存在'; detail: string }
  // 夏令时回拨：那个本地墙钟出现两次，偏移取哪一个会差一小时
  | { ok: false; reason: '本地时间有两次'; detail: string }
  | { ok: false; reason: '缺时刻'; detail: string }
  | { ok: false; reason: '时区未知'; detail: string };

export type MomentOk = { ok: true; utcMs: number; isoUtc: string; offsetMin: number };

export type MomentResult = MomentOk | MomentFail;

/**
 * 把"当地年月日时分 + IANA 时区"解析成 UTC 时刻。
 *
 * 枚举与自洽检查**不在这里**：那套"墙上钟面 → 世界时刻"的逻辑已经有一份经过 openfate
 * 公开验证集回归的实现（app/lib/true-solar/dst-resolver.ts 的 resolveCivil），
 * 这里只把它的三种落点翻成界面要说的那三句话。曾经这一层自己写了一遍枚举，
 * 而第一版写错了（迭代求不动点只会收敛到两个根之一，把回拨那一小时算成一次成功换算）——
 * 同一件事有两份实现时，错的那份往往是对的那份的抄本。
 */
export function toUtc(input: { year: number; month: number; day: number; hour: number; minute: number; timeZone: string }): MomentResult {
  const { year, month, day, hour, minute, timeZone } = input;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)
    || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { ok: false, reason: '缺时刻', detail: '年/月/日/时/分里有没有填上的数' };
  }
  if (!timeZone) return { ok: false, reason: '缺时刻', detail: '没选出生地时区 —— 差一小时，月亮就差两度' };
  // Date.UTC 会把 13 月 45 日顺延成下一年的某月某日 —— 那是一种静默的假数据：
  // 界面（type=date）给不出这种值，但这个函数也要能被套件直接喂，所以这里就拒不猜。
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { ok: false, reason: '无效日期', detail: `${year} 年 ${month} 月 ${day} 日 ${pad(hour)}:${pad(minute)} 不是一个能落在校准日历上的时刻（本站不替你顺延）` };
  }

  let solved: CivilSolve;
  try {
    solved = resolveCivil({ year, month, day, hour, minute }, timeZone);
  } catch {
    return { ok: false, reason: '时区未知', detail: `这台设备不认识时区标识 ${timeZone}` };
  }
  const stamp = `${pad(year)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;

  if (solved.kind === 'nonexistent') {
    return { ok: false, reason: '本地时间不存在', detail: `${timeZone} 在这一天做夏令时跳表，${stamp} 这个墙钟被跳过了` };
  }
  if (solved.kind === 'ambiguous') {
    const spread = (solved.roots[0].offsetMinutes - solved.roots[solved.roots.length - 1].offsetMinutes) / 60;
    return {
      ok: false, reason: '本地时间有两次',
      detail: `${timeZone} 在这一天把钟往回拨，${stamp} 出现了两次（两个世界时相差 ${spread} 小时）`
        + `。请把分钟挪到旁边那一档再算 —— 这一小时差在月亮上就是两度，本站不替你选`,
    };
  }
  const utc = solved.utcMs;
  return {
    ok: true, utcMs: utc, offsetMin: solved.offsetMinutes,
    isoUtc: new Date(utc).toISOString().slice(0, 16).replace('T', ' ') + 'Z',
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 这台设备/浏览器支持的 IANA 时区（用于下拉；不支持时给一份最小可用清单）。 */
export function availableZones(): string[] {
  // ICU 的 supportedValuesOf 里**没有** 'UTC'（只有 Etc/UTC 那一类别名），
  // 而 timeZone:'UTC' 是 ECMA-402 保证任何实现都认的 —— 不补上，"直接按世界时输入"这一档就没有了，
  // 对拍与截图复核也少了一个可复现的入口。
  const fallback = ['UTC', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Kolkata',
    'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'Europe/Moscow', 'America/New_York',
    'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Africa/Cairo'];
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  let list = fallback;
  if (typeof supported === 'function') {
    try { list = supported('timeZone'); } catch { /* 落到兜底清单 */ }
  }
  return list.includes('UTC') ? list : ['UTC', ...list];
}
