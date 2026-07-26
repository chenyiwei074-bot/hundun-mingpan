// 紫微斗数四化系统

import { Tiangan, SiHua } from './types';

/**
 * 四化星曜（按年干）
 * 格式：{ 年干: { 化禄, 化权, 化科, 化忌 } }
 */
const SIHUA_BY_YEAR_GAN: { [key in Tiangan]: { lu: string; quan: string; ke: string; ji: string } } = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' }
};

/**
 * 获取指定天干的四化
 */
export function getSiHuaByGan(gan: Tiangan): { lu: string; quan: string; ke: string; ji: string } {
  return SIHUA_BY_YEAR_GAN[gan];
}

/**
 * 计算某个宫位的四化（用于飞化）
 * @param gan 宫位天干
 * @param gongStars 宫位内的星曜列表
 * @returns 该宫位飞化出的四化星及其位置
 */
export function calculateFeiHua(gan: Tiangan, allGongs: any[]): {
  lu: { star: string; targetGong: string } | null;
  quan: { star: string; targetGong: string } | null;
  ke: { star: string; targetGong: string } | null;
  ji: { star: string; targetGong: string } | null;
} {
  const sihua = getSiHuaByGan(gan);
  
  const result = {
    lu: null as { star: string; targetGong: string } | null,
    quan: null as { star: string; targetGong: string } | null,
    ke: null as { star: string; targetGong: string } | null,
    ji: null as { star: string; targetGong: string } | null
  };
  
  // 找到化禄、化权、化科、化忌的星曜所在宫位（包括主星和辅星）
  for (const gong of allGongs) {
    const allStars = [...gong.mainStars, ...(gong.auxStars || [])];
    
    if (allStars.includes(sihua.lu)) {
      result.lu = { star: sihua.lu, targetGong: gong.gong };
    }
    if (allStars.includes(sihua.quan)) {
      result.quan = { star: sihua.quan, targetGong: gong.gong };
    }
    if (allStars.includes(sihua.ke)) {
      result.ke = { star: sihua.ke, targetGong: gong.gong };
    }
    if (allStars.includes(sihua.ji)) {
      result.ji = { star: sihua.ji, targetGong: gong.gong };
    }
  }
  
  return result;
}

/**
 * 为命盘添加本命四化（出生年干的四化）
 */
export function addBenMingSiHua(gongs: any[], yearGan: Tiangan): any[] {
  const sihua = getSiHuaByGan(yearGan);
  
  return gongs.map(gong => {
    const sihuaList: { star: string; hua: SiHua }[] = [];
    
    // 检查宫位内的主星和辅星是否有四化
    const allStars = [...gong.mainStars, ...(gong.auxStars || [])];
    
    allStars.forEach((star: string) => {
      if (star === sihua.lu) {
        sihuaList.push({ star, hua: '化禄' });
      }
      if (star === sihua.quan) {
        sihuaList.push({ star, hua: '化权' });
      }
      if (star === sihua.ke) {
        sihuaList.push({ star, hua: '化科' });
      }
      if (star === sihua.ji) {
        sihuaList.push({ star, hua: '化忌' });
      }
    });
    
    return {
      ...gong,
      sihua: sihuaList
    };
  });
}

/**
 * 获取四化的颜色样式
 */
export function getSiHuaColor(hua: SiHua): string {
  switch (hua) {
    case '化禄': return '#22c55e'; // 绿色
    case '化权': return '#a855f7'; // 紫色
    case '化科': return '#3b82f6'; // 蓝色
    case '化忌': return '#ef4444'; // 红色
    default: return '#666';
  }
}

/**
 * 获取四化的简称
 */
export function getSiHuaShort(hua: SiHua): string {
  switch (hua) {
    case '化禄': return '禄';
    case '化权': return '权';
    case '化科': return '科';
    case '化忌': return '忌';
    default: return '';
  }
}


// ========== 许诠仁四化技法扩展 ==========

/**
 * 来因宫：命盘中天干与生年天干相同的宫位
 * 许诠仁体系核心——来因宫是人生"气"的根源，四化从该宫发起
 */
