import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { validatePlainLanguageRequest, normalizePlainLanguage } =
  require('../../server/dist/services/plain-language.service.js');

const original = [{ id: 'summary', text: '这是2026年的一个判断，见《底本》「原文」。' }];

test('只接受明确的解读段落，不接受模型选择和额外个人资料', () => {
  assert.equal(validatePlainLanguageRequest({ context: 'tool', parts: original }).ok, true);
  for (const extra of [{ model: 'something' }, { provider: 'something' }, { birthInfo: {} }]) {
    assert.equal(validatePlainLanguageRequest({ context: 'tool', parts: original, ...extra }).ok, false);
  }
  assert.equal(validatePlainLanguageRequest({ context: 'tool', parts: [original[0], original[0]] }).ok, false);
  assert.equal(validatePlainLanguageRequest({ context: 'tool', parts: [{ id: 'x', text: 'x'.repeat(8001) }] }).ok, false);
});

test('改写结果必须逐段对应，保留数字和已引用的底本原文', () => {
  assert.deepEqual(normalizePlainLanguage({ parts: [
    { id: 'summary', text: '意思是看2026年这件事，依据《底本》「原文」。' },
  ] }, original)?.map(part => part.id), ['summary']);
  assert.equal(normalizePlainLanguage({ parts: [{ id: 'wrong', text: original[0].text }] }, original), null);
  assert.equal(normalizePlainLanguage({ parts: [{ id: 'summary', text: '意思是看2027年这件事，依据《底本》「原文」。' }] }, original), null);
  assert.equal(normalizePlainLanguage({ parts: [{ id: 'summary', text: '意思是看2026年这件事，依据《另一书》「原文」。' }] }, original), null);
  assert.equal(normalizePlainLanguage({ parts: [{ id: 'summary', text: original[0].text }] }, original), null);
});
