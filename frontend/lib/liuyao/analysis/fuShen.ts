// 伏神分析 — 本卦缺少六亲时从本宫卦寻找伏神

import type { NaJiaYao } from '@/types/liuyao';
import { PALACE, NA_GAN, NA_ZHI, WX as CORE_WX } from '@/lib/liuyao/core';

export interface FuShenItem {
  position: number;        // 飞神位置（当前卦中此爻位）
  flyingLiuQin: string;    // 飞神六亲
  flyingGanZhi: string;    // 飞神干支
  flyingWuxing: string;    // 飞神五行
  hiddenLiuQin: string;    // 伏神六亲（本宫卦此爻位六亲）
  hiddenGanZhi: string;    // 伏神干支
  hiddenWuxing: string;    // 伏神五行
}

// ══ 计算本宫卦（八纯卦）的纳甲 ══
function getPalaceGuaNaJia(gong: string): { position:number; liuQin:string; ganZhi:string; naZhi:string; naGan:string }[] {
  const palaceGua = PALACE[gong]?.[0]; // 八纯卦 = palace[0]
  if (!palaceGua) return [];

  // 八纯卦上下卦相同，都是 gong 本身
  const shangGua = gong;
  const xiaGua = gong;
  const [xiaGan, shangGan] = NA_GAN[gong] || ['甲','甲'];
  const xiaZhi = NA_ZHI[gong]?.slice(0,3) || [];
  const shangZhi = NA_ZHI[gong]?.slice(3,6) || [];
  const gongWx = CORE_WX[gong] || '?';

  const result = [];
  for (let i = 0; i < 6; i++) {
    const gan = i < 3 ? xiaGan : shangGan;
    const zi = i < 3 ? (xiaZhi[i] || '?') : (shangZhi[i-3] || '?');
    const ganZhi = gan + zi;
    const yaoWx = CORE_WX[zi] || '?';

    // 计算六亲
    const o = ['木','火','土','金','水'];
    const gi = o.indexOf(gongWx);
    const yi = o.indexOf(yaoWx);
    const diff = (yi - gi + 5) % 5;
    let liuQin = '';
    if (diff === 0) liuQin = '兄弟';
    else if (diff === 1) liuQin = '子孙';
    else if (diff === 2) liuQin = '妻财';
    else if (diff === 3) liuQin = '官鬼';
    else liuQin = '父母';

    result.push({ position: i+1, liuQin, ganZhi, naZhi: zi, naGan: gan });
  }
  return result;
}

// ══ 伏神分析 ══
export function analyzeFuShen(
  naJia: NaJiaYao[],
  gong: string
): FuShenItem[] {
  // 当前卦已出现的六亲
  const presentLiuQin = new Set(naJia.map(y => y.liuQin));

  // 标准六亲全集
  const allLiuQin = ['父母','兄弟','官鬼','妻财','子孙'];

  // 检查是否缺六亲
  const missing = allLiuQin.filter(lq => !presentLiuQin.has(lq));
  if (missing.length === 0) return [];

  // 获取本宫卦纳甲
  const palaceNaJia = getPalaceGuaNaJia(gong);
  if (palaceNaJia.length === 0) return [];

  const result: FuShenItem[] = [];

  // 对每个缺失的六亲，在本宫卦中找位置
  for (const missLq of missing) {
    const palaceYao = palaceNaJia.find(p => p.liuQin === missLq);
    if (!palaceYao) continue;

    const pos = palaceYao.position;
    const flyingYao = naJia.find(y => y.position === pos);
    if (!flyingYao) continue;

    result.push({
      position: pos,
      flyingLiuQin: flyingYao.liuQin,
      flyingGanZhi: flyingYao.ganZhi,
      flyingWuxing: CORE_WX[flyingYao.naZhi] || '?',
      hiddenLiuQin: palaceYao.liuQin,
      hiddenGanZhi: palaceYao.ganZhi,
      hiddenWuxing: CORE_WX[palaceYao.naZhi] || '?',
    });
  }

  return result;
}