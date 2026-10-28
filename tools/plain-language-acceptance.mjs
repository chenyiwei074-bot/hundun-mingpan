import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { chromium } = require('playwright');
const base = process.env.QN_BASE || 'http://localhost:3052';
const chrome = process.env.QN_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: chrome,
  args: ['--no-sandbox', '--no-proxy-server'] });

try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const original = '月相角为12°，这只是周期信息，不能据此判断个人吉凶。';
  const simple = '月亮现在处于这个阶段。12°是月相角，不代表你会遇到好事或坏事。';
  let requestBody = null;
  await page.route('**/api/ai/interpret', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      mode: 'ai', aiReady: true, title: '月相解读', summary: original,
      sections: [{ title: '本页计算', body: original, factRefs: ['$.phaseAngle'], sourceIds: [] }],
    } }) }));
  await page.route('**/api/ai/plain-language', route => {
    requestBody = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { parts: requestBody.parts.map(part => ({ id: part.id, text: simple })) } }) });
  });

  await page.goto(`${base}/moon`);
  await page.getByRole('button', { name: '查看此刻' }).click();
  await page.getByRole('button', { name: '生成 AI 解读' }).click();
  await page.getByRole('button', { name: '大白话' }).click();
  await page.locator('[data-plain-mode="plain"]').waitFor();
  assert.equal(requestBody.context, 'tool');
  assert.deepEqual(Object.keys(requestBody).sort(), ['context', 'parts']);
  assert.deepEqual(requestBody.parts.map(part => part.id), ['summary', 'section-0']);
  assert.equal(await page.getByText(simple, { exact: true }).count(), 2);
  assert.equal(await page.getByText('本站自研', { exact: true }).count() > 0, true,
    '出处标记不能被大白话改写覆盖');
  await page.getByRole('button', { name: '原解读' }).click();
  assert.equal(await page.getByText(original, { exact: true }).count(), 2);
  await page.goto(`${base}/oriental`);
  await page.locator('#qa-input-oriental').fill('我想看这个月的运势');
  await page.getByRole('button', { name: '问一下' }).click();
  await page.locator('.qa-turn[data-outcome="matched"]').waitFor();
  const monthLink = page.getByRole('link', { name: /进入.*人生曲线/ });
  assert.equal(await monthLink.count(), 1);
  assert.match(await monthLink.getAttribute('href'), /\/dayun#liuyue$/);
  assert.equal(await page.getByText(/按节气交接的流月结构/).count(), 1);

  const longPage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const longText = '这是一段需要用简单中文表达的传统文化解读。'.repeat(440);
  const rewriteRequests = [];
  await longPage.route('**/api/ai/interpret', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      mode: 'ai', aiReady: true, title: '长解读', summary: longText, sections: [],
    } }) }));
  await longPage.route('**/api/ai/plain-language', route => {
    const body = route.request().postDataJSON();
    rewriteRequests.push(body);
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { parts: body.parts.map(part => ({
        id: part.id, text: `白话：${part.text}`,
      })) } }),
    });
  });
  await longPage.goto(`${base}/moon`);
  await longPage.getByRole('button', { name: '查看此刻' }).click();
  await longPage.getByRole('button', { name: '生成 AI 解读' }).click();
  await longPage.getByRole('button', { name: '大白话' }).click();
  await longPage.locator('[data-plain-mode="plain"]').waitFor();
  assert.ok(rewriteRequests.length > 1, '超过 8000 字符的解读应分批改写');
  assert.ok(rewriteRequests.every(request => request.parts.every(part => part.text.length <= 8000)));
  assert.ok(rewriteRequests.every(request => request.parts.reduce((sum, part) => sum + part.text.length, 0) <= 3000));
  assert.match(await longPage.locator('[data-plain-mode="plain"]').innerText(), /白话：/);
  await longPage.getByRole('button', { name: '原解读' }).click();
  assert.equal(await longPage.locator('[data-plain-mode="original"]').count(), 1);

  const failurePage = await browser.newPage({ viewport: { width: 375, height: 812 } });
  let failedCalls = 0;
  await failurePage.route('**/api/ai/interpret', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      mode: 'ai', aiReady: true, title: '长解读', summary: longText, sections: [],
    } }) }));
  await failurePage.route('**/api/ai/plain-language', route => {
    const body = route.request().postDataJSON();
    failedCalls += 1;
    return route.fulfill({ status: failedCalls === 2 ? 503 : 200,
      contentType: 'application/json', body: failedCalls === 2
        ? JSON.stringify({ success: false, error: '当前无法完成改写' })
        : JSON.stringify({ success: true, data: { parts: body.parts.map(part => ({ id: part.id, text: `白话：${part.text}` })) } }),
    });
  });
  await failurePage.goto(`${base}/moon`);
  await failurePage.getByRole('button', { name: '查看此刻' }).click();
  await failurePage.getByRole('button', { name: '生成 AI 解读' }).click();
  await failurePage.getByRole('button', { name: '大白话' }).click();
  await failurePage.getByRole('alert').getByText(/当前无法完成改写/).waitFor();
  assert.equal(await failurePage.locator('[data-plain-mode="original"]').count(), 1);
  assert.ok(failedCalls >= 2);
  console.log('plain-language browser: toggle, payload, citations, monthly route, long report and failure fallback passed');
} finally {
  await browser.close();
}
