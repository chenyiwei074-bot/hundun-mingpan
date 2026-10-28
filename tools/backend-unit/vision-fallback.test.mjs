import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const { recognizeFloorPlan } = require('/opt/server/dist/services/vision.service.js');
const plan = { ok: true, rooms: [{ name: '客厅', polygon: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9]], confidence: 0.8 }], walls: [], doors: [], windows: [], notes: [] };

function setEnv() {
  process.env.VISION_API_KEY = 'test-first';
  process.env.VISION_MODEL = 'first-model';
  process.env.VISION_BASE_URL = 'https://first.invalid/v1';
  process.env.FREE_AI_API_KEY = 'test-second';
  process.env.FREE_AI_BASE_URL = 'https://second.invalid/v1';
}
function clearEnv() {
  delete process.env.VISION_API_KEY; delete process.env.VISION_MODEL; delete process.env.VISION_BASE_URL;
  delete process.env.FREE_AI_API_KEY; delete process.env.FREE_AI_BASE_URL;
}

test('首家返回坏 JSON 时继续尝试下一家视觉供应商', async () => {
  setEnv();
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ choices: [{ message: { content: '这不是 JSON' } }] }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }), { status: 200 });
  };
  try {
    const outcome = await recognizeFloorPlan('data:image/png;base64,AA==');
    assert.equal(outcome.ok, true);
    assert.equal(calls, 2);
    assert.equal(outcome.attempts[0].error, 'bad_json');
    assert.equal(outcome.attempts[1].ok, true);
    assert.equal(outcome.plan.rooms[0].name, '客厅');
  } finally { global.fetch = original; clearEnv(); }
});

test('全部供应商都返回坏 JSON 时只报固定 bad_json，不泄露原始文本', async () => {
  setEnv();
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '供应商内部错误 SECRET' } }] }), { status: 200 });
  try {
    const outcome = await recognizeFloorPlan('data:image/png;base64,AA==');
    assert.equal(outcome.ok, false);
    assert.equal(outcome.code, 'bad_json');
    assert.doesNotMatch(outcome.message, /SECRET|供应商|first-model|test-first/);
  } finally { global.fetch = original; clearEnv(); }
});