export function getLaiYinGong(yearGan: Tiangan, gongs: any[]): {
  gong: string;
  dizhi: string;
  tiangan: Tiangan;
  index: number;
  desc: string;
  interpretation: string;
} | null {
  const GONG_DESC: { [key: string]: string } = {
    '命宫': '自我、性格、人生基调',
    '兄弟': '手足、同辈、合作关系',
    '夫妻': '配偶、感情、婚姻',
    '子女': '子女、创造力、享乐',
    '财帛': '财富、赚钱能力、物质',
    '疾厄': '健康、灾厄、业力',
    '迁移': '外出、变动、社会形象',
    '交友': '朋友、下属、众生缘',
    '官禄': '事业、地位、成就',
    '田宅': '家庭、房产、根基',
    '福德': '精神、福报、享受',
    '父母': '父母、长辈、上司'
  };

  const LAIYIN_INTERP: { [key: string]: string } = {
    '命宫': '气从自身出——你的人生由自己主导，一切境遇归根结底源于自我选择。四化之力从命宫发动，成败荣辱皆由己造。',
    '兄弟': '气从手足同辈出——兄弟姐妹、合作伙伴是你命运的重要推手。四化之力借由他人之力成就你，单打独斗反而不利。',
    '夫妻': '气从婚姻感情出——配偶或感情伴侣是改变你命运的关键变量。婚后人生轨迹变化明显，另一半的好坏直接影响你的人生高度。',
    '子女': '气从子息出——子女或创作产出是你命运的转折点。生儿育女后运势明显变化，也可能通过创作、投资、合伙项目改变人生。',
    '财帛': '气从财富出——钱财是你命运的核心驱动力。赚钱欲望和理财方式决定人生走向，经济状况变化直接带动全局变化。',
    '疾厄': '气从业力健康出——身体、业障是你必须面对的课题。健康状态影响一切，也有人通过战胜疾病完成人生蜕变。',
    '迁移': '气从外出变动出——离开舒适区是你命运转变的开关。外出发展、远行、换环境是破局的钥匙。',
    '交友': '气从众生缘出——朋友、粉丝、团队是你命运的放大器。人脉广则路宽，得道多助。',
    '官禄': '气从事业出——事业成就定义你的人生价值。在职场和公共事务中找到自我，事业起伏直接关联人生起伏。',
    '田宅': '气从家庭根基出——原生家庭和房产是你命运的压舱石。家宅安稳则人生安稳，祖荫深厚者有天然优势。',
    '福德': '气从精神福报出——内心世界的丰盈决定外在生活的质量。福报深厚者自有机缘相救，精神修养到位则万事从容。',
    '父母': '气从长辈出——父母、师长、上司的提携是你命运的起点。背景和人脉资源不可忽视，有贵人扶持则事半功倍。'
  };

  for (let i = 0; i < gongs.length; i++) {
    if (gongs[i].tiangan === yearGan) {
      return {
        gong: gongs[i].gong,
        dizhi: gongs[i].dizhi,
        tiangan: yearGan,
        index: i,
        desc: GONG_DESC[gongs[i].gong] || '',
        interpretation: LAIYIN_INTERP[gongs[i].gong] || ''
      };
    }
  }
  return null;
}

/**
 * 自化检测：宫干四化落入本宫星曜即为自化
 * 许诠仁体系：自化表示能量的"自我转化"——向外/向内/消散/反弹
 */
export function detectZiHua(gongs: any[]): any[] {
  return gongs.map(gong => {
    const sihua = getSiHuaByGan(gong.tiangan);
    const ziHuaList: { star: string; hua: string; effect: string }[] = [];
    const allStars = [...(gong.mainStars || []), ...(gong.auxStars || [])];

    // 检查宫干四化是否落入本宫星曜
    if (allStars.includes(sihua.lu)) {
      ziHuaList.push({ star: sihua.lu, hua: '化禄', effect: '禄出——能量外溢，乐于分享，但需防散财' });
    }
    if (allStars.includes(sihua.quan)) {
      ziHuaList.push({ star: sihua.quan, hua: '化权', effect: '权出——自我主张强，但易刚愎自用' });
    }
    if (allStars.includes(sihua.ke)) {
      ziHuaList.push({ star: sihua.ke, hua: '化科', effect: '科出——名声自显，但需防虚名' });
    }
    if (allStars.includes(sihua.ji)) {
      ziHuaList.push({ star: sihua.ji, hua: '化忌', effect: '忌出——执着内耗，能量自锁，需化解' });
    }

    return {
      ...gong,
      ziHua: ziHuaList.length > 0 ? ziHuaList : undefined
    };
  });
}

/**
 * 生年四化分布总览（许诠仁体系核心输出）
 * 禄权科忌各落何宫，用于串联解读
 */
export function getSiHuaOverview(yearGan: Tiangan, gongs: any[]): {
  lu: { star: string; gong: string; dizhi: string };
  quan: { star: string; gong: string; dizhi: string };
  ke: { star: string; gong: string; dizhi: string };
  ji: { star: string; gong: string; dizhi: string };
  summary: string;
} {
  const sihua = getSiHuaByGan(yearGan);
  const result: any = { lu: null, quan: null, ke: null, ji: null };

  for (const gong of gongs) {
    const allStars = [...(gong.mainStars || []), ...(gong.auxStars || [])];
    if (allStars.includes(sihua.lu) && !result.lu) {
      result.lu = { star: sihua.lu, gong: gong.gong, dizhi: gong.dizhi };
    }
    if (allStars.includes(sihua.quan) && !result.quan) {
      result.quan = { star: sihua.quan, gong: gong.gong, dizhi: gong.dizhi };
    }
    if (allStars.includes(sihua.ke) && !result.ke) {
      result.ke = { star: sihua.ke, gong: gong.gong, dizhi: gong.dizhi };
    }
    if (allStars.includes(sihua.ji) && !result.ji) {
      result.ji = { star: sihua.ji, gong: gong.gong, dizhi: gong.dizhi };
    }
  }

  // 许诠仁式四化互动总结
  const summaryParts: string[] = [];
  if (result.lu) summaryParts.push('禄在' + result.lu.gong + '（' + result.lu.star + '化禄）');
  if (result.quan) summaryParts.push('权在' + result.quan.gong + '（' + result.quan.star + '化权）');
  if (result.ke) summaryParts.push('科在' + result.ke.gong + '（' + result.ke.star + '化科）');
  if (result.ji) summaryParts.push('忌在' + result.ji.gong + '（' + result.ji.star + '化忌）');

  return {
    ...result,
    summary: summaryParts.join('；')
  };
}
