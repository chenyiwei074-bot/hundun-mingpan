import { FreeModelProvider } from './ai/FreeModelProvider';
import { DeepSeekProvider } from './ai/DeepSeekProvider';
import type { AIProvider } from './ai/AIProvider';
import { TAROT_CARDS, TAROT_SPREADS, TAROT_POSITIONS, type TarotCardData, type TarotOrientation, type TarotPosition, type TarotSpread } from '../data/tarot';
import { findSources } from './classics-registry';

export interface TarotReadingCardInput { cardId: string; position: string; orientation: string }
export interface TarotReadingInput { question?: string; spread?: string; cards: TarotReadingCardInput[] }

export interface TarotReadingCard {
  cardId: string; nameZh: string; position: TarotPosition; orientation: TarotOrientation;
  text: string; source: string; sourceIds: string[];
}
export type TarotMode = 'ai' | 'rules-only' | 'rules-fallback';
export interface TarotReading {
  readingId: string; spread: TarotSpread; spreadLabel: string; mode: TarotMode; aiReady: boolean; model: string;
  createdAt: string; cards: TarotReadingCard[]; summary: string; notes: string[];
}
export type TarotValidation = { ok: true; data: TarotReading } | { ok: false; code: string; status: number; error: string };

const BY_ID = new Map(TAROT_CARDS.map(c => [c.id, c]));
const POSITIONS = new Set<string>(TAROT_POSITIONS);
const ORIENTATIONS = new Set<string>(['正位', '逆位']);
const TIMEOUT_MS = Number(process.env.TAROT_AI_TIMEOUT_MS || 25000);
const TAROT_SOURCE_PREFIX = 'tarot-';
function sourceIdsFor(cardId: string): string[] {
  const id = TAROT_SOURCE_PREFIX + cardId;
  return findSources([id]).found.length ? [id] : [];
}

function cardText(card: TarotCardData, orientation: TarotOrientation): { text: string; source: string } {
  return { text: orientation === '逆位' ? card.reversed : card.upright, source: card.source };
}

