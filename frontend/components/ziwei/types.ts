// ============================================================
// ZiWei Chart — TypeScript 类型定义
// ============================================================

/** 星曜四化 */
export interface SiHua {
  star: string;
  hua: string;       // "化禄" | "化权" | "化科" | "化忌"
}

/** 大限信息 */
export interface DaXian {
  startAge: number;
  endAge: number;
  isCurrent?: boolean;
  daXianGongName?: string;
}

/** 单个宫位 */
export interface GongData {
  gong: string;              // "命宫" | "兄弟宫" | ...
  tiangan?: string;          // 宫干
  dizhi?: string;            // 宫支
  mainStars?: string[];      // 主星
  auxStars?: string[];       // 辅星
  sihua?: SiHua[];           // 四化
  ziHua?: SiHua[];           // 自化
  daXian?: DaXian;           // 大限
  liuNian?: number[];        // 流年年龄列表
  liuNianYear?: number;      // 流年公历年份
  liuNianGongName?: string;  // 流年宫名
}

/** 四化总览 */
export interface SiHuaOverview {
  lu: { star: string; gong: string; dizhi: string } | null;
  quan: { star: string; gong: string; dizhi: string } | null;
  ke: { star: string; gong: string; dizhi: string } | null;
  ji: { star: string; gong: string; dizhi: string } | null;
  summary: string;
}

/** 来因宫 */
export interface LaiYinGong {
  gong: string;
  dizhi: string;
  tiangan: string;
  desc: string;
}

/** ⭐ 紫微斗数完整数据接口 */
export interface ZiweiChartData {
  birthInfo: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    gender: 'male' | 'female';
    isLunar: boolean;
  };
  gongs: GongData[];
  mingGongIndex: number;
  shenGongIndex?: number;
  yinYang?: string;
  wuXingJu?: { name: string; number: number };
  sihuaOverview?: SiHuaOverview;
  laiYinGong?: LaiYinGong;
  lunarDate?: {
    year: number;
    month: number;
    day: number;
    monthCn?: string;
    dayCn?: string;
  };
}
