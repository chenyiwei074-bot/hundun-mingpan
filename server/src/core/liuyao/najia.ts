// 混沌六爻 纳甲排盘引擎
// Ported from 混沌六爻 skill

import { TianGan, DiZhi, YaoValue, LiuYaoData, YaoInfo, GuaInfo, LiuYaoPan } from './types';
import {
  GANS, ZHIS, GUA_NAMES, GUA_YAOS, GUA_WUXING, GUA_YINYANG, GUA64,
  NAJIA, GONG8, GONG_TYPE, SHI_YAO_POS, YING_YAO_POS,
  ZHI_WUXING, DZ_XIU, CHONG_ZHI, getLiuQin, getLiuShenOrder, getXunKong,
  monthToJian, dateToGanZhi, hourToZhi,
} from './constants';
import { JINGFANG_STARS } from './jingfang_stars';

// ============================================================
// 根据6爻二进制编码查找本卦信息
// ============================================================
function getGuaInfo(yaoCode: string): GuaInfo {
  const guaName = GUA64[yaoCode];
  if (!guaName) throw new Error('Invalid yao code: ' + yaoCode);
  
  // 确定宫位
  let gongIdx = 0;
  let guaTypeIdx = 0;
  for (let g = 0; g < 8; g++) {
    const idx = GONG8[g].indexOf(guaName);
    if (idx >= 0) { gongIdx = g; guaTypeIdx = idx; break; }
  }
  
  const xiaCode = yaoCode.substring(0, 3);
  const shangCode = yaoCode.substring(3, 6);
  const xiaIdx = GUA_YAOS.indexOf(xiaCode);
  const shangIdx = GUA_YAOS.indexOf(shangCode);
  
  return {
    name: guaName,
    shangGua: GUA_NAMES[shangIdx],
    xiaGua: GUA_NAMES[xiaIdx],
    gongWei: GUA_NAMES[gongIdx],
    gongWuXing: GUA_WUXING[gongIdx],
    shiYao: SHI_YAO_POS[guaTypeIdx],
    yingYao: YING_YAO_POS[guaTypeIdx],
    guaType: GONG_TYPE[guaTypeIdx] as GuaInfo['guaType'],
  };
}

// ============================================================
// 纳甲: 为六爻分配天干地支
// ============================================================
function naJia(yaoCode: string): { ganList: TianGan[]; zhiList: DiZhi[] } {
  const xiaCode = yaoCode.substring(0, 3);
  const shangCode = yaoCode.substring(3, 6);
  
  const xiaGuaIdx = GUA_YAOS.indexOf(xiaCode);
  const shangGuaIdx = GUA_YAOS.indexOf(shangCode);
  
  const [neiNajia, waiNajia] = NAJIA[xiaGuaIdx];
  const [_, waiNajia2] = NAJIA[shangGuaIdx];
  
  // 内卦纳干支 (初、二、三爻)
  const neiGan = neiNajia[0] as TianGan;
  const neiZhiChars = neiNajia.substring(1); // 三个地支
  const neiZhis: DiZhi[] = [];
  for (let i = 0; i < 3; i++) {
    neiZhis.push(neiZhiChars.substring(i, i+1) as DiZhi);
  }
  
  // 外卦纳干支 (四、五、上爻)
  const waiNajiaStr = waiNajia2 || waiNajia;
  const waiGan = waiNajiaStr[0] as TianGan;
  const waiZhiChars = waiNajiaStr.substring(1);
  const waiZhis: DiZhi[] = [];
  for (let i = 0; i < 3; i++) {
    waiZhis.push(waiZhiChars.substring(i, i+1) as DiZhi);
  }
  
  // 组装: 初爻=内卦初, 二爻=内卦二, 三爻=内卦三, 四爻=外卦初, 五爻=外卦二, 上爻=外卦三
  const ganList: TianGan[] = [neiGan, neiGan, neiGan, waiGan, waiGan, waiGan];
  const zhiList: DiZhi[] = [...neiZhis, ...waiZhis];
  
  return { ganList, zhiList };
}

// ============================================================
// 排盘主函数
// ============================================================
export interface PaiPanOptions {
  /** 日干支 (对应 engine.py day_gz), 缺省按日期推算 */
  riChen?: { gan: TianGan; zhi: DiZhi };
  /** 月建地支 (对应 engine.py month_zhi), 缺省按公历月近似 */
  yueJian?: DiZhi;
  /** 天盘星宿系统: jingfang=京房穿禽(默认, 与 engine.py 一致), dizhi=地支查表 */
  xiuMode?: 'jingfang' | 'dizhi';
}

