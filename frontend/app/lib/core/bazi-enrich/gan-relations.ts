// 天干关系 + 整柱盖头/截脚

import { Tiangan, GAN_WUXING, ZHI_WUXING, Dizhi, shengKe } from './tables';

export type GanRelation = {
  type: '天干合'|'天干相克'|'天干同';
  gans: Tiangan[];
  pillars: string[];
};

const GAN_HE_PAIRS: Array<[Tiangan, Tiangan, string]> = [
  ['甲','己','土'],['乙','庚','金'],['丙','辛','水'],['丁','壬','木'],['戊','癸','火']
];

type Pillar = '年'|'月'|'日'|'时';

export type GanPairType = '天干合' | '天干相克' | '天干相生' | '天干同';

/**
 * 两个天干之间的关系。就地从 detectGanRelations 的双层循环里抽出来，
 * 让"两个人之间"的合盘能复用同一张表 —— 合盘另写一份五合/相克表，
 * 就是本站反复踩的那个"同一件事两处实现"（三份 getShiShen 是现成的例子）。
 * 抽取前后行为必须逐对相同，套件用 10×10 全枚举钉住。
 */
export function ganPair(a: Tiangan, b: Tiangan): GanPairType | null {
  if (GAN_HE_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x))) return '天干合';
  if (a === b) return '天干同';
  const rel = shengKe(GAN_WUXING[a], GAN_WUXING[b]);
  if (rel === '克' || rel === '被克') return '天干相克';
  if (rel === '生' || rel === '被生') return '天干相生';
  return null;
}

export function detectGanRelations(gans: Record<Pillar, Tiangan>): GanRelation[] {
  const out: GanRelation[] = [];
  const pillars: Pillar[] = ['年','月','日','时'];
  const list = pillars.map(p => ({pillar: p, gan: gans[p]}));
  for (let i = 0; i < list.length; i++) {
    for (let j = i+1; j < list.length; j++) {
      const a = list[i], b = list[j];
      // 只保留原来会产出的那三类：新增的"相生/相同"是合盘要用的，
      // 这里必须过滤掉，否则本盘关系表的输出会凭空多出两类（行为变了，套件该红）。
      const p = ganPair(a.gan, b.gan);
      if (p === '天干合' || p === '天干相克') {
        out.push({ type: p, gans: [a.gan, b.gan], pillars: [a.pillar, b.pillar] });
      }
    }
  }
  return out;
}

// 整柱盖头/截脚
// 盖头: 天干克地支(以五行论)
// 截脚: 地支克天干
export type PillarVerdict = {
  pillar: Pillar;
  gan: Tiangan;
  zhi: Dizhi;
  /** 五行之间没有"既不同、也不生、也不克"的第六种情形：shengKe 在 WuXing 上是全函数
   *  (tables.ts:42)，返回值只有 生/克/同/被生/被克 五种，五种各有判词。原并集里那个
   *  '天地异气无生克' 永远进不去，声明却允许它出现 —— 与藏干那次同一个毛病（声明比运行时宽，
   *  下游就会照着写一个永远为假的分支）。已删，枚举齐不齐由套件用 10×12 全组合钉。 */
  verdict: '盖头'|'截脚'|'天干生地支'|'地支生天干'|'天地同气';
};

export function judgePillars(siZhu: Record<Pillar, {gan: Tiangan, zhi: Dizhi}>): PillarVerdict[] {
  const pillars: Pillar[] = ['年','月','日','时'];
  return pillars.map(p => {
    const {gan, zhi} = siZhu[p];
    const ganWx = GAN_WUXING[gan];
    const zhiWx = ZHI_WUXING[zhi];
    const rel = shengKe(ganWx, zhiWx);
    let verdict: PillarVerdict['verdict'];
    if (rel === '克') verdict = '盖头';
    else if (rel === '被克') verdict = '截脚';
    else if (rel === '生') verdict = '天干生地支';
    else if (rel === '被生') verdict = '地支生天干';
    else verdict = '天地同气';
    return {pillar: p, gan, zhi, verdict};
  });
}
