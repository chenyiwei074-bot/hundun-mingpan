import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

async function loadTs(relativePath) {
  const source = await readFile(resolve(here, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  return import(moduleUrl);
}

const { TAROT_DECK, drawThree } = await loadTs('deck.ts');
const { TAROT_MEANINGS } = await loadTs('meanings.ts');

assert.equal(TAROT_DECK.length, 78, 'Rider-Waite-Smith-compatible deck has 78 named cards');
const seed = '01'.repeat(32);
const first = drawThree(seed);
assert.deepEqual(drawThree(seed), first, 'the same revealed seed reproduces the same draw');
assert.equal(new Set(first.map(draw => draw.card.id)).size, 3, 'a draw has three distinct cards');
assert.ok(first.every(draw => ['正位', '逆位'].includes(draw.orientation)), 'each position has a supported upright/reversed orientation');

const orientations = new Set();
for (let sample = 0; sample < 128; sample += 1) {
  const sampleSeed = sample.toString(16).padStart(2, '0').repeat(32);
  for (const draw of drawThree(sampleSeed)) orientations.add(draw.orientation);
}
assert.deepEqual([...orientations].sort(), ['正位', '逆位'], 'seeded draws can reproduce both orientations');
assert.equal(Object.keys(TAROT_MEANINGS).length, 78, 'every card has source-attributed historical upright/reversed meanings');
for (const card of TAROT_DECK) {
  const meaning = TAROT_MEANINGS[card.id];
  assert.ok(meaning?.upright?.length >= 4, `${card.id} has upright meaning`);
  assert.ok(meaning?.reversed?.length >= 4, `${card.id} has reversed meaning`);
  assert.ok(meaning?.source?.includes('1910'), `${card.id} names the historical source and date`);
}
console.log('PASS tarot deck: 78 cards, reproducible directions, and 78 source-attributed upright/reversed meaning pairs');
