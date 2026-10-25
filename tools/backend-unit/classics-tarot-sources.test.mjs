// 塔罗入仓来源单测：78 张牌各一条，quote 必须能在 depositedFile 中连续检索。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { allSources } = require('../../server/dist/services/classics-registry.js');
const ROOT = path.resolve(__dirname, '../..');

test('塔罗 78 张全部入仓，sourceId 唯一', () => {
  const all = allSources();
  const tarot = all.filter(s => s.sourceId.startsWith('tarot-'));
  assert.equal(tarot.length, 78);
  assert.equal(new Set(tarot.map(s => s.sourceId)).size, 78);
  for (const s of tarot) assert.equal(s.language, 'en');
});

test('每条塔罗 quote 是 depositedFile 的连续片段', () => {
  const all = allSources().filter(s => s.sourceId.startsWith('tarot-'));
  for (const s of all) {
    const text = readFileSync(path.join(ROOT, s.depositedFile), 'utf8');
    assert.ok(text.includes(s.quote), `quote 不在底本：${s.sourceId}`);
  }
});