export function paiPan(yaoData: LiuYaoData, date: Date = new Date(), opts: PaiPanOptions = {}): LiuYaoPan {
  // 本卦二进制编码
  const benCode = yaoData.map(v => v % 2 === 1 ? '1' : '0').join('');
  const benGua = getGuaInfo(benCode);
  
  // 变卦: 动爻翻转阴阳
  const bianYaoData = yaoData.map(v => {
    if (v === 6) return 7;  // 老阴动→少阳
    if (v === 9) return 8;  // 老阳动→少阴
    return v;
  }) as LiuYaoData;
  const hasDong = yaoData.some(v => v === 6 || v === 9);
  const bianCode = bianYaoData.map(v => v % 2 === 1 ? '1' : '0').join('');
  const bianGua = hasDong && bianCode !== benCode ? getGuaInfo(bianCode) : null;
  
  // 纳甲
  const { ganList, zhiList } = naJia(benCode);
  const bianNajia = hasDong ? naJia(bianCode) : { ganList: [...ganList], zhiList: [...zhiList] };
  
  // 日辰月建 (opts 可覆盖, 与 engine.py day_gz/month_zhi 对应)
  const riGanZhi = opts.riChen || dateToGanZhi(date);
  const yueJian = opts.yueJian || monthToJian(date.getMonth() + 1);
  const xunKongZhi = getXunKong(riGanZhi.gan, riGanZhi.zhi);
  const yuePoZhi = [CHONG_ZHI[yueJian]];
  
  // 天盘星宿 (默认京房穿禽, 与 engine.py xiu_mode='jingfang' 一致)
  const xiuMode = opts.xiuMode || 'jingfang';
  const tianXiu: string[] = xiuMode === 'jingfang' && JINGFANG_STARS[benCode]
    ? [...JINGFANG_STARS[benCode]]
    : zhiList.map(z => (DZ_XIU[z] || ['?'])[0]);
  
  // 六神顺序
  const liuShenOrder = getLiuShenOrder(riGanZhi.gan);
  
  // 组装六爻
  const yaoList: YaoInfo[] = [];
  for (let i = 0; i < 6; i++) {
    const pos = i + 1; // 1=初爻
    const val = yaoData[i];
    const isDong = val === 6 || val === 9;
    const zhi = zhiList[i];
    
    yaoList.push({
      position: pos,
      value: val,
      yinYang: val % 2 === 1 ? '阳' : '阴',
      isDong,
      naGan: ganList[i],
      naZhi: zhi,
      liuQin: getLiuQin(benGua.gongWuXing, ZHI_WUXING[ZHIS.indexOf(zhi)]),
      liuShen: liuShenOrder[(pos - 1) % 6],
      shiYing: pos === benGua.shiYao ? '世' : pos === benGua.yingYao ? '应' : null,
      xunKong: xunKongZhi.includes(zhi),
      yuePo: yuePoZhi.includes(zhi),
      xiu: tianXiu[i],
    });
  }
  
  // 变卦六爻
  const yaoListBian: YaoInfo[] = [];
  if (bianGua) {
    for (let i = 0; i < 6; i++) {
      const pos = i + 1;
      const zhi = bianNajia.zhiList[i];
      yaoListBian.push({
        position: pos,
        value: bianYaoData[i],
        yinYang: bianYaoData[i] % 2 === 1 ? '阳' : '阴',
        isDong: false, // 变卦中均为静爻
        naGan: bianNajia.ganList[i],
        naZhi: zhi,
        // 变卦六亲以本宫五行论 (与 engine.py bian_qin6 一致)
        liuQin: getLiuQin(benGua.gongWuXing, ZHI_WUXING[ZHIS.indexOf(zhi)]),
        liuShen: liuShenOrder[(pos - 1) % 6],
        shiYing: pos === bianGua.shiYao ? '世' : pos === bianGua.yingYao ? '应' : null,
        xunKong: xunKongZhi.includes(zhi),
        yuePo: yuePoZhi.includes(zhi),
        xiu: tianXiu[i],
      });
    }
  } else {
    yaoListBian.push(...yaoList);
  }
  
  return {
    benGua,
    bianGua,
    yaoList,
    yaoListBian,
    riChen: riGanZhi,
    yueJian,
    xunKongZhi,
    yuePoZhi,
    tianXiu,
  };
}
