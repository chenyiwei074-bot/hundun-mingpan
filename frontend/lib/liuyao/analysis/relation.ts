// 地支关系分析 — 六合、六冲、三合局

import type { NaJiaYao } from '@/types/liuyao';

export interface LiuHeItem {
  type: '六合';
  positions: [number, number];
  zhi: [string, string];
}

export interface LiuChongItem {
  type: '六冲';
  positions: [number, number];
  zhi: [string, string];
}

export interface SanHeItem {
  type: '三合';
  positions: [number, number, number];
  zhi: [string, string, string];
  ju: string; // 水局/木局/火局/金局
}

export interface HexagramRelations {
  liuHe: LiuHeItem[];
  liuChong: LiuChongItem[];
  sanHe: SanHeItem[];
}

// ══ 六合对 ══
const LIU_HE: Record<string,string> = {
  '子':'丑','丑':'子','寅':'亥','亥':'寅',
  '卯':'戌','戌':'卯','辰':'酉','酉':'辰',
  '巳':'申','申':'巳','午':'未','未':'午',
};

// ══ 六冲对 ══
const LIU_CHONG: Record<string,string> = {
  '子':'午','午':'子','丑':'未','未':'丑',
  '寅':'申','申':'寅','卯':'酉','酉':'卯',
  '辰':'戌','戌':'辰','巳':'亥','亥':'巳',
};

// ══ 三合局 ══
const SAN_HE: Record<string,{ zhi: string[]; ju: string }> = {
  '申子辰': { zhi: ['申','子','辰'], ju: '水局' },
  '亥卯未': { zhi: ['亥','卯','未'], ju: '木局' },
  '寅午戌': { zhi: ['寅','午','戌'], ju: '火局' },
  '巳酉丑': { zhi: ['巳','酉','丑'], ju: '金局' },
};

/** 分析卦内所有地支关系 */
export function analyzeRelations(naJia: NaJiaYao[]): HexagramRelations {
  const liuHe: LiuHeItem[] = [];
  const liuChong: LiuChongItem[] = [];
  const sanHe: SanHeItem[] = [];

  const yaos = naJia.map(y => ({ position: y.position, zhi: y.naZhi }));
  const zhiSet = yaos.map(y => y.zhi);

  // 六合：两两配对
  const usedHe = new Set<number>();
  for (let i = 0; i < yaos.length; i++) {
    if (usedHe.has(i)) continue;
    for (let j = i + 1; j < yaos.length; j++) {
      if (usedHe.has(j)) continue;
      if (LIU_HE[yaos[i].zhi] === yaos[j].zhi) {
        liuHe.push({
          type: '六合',
          positions: [yaos[i].position, yaos[j].position] as [number, number],
          zhi: [yaos[i].zhi, yaos[j].zhi],
        });
        usedHe.add(i);
        usedHe.add(j);
        break;
      }
    }
  }

  // 六冲：两两配对
  const usedChong = new Set<number>();
  for (let i = 0; i < yaos.length; i++) {
    if (usedChong.has(i)) continue;
    for (let j = i + 1; j < yaos.length; j++) {
      if (usedChong.has(j)) continue;
      if (LIU_CHONG[yaos[i].zhi] === yaos[j].zhi) {
        liuChong.push({
          type: '六冲',
          positions: [yaos[i].position, yaos[j].position] as [number, number],
          zhi: [yaos[i].zhi, yaos[j].zhi],
        });
        usedChong.add(i);
        usedChong.add(j);
        break;
      }
    }
  }

  // 三合：三三配对
  const sanHeEntries = Object.values(SAN_HE);
  for (const { zhi: pattern, ju } of sanHeEntries) {
    const match: typeof yaos = [];
    const used = new Set<number>();
    for (const targetZhi of pattern) {
      for (let i = 0; i < yaos.length; i++) {
        if (used.has(i)) continue;
        if (yaos[i].zhi === targetZhi) {
          match.push(yaos[i]);
          used.add(i);
          break;
        }
      }
    }
    if (match.length === 3) {
      sanHe.push({
        type: '三合',
        positions: [match[0].position, match[1].position, match[2].position] as [number, number, number],
        zhi: [match[0].zhi, match[1].zhi, match[2].zhi],
        ju,
      });
    }
  }

  return { liuHe, liuChong, sanHe };
}

/** 分析世应特殊关系 */
export function analyzeShiYingRelation(
  naJia: NaJiaYao[]
): { type: string; detail: string } | null {
  const shi = naJia.find(y => y.shiYing === '世');
  const ying = naJia.find(y => y.shiYing === '应');
  if (!shi || !ying) return null;

  const relations: string[] = [];

  if (LIU_HE[shi.naZhi] === ying.naZhi) {
    relations.push(`世${shi.naZhi}应${ying.naZhi}六合`);
  }
  if (LIU_CHONG[shi.naZhi] === ying.naZhi) {
    relations.push(`世${shi.naZhi}应${ying.naZhi}六冲`);
  }

  if (relations.length > 0) {
    return { type: '世应', detail: relations.join('，') };
  }

  return { type: '世应', detail: `世${shi.naZhi}应${ying.naZhi}无特殊冲合` };
}