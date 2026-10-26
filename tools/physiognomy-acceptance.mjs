import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { chromium } = require('playwright');
const BASE = process.env.QN_BASE || 'http://localhost:3092';
const CHROME = process.env.QN_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const recognized = {
  face: [{ id: 'face-outline', label: '面部轮廓', candidate: '轮廓线条清晰可见', confidence: 0.82 }],
  palm: [{ id: 'life-line', label: '生命线（候选标签）', candidate: '掌纹从拇指根部向掌心弧形延伸', confidence: 0.78 }],
};
const interpretation = {
  mode: 'ai', aiReady: true, title: '已确认特征的传统文化参考', summary: '这段文字只依据你确认的结构描述进行传统文化参考解读。它不能代替医学、科学或现实判断，也不会根据照片推断身份、年龄或健康状态。'.repeat(2),
  sections: [
    { id: 's1', title: '已确认结构', body: '本节仅解释页面中由你确认的可见特征，不添加照片之外的事实。'.repeat(2), factRefs: ['$.confirmedFeatures[0].value'], sourceIds: [] },
    { id: 's2', title: '传统文化读法', body: '传统文化中的描述仅供参考，不代表科学预测，也不构成确定结论。'.repeat(2), factRefs: ['$.confirmedFeatures[0].value'], sourceIds: [] },
    { id: 's3', title: '适用边界', body: '不能从这些结构推断健康、身份或未来事件；需要时请依据现实信息判断。'.repeat(2), factRefs: ['$.confirmedFeatures[0].value'], sourceIds: [] },
  ], notes: [],
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  for (const kind of ['face', 'palm']) {
    const route = kind === 'face' ? '/face-reading' : '/palm-reading';
    const inputId = `${kind}-photo`;
    const sent = { recognize: [], interpret: [] };
    await page.route('**/api/physiognomy/recognize', async requestRoute => {
      const body = requestRoute.request().postDataJSON();
      sent.recognize.push(body);
      await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kind, ...(kind === 'palm' ? { hand: body.hand } : {}), features: recognized[kind], notes: [] }) });
    });
    await page.route('**/api/ai/interpret', async requestRoute => {
      sent.interpret.push(requestRoute.request().postDataJSON());
      await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: interpretation }) });
    });
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    const consent = page.locator('main[data-physiognomy] input[type="checkbox"]').first();
    const fileInput = page.locator(`#${inputId}`);
    assert.equal(await fileInput.isDisabled(), true, `${kind}: file input must be disabled before consent`);
    assert.equal(sent.recognize.length, 0);
    await consent.check();
    await fileInput.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: image });
    await page.waitForFunction(id => document.getElementById(id)?.files?.length === 1, inputId);
    await page.waitForTimeout(100);
    assert.equal(sent.recognize.length, 0, `${kind}: choosing a file must not upload it`);
    if (kind === 'palm') {
      const start = page.getByRole('button', { name: '开始识别照片' });
      assert.equal(await start.isDisabled(), true, 'palm requires an explicit left/right choice');
      await page.getByLabel('左手', { exact: false }).check();
    }
    await page.getByRole('button', { name: '开始识别照片' }).click();
    await page.getByRole('heading', { name: '请逐项检查识别候选' }).waitFor();
    assert.equal(sent.recognize.length, 1);
    assert.equal(sent.recognize[0].consent, true);
    assert.equal(sent.recognize[0].kind, kind);
    assert.ok(sent.recognize[0].imageBase64.startsWith('data:image/png;base64,'));
    if (kind === 'palm') assert.equal(sent.recognize[0].hand, 'left');
    assert.equal(await page.locator('[data-ai-interpret]').count(), 0, 'AI must stay hidden until the user confirms a feature');
    await page.locator('textarea').first().fill('用户校正后的可见结构描述');
    await page.getByRole('checkbox', { name: '我确认这项描述准确' }).check();
    await page.locator('[data-ai-interpret] button').click();
    await page.getByText('传统文化读法', { exact: true }).waitFor();
    assert.equal(sent.interpret.length, 1);
    const call = sent.interpret[0];
    assert.equal(call.tool, kind === 'face' ? 'face-reading' : 'palm-reading');
    assert.equal(call.question, '');
    assert.deepEqual(Object.keys(call.payload).sort(), kind === 'palm' ? ['confirmedFeatures', 'hand'] : ['confirmedFeatures']);
    assert.deepEqual(call.payload.confirmedFeatures, [{ id: recognized[kind][0].id, value: '用户校正后的可见结构描述' }]);
    if (kind === 'palm') assert.equal(call.payload.hand, 'left');
    assert.equal(JSON.stringify(call).includes('imageBase64'), false, 'AI interpretation must not receive the photo');
    assert.equal(JSON.stringify(call).includes('sample.png'), false, 'AI interpretation must not receive the filename');
    const stored = await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }));
    assert.equal(stored.includes('data:image/png;base64'), false, 'photo must not be persisted in browser storage');
    await page.getByRole('button', { name: '清除照片与本次结果' }).click();
    assert.equal(await page.locator('[data-ai-interpret]').count(), 0, 'clear must remove interpretation state');
    assert.equal(await page.locator('img[alt$="照片本地预览"]').count(), 0, 'clear must remove local preview');
    console.log(`PASS ${kind}: consent → local preview → explicit recognition → user-confirmed feature → feature-only AI payload → clear`);
    await page.unroute('**/api/physiognomy/recognize');
    await page.unroute('**/api/ai/interpret');
  }
} finally {
  await browser.close();
}
