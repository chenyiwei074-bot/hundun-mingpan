// 西方侧「依据」块的唯一数据源（批H 打样，业主 2026-10-23 裁定）。
//
// 三层是硬性形态：原文（公版底本）／本站白话（本站自写，非他人译本）／口径标注（把
// "古籍原文 · 本站实现选择 · 近代约定"分开写）。缺任一层就不算有出处，astro-acceptance
// 里 `astro/basis-three-layers` 按这一条判红。
//
// 原文那一句必须能在 docs/classics/western/ 对应底本里以"连续子串"找到（比对前两侧各自
// 把连续空白折叠为单空格 —— 源 TXT 是约 70 字符硬换行，不折叠就得把换行位置抄进代码，
// 那种引用一改版就烂）。逐字性由 `astro/basis-quote-is-substring-of-classics` 机检。

/** 一条口径说法属于哪一层。`近代约定` 的词条必须写死在这一层里，不许混进原文层。 */
export type BasisTier = '古籍原文' | '本站实现选择' | '近代约定 · 非古籍';

export interface BasisTriple {
  /** 入仓底本路径（读者与验收套件都从这条路径复核） */
  底本: string;
  /** 版本与取文凭据（PG 编号／译者／原版出版年／抓取日期） */
  版本: string;
  /** 卷篇：编号按该版本，与通行今本不同 */
  章节: string;
  /** 逐字原文（英文照原样，含注号与花体标记） */
  原文: string;
  /** 本站白话：本站自己写的一句话，不是他人译本 */
  白话: string;
  /** 口径标注：这条口径里哪部分是古籍、哪部分是本站实现、哪部分只是近代约定 */
  口径: { 说法: string; 属于: BasisTier }[];
}

export const TROPICAL_SIGNS_BASIS: BasisTriple = {
  底本: 'docs/classics/western/tetrabiblos-i-xiv-tropical-signs.md',
  版本: '《Tetrabiblos》J. M. Ashmand 英译 · 原出版 W. Foulsham & Co. 1900 · Project Gutenberg #70850 · 2026-10-23 取',
  章节: '该版第一卷第十四章「TROPICAL, EQUINOCTIAL, FIXED, AND BICORPOREAL SIGNS」（章节号按该版，通行今本编号不同）',
  原文: 'The tropical signs are two: viz. the first thirty degrees after the summer solstice, which compose the sign of Cancer; and the first thirty degrees after the winter solstice, composing the sign of Capricorn.',
  白话: '巨蟹宫就是夏至点之后的头三十度，摩羯宫是冬至点之后的头三十度；"回归（tropical）"这个名字来自太阳走到这两点看着像转了方向。本页说的"回归黄道"是同一件事：宫名挂在至点与分点上，不随恒星背景漂移。',
  口径: [
    { 说法: '回归黄道：宫挂在至点与分点上', 属于: '古籍原文' },
    { 说法: '黄经自春分点起算、每宫恰 30°、不作岁差换算', 属于: '本站实现选择' },
    { 说法: '相位容许度 orb、Placidus 分宫、synastry 合盘、Life Path', 属于: '近代约定 · 非古籍' },
  ],
};
