// ============================================================
// BaZi Chart — TypeScript 类型定义
// ============================================================

export interface BaziBasic {
  name: string; gender: string; solarDate: string; lunarDate: string;
  birthPlace?: string; currentAge?: string;
}

export interface HiddenStem { gan: string; tenGod?: string; }

export interface Pillar {
  stem: string; branch: string;
  tenGodStem?: string; tenGodBranch?: string;
  hiddenStems: string[];
  hiddenStemsDetail?: HiddenStem[];
  naYin?: string;
  zhangSheng?: string;
  kongWang?: string;
  shenSha?: string[];           // ← 神煞
}

export interface BaziPillars { year: Pillar; month: Pillar; day: Pillar; hour: Pillar; }

export interface BaziElements { wood: number; fire: number; earth: number; metal: number; water: number; }

export interface LuckCycle {
  ageRange: string; startYear?: string; endYear?: string;
  heavenStem: string; earthBranch: string; tenGod: string; description?: string;
}
export interface BaziLuckCycles { startAge: string; direction: string; cycles: LuckCycle[]; }

export interface YearEntry { year: string; age: string; ganZhi: string; tenGod: string; event?: string; }

export interface BaziAnalysis { dayMaster: string; strength: string; useGod: string; summary?: string; }

export interface Enrichment {
  '格局'?:    { primary?: string; confidence?: string; basis?: string };
  '旺衰'?:    { verdict?: string; score?: string | number };
  '调候用神'?: string[];
  '月令'?:    { month?: string };
  '五行统计'?: { surface?: Record<string,number>; missing?: string[]; strongest?: string[] };
  '天干关系'?: Array<{ type: string; gan?: string[]; result?: string; detail?: string; pillars?: string[] }>;
  '地支关系'?: Array<{ type: string; zhi?: string[]; detail?: string; pillars?: string[] }>;
}

export interface BaziChartData {
  basic: BaziBasic; pillars: BaziPillars; elements: BaziElements;
  luckCycles: BaziLuckCycles; years: YearEntry[]; analysis: BaziAnalysis;
  enrichment?: Enrichment;
}
