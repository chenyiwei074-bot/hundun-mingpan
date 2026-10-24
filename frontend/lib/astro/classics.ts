// 西方侧「依据」块的唯一数据源（批H-W，业主 2026-10-23 两条裁定：窄路只认 PG 键入本、
// 查不到古籍出处的口径必须标近代）。
//
// 三层是硬性形态：原文（标底本与该版位置）→ 本站白话（自写并自证非他人译本）→ 口径标注
// （古籍原文 / 本站实现选择 / 近代文献 / 无古籍出处 · 近代约定）。缺任一层不算有出处。
//
// 原文那一句必须能在 `底本` 那个文件的 `底本段` 里以连续子串找到；比对前两侧过同一个
// canon（tools/_lib/pgnorm.ts）。注号 `[44]` 一类不许出现在引文里 —— 有独立判据。

/** 一条口径说法属于哪一层。业主裁定的三档 + 本站实现自己那一档。 */
export type BasisTier = '古籍原文' | '本站实现选择' | '近代文献' | '无古籍出处 · 近代约定';

export interface BasisTriple {
  /** 入仓底本文件（规范化后的 PG 文本，只由脚本生成） */
  底本: string;
  /** 该文件里的 PASSAGE 编号 */
  底本段: string;
  /** 载体与版本（PG 编号／译者／原出版年） */
  版本: string;
  /** 该版位置（章节号按底本这一版，与通行今本不同） */
  位置: string;
  /** 逐字原文（英文照原样，不含注号） */
  原文: string;
  /** 本站白话：本站自己写的一句话，不是他人译本 */
  白话: string;
  /** 口径标注 */
  口径: { 说法: string; 属于: BasisTier }[];
}

export const TROPICAL_SIGNS_BASIS: BasisTriple = {
  底本: 'docs/classics/western/tetrabiblos.txt',
  底本段: 'i-xiv-tropical-signs',
  版本: 'Project Gutenberg #70850 · J. M. Ashmand 英译 · 原出版 W. Foulsham & Co. 1900',
  位置: '该版 Book I 第十四章「TROPICAL, EQUINOCTIAL, FIXED, AND BICORPOREAL SIGNS」',
  原文: 'The tropical signs are two: viz. the first thirty degrees after the summer solstice, which compose the sign of Cancer; and the first thirty degrees after the winter solstice, composing the sign of Capricorn.',
  白话: '巨蟹宫就是夏至点之后的头三十度，摩羯宫是冬至点之后的头三十度；"回归（tropical）"这个名字来自太阳走到这两点看着像转了方向。本页说的"回归黄道"是同一件事：宫名挂在至点与分点上，不随恒星背景漂移。',
  口径: [
    { 说法: '回归黄道：宫挂在至点与分点上', 属于: '古籍原文' },
    { 说法: '黄经自春分点起算、每宫恰 30°、不作岁差换算', 属于: '本站实现选择' },
  ],
};

/** 相位几何：角度由古典段落支持；容许度是本站公开的现代实现选择。 */
export const ASPECT_GEOMETRY_BASIS: BasisTriple = {
  底本: 'docs/classics/western/tetrabiblos.txt',
  底本段: 'i-xvi-mutual-configurations',
  版本: 'Project Gutenberg #70850 · J. M. Ashmand 英译 · 原出版 W. Foulsham & Co. 1900',
  位置: '该版 Book I 第十六章「MUTUAL CONFIGURATIONS OF THE SIGNS」（≈ 今本 I.13，编号按本版记）',
  原文: 'This mutual configuration attaches to all parts diametrically distant from each other, containing between them two right angles, or six signs, or a hundred and eighty degrees: it also exists in all parts at the triangular distance from each other, containing between them one right angle and a third, or four signs, or a hundred and twenty degrees; also, in all parts at the quadrate distance from each other, containing between them exactly one right angle, or three signs, or ninety degrees; and, also, in all parts at the hexagonal distance from each other, containing between them two-thirds of a right angle, or two signs, or sixty degrees.',
  白话: '这段给的是相位按角度的定义：对宫 180°、三分相 120°、四分相 90°、六分相 60°。本站相位表采用这四个角度加合相 0°。',
  口径: [
    { 说法: '相位角度 60° / 90° / 120° / 180°', 属于: '古籍原文' },
    { 说法: '合相 0° 纳入本站五类主要相位', 属于: '本站实现选择' },
    { 说法: '容许度 orb（日月 ±8°、其余 ±6°、冲合 ±8°）', 属于: '无古籍出处 · 近代约定' },
    { 说法: 'Placidus 分宫、synastry 合盘', 属于: '无古籍出处 · 近代约定' },
  ],
};
