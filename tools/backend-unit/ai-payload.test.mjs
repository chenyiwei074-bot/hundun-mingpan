// 防回归：用户姓名不得进入发往 AI 的载荷（2026-10-24 裁定）。
// 业务不需要姓名：AI 解读用「命主」即可；姓名只用于页面显示与报告标题。
// 运行：cd /opt && node --test tools/backend-unit/ai-payload.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');

test('analysis.service：不把姓名写进 chartSummary，也不放进 AI 请求', () => {
  const src = read('server/src/services/analysis.service.ts');
  assert.equal(/chartSummary\.name\s*=/.test(src), false, 'chartSummary.name 又出现了');
  assert.equal(/^\s*name:\s*'',?\s*$/m.test(src), false, 'buildChartSummary 又带 name 字段');
  // req 对象里不允许有裸 name（chartData 里的 name 已随 chartSummary 一起清掉）
  const fn = src.slice(src.indexOf('export async function generateAIAnalysis'));
  assert.equal(/\n\s*name,\s*\n/.test(fn), false, 'AI 请求对象里又出现 name');
});

test('pipeline：调用 AI 时不传 input.name', () => {
  const src = read('server/src/services/pipeline.service.ts');
  assert.equal(/generateAIAnalysis\([^)]*input\.name/.test(src), false, 'pipeline 又把姓名传给 AI');
});

test('AIProvider：请求类型里不再声明姓名（从类型上杜绝）', () => {
  const src = read('server/src/services/ai/AIProvider.ts');
  assert.equal(/name\?:\s*string/.test(src), false, 'AIAnalysisRequest 又声明了 name');
});
