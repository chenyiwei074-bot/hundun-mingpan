// 塔罗牌阵契约单测：1/3/5/10 张与位置校验。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { buildTarotReading } = require('../../server/dist/services/tarot.service.js');

const card = (id, position) => ({ cardId: id, position, orientation: '正位' });

test('single：1 张、位置“指引”', () => {
  const r = buildTarotReading({ spread: 'single', cards: [card('major-00', '指引')] });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.spread, 'single');
    assert.equal(r.data.cards.length, 1);
    assert.equal(r.data.cards[0].sourceIds.length, 1);
  }
});

test('five-card：5 张固定位置', () => {
  const r = buildTarotReading({ spread: 'five-card', cards: [
    card('major-00', '过去'), card('major-01', '现在'), card('major-02', '未来'),
    card('major-03', '建议'), card('major-04', '结果'),
  ] });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.spreadLabel, '五张牌');
});

test('celtic-cross：10 张、重复牌被拒', () => {
  const ok = buildTarotReading({ spread: 'celtic-cross', cards: [
    card('major-00', '现状'), card('major-01', '挑战'), card('major-02', '过去'),
    card('major-03', '未来'), card('major-04', '目标'), card('major-05', '潜在'),
    card('major-06', '态度'), card('major-07', '环境'), card('major-08', '希望与恐惧'), card('major-09', '结果'),
  ] });
  assert.equal(ok.ok, true);
  const dup = buildTarotReading({ spread: 'celtic-cross', cards: [
    card('major-00', '现状'), card('major-00', '挑战'), card('major-02', '过去'),
    card('major-03', '未来'), card('major-04', '目标'), card('major-05', '潜在'),
    card('major-06', '态度'), card('major-07', '环境'), card('major-08', '希望与恐惧'), card('major-09', '结果'),
  ] });
  assert.equal(dup.ok, false);
});

test('未知牌阵 / 张数不符被拒', () => {
  assert.equal(buildTarotReading({ spread: 'unknown', cards: [] }).ok, false);
  assert.equal(buildTarotReading({ spread: 'single', cards: [] }).ok, false);
});
