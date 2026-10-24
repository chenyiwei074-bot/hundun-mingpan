// 分享链接纯逻辑单测（node --test）。依赖 server/dist 已构建。
// 运行：cd /opt && node --test tools/backend-unit/share.service.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const svc = require('../../server/dist/services/share.service.js');

test('token：32 字节 CSPRNG，base64url 43 字符，两次不同', () => {
  const a = svc.newShareToken();
  const b = svc.newShareToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.equal(svc.isValidShareToken(a), true);
  assert.equal(svc.isValidShareToken('short'), false);
});

test('token 哈希：只存 sha256 裸 hex，稳定且不可逆', () => {
  const t = 'N5gnmy34DucNh8fIAqmHzj4dMiG2oycHHlc3hp-hSK0';
  const h1 = svc.hashShareToken(t);
  const h2 = svc.hashShareToken(t);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);
  assert.notEqual(h1, t);
});

test('有效期固定 168 小时', () => {
  const now = new Date('2026-10-24T00:00:00.000Z');
  const exp = svc.shareExpiry(now);
  assert.equal(exp.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(svc.SHARE_TTL_HOURS, 168);
});

test('有效判断：过期/撤回/边界', () => {
  const now = new Date('2026-10-24T00:00:00.000Z');
  assert.equal(svc.isShareActive({ expiresAt: new Date('2026-10-24T00:00:01.000Z'), revokedAt: null }, now), true);
  assert.equal(svc.isShareActive({ expiresAt: new Date('2026-10-23T23:59:59.000Z'), revokedAt: null }, now), false);
  assert.equal(svc.isShareActive({ expiresAt: new Date('2026-10-30T00:00:00.000Z'), revokedAt: null }, now), true);
  assert.equal(svc.isShareActive({ expiresAt: new Date('2026-10-30T00:00:00.000Z'), revokedAt: new Date() }, now), false);
});

test('分享清洗：丢访客/出生/地点/海报，姓名与 visitorId 替换', () => {
  const out = svc.sanitizeSharedChart({
    name: '陈一为',
    visitorId: 'visitor_abcdefgh',
    chartData: {
      name: '陈一为',
      bazi: { birthInfo: { birthday: '2003-11-09', gender: 'male' }, dayMaster: '丙' },
      birthPlace: '深圳',
      currentPlace: '深圳',
      note: '命主陈一为的盘，visitor_abcdefgh 提交',
      posterHtml: '<html>',
    },
    analysisData: { errorMessage: '内部错误' },
    aiAnalysis: { sections: [{ title: '一', body: '陈一为偏弱' }] },
  });
  const s = JSON.stringify(out);
  assert.equal(s.includes('visitor_abcdefgh'), false);
  assert.equal(s.includes('birthInfo'), false);
  assert.equal(s.includes('birthPlace'), false);
  assert.equal(s.includes('currentPlace'), false);
  assert.equal(s.includes('posterHtml'), false);
  assert.equal(s.includes('errorMessage'), false);
  assert.equal(s.includes('陈一为'), false);
  assert.equal(s.includes('（已隐藏）'), true);
  assert.equal(out.chartData.bazi.dayMaster, '丙');
});
