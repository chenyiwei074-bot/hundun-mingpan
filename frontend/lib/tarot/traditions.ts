import type { TarotCard } from './deck';

export interface MarseilleCardReference {
  title: string;
  number: string;
  structure: string;
  note?: string;
}

// Common Tarot de Marseille correspondences. Deck-specific spelling and
// numbering can vary; this table is a naming/structure index, not divinatory
// meanings attributed to a Marseille author.
const MARSEILLE_MAJOR: Record<string, MarseilleCardReference> = {
  'major-00': { title: 'Le Mat', number: '无编号', structure: '大阿卡那；此处不把韦特的 0 号直接当作马赛牌原始编号。' },
  'major-01': { title: 'Le Bateleur', number: 'I', structure: '大阿卡那；常见牌序第 I 张。' },
  'major-02': { title: 'La Papesse', number: 'II', structure: '大阿卡那；常见牌序第 II 张。' },
  'major-03': { title: "L'Impératrice", number: 'III', structure: '大阿卡那；常见牌序第 III 张。' },
  'major-04': { title: "L'Empereur", number: 'IV', structure: '大阿卡那；常见牌序第 IV 张。' },
  'major-05': { title: 'Le Pape', number: 'V', structure: '大阿卡那；常见牌序第 V 张。' },
  'major-06': { title: "L'Amoureux", number: 'VI', structure: '大阿卡那；常见牌序第 VI 张。' },
  'major-07': { title: 'Le Chariot', number: 'VII', structure: '大阿卡那；常见牌序第 VII 张。' },
  'major-08': { title: 'La Force', number: 'XI', structure: '大阿卡那；马赛常见编号为 XI，与韦特—史密斯的 VIII 不同。' },
  'major-09': { title: "L'Hermite", number: 'IX', structure: '大阿卡那；常见牌序第 IX 张。' },
  'major-10': { title: 'La Roue de Fortune', number: 'X', structure: '大阿卡那；常见牌序第 X 张。' },
  'major-11': { title: 'La Justice', number: 'VIII', structure: '大阿卡那；马赛常见编号为 VIII，与韦特—史密斯的 XI 不同。' },
  'major-12': { title: 'Le Pendu', number: 'XII', structure: '大阿卡那；常见牌序第 XII 张。' },
  'major-13': { title: 'Arcane sans nom', number: 'XIII', structure: '大阿卡那；部分历史牌组不在牌面印出名称。', note: '这里保留“无名牌”称呼，不把现代通称当作每一版的牌面原文。' },
  'major-14': { title: 'Tempérance', number: 'XIV', structure: '大阿卡那；常见牌序第 XIV 张。' },
  'major-15': { title: 'Le Diable', number: 'XV', structure: '大阿卡那；常见牌序第 XV 张。' },
  'major-16': { title: 'La Maison Dieu', number: 'XVI', structure: '大阿卡那；常见牌序第 XVI 张，牌名依版本可能有异。' },
  'major-17': { title: "L'Étoile", number: 'XVII', structure: '大阿卡那；常见牌序第 XVII 张。' },
  'major-18': { title: 'La Lune', number: 'XVIII', structure: '大阿卡那；常见牌序第 XVIII 张。' },
  'major-19': { title: 'Le Soleil', number: 'XIX', structure: '大阿卡那；常见牌序第 XIX 张。' },
  'major-20': { title: 'Le Jugement', number: 'XX', structure: '大阿卡那；常见牌序第 XX 张。' },
  'major-21': { title: 'Le Monde', number: 'XXI', structure: '大阿卡那；常见牌序第 XXI 张。' },
};

const SUIT_FR: Record<NonNullable<TarotCard['suit']>, string> = {
  '权杖': 'Bâtons', '圣杯': 'Coupes', '宝剑': 'Épées', '星币': 'Deniers',
};
const RANK_FR: Record<string, string> = {
  A: 'As', '2': 'Deux', '3': 'Trois', '4': 'Quatre', '5': 'Cinq',
  '6': 'Six', '7': 'Sept', '8': 'Huit', '9': 'Neuf', '10': 'Dix',
  P: 'Valet', N: 'Cavalier', Q: 'Reine', K: 'Roi',
};

export function getMarseilleCardReference(card: TarotCard): MarseilleCardReference {
  if (card.arcana === 'major') return MARSEILLE_MAJOR[card.id] ?? {
    title: '未匹配的大阿卡那牌', number: '—', structure: '当前牌名不在对应表中，暂不推测。',
  };
  const rank = card.rank ?? '';
  const suit = card.suit ? SUIT_FR[card.suit] : undefined;
  const frenchRank = RANK_FR[rank];
  if (!suit || !frenchRank) return {
    title: '未匹配的小阿卡那牌', number: '—', structure: '当前牌名或花色不完整，暂不推测。',
  };
  const court = ['P', 'N', 'Q', 'K'].includes(rank);
  return {
    title: `${frenchRank} de ${suit}`,
    number: rank === 'A' ? 'As' : /^\d+$/.test(rank) ? rank : '宫廷牌',
    structure: court
      ? '宫廷牌称谓对照：Valet / Cavalier / Reine / Roi；不同牌组或译本的中文叫法可能不同。'
      : '数字牌结构对照：按花色与点数映射；此处不把韦特—史密斯场景插画或牌义移植到马赛牌系。',
  };
}

export const TAROT_TRADITION_SOURCES = {
  waite: 'https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3',
  dodal: 'https://www.britishmuseum.org/collection/object/P_1896-0501-592-1-78',
} as const;
