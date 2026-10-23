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
// 只用 Intl（ES2015+ 的 timeZone 支持）自己算偏移：不去 import 一张城市表，
// 因为那会变成 lib/liuyao/solar-basis.ts 之外的第二份"哪儿几点是什么"的真相。

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

/** 该时区在那个本地时刻相对 UTC 的偏移（分钟）。用 Intl 的格式化器反推，不查表。 */
const DTF_CACHE = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = DTF_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    DTF_CACHE.set(tz, f);
  }
  return f;
}

function offsetAt(tz: string, asUtc: number): number {
  const p: Record<string, string> = {};
  for (const part of formatter(tz).formatToParts(asUtc)) p[part.type] = part.value;
  const asLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asLocal - asUtc) / 60000);
}

/**
 * 把"当地年月日时分 + IANA 时区"解析成 UTC 时刻。
 *
 * 为什么不是"试两次收敛"：迭代求不动点只会找到**其中一个**根。夏令时回拨那一小时有两个根
 * （纽约 2024-11-03 01:30 既是 05:30Z 也是 06:30Z），收敛到哪一个都合法，于是"墙钟读了两遍"
 * 会被算成"算出来了"——这是最坏的一种错：它看起来自洽，而月亮在两个根之间正好差两度。
 * 所以这里改成枚举：把那一天前后各两天内出现过的偏移都取出来当候选，逐个验"该偏移在这一个
 * 瞬间确实生效"。一个根=唯一解；两个根=回拨歧义；零个根=跳表，那个墙钟从来没出现过。
 */
export function toUtc(input: { year: number; month: number; day: number; hour: number; minute: number; timeZone: string }): MomentResult {
  const { year, month, day, hour, minute, timeZone } = input;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)
    || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { ok: false, reason: '缺时刻', detail: '年/月/日/时/分里有没有填上的数' };
  }
  if (!timeZone) return { ok: false, reason: '缺时刻', detail: '没选出生地时区 —— 差一小时，月亮就差两度' };

  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  if (!Number.isFinite(wall)) return { ok: false, reason: '无效日期', detail: `${year} 年 ${month} 月 ${day} 日拼不成一个日期` };

  // 候选偏移：±2 天以内在这个时区生效过的所有偏移（含半小时/45 分钟那种非整点时区）。
  let offsets: number[];
  try {
    const set = new Set<number>();
    for (let d = -48; d <= 48; d += 6) set.add(offsetAt(timeZone, wall + d * 3600000));
    offsets = [...set];
  } catch {
    return { ok: false, reason: '时区未知', detail: `这台设备不认识时区标识 ${timeZone}` };
  }

  const roots = offsets
    .map(o => ({ off: o, utc: wall - o * 60000 }))
    .filter(c => offsetAt(timeZone, c.utc) === c.off);

  if (roots.length === 0) {
    return { ok: false, reason: '本地时间不存在', detail: `${timeZone} 在这一天做夏令时跳表，${pad(year)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} 这个墙钟被跳过了` };
  }
  if (roots.length > 1) {
    const spread = Math.abs(roots[0].off - roots[roots.length - 1].off) / 60;
    return {
      ok: false, reason: '本地时间有两次',
      detail: `${timeZone} 在这一天把钟往回拨，${pad(year)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)} 出现了两次`
        + `（两个世界时相差 ${spread} 小时）。请把分钟挪到旁边那一档再算 —— 这一小时差在月亮上就是两度，本站不替你选`,
    };
  }
  const { off, utc } = roots[0];
  return {
    ok: true, utcMs: utc, offsetMin: off,
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
