import { DIZHI, TIANGAN } from '@/app/lib/core/yiqi-core/ganzhi';

export type DirectPillar = { gan: string; zhi: string };
export type DirectPillarsInput = {
  年: DirectPillar;
  月: DirectPillar;
  日: DirectPillar;
  时: DirectPillar;
};

export type DirectPillarsResult = {
  siZhu: DirectPillarsInput;
  enrichment: Record<string, unknown>;
};

/** 只判断这一柱是否为六十甲子中的合法干支配对，不校验整组四柱的出生时序。 */
export function isValidSexagenaryPillar(pillar: DirectPillar): boolean {
  const ganIndex = TIANGAN.indexOf(pillar.gan as typeof TIANGAN[number]);
  const zhiIndex = DIZHI.indexOf(pillar.zhi as typeof DIZHI[number]);
  return ganIndex >= 0 && zhiIndex >= 0 && ganIndex % 2 === zhiIndex % 2;
}
