// 塔罗规则拼装接口单测（node --test）。依赖 server/dist 已构建。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { buildTarotReading } = require('../../server/dist/services/tarot.service.js');

const okCards = [
  { cardId: 'major-13', position: '过去', orientation: '正位' },
  { cardId: 'minor-cups-2', position: '现在', orientation: '逆位' },
  { cardId: 'major-19', position: '未来', orientation: '正位' },
];

test('三张合法牌：返回逐牌牌义，明确 rules-only / aiReady=false', () => {
  const r = buildTarotReading({ question: '这段关系会怎么发展？', spread: 'three-card', cards: okCards });
  assert.equal(r.ok, true);
  assert.equal(r.data.mode, 'rules-only');
  assert.equal(r.data.aiReady, false);
  assert.equal(r.data.cards.length, 3);
  assert.deepEqual(r.data.cards.map(c => c.cardId), ['major-13', 'minor-cups-2', 'major-19']);
  assert.equal(r.data.cards[1].orientation, '逆位');
  assert.equal(r.data.cards.every(c => Array.isArray(c.sourceIds) && c.sourceIds.length === 1), true);
  assert.match(r.data.summary, /过去/);
  assert.match(r.data.notes[0], /不是 AI 综合解读/);
});

test('位置不按过去/现在/未来：400 bad_cards', () => {
  const r = buildTarotReading({ cards: [okCards[1], okCards[0], okCards[2]] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.code, 'bad_cards');
});

test('未知牌 / 重复牌 / 非法方向：拒绝', () => {
  assert.equal(buildTarotReading({ cards: [{ ...okCards[0], cardId: 'major-99' }, okCards[1], okCards[2]] }).code, 'card_unknown');
  assert.equal(buildTarotReading({ cards: [okCards[0], okCards[0], okCards[2]] }).code, 'bad_cards');
  assert.equal(buildTarotReading({ cards: [{ ...okCards[0], orientation: '倒位' }, okCards[1], okCards[2]] }).code, 'bad_cards');
});

test('问题超长 / 非三张牌：400', () => {
  assert.equal(buildTarotReading({ question: 'x'.repeat(301), cards: okCards }).code, 'bad_question');
  assert.equal(buildTarotReading({ cards: okCards.slice(0, 2) }).code, 'bad_cards');
});
