// 通用 AI 解读契约：每个术数独立 profile，禁止跨体系混断。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { AI_TOOLS, TOOL_PROFILES, promptFor, validateAiRequest } = require('../../server/dist/services/tool-interpretation.service.js');

test('每个工具都有独立体系与禁止项', () => {
  assert.deepEqual(Object.keys(TOOL_PROFILES).sort(), Object.keys(AI_TOOLS).sort());
  for (const [tool, p] of Object.entries(TOOL_PROFILES)) {
    assert.ok(p.system, tool + ' 缺 system');
    assert.ok(p.scope.length > 10, tool + ' 缺 scope');
    assert.ok(p.avoid.length >= 2, tool + ' 缺 avoid');
    assert.ok(p.sections.length >= 3, tool + ' 缺 sections');
    const prompt = promptFor(tool, { result: 'fixture' }, '');
    assert.ok(prompt.includes(p.system), tool + ' prompt 未写体系');
    assert.ok(prompt.includes('明确禁止混入'), tool + ' prompt 未写禁止项');
    for (const a of p.avoid) assert.ok(prompt.includes(a), tool + ' prompt 漏禁止项 ' + a);
  }
});

test('未知工具 / 缺 payload 被拒', () => {
  assert.equal(validateAiRequest({ tool: 'unknown', payload: {} }).ok, false);
  assert.equal(validateAiRequest({ tool: 'meihua' }).ok, false);
  assert.equal(validateAiRequest({ tool: 'meihua', payload: {} }).ok, true);
});
