// 地盘 - 卦象数理运算
// Ported from 混沌六爻 skill

import { LiuYaoPan } from './types';
import { GUA_HOUTIAN, GUA_WUXING } from './constants';

export interface DiPanResult {
  neiGua: string;
  waiGua: string;
  neiShu: number;
  waiShu: number;
  operations: { type: string; formula: string; result: number; meaning: string }[];
  huaGua: string;
}

const OP_MEANINGS: Record<string,{ label: string; meaning: string }> = {
  'add': { label: '聚合', meaning: '两数相聚 — 适用于缘分、合作、婚姻' },
  'multiply': { label: '势能', meaning: '倍数增长 — 适用于事业、学业、长期投资' },
  'subtract': { label: '动向', meaning: '两者差距 — 适用于出行、分手、一方变动' },
  'square': { label: '爆发', meaning: '能量爆发 — 适用于突变、意外、冲突' },
};

// 后天数→卦名
const NUM_GUA: Record<number,string> = { 1:'坎☵', 2:'坤☷', 3:'震☳', 4:'巽☴', 6:'乾☰', 7:'兑☱', 8:'艮☶', 9:'离☲' };

export function analyzeDiPan(pan: LiuYaoPan): DiPanResult {
  const neiGua = pan.benGua.xiaGua;
  const waiGua = pan.benGua.shangGua;
  const neiShu = GUA_HOUTIAN[neiGua] || 0;
  const waiShu = GUA_HOUTIAN[waiGua] || 0;
  
  const operations = [
    { type: 'add', formula: `${neiShu} + ${waiShu}`, result: neiShu + waiShu, meaning: OP_MEANINGS.add.meaning },
    { type: 'multiply', formula: `${neiShu} × ${waiShu}`, result: neiShu * waiShu, meaning: OP_MEANINGS.multiply.meaning },
    { type: 'subtract', formula: `|${waiShu} − ${neiShu}|`, result: Math.abs(waiShu - neiShu), meaning: OP_MEANINGS.subtract.meaning },
    { type: 'square', formula: `${neiShu}² + ${waiShu}²`, result: neiShu * neiShu + waiShu * waiShu, meaning: OP_MEANINGS.square.meaning },
  ];
  
  // 化卦: 取乘法的结果 ÷ 8 余数对应卦
  const huaShu = (neiShu * waiShu) % 8 || 8;
  const huaGua = NUM_GUA[huaShu] || '?';
  
  return { neiGua, waiGua, neiShu, waiShu, operations, huaGua };
}
