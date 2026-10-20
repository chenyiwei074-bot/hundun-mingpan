// 3D 舞台的场景参数（批准的参数稿落成代码）。
//
// 为什么单独一个文件而不是写在组件里：套件要能**读到这些数**并断言它们没漂。
// 截图只能看出"大概是个房子"，看不出粒子从 420 悄悄涨到 900、或者第二盏有色光被加了进来。
// 而这一页的观感几乎全部由这几个参数决定 —— 参数就是实现。
//
// 舞台色**不复用** --color-western-*：东方页里的一块深色舞台如果吃西方的 token，
// 改西方配色就会连带改掉东方的 3D，而且同值会让人以为主题漏了。所以另立一组、色值刻意偏离。
//
// 这里只放**令牌名**，不放色值。色值唯一住在 globals.css 的 :root 里：
// SVG 降级图用 var() 直接吃，three.js 运行时用 getComputedStyle 读同一批变量。
// 两边各写一遍 hex 的话，"改了一处没改另一处"就正好是降级图和 3D 长得不一样那种错。

import { WALL_HEIGHT } from './geometry';

export const STAGE_TOKENS = {
  bg: '--color-fp-stage-bg',
  floor: '--color-fp-stage-floor',
  wall: '--color-fp-stage-wall',
  line: '--color-fp-stage-line',
  gold: '--color-fp-stage-gold',
  flow: '--color-fp-stage-flow',
} as const;

export type StageKey = keyof typeof STAGE_TOKENS;

/** 读不到 CSS 变量时的兜底值。只用于首帧与异常环境，正常路径一律走读出来的值。 */
export const STAGE_FALLBACK: Record<StageKey, string> = {
  bg: '#171226', floor: '#241a3d', wall: '#f3eeff', line: 'rgba(230, 220, 255, 0.14)',
  gold: '#d9b877', flow: '#c9bfe0',
};

export function readStage(el: Element | null): Record<StageKey, string> {
  const cs = el ? getComputedStyle(el) : null;
  const out = {} as Record<StageKey, string>;
  (Object.keys(STAGE_TOKENS) as StageKey[]).forEach(k => {
    const v = cs?.getPropertyValue(STAGE_TOKENS[k]).trim();
    out[k] = v || STAGE_FALLBACK[k];
  });
  return out;
}

export const SURFACE = {
  wallRoughness: 0.55,
  wallMetalness: 0,
} as const;

export const LIGHTS = {
  /** 天顶偏紫；地面色取舞台底色（由组件从 CSS 变量读出来后传入，这里不重复写色值）。
   *  只负责"哪边是上"，不负责造气氛。 */
  hemi: { sky: '#6b5a99', intensity: 0.55 },
  /** 唯一的一盏方向光。"单一金色高光"是一条光，不是一堆有色灯。 */
  key: { color: '#fff6e0', intensity: 0.9, offset: [4, 7, 3] as const },
  shadowMap: 1024,
  shadowMapMobile: 512,
  toneMappingExposure: 1.0,
} as const;

export const CAMERA = {
  fov: 38, near: 0.1, far: 100,
  /** 开场：从高处远处缓动到默认机位。reduced-motion 下直接落位。 */
  start: [0, 9, 11] as const,
  end: [0, 6.2, 7.4] as const,
  openMs: 1400,
  focusMs: 900,
  /** OrbitControls 的行为锁：不许平移（会把房子转出屏幕），俯仰与缩放都夹住。 */
  minPolar: 0.18, maxPolar: 1.32,
  minDistanceFactor: 0.6, maxDistanceFactor: 2.2,
} as const;

export const PARTICLES = {
  每门: 90,
  每窗: 60,
  全局上限: 420,
  移动减半: 210,
  /** m/s。慢到能看清往哪走，快了就只是一团雾。 */
  速度: 0.35,
  生命秒: 8,
  淡入淡出秒: 0.6,
  步长: 0.25,
  dpr上限: 2,
  dpr移动: 1.5,
  /** 连续这么多个帧低于下限 fps 就降一档。 */
  掉帧窗口帧: 30,
  下限fps: 45,
} as const;

export const BUDGET = {
  /** 从点「进入 3D」到 canvas 出第一帧。不含上传与识别。 */
  首帧毫秒: 2500,
  /** /fengshui 这一路由的增量上限（gzip）。 */
  包体KB: 200,
} as const;

export const SCENE = {
  墙高: WALL_HEIGHT,
  墙厚: 0.12,
  门高: 2.05,
  门宽: 0.9,
  窗台: 0.9,
  窗高: 1.2,
  无网格地板: true,
  无后期特效: true,
  无贴图资源: true,
} as const;

/** deviceMemory 可用时先降档：不是所有"移动设备"都一样弱，能问就不猜。 */
export function tierFor(env: { mobile: boolean; deviceMemory?: number }): 'full' | 'half' | 'minimal' {
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return 'minimal';
  if (env.mobile) return 'half';
  return 'full';
}

export function particleBudget(tier: ReturnType<typeof tierFor>, 门数: number, 窗数: number) {
  const want = 门数 * PARTICLES.每门 + 窗数 * PARTICLES.每窗;
  const cap = tier === 'full' ? PARTICLES.全局上限 : tier === 'half' ? PARTICLES.移动减半 : Math.floor(PARTICLES.移动减半 / 2);
  return Math.min(want, cap);
}
