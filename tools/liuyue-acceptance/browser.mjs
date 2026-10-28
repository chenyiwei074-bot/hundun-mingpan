import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../server/package.json', import.meta.url));
const { chromium } = require('playwright');

const base = process.env.QN_BASE || 'http://localhost:3052';
const chrome = process.env.QN_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const fixture = JSON.parse(readFileSync(new URL('../visual-harness/fixtures/chart-result.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: chrome,
  args: ['--no-sandbox', '--no-proxy-server'] });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let aiPayload = null;
  await page.route('**/api/chart/result/stubchart0001', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ success: true, data: { chartData: fixture.chart } }) }));
  await page.route('**/api/ai/interpret', route => {
    aiPayload = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, data: { mode: 'ai', aiReady: true, title: '节月结构', summary: '所选节月只按已计算的数据解释，不能确定事件或吉凶。'.repeat(5),
        sections: [{ id: 's1', title: '月柱', body: '本月干支与日主的十神关系只代表传统文化中的结构描述。'.repeat(3),
          factRefs: ['$.monthGanZhi.gan'], sourceIds: [] }], notes: [] },
    }) });
  });
  await page.goto(`${base}/dayun/stubchart0001#liuyue`);
  await page.locator('[data-liuyue-state="ready"]').waitFor();
  await page.waitForFunction(() => scrollY > 300);
  assert.equal(await page.getByRole('group', { name: '选一个节月' }).getByRole('button').count(), 12);
  await page.getByRole('group', { name: '选一个节月' }).getByRole('button', { name: /寅月/ }).click();
  assert.equal(await page.locator('[data-liuyue-selected="寅月"]').count(), 1);
  assert.equal(await page.getByText(/立春 2026-02-04 04:02 至 惊蛰/).count(), 1);
  await page.getByRole('button', { name: '生成 AI 解读' }).last().click();
  await page.locator('[data-ai-interpret="liuyue"] [data-plain-mode="original"]').waitFor();
  assert.equal(aiPayload.tool, 'liuyue');
  assert.equal(aiPayload.payload.monthIndex, 1);
  assert.equal(aiPayload.payload.monthName, '寅月');
  assert.equal(aiPayload.payload.startBeijing, '2026-02-04 04:02');
  assert.equal(JSON.stringify(aiPayload).includes('birthInfo'), false);
  assert.equal(JSON.stringify(aiPayload).includes('model'), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    '375px 下不应横向溢出');
  assert.deepEqual(errors, []);
  console.log('liuyue browser: 12 months, selected detail, AI payload and mobile width passed');
} finally { await browser.close(); }
