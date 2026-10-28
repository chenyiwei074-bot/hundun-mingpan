import assert from 'node:assert/strict';
import { INTENTS } from '../../frontend/lib/tools/catalog';
import { WESTERN_INTENTS } from '../../frontend/lib/tools/western-catalog';
import { isMonthlyFortuneQuestion, routeLocal } from '../../frontend/lib/assistant/intent';
import { askRoute } from '../../frontend/lib/assistant/route-client';

const oriental = INTENTS.flatMap(group => group.tools);
const western = WESTERN_INTENTS.flatMap(group => group.tools);

async function main() {
  for (const question of ['想看我的月运', '我的流月怎么样', '这个月运势如何', '下个月财运如何', '十月事业运怎样']) {
    assert.equal(isMonthlyFortuneQuestion(question), true, question);
    const result = routeLocal('oriental', question, oriental, western);
    assert.equal(result.toolSlug, 'dayun', question);
    assert.equal(result.available, true, question);
    assert.match(result.clarification ?? '', /按节气交接的流月结构/, question);
  }
  assert.equal(isMonthlyFortuneQuestion('我这个月能签成那单吗'), false,
    '单次问事不能被“这个月”错误归类为月运');
  const westernResult = routeLocal('western', '我的月运怎么样', western, oriental);
  assert.equal(westernResult.toolSlug, null, '西方本命工具不能冒充逐月推运');
  assert.match(westernResult.clarification ?? '', /没有逐月推运计算/);
  let fetched = false;
  const outcome = await askRoute({ mode: 'oriental', text: '想问月运', catalog: oriental,
    otherCatalog: western, fetchImpl: (async () => { fetched = true; throw new Error('unexpected fetch'); }) as typeof fetch });
  assert.equal(fetched, false, '月运应直接落入明确边界的路由，不等待模型或网关');
  assert.equal(outcome.result.toolSlug, 'dayun');
  assert.equal(outcome.source, 'local');
  console.log('monthly-routing: oriental and western scope checks passed');
}

void main();
