// 地盘 - 卦象数理运算
// Ported from 混沌六爻 skill

import { LiuYaoPan } from './types';
import { GUA_HOUTIAN, GUA_NAMES } from './constants';

export interface DiPanOperation {
  type: 'add' | 'multiply' | 'subtract' | 'square';
  label: string;
  formula: string;
  result: number;
  huaGua: string;
  meaning: string;
}

export interface DiPanResult {
  neiGua: string;
  waiGua: string;
  neiShu: number;
  waiShu: number;
  operations: DiPanOperation[];
  huaGua: Record<string,string>;
}

const OP_META: Record<string,{ label: string; meaning: string }> = {
  'add': { label: '聚合', meaning: '两数相聚 — 适用于缘分、合作、婚姻' },
  'multiply': { label: '势能', meaning: '倍数增长 — 适用于事业、学业、长期投资' },
  'subtract': { label: '动向', meaning: '两者差距 — 适用于出行、分手、一方变动' },
  'square': { label: '爆发', meaning: '能量爆发 — 适用于突变、意外、冲突' },
};

// 归余化卦: 先天卦序 乾1兑2离3震4巽5坎6艮7坤8 (与 engine.py num_to_gua 一致)
function numToGua(n: number): string {
  const r = n % 8 === 0 ? 8 : n % 8;
  return GUA_NAMES[r - 1];
}

export function analyzeDiPan(pan: LiuYaoPan): DiPanResult {
  const neiGua = pan.benGua.xiaGua;
  const waiGua = pan.benGua.shangGua;
  const neiShu = GUA_HOUTIAN[neiGua] || 0;
  const waiShu = GUA_HOUTIAN[waiGua] || 0;
  
  const add = neiShu + waiShu;
  const mul = neiShu * waiShu;
  const sub = Math.abs(waiShu - neiShu);
  const sq = neiShu * neiShu + waiShu * waiShu;
  
  const operations: DiPanOperation[] = [
    { type: 'add', label: OP_META.add.label, formula: `${neiShu} + ${waiShu}`, result: add, huaGua: numToGua(add), meaning: OP_META.add.meaning },
    { type: 'multiply', label: OP_META.multiply.label, formula: `${neiShu} × ${waiShu}`, result: mul, huaGua: numToGua(mul), meaning: OP_META.multiply.meaning },
    { type: 'subtract', label: OP_META.subtract.label, formula: `|${waiShu} − ${neiShu}|`, result: sub, huaGua: numToGua(sub), meaning: OP_META.subtract.meaning },
    { type: 'square', label: OP_META.square.label, formula: `${neiShu}² + ${waiShu}²`, result: sq, huaGua: numToGua(sq), meaning: OP_META.square.meaning },
  ];
  
  return {
    neiGua, waiGua, neiShu, waiShu, operations,
    huaGua: { add: numToGua(add), mul: numToGua(mul), sub: numToGua(sub), sq: numToGua(sq) },
  };
}
