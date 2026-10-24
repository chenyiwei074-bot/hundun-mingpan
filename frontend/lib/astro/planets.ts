// 本命行星位置：地心、回归黄道（黄道面取"那一天的真黄道"）、不作 ayanamsa 换算。
//
// 引擎：astronomy-engine（MIT，github.com/cosinekitty/astronomy）的 DE441 数值。
// 只取它算得到的那一层：十颗星的黄道经度/纬度。宫位、上升、相位、凯龙、南北交点
// 它都不给 —— 那几项在目录里继续标「未开放」，写清楚缺什么，而不是拿星座性格测试冒充。
//
// 口径戳 astro-planets-v1：改这里的任何口径（地心/黄道面/是否含光行差与周年视差）
// 都必须升戳，否则老截图无法区分是哪一版算出来的。
//
// 与 JPL Horizons（DE441）的对拍在 tools/astro-acceptance/（原始输出随仓库提交，
// 公差与实测最大偏差写在 cases/astro-ephemeris-reference.json 里），不在这里重复。

import { Body, Ecliptic, GeoVector, SunPosition, MakeTime } from 'astronomy-engine';

export const ASTRO_BASIS = 'astro-planets-v1' as const;

/** 这一层算得出什么、算不出什么 —— 目录卡面与 /astro 页都读这两份清单，不各写一套。
 *  western-catalog 里那两条 done/notDone 字面量必须与此逐字相等（astro-acceptance 钉）。 */
export const ASTRO_DONE = ['太阳、月亮与水金火木土天海冥八颗行星的地心黄道经度（落座与度数）', '太阳星座、月亮星座', '黄纬（一并给出，便于自查）', '上升点与整宫制宫位（按出生经纬度与时刻计算，20 组对拍公差 0.05°）'] as const;
export const ASTRO_NOT_DONE = ['行星之间的相位', '其他非整宫制宫位', '凯龙星等小行星', '南北交点', '恒星黄道体系'] as const;

/** 与 JPL Horizons 对拍的口径：窗口内（公历 1850—2100）黄经与黄纬都按 0.02° 硬判。
 *  这三个数只有一个出处：页面上那句"对拍窗口"读它，tools/astro-acceptance 的夹具与
 *  判据也读它（fixture 里的 toleranceDeg/window 必须与此逐字相等，astro/cross-check-single-source 钉）。
 *  窗口外不是"没测"：2160 那批实测月亮偏 0.042°，夹具单独记着，本站对那一段不打包票。 */
export const ASTRO_CROSS_CHECK = {
  authority: 'NASA JPL Horizons（DE441）', from: 1850, to: 2100, toleranceDeg: 0.02,
} as const;

export type PlanetKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

/** 展示名与引擎的 Body 枚举一一对应；这里不写第二种拉丁名，页面只出中文。 */
export const PLANETS: { key: PlanetKey; 名称: string; body: Body }[] = [
  { key: 'sun', 名称: '太阳', body: Body.Sun },
  { key: 'moon', 名称: '月亮', body: Body.Moon },
  { key: 'mercury', 名称: '水星', body: Body.Mercury },
  { key: 'venus', 名称: '金星', body: Body.Venus },
  { key: 'mars', 名称: '火星', body: Body.Mars },
  { key: 'jupiter', 名称: '木星', body: Body.Jupiter },
  { key: 'saturn', 名称: '土星', body: Body.Saturn },
  { key: 'uranus', 名称: '天王星', body: Body.Uranus },
  { key: 'neptune', 名称: '海王星', body: Body.Neptune },
  { key: 'pluto', 名称: '冥王星', body: Body.Pluto },
];

export const SIGNS = ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'] as const;

export interface PlanetPlace {
  key: PlanetKey;
  名称: string;
  /** 黄经 0..360（回归黄道、历元为当日真春分点） */
  lon: number;
  /** 黄纬，度 */
  lat: number;
  signIndex: number;
  星座: string;
  /** 星座内度数：度与分（占星写法 12°34′） */
  signDeg: number;
  signMin: number;
}

export interface PlanetsResult { ok: true; basis: typeof ASTRO_BASIS; utcMs: number; positions: PlanetPlace[]; sun: PlanetPlace; moon: PlanetPlace }
export interface PlanetsFailed { ok: false; reason: '引擎不可用' | '时刻无效'; detail: string }

/** 十颗星的地心黄道位置。utcMs 是绝对时刻（UTC 毫秒），换算归调用方（见 lib/astro/moment.ts）。 */
export function computePlanets(utcMs: number): PlanetsResult | PlanetsFailed {
  if (!Number.isFinite(utcMs)) return { ok: false, reason: '时刻无效', detail: '没拿到可计算的世界时时刻' };
  let time;
  try { time = MakeTime(new Date(utcMs)); }
  catch { return { ok: false, reason: '时刻无效', detail: '这个时刻超出引擎支持的历表范围' }; }

  const positions: PlanetPlace[] = [];
  try {
    for (const p of PLANETS) {
      // 太阳走 SunPosition：它给的就是"含光行差与章动的视位置"，与地心观测一致。
      // 其余走 GeoVector → Ecliptic：Ecliptic 只接一个 Vector，那个 Vector 自己带着 .t，
      // 再传第二个参数 TS 会红（运行时被忽略，所以这是一条只在类型检查里存在的错）。
      const e = p.key === 'sun'
        ? SunPosition(time)
        : Ecliptic(GeoVector(p.body, time, true));
      const lon = ((e.elon % 360) + 360) % 360;
      const signIndex = Math.floor(lon / 30) % 12;
      const within = lon - signIndex * 30;
      // 29.9999° 会进位成"30 度"这种不存在的星座内读数 —— 先夹住再取整分。
      const signDeg = Math.min(29, Math.floor(within));
      const signMin = Math.min(59, Math.floor((within - Math.floor(within)) * 60));
      positions.push({
        key: p.key, 名称: p.名称, lon, lat: e.elat, signIndex, 星座: SIGNS[signIndex], signDeg, signMin,
      });
    }
  } catch (err) {
    return { ok: false, reason: '引擎不可用', detail: `行星历算没跑通：${err instanceof Error ? err.message : String(err)}` };
  }

  const sun = positions.find(p => p.key === 'sun')!;
  const moon = positions.find(p => p.key === 'moon')!;
  return { ok: true, basis: ASTRO_BASIS, utcMs, positions, sun, moon };
}

/** 度数的整数部分与 0..1 的相位角，给"落在哪一宫"以外的任何自证用途（例如对拍）。 */
export const norm360 = (deg: number) => ((deg % 360) + 360) % 360;
