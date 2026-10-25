export interface TarotCard {
  id: string;
  nameZh: string;
  nameEn: string;
  arcana: 'major' | 'minor';
  suit?: '权杖' | '圣杯' | '宝剑' | '星币';
  rank?: string;
  numeral?: string;
}

const MAJOR_ARCANA: TarotCard[] = [
  { id: 'major-00', nameZh: '愚者', nameEn: 'The Fool', arcana: 'major', numeral: '0' },
  { id: 'major-01', nameZh: '魔术师', nameEn: 'The Magician', arcana: 'major', numeral: 'I' },
  { id: 'major-02', nameZh: '女祭司', nameEn: 'The High Priestess', arcana: 'major', numeral: 'II' },
  { id: 'major-03', nameZh: '皇后', nameEn: 'The Empress', arcana: 'major', numeral: 'III' },
  { id: 'major-04', nameZh: '皇帝', nameEn: 'The Emperor', arcana: 'major', numeral: 'IV' },
  { id: 'major-05', nameZh: '教皇', nameEn: 'The Hierophant', arcana: 'major', numeral: 'V' },
  { id: 'major-06', nameZh: '恋人', nameEn: 'The Lovers', arcana: 'major', numeral: 'VI' },
  { id: 'major-07', nameZh: '战车', nameEn: 'The Chariot', arcana: 'major', numeral: 'VII' },
  { id: 'major-08', nameZh: '力量', nameEn: 'Strength', arcana: 'major', numeral: 'VIII' },
  { id: 'major-09', nameZh: '隐者', nameEn: 'The Hermit', arcana: 'major', numeral: 'IX' },
  { id: 'major-10', nameZh: '命运之轮', nameEn: 'Wheel of Fortune', arcana: 'major', numeral: 'X' },
  { id: 'major-11', nameZh: '正义', nameEn: 'Justice', arcana: 'major', numeral: 'XI' },
  { id: 'major-12', nameZh: '倒吊者', nameEn: 'The Hanged Man', arcana: 'major', numeral: 'XII' },
  { id: 'major-13', nameZh: '死神', nameEn: 'Death', arcana: 'major', numeral: 'XIII' },
  { id: 'major-14', nameZh: '节制', nameEn: 'Temperance', arcana: 'major', numeral: 'XIV' },
  { id: 'major-15', nameZh: '恶魔', nameEn: 'The Devil', arcana: 'major', numeral: 'XV' },
  { id: 'major-16', nameZh: '高塔', nameEn: 'The Tower', arcana: 'major', numeral: 'XVI' },
  { id: 'major-17', nameZh: '星星', nameEn: 'The Star', arcana: 'major', numeral: 'XVII' },
  { id: 'major-18', nameZh: '月亮', nameEn: 'The Moon', arcana: 'major', numeral: 'XVIII' },
  { id: 'major-19', nameZh: '太阳', nameEn: 'The Sun', arcana: 'major', numeral: 'XIX' },
  { id: 'major-20', nameZh: '审判', nameEn: 'Judgement', arcana: 'major', numeral: 'XX' },
  { id: 'major-21', nameZh: '世界', nameEn: 'The World', arcana: 'major', numeral: 'XXI' },
];

export const TAROT_SUITS: { zh: TarotCard['suit']; en: string; mark: string }[] = [
  { zh: '权杖', en: 'Wands', mark: '✦' },
  { zh: '圣杯', en: 'Cups', mark: '◌' },
  { zh: '宝剑', en: 'Swords', mark: '⌁' },
  { zh: '星币', en: 'Pentacles', mark: '◇' },
];

const RANKS = [
  { value: 'A', zh: '王牌', en: 'Ace' },
  { value: '2', zh: '二', en: 'Two' },
  { value: '3', zh: '三', en: 'Three' },
  { value: '4', zh: '四', en: 'Four' },
  { value: '5', zh: '五', en: 'Five' },
  { value: '6', zh: '六', en: 'Six' },
  { value: '7', zh: '七', en: 'Seven' },
  { value: '8', zh: '八', en: 'Eight' },
  { value: '9', zh: '九', en: 'Nine' },
  { value: '10', zh: '十', en: 'Ten' },
  { value: 'P', zh: '侍从', en: 'Page' },
  { value: 'N', zh: '骑士', en: 'Knight' },
  { value: 'Q', zh: '王后', en: 'Queen' },
  { value: 'K', zh: '国王', en: 'King' },
];

export const TAROT_DECK: TarotCard[] = [
  ...MAJOR_ARCANA,
  ...TAROT_SUITS.flatMap(suit => RANKS.map(rank => ({
    id: `minor-${suit.en.toLowerCase()}-${rank.value.toLowerCase()}`,
    nameZh: `${rank.zh}${suit.zh}`,
    nameEn: `${rank.en} of ${suit.en}`,
    arcana: 'minor' as const,
    suit: suit.zh,
    rank: rank.value,
  }))),
];

export const TAROT_SPREADS = {
  single: { label: '单牌指引', count: 1, positions: ['指引'] },
  'three-card': { label: '三张牌', count: 3, positions: ['过去', '现在', '未来'] },
  'five-card': { label: '五张牌', count: 5, positions: ['过去', '现在', '未来', '建议', '结果'] },
  'celtic-cross': { label: '凯尔特十字', count: 10, positions: ['现状', '挑战', '过去', '未来', '目标', '潜在', '态度', '环境', '希望与恐惧', '结果'] },
} as const;
export type TarotSpreadId = keyof typeof TAROT_SPREADS;
export type TarotPosition = (typeof TAROT_SPREADS)[TarotSpreadId]['positions'][number];
export const THREE_CARD_POSITIONS = TAROT_SPREADS['three-card'].positions;
export type TarotOrientation = '正位' | '逆位';
export type TarotDraw = { card: TarotCard; position: TarotPosition; orientation: TarotOrientation };

function seededRandom(seedHex: string) {
  if (!/^(?:[0-9a-f]{2}){32}$/i.test(seedHex)) throw new Error('随机种子格式不正确。');
  const state: number[] = [0x811c9dc5, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
  for (let i = 0; i < seedHex.length; i += 2) {
    const lane = (i / 2) % 4;
    state[lane] = Math.imul(state[lane] ^ Number.parseInt(seedHex.slice(i, i + 2), 16), 0x01000193) >>> 0;
  }
  let hasNonZeroLane = false;
  for (const lane of state) {
    if (lane !== 0) {
      hasNonZeroLane = true;
      break;
    }
  }
  if (!hasNonZeroLane) state[0] = 1;

  const rotateLeft = (value: number, shift: number) => ((value << shift) | (value >>> (32 - shift))) >>> 0;
  return () => {
    const result = Math.imul(rotateLeft(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (state[1] << 9) >>> 0;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = rotateLeft(state[3], 11);
    return result;
  };
}

/** Deterministically reproduces a spread from the revealed 256-bit seed. */
export function drawSpread(seedHex: string, spread: TarotSpreadId): TarotDraw[] {
  const next = seededRandom(seedHex);
  const cards = [...TAROT_DECK];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const upperBound = i + 1;
    const limit = Math.floor(0x100000000 / upperBound) * upperBound;
    let value = next();
    while (value >= limit) value = next();
    const j = value % upperBound;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return TAROT_SPREADS[spread].positions.map((position, index) => ({
    card: cards[index],
    position,
    orientation: next() & 1 ? '逆位' : '正位',
  }));
}

/** Backward-compatible helper for existing callers and historical tests. */
export function drawThree(seedHex: string): TarotDraw[] {
  return drawSpread(seedHex, 'three-card');
}
