// 塔罗保存入参校验（纯函数；不写库）。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { validateTarotSaveInput } = require('../../server/dist/controllers/tarot-reading.controller.js');

const baseReading = {
  spread: 'single',
  summary: '单牌解读摘要',
  cards: [{ cardId: 'major-00', position: '指引', orientation: '正位', text: '愚者牌义' }],
};

test('合法单牌结果可保存', () => {
  const r = validateTarotSaveInput({ visitorId: 'visitor_test_1234', question: '我现在该注意什么？', reading: baseReading });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.spread, 'single');
    assert.equal(r.value.title, '我现在该注意什么？');
  }
});

test('visitorId / 牌阵 / 牌面不合法被拒', () => {
  assert.equal(validateTarotSaveInput({ visitorId: 'short', reading: baseReading }).ok, false);
  assert.equal(validateTarotSaveInput({ visitorId: 'visitor_test_1234', reading: { ...baseReading, spread: 'nope' } }).ok, false);
  assert.equal(validateTarotSaveInput({ visitorId: 'visitor_test_1234', reading: { ...baseReading, cards: [] } }).ok, false);
  assert.equal(validateTarotSaveInput({ visitorId: 'visitor_test_1234', reading: { ...baseReading, cards: [{ ...baseReading.cards[0], cardId: 'not-a-card' }] } }).ok, false);
});
