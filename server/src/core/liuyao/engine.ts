// 混沌六爻 主引擎
// 整合起卦 + 排盘, 输出完整六爻结果

import { QiGuaInput, LiuYaoResult } from './types';
import { qiGua } from './qigua';
import { paiPan } from './najia';

/** 完整六爻推演 */
export function runLiuYao(input: QiGuaInput): LiuYaoResult {
  const question = input.question || '未提供问题';
  const date = input.date || new Date();
  
  // 1. 起卦
  const qiGuaResult = qiGua(input);
  
  // 2. 排盘
  const pan = paiPan(qiGuaResult.yaoData, date);
  
  // 3. 基础分析 (不含AI, 后续由AI provider生成)
  const dongYaoCount = qiGuaResult.dongYaoPositions.length;
  let analysis = '';
  if (dongYaoCount === 0) {
    analysis = '静卦 — 事体平稳，以本卦卦辞为主参详。';
  } else if (dongYaoCount === 1) {
    analysis = '一爻动 — 以动爻爻辞为主要参考。';
  } else if (dongYaoCount === 2) {
    analysis = '两爻动 — 以阴爻爻辞为主，兼看阳爻。';
  } else {
    analysis = '多爻动 — 以变卦卦辞为主，本卦为辅参详。';
  }
  
  return {
    question,
    qiGua: qiGuaResult,
    pan,
    analysis,
    advice: '',
  };
}

export { qiGua, paiPan };
export * from './types';
export * from './constants';
