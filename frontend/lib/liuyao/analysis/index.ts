// 六爻分析引擎 — 统一入口
// 模块：旺衰 / 世应 / 用神 / 动爻 / 日月建 / 伏神 / 冲合

import type { LiuyaoResult, NaJiaYao, QuestionType } from '@/types/liuyao';
import { WX as CORE_WX } from '@/lib/liuyao/core';

// ══ 子模块 ══
import { analyzeWangShuai, analyzeWangShuaiEnhanced } from './wangShuai';
import type { WangShuaiDetail } from './wangShuai';
import { analyzeMonthDayRelation } from './yueRi';
import type { YaoMonthDayRelation } from './yueRi';
import { analyzeFuShen } from './fuShen';
import type { FuShenItem } from './fuShen';
import { analyzeRelations, analyzeShiYingRelation } from './relation';
import type { HexagramRelations, LiuHeItem, LiuChongItem, SanHeItem } from './relation';

// ══ 导出类型 ══

export type { QuestionType };
export type { WangShuaiDetail, YaoMonthDayRelation, FuShenItem, HexagramRelations, LiuHeItem, LiuChongItem, SanHeItem };

export interface YaoStatus {
  wangShuai: '旺'|'相'|'休'|'囚'|'死';
  monthInfluence: string;
  dayInfluence: string;
}

export interface ShiYingAnalysis {
  shiPosition: number;
  yingPosition: number;
  shiLiuQin: string;
  yingLiuQin: string;
  shiWx: string;
  yingWx: string;
  relation: string;
}

export interface DongYaoItem {
  position: number;
  before: { liuQin: string; ganZhi: string; wuxing: string; label: string };
  after: { liuQin: string; ganZhi: string; wuxing: string } | null;
}

export interface YongShenResult {
  yongShen: string;
  positions: { position: number; liuQin: string; ganZhi: string; wuxing: string; wangShuai: string; shiYing: string; isDong: boolean }[];
}

export interface LiuyaoAnalysisData {
  question: string;
  questionType: QuestionType;
  benGua: { name:string; shangGua:string; xiaGua:string; gong:string; gongWx:string };
  bianGua: { name:string|null; gong:string; gongWx:string } | null;
  shiYing: ShiYingAnalysis | null;
  yongShen: YongShenResult;
  dongYao: DongYaoItem[];
  yaoStatus: YaoStatus[];
  monthZhi: string;
  dayGZ: { gan:string; zhi:string };
  xunKong: string;
  // NEW: 增强分析
  wangShuaiDetail: WangShuaiDetail[];       // 增强旺衰
  monthDayRelations: YaoMonthDayRelation[];  // 月日建
  fuShen: FuShenItem[];                      // 伏神
  hexagramRelations: HexagramRelations;      // 冲合关系
}

// ══ 基础常量 ══

const WX_SHENG: Record<string,string> = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
const WX_KE: Record<string,string> = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
const ZHI_WX: Record<string,string> = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水',
};

// ══ 世应分析 ══

function isLiuHe(a: string, b: string): boolean {
  const he: Record<string,string> = { '子':'丑','丑':'子','寅':'亥','亥':'寅','卯':'戌','戌':'卯','辰':'酉','酉':'辰','巳':'申','申':'巳','午':'未','未':'午' };
  return he[a] === b;
}

function isLiuChong(a: string, b: string): boolean {
  const chong = ['子午','丑未','寅申','卯酉','辰戌','巳亥'];
  return chong.includes(a+b) || chong.includes(b+a);
}

export function analyzeShiYing(
  naJia: { position:number; liuQin:string; naZhi:string; shiYing:string }[],
  WX: Record<string,string>
): ShiYingAnalysis | null {
  const shi = naJia.find(n=>n.shiYing==='世');
  const ying = naJia.find(n=>n.shiYing==='应');
  if (!shi || !ying) return null;
  const sw = WX[shi.naZhi] || '?';
  const yw = WX[ying.naZhi] || '?';
  let rel = '比和';
  if (WX_SHENG[sw] === yw) rel = '世生应';
  else if (WX_KE[sw] === yw) rel = '世克应';
  else if (WX_SHENG[yw] === sw) rel = '应生世';
  else if (WX_KE[yw] === sw) rel = '应克世';
  if (isLiuChong(shi.naZhi, ying.naZhi)) rel += '·相冲';
  if (isLiuHe(shi.naZhi, ying.naZhi)) rel += '·相合';
  return {
    shiPosition: shi.position,
    yingPosition: ying.position,
    shiLiuQin: shi.liuQin,
    yingLiuQin: ying.liuQin,
    shiWx: sw,
    yingWx: yw,
    relation: rel,
  };
}

// ══ 用神分析 ══

export function getYongShen(qt: QuestionType): string {
  const map: Record<string, string> = {
    '财运':'妻财','事业':'官鬼','感情':'妻财','婚姻':'官鬼',
    '考试':'父母','健康':'子孙','出行':'兄弟','合作':'兄弟','其他':'妻财',
  };
  return map[qt] || '妻财';
}

