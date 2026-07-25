// 混沌命盘核心算法 — 统一导出入口
// 不重写算法，仅重新组织模块导出

// Yiqi Core: 八字 + 紫微排盘
export { createChart, validateBirthInfo, runAllTests, formatChartResult, EXAMPLE_BIRTH_INFO } from './yiqi-core/index';
export type { BirthInfo, ChartResult, BaziChart, ZiweiChart, SiZhu, DayunDetail, LiuNian, GanZhi, Tiangan, Dizhi, ShiShen, ZiweiGong, ZiweiGongInfo } from './yiqi-core/types';

// Bazi Enrich: 八字增强层
export { enrichBazi } from './bazi-enrich/enrich';
export type { BaziEnrichment } from './bazi-enrich/enrich';

// Bazi utilities
export { getZhiCangGanFull } from './yiqi-core/bazi';
