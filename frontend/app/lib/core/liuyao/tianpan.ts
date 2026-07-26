// 天盘 - 星宿演禽 & 吞啖
// Ported from 混沌六爻 skill

import { DiZhi, YaoInfo, LiuYaoPan } from './types';
import { ZHIS, DZ_XIU, XIU28 } from './constants';

// 二十八宿五行
const XIU_WUXING: Record<string,string> = {
  '角':'木','亢':'金','氐':'土','房':'火','心':'火','尾':'火','箕':'水',
  '斗':'木','牛':'金','女':'土','虚':'火','危':'火','室':'火','壁':'水',
  '奎':'木','娄':'金','胃':'土','昴':'火','毕':'火','觜':'火','参':'水',
  '井':'木','鬼':'金','柳':'土','星':'火','张':'火','翼':'火','轸':'水',
};

// 禽象
const QIN_XIANG: Record<string,string> = {
  '角':'蛟','亢':'龙','氐':'貉','房':'兔','心':'狐','尾':'虎','箕':'豹',
  '斗':'獬','牛':'牛','女':'蝠','虚':'鼠','危':'燕','室':'猪','壁':'貐',
  '奎':'狼','娄':'狗','胃':'雉','昴':'鸡','毕':'乌','觜':'猴','参':'猿',
  '井':'犴','鬼':'羊','柳':'獐','星':'马','张':'鹿','翼':'蛇','轸':'蚓',
};

// 吞啖表: 吞者 → 被吞者列表
const TUNTIE: Record<string,string[]> = {
  '蛟':['獐'], '虎':['猪','羊','牛'], '龙':['蛇','蚓'],
  '豹':['鹿','兔','羊'], '狼':['羊','兔','鸡'], '狗':['兔','鸡'],
  '猴':['蛇','蚓'], '蛇':['蚓','鼠'], '鸡':['蚓'], '猪':['蚓'],
};

// 泊位判断
function boWei(zhi: DiZhi): string {
  const map: Record<string,string> = {
    '子':'泊水','丑':'泊库','寅':'泊林','卯':'泊林','辰':'泊山',
    '巳':'泊天','午':'泊天','未':'泊库','申':'泊山','酉':'泊地',
    '戌':'泊库','亥':'泊水',
  };
  return map[zhi] || '泊地';
}

export interface TianPanResult {
  yaoXiu: { position: number; xiuName: string; qinXiang: string; wuXing: string; boWei: string }[];
  shiXiu: string;
  yingXiu: string;
  tunTie: string;
  geJu: string[];
}

/** 获取日支对应的二十八宿主星宿 */
function getRiXiu(riZhi: DiZhi): string {
  const xius = DZ_XIU[riZhi];
  return xius ? xius[0] : '星日马'; // 默认
}

export function analyzeTianPan(pan: LiuYaoPan): TianPanResult {
  const riXiu = getRiXiu(pan.riChen.zhi);
  const riXiuIdx = XIU28.indexOf(riXiu);
  
  // 各爻配宿 (日宿从世爻开始顺排)
  const shiPos = pan.benGua.shiYao;
  const startIdx = (riXiuIdx - (shiPos - 1) + 28) % 28;
  
  let shiXiuName = '', yingXiuName = '';
  const yaoXiu: TianPanResult['yaoXiu'] = [];
  
  for (let i = 0; i < 6; i++) {
    const pos = i + 1;
    const xiuIdx = (startIdx + i) % 28;
    const xiuFull = XIU28[xiuIdx];
    const xiuShort = xiuFull[0]; // 取第一个字作为简称
    const qin = QIN_XIANG[xiuShort] || '?';
    const wx = XIU_WUXING[xiuShort] || '?';
    const bw = boWei(pan.yaoList[i].naZhi);
    
    yaoXiu.push({ position: pos, xiuName: xiuFull, qinXiang: qin, wuXing: wx, boWei: bw });
    
    if (pan.yaoList[i].shiYing === '世') shiXiuName = qin;
    if (pan.yaoList[i].shiYing === '应') yingXiuName = qin;
  }
  
  // 吞啖判断
  let tunTie = '世应无吞啖关系';
  if (shiXiuName && yingXiuName) {
    if (shiXiuName === yingXiuName) tunTie = '同宿相争，两强相斗';
    else if (TUNTIE[shiXiuName]?.includes(yingXiuName)) tunTie = `我(${shiXiuName})吞彼(${yingXiuName})，我得势，事可成`;
    else if (TUNTIE[yingXiuName]?.includes(shiXiuName)) tunTie = `彼(${yingXiuName})吞我(${shiXiuName})，对方得势，我被动`;
  }
  
  // 格局简判
  const geJu: string[] = [];
  const shiYao = pan.yaoList.find(y => y.shiYing === '世');
  const shiXiuObj = shiYao ? yaoXiu.find(x => x.position === shiYao.position) : null;
  if (shiXiuObj) {
    if (shiXiuObj.qinXiang === '龙' && ['巳','午'].includes(shiYao!.naZhi)) geJu.push('龙居尊位');
    if (shiXiuObj.qinXiang === '虎' && ['寅','卯'].includes(shiYao!.naZhi)) geJu.push('虎踞山林');
    if (shiXiuObj.qinXiang === '蛟' && ['亥','子'].includes(shiYao!.naZhi)) geJu.push('蛟龙出海');
    if (shiXiuObj.qinXiang === '马' && shiYao!.naZhi === '午') geJu.push('马跃天衢');
    if (shiXiuObj.qinXiang === '虎' && ['辰','戌','丑','未'].includes(shiYao!.naZhi)) geJu.push('虎遭陷井');
    if (shiXiuObj.qinXiang === '龙' && ['巳','午'].includes(shiYao!.naZhi)) geJu.push('龙游浅水');
  }
  
  return { yaoXiu, shiXiu: shiXiuName, yingXiu: yingXiuName, tunTie, geJu };
}
