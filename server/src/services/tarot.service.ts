import { TAROT_CARDS, TAROT_POSITIONS, type TarotCardData, type TarotOrientation, type TarotPosition } from '../data/tarot';

export interface TarotReadingCardInput { cardId: string; position: string; orientation: string }
export interface TarotReadingInput { question?: string; spread?: string; cards: TarotReadingCardInput[] }

export interface TarotReadingCard {
  cardId: string; nameZh: string; position: TarotPosition; orientation: TarotOrientation;
  text: string; source: string; sourceIds: string[];
}
export interface TarotReading {
  readingId: string; mode: 'rules-only'; aiReady: false; model: 'hundun-tarot-rules-v1';
  createdAt: string; cards: TarotReadingCard[]; summary: string; notes: string[];
}
export type TarotValidation = { ok: true; data: TarotReading } | { ok: false; code: string; status: number; error: string };

const BY_ID = new Map(TAROT_CARDS.map(c => [c.id, c]));
const POSITIONS = new Set<string>(TAROT_POSITIONS);
const ORIENTATIONS = new Set<string>(['正位', '逆位']);

function cardText(card: TarotCardData, orientation: TarotOrientation): { text: string; source: string } {
  return { text: orientation === '逆位' ? card.reversed : card.upright, source: card.source };
}

/**
 * 塔罗综合解读的“规则拼装”版本：只校验三张牌并按已登记牌义返回逐牌文字，
 * 不调用模型、不生成综合判断。mode=rules-only / aiReady=false 是响应的硬字段，
 * 前端必须据此标注，不能当成 AI 综合解读展示。
 */
export function buildTarotReading(input: TarotReadingInput, now = new Date()): TarotValidation {
  const question = String(input.question || '').trim();
  if (question.length > 300) return { ok: false, status: 400, code: 'bad_question', error: '问题过长，请缩短后重试' };
  if (input.spread && input.spread !== 'three-card') return { ok: false, status: 400, code: 'bad_spread', error: '暂只支持三张牌阵' };
  if (!Array.isArray(input.cards) || input.cards.length !== 3) {
    return { ok: false, status: 400, code: 'bad_cards', error: '牌面数据不完整，请重新抽牌' };
  }
  const seen = new Set<string>();
  const cards: TarotReadingCard[] = [];
  for (let i = 0; i < 3; i += 1) {
    const raw = input.cards[i];
    const expectedPos = TAROT_POSITIONS[i];
    if (!raw || raw.position !== expectedPos) {
      return { ok: false, status: 400, code: 'bad_cards', error: `第 ${i + 1} 张牌的位置应为「${expectedPos}」` };
    }
    if (!ORIENTATIONS.has(raw.orientation)) {
      return { ok: false, status: 400, code: 'bad_cards', error: '牌面方向只能是正位或逆位' };
    }
    const card = BY_ID.get(String(raw.cardId));
    if (!card) return { ok: false, status: 404, code: 'card_unknown', error: '这张牌不在牌组中，请重新抽牌' };
    if (seen.has(card.id)) return { ok: false, status: 400, code: 'bad_cards', error: '同一张牌不能重复出现' };
    seen.add(card.id);
    const orientation = raw.orientation as TarotOrientation;
    const { text, source } = cardText(card, orientation);
    cards.push({ cardId: card.id, nameZh: card.nameZh, position: expectedPos, orientation, text, source, sourceIds: [] });
  }
  const summary = cards.map(c => `${c.position}「${c.nameZh}」（${c.orientation}）：${c.text}`).join('；');
  return {
    ok: true,
    data: {
      readingId: 'tarot_' + now.getTime().toString(36) + '_' + Math.random().toString(36).slice(2, 10),
      mode: 'rules-only', aiReady: false, model: 'hundun-tarot-rules-v1',
      createdAt: now.toISOString(), cards, summary,
      notes: [
        '当前只是按已登记牌义的规则拼装，不是 AI 综合解读；综合解读还未接入。',
        '解读为传统文化参考，不构成专业建议。',
      ],
    },
  };
}
