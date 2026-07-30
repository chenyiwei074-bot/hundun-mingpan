// BaZi 模块 — 统一导出

// 新组件（卡片风格，named export）
export { BaziChart } from "./BaziChart";
export { BaziHeader } from "./BaziHeader";
export { FourPillars } from "./FourPillars";
export { FiveElements } from "./FiveElements";
export { DaYunTimeline } from "./DaYunTimeline";
export { LiuNianTimeline } from "./LiuNianTimeline";
export { BaziAnalysis } from "./BaziAnalysis";

// 存量组件（default export — 兼容旧 chart 页）
export { default as BaziPillars } from "./BaziPillars";
export { default as BaziEnrich } from "./BaziEnrich";
export { default as DayunSection } from "./DayunSection";

// 类型
export type {
  BaziChartData, BaziBasic, Pillar,
  BaziElements, BaziLuckCycles, LuckCycle,
  YearEntry,
} from "./types";
// 注：BaziPillars 类型与组件重名，如需类型请直接用 Pillar
export type { BaziAnalysis as BaziAnalysisType } from "./types";
