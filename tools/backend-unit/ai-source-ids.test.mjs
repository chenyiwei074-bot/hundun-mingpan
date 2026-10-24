// sourceIds 契约防回归（2026-10-24）。
// - 命盘解读：每个 section 必须有 sourceIds 数组；当前无章节级底本匹配时为空数组。
// - 模型自报的 sourceIds 一律不信，不能被透传。
// - 六爻报告接口返回顶层 sourceIds（当前为空，前端显示「本站自研」）。
// 运行：cd /opt && node --test tools/backend-unit/ai-source-ids.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const svc = require('../../server/dist/services/analysis.service.js');

test('attachVerifiedSourceIds：每个 section 都有 sourceIds，且不透传模型自报值', () => {
  const result = {
    summary: '总述',
    sections: [
      { title: '一、天赋', body: '正文 1', sourceIds: ['model-invented-id'] },
      { title: '二、财运', body: '正文 2' },
    ],
  };
  const out = svc.attachVerifiedSourceIds(result);
  assert.equal(Array.isArray(out.sections), true);
  for (const section of out.sections) {
    assert.equal(Array.isArray(section.sourceIds), true, 'sourceIds 必须是数组');
    assert.deepEqual(section.sourceIds, [], '当前没有章节级已核验来源，必须为空');
  }
  assert.equal(out.sections[0].title, '一、天赋');
  assert.equal(out.sections[1].body, '正文 2');
});

test('attachVerifiedSourceIds：没有 sections 的对象原样返回（summary-only 不硬造章节）', () => {
  const result = { summary: '只有总述' };
  const out = svc.attachVerifiedSourceIds(result);
  assert.deepEqual(out, result);
});

test('六爻报告接口：返回顶层 sourceIds 数组', () => {
  const src = readFileSync(new URL('../../frontend/app/api/liuyao/report/route.ts', import.meta.url), 'utf8');
  assert.match(src, /sourceIds:\s*\[\]/);
});