export function analyzeYongShen(
  naJia: { position:number; liuQin:string; ganZhi:string; naZhi:string; shiYing:string; isDong:boolean }[],
  yongShenName: string,
  monthZhi: string,
  dayGZ: { ganIdx:number; zhiIdx:number },
  WX: Record<string,string>
): YongShenResult {
  const matched = naJia.filter(n=>n.liuQin===yongShenName);
  return {
    yongShen: yongShenName,
    positions: matched.map(m=>{
      const wx = WX[m.naZhi]||'?';
      const moonWx = ZHI_WX[monthZhi] || '土';
      let ws = '休';
      if (wx === moonWx) ws = '旺';
      else if (WX_SHENG[moonWx] === wx) ws = '相';
      else if (WX_SHENG[wx] === moonWx) ws = '休';
      else if (WX_KE[wx] === moonWx) ws = '囚';
      else ws = '死';
      return {
        position: m.position,
        liuQin: m.liuQin,
        ganZhi: m.ganZhi,
        wuxing: wx,
        wangShuai: ws,
        shiYing: m.shiYing,
        isDong: m.isDong,
      };
    }),
  };
}

// ══ 动爻分析 ══

export function analyzeDongYao(
  naJia: { position:number; isDong:boolean; label:string; liuQin:string; ganZhi:string; naZhi:string }[],
  bianNaJia: { position:number; liuQin:string; ganZhi:string; naZhi:string }[],
  WX: Record<string,string>
): DongYaoItem[] {
  return naJia.filter(n=>n.isDong).map(n=>{
    const bn = bianNaJia.find(b=>b.position===n.position);
    return {
      position: n.position,
      before: { liuQin:n.liuQin, ganZhi:n.ganZhi, wuxing:WX[n.naZhi]||'?', label:n.label },
      after: bn ? { liuQin:bn.liuQin, ganZhi:bn.ganZhi, wuxing:WX[bn.naZhi]||'?' } : null,
    };
  });
}

// ══ 统一分析入口 ══

export function analyzeLiuyao(result: LiuyaoResult): LiuyaoAnalysisData {
  const WX = CORE_WX as Record<string,string>;
  const dayGZ = { ganIdx: result.dayGZ.ganIdx, zhiIdx: result.dayGZ.zhiIdx };
  const dayZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][dayGZ.zhiIdx] || '子';

  // 基础旺衰（兼容旧接口）
  const ws = analyzeWangShuai(result.naJia, result.monthZhi, dayGZ, WX);

  // NEW: 增强旺衰
  const wangShuaiDetail = analyzeWangShuaiEnhanced(
    result.naJia.map((y,i) => ({...y, liuQin: y.liuQin || ''})),
    result.monthZhi,
    dayZhi,
    WX
  );

  // NEW: 月日建关系
  const monthDayRelations = analyzeMonthDayRelation(result.naJia, result.monthZhi, dayGZ.zhiIdx);

  // NEW: 伏神
  const fuShen = analyzeFuShen(result.naJia, result.benGua.gong);

  // NEW: 冲合关系
  const hexagramRelations = analyzeRelations(result.naJia);

  return {
    question: result.question,
    questionType: result.questionType,
    benGua: {
      name: result.benGua.name,
      shangGua: result.benGua.shangGua,
      xiaGua: result.benGua.xiaGua,
      gong: result.benGua.gong,
      gongWx: result.benGua.wuxing,
    },
    bianGua: result.bianGua.name ? {
      name: result.bianGua.name,
      gong: result.bianGua.gong || '?',
      gongWx: result.bianGua.wuxing || '?',
    } : null,
    shiYing: analyzeShiYing(result.naJia, WX),
    yongShen: analyzeYongShen(result.naJia, getYongShen(result.questionType), result.monthZhi, dayGZ, WX),
    dongYao: analyzeDongYao(result.naJia, result.bianNaJia, WX),
    yaoStatus: ws,
    monthZhi: result.monthZhi,
    dayGZ: { gan: result.dayGZ.gan, zhi: result.dayGZ.zhi },
    xunKong: result.xunKong,
    // NEW
    wangShuaiDetail,
    monthDayRelations,
    fuShen,
    hexagramRelations,
  };
}

// ══ 兼容旧接口 ══
export function buildAnalysisData(params: {
  question: string;
  questionType: QuestionType;
  guaR: { ben:string; bian:string|null; dong:number[]; shangGua:string; xiaGua:string };
  gong: string;
  bianGong: { gong:string }|null;
  naJiaResult: any[];
  bianNaJiaResult: any[];
  monthZhi: string;
  dayGZ: { gan:string; zhi:string; ganIdx:number; zhiIdx:number };
  xunKongZhi: string;
  WX: Record<string,string>;
}): LiuyaoAnalysisData {
  const ws = analyzeWangShuai(params.naJiaResult, params.monthZhi, params.dayGZ, params.WX);
  const dayZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][params.dayGZ.zhiIdx] || '子';

  return {
    question: params.question,
    questionType: params.questionType,
    benGua: { name:params.guaR.ben, shangGua:params.guaR.shangGua, xiaGua:params.guaR.xiaGua, gong:params.gong, gongWx:params.WX[params.gong] },
    bianGua: params.guaR.bian ? { name:params.guaR.bian, gong:params.bianGong?.gong||'?', gongWx:params.WX[params.bianGong?.gong||'?'] } : null,
    shiYing: analyzeShiYing(params.naJiaResult, params.WX),
    yongShen: analyzeYongShen(params.naJiaResult, getYongShen(params.questionType), params.monthZhi, params.dayGZ, params.WX),
    dongYao: analyzeDongYao(params.naJiaResult, params.bianNaJiaResult, params.WX),
    yaoStatus: ws,
    monthZhi: params.monthZhi,
    dayGZ: { gan:params.dayGZ.gan, zhi:params.dayGZ.zhi },
    xunKong: params.xunKongZhi,
    // NEW 字段兼容
    wangShuaiDetail: [],
    monthDayRelations: [],
    fuShen: [],
    hexagramRelations: { liuHe: [], liuChong: [], sanHe: [] },
  };
}