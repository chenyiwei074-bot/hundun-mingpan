// 混沌六爻 主引擎
// 整合起卦 + 排盘 + 天盘 + 地盘, 输出三盘合断

import { QiGuaInput, LiuYaoResult } from './types';
import { qiGua } from './qigua';
import { paiPan } from './najia';
import { analyzeTianPan, TianPanResult } from './tianpan';
import { analyzeDiPan, DiPanResult } from './dipan';

export interface FullLiuYaoResult extends LiuYaoResult {
  tianPan: TianPanResult;
  diPan: DiPanResult;
}

/** 完整六爻推演 (三盘合断) */
export function runLiuYao(input: QiGuaInput): FullLiuYaoResult {
  const question = input.question || '未提供问题';
  const date = input.date || new Date();
  
  const qiGuaResult = qiGua(input);
  const pan = paiPan(qiGuaResult.yaoData, date);
  const tianPan = analyzeTianPan(pan);
  const diPan = analyzeDiPan(pan);
  
  // 基础分析
  const dongYaoCount = qiGuaResult.dongYaoPositions.length;
  let analysis = '';
  if (dongYaoCount === 0) analysis = '静卦 — 事体平稳，以本卦卦辞为主参详。';
  else if (dongYaoCount === 1) analysis = '一爻动 — 以动爻爻辞为主要参考。';
  else if (dongYaoCount === 2) analysis = '两爻动 — 以阴爻爻辞为主，兼看阳爻。';
  else analysis = '多爻动 — 以变卦卦辞为主，本卦为辅参详。';
  
  return {
    question,
    qiGua: qiGuaResult,
    pan,
    analysis,
    advice: '',
    tianPan,
    diPan,
  };
}

export { qiGua, paiPan };
export * from './types';
export * from './constants';
