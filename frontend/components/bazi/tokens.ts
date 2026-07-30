// ═══════════════════════════════════════════════
// Apple DESIGN.md → 混沌项目 设计 Token 映射
// ═══════════════════════════════════════════════

// ── 色彩 ──
export const colors = {
  // Apple ink    →   混沌主文字
  ink:           "#1d1d1f",
  // Apple canvas →   混沌卡片底
  canvas:        "#ffffff",
  // Apple parchment → 混沌交替底
  parchment:     "#f5f5f7",
  // Apple primary →   混沌强调色
  accent:        "#b2955d",
  // Apple hairline →  混沌微分隔
  hairline:      "rgba(0,0,0,0.06)",
} as const;

// ── 圆角（Apple 精确值） ──
// none:0  xs:5  sm:8  md:11  lg:18  pill:9999
export const radius = {
  none:   "0px",
  sm:     "8px",     // 小工具卡片
  md:     "11px",
  lg:     "18px",    // 主卡片 (rounded-2xl ≈ 16px，用 lg:18px)
  pill:   "9999px",
} as const;

// ── 间距（Apple 精确值） ──
export const spacing = {
  xs:     "8px",
  sm:     "12px",
  md:     "17px",
  lg:     "24px",    // 卡片内 padding
  xl:     "32px",
  xxl:    "48px",
  section:"80px",    // 段落间纵向 padding
} as const;

// ── 字体层级（Apple 精确值） ──
export const type = {
  hero:     { size: "56px", weight: 600, lineHeight: 1.07, tracking: "-0.28px" },
  display:  { size: "40px", weight: 600, lineHeight: 1.10, tracking: "0" },
  tagline:  { size: "21px", weight: 600, lineHeight: 1.19, tracking: "0.231px" },
  body:     { size: "17px", weight: 400, lineHeight: 1.47, tracking: "-0.374px" },
  caption:  { size: "14px", weight: 400, lineHeight: 1.43, tracking: "-0.224px" },
  fine:     { size: "12px", weight: 400, lineHeight: 1.0,  tracking: "-0.12px" },
  micro:    { size: "10px", weight: 400, lineHeight: 1.3,  tracking: "-0.08px" },
} as const;

// ── 阴影（Apple 唯一阴影，仅用于"产品图"） ──
export const productShadow =
  "rgba(0, 0, 0, 0.18) 0px 4px 24px 0px";

// ── 动效 ──
export const motion = {
  fadeUp:   "transition-all duration-700 ease-out",
  hover:    "transition-all duration-300 ease-out",
  active:   "active:scale-95 transition-transform duration-150",
} as const;
