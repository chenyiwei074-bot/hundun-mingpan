import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { recognizePhysiognomyImage } = require('../../server/dist/controllers/physiognomy.controller.js');

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const imageBase64 = `data:image/png;base64,${png.toString('base64')}`;
const modelContent = JSON.stringify({
  ok: true,
  features: [{ id: 'face-outline', label: '面部轮廓', candidate: '轮廓线条清晰可见', confidence: 0.82, region: [0.1, 0.1, 0.8, 0.8] }],
  notes: [],
});

function invoke(body) {
  const state = { status: 200, headers: {}, payload: null };
  const req = { body };
  const res = {
    setHeader(name, value) { state.headers[name] = value; return this; },
    status(value) { state.status = value; return this; },
    json(value) { state.payload = value; return this; },
  };
  return recognizePhysiognomyImage(req, res).then(() => ({ ...state, body }));
}

test('同意后识别并返回脱敏特征；不回显图片或服务配置', async () => {
  const previous = { fetch: global.fetch, key: process.env.VISION_API_KEY, model: process.env.VISION_MODEL };
  process.env.VISION_API_KEY = 'test-key';
  process.env.VISION_MODEL = 'test-vision';
  let calls = 0;
  global.fetch = async (_url, init) => {
    calls += 1;
    const sent = JSON.parse(init.body);
    assert.equal(sent.messages[0].content[1].image_url.url, imageBase64);
    return { ok: true, json: async () => ({ choices: [{ message: { content: modelContent } }] }) };
  };
  try {
    const result = await invoke({ kind: 'face', consent: true, imageBase64 });
    assert.equal(calls, 1);
    assert.equal(result.status, 200);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.payload.kind, 'face');
    assert.equal(result.payload.features[0].id, 'face-outline');
    assert.equal('imageBase64' in result.payload, false);
    assert.equal('provider' in result.payload, false);
    assert.equal('model' in result.payload, false);
    assert.equal(result.body.imageBase64, '');
  } finally {
    global.fetch = previous.fetch;
    if (previous.key === undefined) delete process.env.VISION_API_KEY; else process.env.VISION_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.VISION_MODEL; else process.env.VISION_MODEL = previous.model;
  }
});

test('未同意时拒绝且不调用识别服务', async () => {
  const previousFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error('must not be called'); };
  try {
    const result = await invoke({ kind: 'face', consent: false, imageBase64 });
    assert.equal(result.status, 400);
    assert.equal(result.payload.code, 'consent_required');
    assert.equal(calls, 0);
  } finally { global.fetch = previousFetch; }
});

test('拒绝未知字段、面相夹带手别以及无效手别', async () => {
  const extra = await invoke({ kind: 'face', consent: true, imageBase64, visitorId: 'private-id' });
  assert.equal(extra.status, 400);
  assert.equal(extra.payload.code, 'invalid_request');
  const faceHand = await invoke({ kind: 'face', consent: true, hand: 'left', imageBase64 });
  assert.equal(faceHand.status, 400);
  const palmHand = await invoke({ kind: 'palm', consent: true, hand: 'both', imageBase64 });
  assert.equal(palmHand.status, 400);
});

test('拒绝 MIME 与文件头不一致、错误格式与超大图片', async () => {
  const mismatch = await invoke({ kind: 'face', consent: true, imageBase64: `data:image/jpeg;base64,${png.toString('base64')}` });
  assert.equal(mismatch.status, 415);
  assert.equal(mismatch.payload.code, 'bad_type');
  const malformed = await invoke({ kind: 'face', consent: true, imageBase64: 'data:image/png;base64,not-an-image' });
  assert.equal(malformed.status, 415);
  const large = Buffer.alloc(5 * 1024 * 1024 + 1, 0).toString('base64');
  const oversized = await invoke({ kind: 'face', consent: true, imageBase64: `data:image/png;base64,${large}` });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.payload.code, 'too_large');
});

test('服务端错误不会向外泄漏模型名或原始服务响应', async () => {
  const previous = { fetch: global.fetch, key: process.env.VISION_API_KEY, model: process.env.VISION_MODEL };
  process.env.VISION_API_KEY = 'test-key';
  process.env.VISION_MODEL = 'secret-model-name';
  global.fetch = async () => ({ ok: false, status: 500, text: async () => 'secret provider response' });
  try {
    const result = await invoke({ kind: 'face', consent: true, imageBase64 });
    assert.equal(result.status, 503);
    assert.equal(JSON.stringify(result.payload).includes('secret-model-name'), false);
    assert.equal(JSON.stringify(result.payload).includes('secret provider response'), false);
  } finally {
    global.fetch = previous.fetch;
    if (previous.key === undefined) delete process.env.VISION_API_KEY; else process.env.VISION_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.VISION_MODEL; else process.env.VISION_MODEL = previous.model;
  }
});