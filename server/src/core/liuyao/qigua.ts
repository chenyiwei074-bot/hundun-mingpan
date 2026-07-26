// 混沌六爻 起卦模块
// Ported from 混沌六爻 skill

import { QiGuaInput, QiGuaResult, LiuYaoData, YaoValue } from './types';
import { randomYao, timeQiGua } from './constants';

/** 铜钱摇卦 */
function coinQiGua(): LiuYaoData {
  const yaos: YaoValue[] = [];
  for (let i = 0; i < 6; i++) yaos.push(randomYao());
  return yaos as LiuYaoData;
}

/** 随机起卦 (等同于铜钱) */
const randomQiGua = coinQiGua;

/** 手动输入 */
function manualQiGua(data: LiuYaoData): LiuYaoData {
  for (const v of data) {
    if (![6,7,8,9].includes(v)) throw new Error('爻值必须为6/7/8/9');
  }
  return data;
}

/** 起卦主入口 */
export function qiGua(input: QiGuaInput): QiGuaResult {
  const { method, manualData, date } = input;
  const now = date || new Date();
  let yaoData: LiuYaoData;
  let shangGuaNum = 0;
  let xiaGuaNum = 0;
  let dongYaoPositions: number[];

  switch (method) {
    case 'coin':
      yaoData = coinQiGua();
      break;
    case 'random':
      yaoData = randomQiGua();
      break;
    case 'manual':
      if (!manualData) throw new Error('手动起卦需要提供六爻数据');
      yaoData = manualQiGua(manualData);
      break;
    case 'time': {
      const result = timeQiGua(now);
      yaoData = result.yaoData;
      shangGuaNum = result.shangGua;
      xiaGuaNum = result.xiaGua;
      break;
    }
    default:
      yaoData = randomQiGua();
  }

  // 计算本卦信息
  const benCode = yaoData.map(v => v % 2 === 1 ? '1' : '0').join('');
  const xiaCode = benCode.substring(0, 3);
  const shangCode = benCode.substring(3, 6);
  
  // 简单计算 (如果time起卦已设置则用已设的)
  if (!shangGuaNum) {
    const GUA_YAOS = ['111','110','101','100','011','010','001','000'];
    shangGuaNum = GUA_YAOS.indexOf(shangCode) + 1;
    xiaGuaNum = GUA_YAOS.indexOf(xiaCode) + 1;
  }
  
  // 找动爻位置
  dongYaoPositions = [];
  yaoData.forEach((v, i) => {
    if (v === 6 || v === 9) dongYaoPositions.push(i + 1);
  });

  return { yaoData, method, shangGuaNum, xiaGuaNum, dongYaoPositions };
}