function readId(now: Date) {
  return 'tarot_' + now.getTime().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

/** 输入校验 + 规则底稿。AI 失败时这份仍可返回，但会明确标 rules-fallback / aiReady:false。 */
export function buildTarotReading(input: TarotReadingInput, now = new Date()): TarotValidation {
  const question = String(input.question || '').trim();
  if (question.length > 300) return { ok: false, status: 400, code: 'bad_question', error: '问题过长，请缩短后重试' };
  const spread = String(input.spread || 'three-card') as TarotSpread;
  const spreadDef = TAROT_SPREADS[spread];
  if (!spreadDef) {
    return { ok: false, status: 400, code: 'bad_spread', error: `不支持的牌阵，可用：${Object.keys(TAROT_SPREADS).join('、')}` };
  }
  if (!Array.isArray(input.cards) || input.cards.length !== spreadDef.positions.length) {
    return { ok: false, status: 400, code: 'bad_cards', error: `牌面数据不完整：${spreadDef.label}需要 ${spreadDef.positions.length} 张牌` };
  }
  const seen = new Set<string>();
  const cards: TarotReadingCard[] = [];
  for (let i = 0; i < spreadDef.positions.length; i += 1) {
    const raw = input.cards[i];
    const expectedPos = spreadDef.positions[i];
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
    cards.push({ cardId: card.id, nameZh: card.nameZh, position: expectedPos, orientation, text, source, sourceIds: sourceIdsFor(card.id) });
  }
  return {
    ok: true,
    data: {
      readingId: readId(now), spread, spreadLabel: spreadDef.label, mode: 'rules-only', aiReady: false, model: 'hundun-tarot-rules-v1',
      createdAt: now.toISOString(), cards,
      summary: cards.map(c => `${c.position}「${c.nameZh}」（${c.orientation}）：${c.text}`).join('；'),
      notes: ['当前只是按已登记牌义的规则拼装，不是 AI 综合解读。'],
    },
  };
}

function promptFor(input: TarotReadingInput, cards: TarotReadingCard[]): string {
  const spread = String(input.spread || 'three-card') as TarotSpread;
  const spreadDef = TAROT_SPREADS[spread];
  const rows = cards.map(c => `${c.position}：${c.nameZh}（${c.orientation}）— 传统牌义参考：${c.text}；来源：${c.source}`).join('\n');
  return `你是「混沌自研 AI」的塔罗解读编排层，只做传统文化解释与整理，不宣称科学预测，不给医疗/投资/法律结论。
用户问题：${String(input.question || '').trim() || '（未填写）'}
牌阵：${spreadDef.label}（${spreadDef.positions.join(' / ')}）
${rows}

请只输出严格 JSON（不要 Markdown、不要代码块）：
{
  "summary": "120-220 字综合解读，按牌阵顺序串起来，直接回答用户问题；不确定就写不确定",
  "cards": [
    { "cardId": "与输入相同的 cardId", "text": "80-150 字，结合该牌位与问题解释这一张牌" }
  ],
  "notes": ["1-2 句边界说明"]
}
约束：
- 每张牌的 cardId 必须与输入一一对应，顺序不变；
- 不得编造古籍原文、页码或来源；没有出处就说“本站自研”；
- 不得出现任何模型/供应商名称；
- 解读用中文，不写“作为AI”之类自指。`;
}

function normalizeAI(raw: Record<string, unknown>, base: TarotReading, question: string): { summary: string; cards: TarotReadingCard[]; notes: string[] } | null {
  const outCards = Array.isArray(raw.cards) ? raw.cards : [];
  if (outCards.length !== base.cards.length) return null;
  const cards = base.cards.map((c, i) => {
    const x = outCards[i] as Record<string, unknown> | undefined;
    if (!x || String(x.cardId) !== c.cardId) return null;
    const text = String(x.text || '').trim();
    return text ? { ...c, text } : null;
  });
  if (cards.some(c => !c)) return null;
  const summary = String(raw.summary || '').trim();
  if (!summary) return null;
  const notes = Array.isArray(raw.notes) ? raw.notes.map(String).filter(Boolean).slice(0, 3) : [];
  return {
    summary,
    cards: cards as TarotReadingCard[],
    notes: [...notes, '解读为传统文化参考，不构成专业建议。'],
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('tarot-ai-timeout')), ms); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

/**
 * 真正接自研 AI 编排层：免费模型优先，失败回落 DeepSeek；全部不可用/输出不合格时
 * 返回 rules-fallback，aiReady=false，绝不把规则拼装说成 AI。
 * 公开响应不写供应商名或底层模型名，只写本站口径标签。
 */
export async function generateTarotReading(input: TarotReadingInput, now = new Date()): Promise<TarotValidation> {
  const base = buildTarotReading(input, now);
  if (!base.ok) return base;
  const question = String(input.question || '').trim();
  const providers: AIProvider[] = [new FreeModelProvider(), new DeepSeekProvider()];
  for (const provider of providers) {
    try {
      if (!(await provider.isAvailable())) continue;
      const response = await withTimeout(provider.generateAnalysis({
        chartData: { question, spread: base.data.spread, cards: base.data.cards.map(c => ({ cardId: c.cardId, position: c.position, orientation: c.orientation })) },
        type: 'tarot', promptOverride: promptFor(input, base.data.cards), maxTokens: Math.min(2600, 900 + base.data.cards.length * 140),
      }), TIMEOUT_MS);
      const normalized = normalizeAI(response.result, base.data, question);
      if (!normalized) {
        console.warn('[tarot] AI 输出不合格，尝试下一个 provider');
        continue;
      }
      return {
        ok: true,
        data: {
          ...base.data, mode: 'ai', aiReady: true, model: 'hundun-self-developed-ai-v1',
          cards: normalized.cards, summary: normalized.summary,
          notes: ['本解读由混沌自研 AI 编排生成；牌面与传统牌义是确定性输入。', ...normalized.notes],
        },
      };
    } catch (err) {
      console.warn('[tarot] AI provider failed:', err instanceof Error ? err.message : err);
    }
  }
  return {
    ok: true,
    data: {
      ...base.data, mode: 'rules-fallback', aiReady: false,
      notes: ['综合 AI 解读暂时不可用，当前只展示逐牌已登记牌义；AI 未参与。'],
    },
  };
}
