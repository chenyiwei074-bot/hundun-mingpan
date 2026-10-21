#!/usr/bin/env node
// Visual acceptance harness for 混沌阁 frontend.
//
// Drives a real Chrome over CDP, walks a list of routes at two viewports, and fails
// (exit 1) on any broken contract. Reads only pixels and computed styles: it never
// mutates the app and never calls a write endpoint.
//
//   node tools/visual-harness/census.mjs --base=http://localhost:3001 --out=/tmp/vh
//
// Against the real backend, pass live ids so the dynamic routes render real content:
//   ... --chart-id=<id> --report-id=<id>
// Without ids those routes are skipped and the run says so out loud. 六爻结果态不看 id：
// 它读 sessionStorage，fixture 目录有默认值（tools/visual-harness/fixtures），四种盘各测一张。
//
// --stub exists for local dev where the Express/Postgres API is not running; it
// replaces window.fetch with fixtures. Never use it to judge a live deploy: every
// number it produces comes from fixture copy, not from the service.

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';

// ---------------------------------------------------------------- flags
const arg = (name, dflt = undefined) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  if (hit) return hit.slice(name.length + 3);
  return process.argv.includes('--' + name) ? true : dflt;
};

const BASE = (arg('base') || process.env.QN_BASE || 'http://localhost:3001').replace(/\/$/, '');
const OUT = arg('out') || process.env.QN_OUT || '.visual-harness';
// --chrome accepts a comma-separated candidate list; the first one that exists wins.
// A bare name (no slash) is left alone so it resolves through PATH.
const pickChrome = spec => {
  const list = String(spec).split(',').map(s => s.trim()).filter(Boolean);
  for (const c of list) if (!c.includes('/') || existsSync(c)) return c;
  return list[0];
};
const CHROME = pickChrome(arg('chrome') || process.env.QN_CHROME || [
  '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'google-chrome-stable',
].join(','));
const PORT = Number(arg('port') || 9399);
const STUB = Boolean(arg('stub'));
const SHOTS = !arg('no-shots');
const ONLY = (arg('only') || '').split(',').filter(Boolean);
const IDS = {
  chart: arg('chart-id'),
  report: arg('report-id'),
  liuyao: arg('liuyao-id'),
};
// A dump of the app's own sessionStorage key "chart_preview", so --stub can render
// /chart/result at all. Without it that page has nothing to draw.
// 现在有两张、而且都有仓库内默认值（tools/visual-harness/make-chart-fixture.ts 生成）：
// 一张完整盘（审「场景矩阵」11 行），一张同一盘摘掉 siZhu（审裁定 6 的无盘降级那一支）。
// 路径有默认值这件事本身就是修过的坑 —— 以前 --chart-fixture 忘了传就静默 SKIP，
// 于是那一节从来没被测过。
const CHART_DIR = arg('chart-fixtures') || 'tools/visual-harness/fixtures';
const CHART_ROUTES = {
  'chart-result': ['stubchart0001', `${CHART_DIR}/chart-result.json`],
  'chart-result-empty': ['stubchartempty', `${CHART_DIR}/chart-result-no-sizhu.json`],
  // 贫盘：四柱、大运、日主一起缺 —— 人生K线（#41）的降级分支只有在这种盘上才走得到。
  // 没有它，那一支就永远没被测过（与六爻「只审到输入态」、矩阵「降级没测」同一类假绿）。
  'chart-result-barren': ['stubchartbarren', `${CHART_DIR}/chart-result-barren.json`],
  // 合盘那一节的"填了对方"态：同一张完整盘，多一段本机对照报告。
  // 挂在同一个 fixture 上是有意的 —— 这一态要证的不是盘面又算了一遍，而是
  // "本机的盘 + 本机现排的对方盘"真的能在页面上拼出八条立项。
  'chart-hepan': ['stubchart0001', `${CHART_DIR}/chart-result.json`],
};
if (arg('chart-fixture')) CHART_ROUTES['chart-result'] = ['stubchart0001', arg('chart-fixture')];
const CHART_BY_PATH = {};
for (const [tag, [id, file]] of Object.entries(CHART_ROUTES)) {
  if (!existsSync(file)) { console.log(`\nSKIP ${tag}: fixture 不存在 ${file}（生成：tools/visual-harness/make-chart-fixture.ts）`); continue; }
  CHART_BY_PATH[`/chart/result/${id}`] = readFileSync(file, 'utf8');
}
const HAS_CHART = Object.keys(CHART_BY_PATH).length > 0;
const CHART_FIXTURE = HAS_CHART;

// 真盘模式：用 --chart-id 打真实后端时，页面四柱来自实时数据，不可能等于 fixture 的钉值。
// 那种情况下跳过「四柱必须等于 fixtures/chart-result.json」，其余结构断言（11 行/4 约定/
// 藏干/禁断语/文案）照旧 —— 否则真盘回归永远红 6 条，等于没人跑它。
const LIVE_CHART = !STUB && Boolean(IDS.chart) && !arg('chart-fixture');
// Same idea for 六爻: /liuyao/result/[id] reads its plate out of sessionStorage key
// "liuyao_result" and has no fetch fallback, so a route id alone can never render it.
// Generated, committed, synthetic: tools/liuyao-ganzhi/make-fixture.ts —— 三种起卦各一张，
// 外加一张「老盘」（同一张摇卦盘去掉两个口径版本戳），用来测结果页 A4 那句标注。
// 路径有默认值：不带任何参数也测得到结果态，不会再退化成「忘了传就静默跳过」。
const LIUYAO_DIR = arg('liuyao-fixtures') || 'tools/visual-harness/fixtures';
const LIUYAO_ROUTES = {
  'liuyao-result': ['fixture_coin_0001', `${LIUYAO_DIR}/liuyao-result.json`],
  'liuyao-result-time': ['fixture_time_0001', `${LIUYAO_DIR}/liuyao-result-time.json`],
  'liuyao-result-number': ['fixture_number_0001', `${LIUYAO_DIR}/liuyao-result-number.json`],
  'liuyao-result-legacy': ['fixture_legacy_0001', `${LIUYAO_DIR}/liuyao-result-legacy.json`],
};
// --liuyao-fixture=<file> 保留给单张盘（只覆盖摇卦那一张），其余仍走默认目录。
if (arg('liuyao-fixture')) LIUYAO_ROUTES['liuyao-result'] = ['fixture_synth_0001', arg('liuyao-fixture')];
const LIUYAO_BY_PATH = {};
for (const [tag, [id, file]] of Object.entries(LIUYAO_ROUTES)) {
  if (!existsSync(file)) { console.log(`\nSKIP ${tag}: fixture 不存在 ${file}（生成：tools/liuyao-ganzhi/make-fixture.ts）`); continue; }
  LIUYAO_BY_PATH[`/liuyao/result/${id}`] = readFileSync(file, 'utf8');
}
const HAS_LIUYAO = Object.keys(LIUYAO_BY_PATH).length > 0;

mkdirSync(OUT, { recursive: true });

// 已知、已裁定本轮不修（P2）的对比度问题。为什么单开一张表而不塞进 EXEMPT：
// EXEMPT 是按设计裁定把整条放过，而对比度被明令不许走那张表 —— 这里只把"同一对
// 前景/背景"降级成一条会打印、会计数、会在末尾点名的 KNOWN-CONTRAST，既不静默，
// 也不混进 FAIL 让人误读成本批引入。命中条件是前景+背景都等值（归一化空白后比），
// 所以换了色值就是新的一条红，这张表替不了别的问题挡刀。
// 修掉之后条目必须删干净 —— 现在就是一张空表。留着条目 = 给一个已修的问题发免死牌。
// 登记过并已了结：liuyao-done 的 13px/11px 金漆压棕 4.08:1（2026-10-19 裁定 ②，
// 改 --color-accent-gold-on-ink #e3cd96 后同底 5.01:1，条目随即删除）。
const KNOWN_CONTRAST = {};
const normColor = c => String(c || '').replace(/\s+/g, '');

// Deliberate, tracked violations — each entry names why it is not an accident and
// what would clear it. Anything not listed here still fails, so a page cannot buy
// silence by falling outside an audited region. Contrast never consults this table.
// Empty since 批 5: the homepage's own --fs scale was ruled into the ladder as the
// display tier and its copy moved inside <main>, so there is nothing left to excuse.
const EXEMPT = {};

// Frozen data-encoding colours. A value drifting here means someone edited the
// 五行 palette, which is a data bug, not a design choice.
const WX_FROZEN = {
  'jin': '#ef9104', 'mu': '#07a830', 'shui': '#2e83f6', 'huo': '#d30505', 'tu': '#8b6d03',
};

// 四化 values landed from the colour card (hue 80/175/250/320). Frozen for the same
// reason as 五行: the value is the encoding of 禄/权/科/忌, not a design taste.
const SIHUA_FROZEN = {
  'lu': '#586f2a', 'quan': '#2a6f69', 'ke': '#362a6f', 'ji': '#6f2a58',
};

const STATIC_PAGES = [
  // #双体系：tag "home" 现在指门廊（/ 只负责选体系），原来那张首页搬到 /oriental。
  // 于是 d1-home.png 的旧基线整张作废（不是回归，是这一页换了内容），
  // 而 d1-oriental.png 才是与旧 d1-home.png 可比的那一张。
  ['home', '/'],
  ['oriental', '/oriental'],
  ['western', '/western'],
  // 问事框的"答完之后"那一态：同一张页面，AFTER 钩子真的把一句话打进去并提交。
  // 不测这一态，等于只审了一个空输入框 —— 路由对不对、来源标没标、未开放有没有入口，全在提交之后。
  ['oriental-ask', '/oriental'],
  ['western-ask', '/western'],
  ['fengshui', '/fengshui'],
  // 户型页填一组标注之后的那一态：规则层的输出必须真的上屏（空页面过审没有意义）。
  ['fengshui-filled', '/fengshui'],
  // 3D 那一态单独跑：它要等动态 import、要量首帧与帧率，混在 filled 里会把两个数都污染。
  ['fengshui-3d', '/fengshui'],
  // 识别的两种后端落点。查询串只给 STUB_BOOT 看（同一张 /fengshui，recognize=503 让桩返回 503，
  // recognize=ok 返回契约里的成功体），页面自己不读它。
  // 为什么必须有两态而不是一态：三态里"失败"与"成功待确认"是两条完全不同的代码路径，
  // 只测失败就永远不知道成功体能不能被这套 UI 吃下；只测成功就永远不知道失败会不会假装成功。
  ['fengshui-recognize-fail', '/fengshui?recognize=503'],
  ['fengshui-recognize-candidates', '/fengshui?recognize=ok'],
  // 契约那一枪走的是**网络层**：CDP Fetch 拦下来看真实出站的头与体，然后 abort。
  // 上面两态读的是 window.__recReq —— 那是 fetch() 拿到的参数，不是发出去的东西；
  // 桩替换了 fetch，所以桩下永远看不到"Content-Type 到底有没有上线路"这一层。
  ['fengshui-recognize-wire', '/fengshui'],
  // 编辑闭环那一态：真的加一道墙、在墙上开个门、调宽、改一间房的用途，然后逐条钉回来。
  // 这批补的是"页面承诺过但没有控件"的缺陷，所以判据必须落在控件真的能改动画面上。
  ['fengshui-edit', '/fengshui'],
  ['create', '/create'],
  // 农历态从没被审过：闰月开关、日期下拉、农历换算提示都只在 calendar==='农历' 时存在，
  // 而 create 那一态停在默认的公历上。本批把三处 qn-chip 的内联 minHeight:30 摘掉，
  // 不新增这一态就没法证明 44px 真的成立了。
  ['create-lunar', '/create'],
  // 建盘页的「双人合盘」那一栏本批接管成真输入（多了同意框、闰月开关、对方的地区三件），
  // 不测这一 tab 就等于这批新加的控件一个 44px 读数都没有 —— 与"只审到输入态"同一类假绿。
  ['create-double', '/create'],
  // 建盘页的「四柱直批」那一态：后端 calendar 只收 公历/农历，这一条永远存不进服务器。
  // 要钉的是"这话在提交之前就写在屏上"，不是等用户事后发现报告列表里没有它。
  ['create-sizhu', '/create'],
  ['liuyao', '/liuyao'],
  ['liuyao-create', '/liuyao/create'],
  // 结果态（step==='done'）单独占一个状态：同一 URL，但 AFTER 钩子会真摇一卦把它推到位。
  ['liuyao-done', '/liuyao/create'],
  ['meihua', '/meihua'],
  ['xiu', '/xiu'],
  ['huangli', '/huangli'],
  ['tools', '/tools'],
  ['verify', '/verify'],
  ['dashboard', '/dashboard'],
  ['contact', '/contact'],
  ['privacy', '/privacy'],
  ['agreement', '/agreement'],
  ['disclaimer', '/disclaimer'],
];
const DYNAMIC_PAGES = [
  ['chart-loading', '/chart/loading/', 'chart'],
  ['chart-result', '/chart/result/', 'chart'],
  // 合盘态：同一张真盘，页内那一节被真人级点击推到"已经并排"。live 下也要跑，
  // 否则这一节只在 fixture 上被审过，而后端给的盘才带 enrichment。
  ['chart-hepan', '/chart/result/', 'chart'],
  // liuyao-result deliberately not here: it takes its plate from sessionStorage, not
  // from the API, so an id cannot make it render. See the LIUYAO_ROUTES block below.
  ['report', '/report/', 'report'],
];
// Orphan routes: out of scope for the redesign, they only have to not error.
const ORPHAN_PAGES = [
  ['orphan-admin', '/admin/dashboard'],
  ['orphan-bazi-chart', '/bazi-chart'],
  ['orphan-chart-preview', '/chart/preview'],
];

// Some states only exist after a click. Each entry runs once after load and must
// return true; the click itself doubles as a "did the control survive the redesign"
// check, and without it the collapsed half of the chart card is never audited.
// 目录里"有入口"的 href 全集，从 catalog.ts 源码现读。问事框回答里出现的每一个链接
// 都必须落在这个集合里 —— 这一条是防"模型/代码幻觉出一个入口"的最后一道，写死一份清单
// 就会与目录漂移，所以宁可去读源文件。
// 读的是源码，必须先剥注释：注释掉的一行 `href: '/xxx'` 会悄悄把白名单放宽，这道闸门就
// 松了而没有任何信号（globals.css 那处 token 审计同一做法）。
// 这里只能内联写这两行 replace —— census.mjs 由 node 直接当 ESM 跑，import 不了
// tools/_lib/codesrc.ts 那个 TypeScript 件。
const CATALOG_SRC = readFileSync(join(import.meta.dirname, '..', '..', 'frontend', 'lib', 'tools', 'catalog.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const CATALOG_HREFS = [...new Set(
  (CATALOG_SRC.match(/href:\s*['"]\/[^'"]+['"]/g) || []).map(s => s.replace(/.*['"](\/[^'"]+)['"]/, '$1')))];

// 问事框两态的钉值。期望全部是照 lib/assistant/intent.ts 的关键词表人工推出来的
// （与 kline 那 144 组成对表同一做法），不是跑一遍再把输出抄回来。
const QA_PINS = {
  'oriental-ask': {
    q: '帮我排个八字看看命格',
    mustSay: ['你问：帮我排个八字看看命格', '该用的是', '八字 & 紫微斗数（可用）', '还要补：日期或生日、出生时辰、出生地点',
      '这一轮由本机目录匹配给出，未经模型'],
    entry: { text: '进入 · 八字 & 紫微斗数', href: '/create' },
    absent: ['这一轮来自服务端路由'],
  },
  'western-ask': {
    q: '我的上升和月亮星座是什么',
    mustSay: ['还没开放', '这一轮由本机目录匹配给出，未经模型'],
    entry: null,
    absent: ['进入 ·', '这一轮来自服务端路由'],
  },
};

// tools/visual-harness/fixtures/floorplan-sample.png 的字节（156B 的 200×100 PNG，白底黑边）。
// 之所以用 2:1 而不是正方：识别响应只有 0..1 归一化坐标，宽高比是本站唯一能拿到
// "这张图本来多长多宽"的通道；正方图会让"按 aspect 分两轴缩"与"两轴同缩"算出同一结果，
// 那条缩放路径就永远没被真图跑过。套件里钉了这份内联字节必须与该文件逐字节相同，
// 并且钉"这张图本身能被独立实现解出来"——上一版它解不出来，aspect 静默落到 1，
// 那条缩放路径看起来跑过了，其实一次都没跑。
const FS_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAAAAADm7SDXAAAAY0lEQVTtzwENAAAMAiD7l/5rOAcNSGbcBBERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERkc7IiAfEP4sqAAAAAElFTkSuQmCC';
const FS_PICK = `(async () => {
  const inp = document.querySelector('input[type=file]');
  if (!inp) return '页面上没有选图控件（input[type=file]）';
  const bin = atob(${JSON.stringify(FS_PNG_B64)});
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  dt.items.add(new File([u8], 'floorplan-sample.png', { type: 'image/png' }));
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  // 等 onPick 走完：它要读字节、开 objectURL、解码一次量宽高比，然后才把同意框渲染出来。
  // 不等这一步就点同意，TRUSTED 那一枪会打在"还没有同意框"的页面上，而且不报错。
  const wait = ms => new Promise(r => setTimeout(r, ms));
  for (let n = 0; n < 60 && !document.getElementById('fp-consent'); n++) await wait(50);
  if (!document.getElementById('fp-consent')) return '塞了图但同意框没出现（onPick 没走完或校验把文件拒了）';
  return true; })()`;

const AFTER = {
  // 农历态：先把历法切到农历，再把年/月设成 2025 年 6 月（该年闰六月），闰月开关才会出现。
  // select 是 React 受控的，必须走 HTMLSelectElement 的原生 setter + change 事件，
  // 直接赋 .value 不触发 onChange，后面那一步就永远等不到闰月 chip（这种绿最骗人）。
  'create-lunar': `(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const btn = t => [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === t);
    const cal = btn('农历'); if (!cal) return '历法切换里的「农历」不在页面上';
    cal.click();
    const selSet = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    // 认列靠内容不靠 nth-child：年列里必有四位数字 option，月列里必有 '12'。
    // 按位置索引的话，页面上多加一个下拉（比如时辰）就会整体错位，而且不报错。
    const yrs = [...document.querySelectorAll('select')].filter(s => [...s.options].some(o => /^\\d{4}$/.test((o.textContent || '').trim())));
    const mons = [...document.querySelectorAll('select')].filter(s => [...s.options].some(o => (o.textContent || '').trim() === '12'));
    if (!yrs.length || !mons.length) return '年或月的下拉没找到（页面结构与探针假设不符）';
    selSet.call(yrs[0], '2025'); yrs[0].dispatchEvent(new Event('change', { bubbles: true }));
    selSet.call(mons[0], '6'); mons[0].dispatchEvent(new Event('change', { bubbles: true }));
    for (let n = 0; n < 30 && !btn('闰6月'); n++) await wait(50);
    if (!btn('闰6月')) return '选了 2025 年 6 月却没出现「闰6月」开关（该年闰六月；出现了说明派生判据变了）';
    return true; })()`,
  // 户型工作室那两态改走 TRUSTED（真实 CDP 点击），不再用脚本 .click()：
  // 见上面 TRUSTED 的注释 —— 合成点击不计入 hadRecentInput，会把用户不被扣分的展开算成回归。
  // 户型识别两态的文件注入不放这儿了 —— 挪进 TRUSTED 的 '@file' 那一步。
  // 原因：AFTER 跑完之后、TRUSTED 之前会**再快照一次** __clsAtLoad，于是"选完图 → 预览卡出现
  // → 下面整块被推下去"这段位移被算进"加载期 CLS"。而真人选图是**用户输入**，
  // 500ms 内的位移按定义不计分。那两条 0.139 的 warn 是量法错了，不是产品回归。
  // 问事框：填一句话并提交。React 受控 input 必须走原生 setter + input 事件，
  // 直接改 .value 不会触发 onChange，点提交就是空跑一趟（那种"绿"最骗人）。
  'oriental-ask': `(() => { const i = document.getElementById('qa-input-oriental');
    if (!i) return '问事框输入框不在页面上（#qa-input-oriental）';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(QA_PINS['oriental-ask'].q)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    const b = [...document.querySelectorAll('button')].find(x => /问一下/.test(x.textContent || ''));
    if (!b) return '「问一下」按钮不在页面上'; b.click(); return true; })()`,
  'western-ask': `(() => { const i = document.getElementById('qa-input-western');
    if (!i) return '问事框输入框不在页面上（#qa-input-western）';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(QA_PINS['western-ask'].q)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    const b = [...document.querySelectorAll('button')].find(x => /问一下/.test(x.textContent || ''));
    if (!b) return '「问一下」按钮不在页面上'; b.click(); return true; })()`,
  // 启动器在东方工作页上（#双体系 之后 / 只剩两个入口，门廊没有按钮可点）。
  'oriental': `(() => { const b = [...document.querySelectorAll('button')]
      .find(x => /开始使用/.test(x.textContent || '')); if (!b) return false; b.click(); return true; })()`,
  'chart-result': `(() => { const b = [...document.querySelectorAll('button')]
      .find(x => /展开/.test(x.textContent || '')); if (!b) return '四柱卡片的「展开」按钮不在页面上'; b.click();
    // 场景矩阵每一行的依据/原文/岁运都收在 <details> 里。不打开，字号梯与对比度审计
    // 就只见过折叠态，qn-quote 那一路 13px 原文从未被量过 —— 与 /meihua、/xiu 那次
    // 「只审到输入态」同一类假绿。summary 不是 button，所以必须显式打开。
    const ds = [...document.querySelectorAll('.qn-scenario details')];
    if (!ds.length) return '场景矩阵里没有 <details> 可打开（那一节没渲染出来）';
    ds.forEach(d => { d.open = true; });
    return ds.every(d => d.open) ? true : 'details 打不开'; })()`,
  // 合盘：把"本机填对方生辰"这条路走一遍。这一段用脚本点击把表单叫出来、把三个
  // 数字格填上，然后交给 TRUSTED 用真实鼠标去勾同意 + 按「并排对照」——
  // 因为那一下会插入整段报告，脚本点击不算 hadRecentInput，会把用户不被扣分的
  // 展开记成加载回归（户型那两态已经为此改过一次）。
  'chart-hepan': `(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const open = document.getElementById('hp-open');
    if (open) open.click();
    for (let n = 0; n < 30 && !document.getElementById('hp-consent'); n++) await wait(50);
    if (!document.getElementById('hp-consent')) return '合盘的对方表单没渲染出来（#hp-open 点下去 #hp-consent 不出现）';
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const put = (label, v) => { const i = [...document.querySelectorAll('input[aria-label]')]
        .find(x => x.getAttribute('aria-label') === label);
      if (!i) return false; set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); return true; };
    if (!put('对方年', '1990') || !put('对方月', '2') || !put('对方日', '3')) return '对方年/月/日输入框不在页面上';
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '并排对照');
    if (!b) return '「并排对照」按钮不在页面上';
    return true; })()`,
  // 卦成之后才是这个页面真正交付的版式：三卦并排、体用条、取数过程、法务口径。不点这一下，
  // /meihua 审到的只有输入态，结果态的字号与对比度从未被测量过（等同首页那次「假绿」）。
  // 精确匹配「起卦」：三个 tab 的文字里也都含「起卦」。
  'meihua': `(() => { const b = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').trim() === '起卦'); if (!b) return false; b.click(); return true; })()`,
  // 星宿页同理：输入态只有一栏日期，命宿大字、四象铺表、值日诗全在结果态。
  // 不点这一下，display 档的宿名与 4×7 网格从未被字号审计量过。
  // 但点完不能立刻探：实测 React 把结果态排在下一个 tick，同步读到的还是输入态，
  // 钩子就会返回 false、页面被记成「没点开」，而 800ms 后的审计其实已经在审结果态。
  // evl 开了 awaitPromise，所以轮询到结果态真出现再返回，判定与实际审到的东西才对得上。
  'xiu': `(async () => { const b = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').trim() === '查命宿'); if (!b) return false;
      const i = document.querySelector('input[type=date]'); if (!i) return false;
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(i, '1994-08-15'); i.dispatchEvent(new Event('input', { bubbles: true }));
      b.click();
      for (let n = 0; n < 24; n++) {
        if ((document.body.innerText || '').includes('取数过程')) return true;
        await new Promise(r => setTimeout(r, 25));
      }
      return false; })()`,
  // 回执面板要点一下才存在。不点，「结果回执」这块版式（三行摘要 + 三个按钮）就从未被测量过，
  // 与 /meihua、/xiu 那次「只审到输入态」是同一类假绿。
  'liuyao-result': `(async () => { const b = [...document.querySelectorAll('button')]
      .find(x => (x.textContent || '').trim() === '生成本盘回执'); if (!b) return false;
      b.click();
      for (let n = 0; n < 24; n++) {
        if ((document.body.innerText || '').includes('回执编号')) return true;
        await new Promise(r => setTimeout(r, 25));
      }
      return false; })()`,
  // 结果态只能真摇出来（六爻各 2s 转 + 1.5s 停 ≈ 21s）。裁定 (c2)② 明确不给生产加可注入
  // 调试态 —— 能注入 seed 就等于用户能挑 seed，承诺当场作废。所以这里只做「点击 + 等待」，
  // 与用户走同一条路；代价是每个视口多花约 25 秒。
  // 到位判据钉的是结构不是文字：六爻六行、承诺行、那两个按钮，缺一就不算到达 ——
  // 空态同样"有导航、有页脚、有字号梯"，只测 bodyText 会假绿（首页那次已经踩过）。
  'liuyao-done': `(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const btn = re => [...document.querySelectorAll('button')].find(x => re.test((x.textContent || '').trim()));
    const ta = document.getElementById('ly-question'); if (!ta) return '问题输入框不在页面上';
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(ta, '视觉验收占位问题'); ta.dispatchEvent(new Event('input', { bubbles: true }));
    const next = btn(/下一步/); if (!next) return '下一步按钮不在页面上'; next.click();
    for (let n = 0; n < 40 && !btn(/^开始摇卦$/); n++) await wait(50);
    const start = btn(/^开始摇卦$/); if (!start) return '起卦方式那一步没渲染出「开始摇卦」'; start.click();
    for (let n = 0; n < 200; n++) { if (btn(/查看结果/)) break; await wait(250); }
    if (!btn(/查看结果/)) return '摇满六爻后没进入结果态';
    if (!btn(/重新摇一卦/)) return '结果态缺「重新摇一卦」入口';
    const line = ([...document.querySelectorAll('p')].map(p => p.textContent).find(t => (t || '').includes('已锁定')) || '');
    if (!/seedHash [0-9a-f]{12}/.test(line)) return '结果态缺承诺行（seedHash 未显示）';
    const rows = [...document.querySelectorAll('.qn-ink .qn-note')].map(e => (e.textContent || '').trim()).filter(t => t && t !== '—').length;
    if (rows < 6) return '六爻记录只渲染出 ' + rows + ' 行';
    return true; })()`,
};

// Injected states must actually land on screen. A fixture the app silently fails to
// read leaves the page on its empty state, and an empty state is also "a page with a
// nav, a footer and a ladder" — so bodyText alone can pass it while the real delivery
// (四柱行、每爻空亡、口径行、跨日提示) was never measured.
//
// 2026-10-17 #66/#67 收口后改成按 method 分组、逐爻钉死：
//  · 每爻钉的是「六亲+干支+五行」整串，不是单独的干支 —— 纳甲错一格六亲跟着错，只比干支会漏。
//  · 值全部取自 tools/liuyao-ganzhi/gold.ts 那份手写京房纳甲金标准（make-fixture.ts 的 PINS 段落
//    就是把同一份金标准印出来），没有一个字是从 fixture 抄的：从 fixture 抄等于让盘面自己证明自己对。
//  · 爻位序一律 初→上；盘面上是 上爻在顶，探针读回来以后再翻。
//  · 每爻空亡不另立表：kong 那个数是从已钉死的干支 + 当日旬空推出来的产物，只对精确值，不对「至少有」。
//  · 重生成 fixture 时这些 token 必须跟着改（改的是 make-fixture.ts 重跑以后的 PINS 段落），
//    手改 fixture 文件是禁止的。
const LIUYAO_PINS = {
  'liuyao-result': {
    base: 1, gua: '雷火丰', gong: '坎宫', bianName: '泽雷随', kong: 2,
    text: ['戊午日', '子丑旬空', '真太阳时', '87.62°E', '校正后跨日'],
    absent: ['本盘按起卦时口径生成'],
    ben: ['子孙己卯木', '官鬼己丑土', '兄弟己亥水', '妻财庚午火', '父母庚申金', '官鬼庚戌土'],
    bian: ['父母庚子水', '兄弟庚寅木', '妻财庚辰土', '父母丁亥水', '官鬼丁酉金', '妻财丁未土'],
  },
  'liuyao-result-time': {
    base: 13, gua: '火雷噬嗑', gong: '巽宫', bianName: '火泽睽', kong: 2,
    text: ['己未日', '子丑旬空', '真太阳时', '87.62°E', '校正后跨日', '取数过程'],
    absent: ['本盘按起卦时口径生成'],
    ben: ['父母庚子水', '兄弟庚寅木', '妻财庚辰土', '官鬼己酉金', '妻财己未土', '子孙己巳火'],
    bian: ['父母丁巳火', '官鬼丁卯木', '兄弟丁丑土', '子孙己酉金', '兄弟己未土', '父母己巳火'],
  },
  'liuyao-result-number': {
    base: 25, gua: '乾为天', gong: '乾宫', bianName: '天火同人', kong: 2,
    text: ['戊午日', '子丑旬空', '真太阳时', '87.62°E', '校正后跨日', '取数过程'],
    absent: ['本盘按起卦时口径生成'],
    ben: ['子孙甲子水', '妻财甲寅木', '父母甲辰土', '官鬼壬午火', '兄弟壬申金', '父母壬戌土'],
    bian: ['父母己卯木', '子孙己丑土', '官鬼己亥水', '兄弟壬午火', '妻财壬申金', '子孙壬戌土'],
  },
  // 老盘：摇卦那张去掉两个口径戳。盘面内容仍是金标准值（要测的是标注分支，
  // 不是把修前的错纳甲再认证一遍），但 A4 那句必须冒出来，且与上面三张反过来。
  'liuyao-result-legacy': {
    base: 37, gua: '雷火丰', gong: '坎宫', bianName: '泽雷随', kong: 2,
    text: ['本盘按起卦时口径生成', '戊午日', '子丑旬空'],
    absent: [],
    ben: ['子孙己卯木', '官鬼己丑土', '兄弟己亥水', '妻财庚午火', '父母庚申金', '官鬼庚戌土'],
    bian: ['父母庚子水', '兄弟庚寅木', '妻财庚辰土', '父母丁亥水', '官鬼丁酉金', '妻财丁未土'],
  },
};
// 八字结果态同样要钉结构。理由与六爻一致：--stub 注入的盘如果被应用读丢了，页面会落到
// 空态，而空态也有导航、页脚、字号梯 —— bodyText 会绿，真正交付的四柱行与「场景矩阵」
// 那一节却从没被量过。钉值全部取自 tools/visual-harness/fixtures/chart-coverage.txt，
// 那份 token 又来自 bazi-validation-v1.json 的外部期望，不是从 fixture 抄的。
const CHART_PINS = {
  'chart-result': {
    mode: 'plate',
    pillars: ['戊辰', '己未', '辛未', '乙未'],
    rows: ['自己', '日常', '父母', '兄弟姐妹与朋友', '恋爱', '婚姻', '子女',
      '亲子（我为人子女）', '亲子（我为人父母）', '共事合作', '上下级'],
    conventionRows: 4,          // 11 行里恰好 4 行标「本站约定，非古籍原目」
    text: ['场景矩阵', 'liuqin-scenario-v1', '两说并存，本站不裁决', '宫分：年柱管父母'],
    // 断语一律不上屏（裁定 9）。这几串只存在于 scenarios.ts 的出处凭据与 docs 底本里。
    absent: ['父母不全', '兄弟不完', '妻妾不完', '子息无传', '子息凶頑', '妻妾不賢'],
    minCangGan: 1,              // 藏干命中必须真上屏（字段名读错时这一路会静默归零）
  },
  // 无盘降级那一支：裁定 6 要的是「说明 + 去排盘的路」，不是整节消失，也不是编一张盘。
  // 探针钉的是反向条件 —— 一行 [data-scenario] 都不许出现，同时要看到 /create 那条链接。
  'chart-result-empty': {
    mode: 'empty',
    rows: [],
    conventionRows: 0,
    minCangGan: 0,
    text: ['场景矩阵', '不预置示例盘', '先去排一张盘'],
    absent: ['liuqin-scenario-v1', '两说并存', '父母不全', '妻妾不賢'],
    pillars: [],
  },
  // 贫盘：矩阵同样降级（siZhu 也缺了）。K线那一节另有 KLINE_PINS 管。
  'chart-result-barren': {
    mode: 'empty',
    rows: [],
    conventionRows: 0,
    minCangGan: 0,
    text: ['场景矩阵', '不预置示例盘', '先去排一张盘'],
    absent: ['liuqin-scenario-v1', '两说并存', '父母不全', '妻妾不賢'],
    pillars: [],
  },
};

// 人生K线（#41）的钉值。y 轴是固定十条十神泳道，所以钉的是「哪一格该出现哪个干支」——
// 每个值都是手工推出的，不是从页面、也不是从 kline.ts 的输出抄的：
//   日主辛（阴金）。辛见辛=比肩、见庚=劫财；辛生癸=食神、生壬=伤官；辛克乙=偏财、克甲=正财；
//   丙克辛=正官、丁克辛=七杀；戊生辛=正印、己生辛=偏印。
//   藏干按本/中/余：子[癸]、丑[己癸辛]、寅[甲丙戊]、卯[乙]、辰[戊乙癸]、巳[丙庚戊]、
//   午[丁己]、未[己丁乙]、申[庚壬戊]、酉[辛]。
// 于是首段（1996–2005，庚申运，虚岁 9 起）：
//   比肩 = 1997 丁丑的余气辛 / 2001 辛巳的流年干辛 / 2005 乙酉的本气辛 → 三格；
//   正官 = 1996 丙子的流年干丙 / 1998 戊寅的中气丙 / 2001 辛巳的本气丙 → 三格。
// 运段 chip = 9、每段 10 格，取自 fixtures/chart-coverage.txt（那份是引擎+外部用例的产物）。
const KLINE_PINS = {
  'chart-result': {
    mode: 'plate', segments: 9,
    years: ['96', '97', '98', '99', '00', '01', '02', '03', '04', '05'],
    lanes: ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'],
    cells: { 比肩: ['1997', '2001', '2005'], 正官: ['1996', '1998', '2001'] },
    cellText: { 比肩: ['丁丑', '辛巳', '乙酉'], 正官: ['丙子', '戊寅', '辛巳'] },
    text: ['人生K线 · 类别轴', 'kline-category-v1', '本图不构成吉凶评分',
      '流年干支按立春换年', '无事件（未由你标注）', '落点取的是流年支', '格子只读'],
    // 落点的逐字期望（手工推，不跑代码）：默认展示首段 1996 丙子，日主辛，四柱 戊辰 己未 辛未 乙未。
    //   子 × 未 = 六害（月／日／时三柱各一条）；子藏癸 × 辰藏戊 = 戊癸合 → 暗合（年柱一条）；
    //   运支 申 与 辰／未：申藏庚壬戊，辰藏戊乙癸、未藏己丁乙，天干五合是来回都算的一张对称表
    //   → 庚乙合（辰、未都有乙）、壬丁合（未有丁）、戊癸合（辰有癸），四柱各出一条。
    //   另一张盘上 1997 丁丑：丑×未 同时是六冲与无恩之刑(半)，成对入口两条都报 —— 这里默认
    //   展示的是 1996，六冲/相刑那两条由 kline-acceptance 的 144 组手推表钉住。
    land: {
      has: ['流年支 子 × 月柱 未 → 六害', '流年支 子 × 年柱 辰 → 暗合·癸戊合',
        '运支 申 × 年柱 辰 → 暗合·庚乙合、戊癸合', '运支 申 × 日柱 未 → 暗合·庚乙合、壬丁合'],
      counts: { '→ 六害': 3, '→ 暗合': 5 },
    },
  },
  // 无四柱但大运仍在：矩阵降级，K线照排 —— 两节各判各的盘，这个组合本身就是被测的事实。
  'chart-result-empty': {
    mode: 'plate', segments: 9,
    years: ['96', '97', '98', '99', '00', '01', '02', '03', '04', '05'],
    lanes: ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'],
    cells: { 比肩: ['1997', '2001', '2005'], 正官: ['1996', '1998', '2001'] },
    cellText: { 比肩: ['丁丑', '辛巳', '乙酉'], 正官: ['丙子', '戊寅', '辛巳'] },
    land: null,
    text: ['人生K线 · 类别轴', '本图不构成吉凶评分', '这份数据里没有完整四柱', '格子只读'],
  },
  'chart-result-barren': {
    mode: 'empty', segments: 0, years: [], lanes: [], cells: {}, cellText: {}, land: null,
    text: ['人生K线', '没有可用的岁运序列', '不预置示例盘', '先去排一张盘'],
  },
};

// 合盘（#49）的钉值。我 = fixtures/chart-result.json 那张完整盘（戊辰 己未 辛未 乙未，日主辛）；
// 对方 = 探针填进去的 1990-02-03 12:00 北京（时辰格留默认值），四柱 己巳 丁丑 己亥 庚午。
// 1990 年 2 月 3 日在立春前，故年柱仍是己巳；己年五虎遁到丑月为丁丑。以下每条都是手推：
//   日主 辛(阴金) × 己(阴土)：土生金 → 金被生 → 「天干相生」；辛己不构成五合任何一对。
//   以辛论己：阴土生阴金，同性相生 → 偏印；我盘四干 戊/己/辛/乙 的十神是 正印/偏印/比肩/偏财，
//     所以回指落点恰好只有月柱。
//   年支 辰 × 巳：非冲非合非害非刑 → 看暗合。辰藏戊乙癸、巳藏丙庚戊 → 乙庚合、癸戊合 → 暗合。
//   日支 未 × 亥：亥卯未是三支的三合，成对不报（原典之外不发明）→ 看暗合。未藏己丁乙、亥藏壬甲
//     → 己甲合、丁壬合 → 暗合。
//   年命纳音：戊辰与己巳同属大林木 → 同为木，shengKe 在 WuXing 上是全函数，这一档报「同」。
const HEPAN_DEGRADED = {
  mode: 'degraded', items: [],
  text: ['合盘 · 两人对照', '自研 · 非还原', 'hepan-local-v1', '对方生辰需要本人同意才能填',
    '填对方生辰（本机计算）', '不进报告、不进回执、不进台账、不上链', '进入 · 建盘页（双人合盘）'],
  absent: ['null', 'undefined', 'NaN'],
  noScoreIn: ['评分', '匹配度', '吉', '凶', '宜忌', '%'],
};
const HEPAN_PINS = {
  // 没有对方数据时那一节必须还在，而且给的是一个当场能填的表单 —— 不是整节消失。
  // 用户分不清"这站没这功能"和"我的盘没算出来"，这条就是用来分清它们的。
  'chart-result': { ...HEPAN_DEGRADED },
  // 无四柱 / 贫盘两张降级盘各测一遍：这一节是无条件挂载的，降级页上它同样必须在。
  'chart-result-empty': { ...HEPAN_DEGRADED },
  'chart-result-barren': { ...HEPAN_DEGRADED },
  'chart-hepan': {
    items: ['日主相待', '对方日主在我盘里的位置', '年支对照', '日支对照', '年命纳音',
      '我盘夫妻宫 × 对方命宫', '五行数量并排', '当前大运并排'],
    text: [
      '我日主 辛、对方日主 己，两者之间是「天干相生」',
      '是「偏印」', '我盘里月柱的天干也是这个十神',
      '我年支 辰、对方年支 巳：暗合', '我日支 未、对方日支 亥：暗合',
      '大林木', '两者是「同」',
      '1990-2-3 12:00', '自研 · 非还原', 'hepan-local-v1', '没做的部分',
      '合盘评分 / 匹配度百分比：不做（裁定）',
    ],
    // 反向：整节里既不该出现 undefined/null 这类没被兜住的空值，也不该出现结论性数字。
    absent: ['null', 'undefined', 'NaN'],
    noScoreIn: ['评分', '匹配度', '吉', '凶', '宜忌', '%'],
  },
};

// 紫微十二宫那张卡（P1-1）：重点宫位五张 + 其余七张，两边不重不漏，标签上的宫数与分区一致。
// 这一节红过一次的方式很特别 —— 页面不报错，只是四张卡不见了，因为宫名照 types.ts 的
// ZiweiGong 声明写（除命宫外都带"宫"），而引擎实际产出不带。所以这里按 DOM 上的 data 属性数，
// 不读文案：文案可以对，分区才是被交付的东西。
const ZIWEI_BASE = { key: ['命宫', '官禄', '财帛', '夫妻', '福德'], other: 7 };
const ZIWEI_PINS = {
  'chart-result': { ...ZIWEI_BASE },
  // 三张降级盘上的紫微半边都是完整的（fixture 只摘 bazi 那几路径），所以这张卡同样在屏上 ——
  // 以前没有任何一态数过它，"降级盘"于是只在场景矩阵和 K线那两节被证明过。
  'chart-result-empty': { ...ZIWEI_BASE },
  'chart-result-barren': { ...ZIWEI_BASE },
  'chart-hepan': { ...ZIWEI_BASE },
};

const ziweiProbe = p => `(() => {
  const out = [];
  const key = [...document.querySelectorAll('[data-zw-key]')];
  const other = [...document.querySelectorAll('[data-zw-other]')];
  if (!key.length && !other.length) return { miss: ['card: data-zw-key / data-zw-other 一个都没有（紫微那张卡没渲染）'] };
  const names = key.map(e => e.getAttribute('data-zw-key'));
  const others = other.map(e => e.getAttribute('data-zw-other'));
  if (names.length !== ${p.key.length}) out.push('重点卡=' + names.length + '（应为 ${p.key.length}；少一张就是那个宫名查不到，而它不报错，只是不出现）');
  (${JSON.stringify(p.key)}).forEach(x => { if (names.indexOf(x) < 0) out.push('缺重点卡:' + x); });
  if (others.length !== ${p.other}) out.push('其余宫=' + others.length + '（应为 ${p.other}）');
  const both = names.filter(x => others.indexOf(x) >= 0);
  if (both.length) out.push('同一宫同时出现在两组:' + both.join('、'));
  if (new Set(names.concat(others)).size !== 12) out.push('两组去重后=' + new Set(names.concat(others)).size + '（十二宫必须全覆盖，少一个就是有一个宫在页面上根本不存在）');
  const btn = [...document.querySelectorAll('button')].find(b => /其余\\d+宫详情|收起全部宫位详情/.test(b.textContent || ''));
  if (!btn) out.push('其余宫那一排没有展开按钮');
  else if (!/收起/.test(btn.textContent || '') && (btn.textContent || '').indexOf('其余${p.other}宫详情') < 0)
    out.push('按钮写的宫数与分区不一致：屏上「' + (btn.textContent || '').trim() + '」/ 实数 ${p.other} 宫');
  return { miss: out, key: names.length, other: others.length };
})()`;

const hepanProbe = p => `(() => {
  const out = [];
  const sec = document.getElementById('hepan');
  if (!sec) return { miss: ['section: #hepan 不存在（那一节根本没挂上结果页）'] };
  const items = [...sec.querySelectorAll('[data-hepan-item]')];
  const names = items.map(x => x.getAttribute('data-hepan-item'));
  const DEGRADED = ${p.mode === 'degraded'};
  if (DEGRADED) {
    if (names.length) out.push('degraded: 没有对方数据时不该有任何立项块（实得 ' + names.length + '）');
    if (!document.getElementById('hp-open')) out.push('degraded: 缺「填对方生辰（本机计算）」那颗按钮（整节只剩说明文字 = 用户分不清没这功能和没填）');
  } else {
    if (names.length !== ${p.items.length}) out.push('立项块=' + names.length + '（应为 ${p.items.length}；少一块通常是某个盘面字段读成 undefined 后静默走了「没做的部分」）');
    (${JSON.stringify(p.items)}).forEach(x => { if (names.indexOf(x) < 0) out.push('缺立项:' + x); });
  }
  // 每块都得同时有"依据"与"说不准的"两行，缺一行就是只剩断语。
  items.forEach(el => {
    const t = (el.textContent || '').replace(/\\s+/g, '');
    if (!t.includes('依据：')) out.push('[' + el.getAttribute('data-hepan-item') + '] 没有依据行');
    if (!t.includes('说不准的：')) out.push('[' + el.getAttribute('data-hepan-item') + '] 没有不确定项行');
  });
  const raw = (sec.textContent || '').replace(/\\s+/g, '');
  const body = (sec.innerText || '').replace(/\\s+/g, '');
  (${JSON.stringify(p.text)}).forEach(x => { const k = x.replace(/\\s+/g, '');
    if (raw.indexOf(k) < 0 && body.indexOf(k) < 0) out.push('text:' + x); });
  (${JSON.stringify(p.absent)}).forEach(x => { if (raw.includes(x)) out.push('不该出现:' + x); });
  const inItems = items.map(el => (el.textContent || '')).join('|');
  (${JSON.stringify(p.noScoreIn)}).forEach(x => { if (inItems.includes(x))
    out.push('结论块里出现「' + x + '」（这一节只报盘面对应关系，不裁决；声明不做的句子在块外，不在块内）'); });
  return { miss: out, blocks: names.length };
})()`;

// 读盘面用结构探针而不是整页 bodyText：整页 includes('庚午') 会被别的行、别的卡片撞中，
// 而「第 4 爻那一格写的就是 妻财庚午火」才是这次交付的东西。比较全在页内做完再回传，
// 免得把整页文本搬过 CDP。
const liuyaoProbe = p => `(() => {
  const out = [];
  const plate = document.querySelector('.liuyao-plate');
  if (!plate) return { miss: ['plate: .liuyao-plate 不存在（sessionStorage 没被读进盘面）'] };
  const rows = [...plate.children].filter(d => d.children.length === 5);
  if (rows.length !== 6) return { miss: ['plate: 爻行数=' + rows.length + '（应为 6）'] };
  const txt = el => ((el && el.textContent) || '').replace(/\\s+/g, '');
  const yao = rows.map(r => txt(r.children[1])).reverse();   // 盘面上爻在顶，翻回 初→上
  const bian = rows.map(r => txt(r.children[4])).reverse();
  (${JSON.stringify(p.ben)}).forEach((want, i) => { if (yao[i].indexOf(want) < 0)
    out.push('n' + String(${p.base} + i).padStart(2, '0') + ' 本卦第' + (i + 1) + '爻 屏上「' + yao[i] + '」不含金标准「' + want + '」'); });
  (${JSON.stringify(p.bian)}).forEach((want, i) => { if (bian[i].indexOf(want) < 0)
    out.push('n' + String(${p.base} + 6 + i).padStart(2, '0') + ' 变卦第' + (i + 1) + '爻 屏上「' + bian[i] + '」不含金标准「' + want + '」'); });
  const kong = plate.querySelectorAll('[data-ly-kong]').length;
  if (kong !== ${p.kong}) out.push('空亡标记数=' + kong + '（干支+旬空推导应为 ${p.kong}）');
  const head = txt(plate);
  (${JSON.stringify([p.gua, p.gong, p.bianName])}).forEach(x => { if (head.indexOf(x) < 0) out.push('盘头缺「' + x + '」'); });
  const page = (document.body.innerText || '').replace(/\\s+/g, '');
  (${JSON.stringify(p.text)}).forEach(x => { if (page.indexOf(x) < 0) out.push('text:' + x); });
  (${JSON.stringify(p.absent)}).forEach(x => { if (page.indexOf(x) >= 0) out.push('不该出现:' + x); });
  return { miss: out, kong, yao, bian };
})()`;

// 场景矩阵一节按结构数：11 个 [data-scenario] 行、行名逐一对上、约定标签恰好 4 行、
// 藏干命中至少 N 条。用整页 bodyText 数「本站约定」会把别处的说明文字也算进去，
// 数「命中」更是根本数不出来 —— 所以全部在页内按节内元素做完再回传。
const chartProbe = p => `(() => {
  const out = [];
  const EMPTY = ${p.mode === 'empty'};
  const sec = document.querySelector('.qn-scenario');
  if (!sec) return { miss: ['section: .qn-scenario 不存在（盘面没读进来，或那一节没挂上）'] };
  if (EMPTY !== sec.classList.contains('qn-scenario--empty'))
    out.push('mode: 该走' + (EMPTY ? '降级' : '读盘') + '支，屏上却是' + (EMPTY ? '整节矩阵' : '降级卡'));
  const rows = [...sec.querySelectorAll('[data-scenario]')];
  if (rows.length !== ${p.rows.length}) out.push('rows: 场景行=' + rows.length + '（应为 ${p.rows.length}）');
  const names = rows.map(r => r.getAttribute('data-scenario'));
  (${JSON.stringify(p.rows)}).forEach(x => { if (names.indexOf(x) < 0) out.push('缺行:' + x); });
  if (EMPTY) {
    const a = [...sec.querySelectorAll('a')].find(x => (x.getAttribute('href') || '').indexOf('/create') === 0);
    if (!a) out.push('降级分支缺 /create 入口');
  }
  const conv = rows.filter(r => ((r.querySelector('.qn-badge') || {}).textContent || '').indexOf('本站约定') >= 0).length;
  if (conv !== ${p.conventionRows}) out.push('约定行=' + conv + '（应为 ${p.conventionRows}）');
  const cang = rows.reduce((n, r) => n + [...r.querySelectorAll('li')].filter(li => (li.textContent || '').indexOf('藏干') >= 0).length, 0);
  if (cang < ${p.minCangGan}) out.push('藏干命中=' + cang + '（引擎给 shiShen、types 里写的 tenGod 不存在，读错键就是这里归零）');
  const secTxt = (sec.innerText || '').replace(/\\s+/g, '');
  (${JSON.stringify(p.text)}).forEach(x => { if (secTxt.indexOf(x.replace(/\\s+/g, '')) < 0) out.push('text:' + x); });
  // 四柱必须在盘上（不只在矩阵里）：这一条钉的是「注入的 fixture 真被应用读成了一张盘」。
  const page = (document.body.innerText || '').replace(/\\s+/g, '');
  (${JSON.stringify(p.pillars)}).forEach(x => { if (page.indexOf(x) < 0) out.push('四柱缺:' + x); });
  (${JSON.stringify(p.absent)}).forEach(x => { if (page.indexOf(x) >= 0) out.push('不该上屏:' + x); });
  return { miss: out, rows: names.length, conv, cang };
})()`;

// K线的探针按结构读：运段 chip 数、年份刻度、十条泳道、以及每条泳道"哪些年份被点亮、
// 格子里写的是哪个干支"。手工推的钉值写在 KLINE_PINS 上面，不是从组件或 kline.ts 抄的 ——
// 从自己的输出抄回来，等于让这一节自己证明自己对。
const klineProbe = p => `(() => {
  const out = [];
  const sec = document.querySelector('.qn-kline');
  if (!sec) return { miss: ['section: .qn-kline 不存在（那一节没挂上，或盘没读进来）'] };
  const EMPTY = ${p.mode === 'empty'};
  // 真盘（--chart-id）模式：手工逐格钉值是这张 fixture 盘的，不该拿它去判别人的盘。
  // 这一模式只测结构 —— 十条泳道固定、每道格子数等于年份刻度数、声明句照旧上屏。
  const LIVE = ${p.mode === 'live'};
  if (EMPTY !== sec.classList.contains('qn-kline--empty'))
    out.push('mode: 该走' + (EMPTY ? '降级' : '排图') + '支，屏上却是' + (EMPTY ? '整张泳道图' : '降级卡'));
  // 运段那一排与年票那一排都是 .qn-chip 按钮（#88 之后），按类名数会把两排数成一排。
  // 所以钉 data-seg：数量、顺序、哪一个点亮，都只说运段。
  const chips = [...sec.querySelectorAll('button[data-seg]')].length;
  if (!LIVE && chips !== ${p.segments}) out.push('segments: 运段 chip=' + chips + '（应为 ' + ${p.segments} + '）');
  const ticks = [...sec.querySelectorAll('[data-tick]')].map(b => b.getAttribute('data-tick').slice(2));
  if (!LIVE && JSON.stringify(ticks) !== JSON.stringify(${JSON.stringify(p.years)}))
    out.push('ticks: 年份刻度=' + JSON.stringify(ticks) + '（应为 ' + JSON.stringify(${JSON.stringify(p.years)}) + '）');
  let tapFacts = null;
  // #88（2026-10-19）：选年只剩年票这一条路，格子改只读。三件事必须钉在 DOM 上，
  // 不能只看组件源码 —— 源码里没写 onClick 不等于屏上不是个 button（还能 Tab 到）。
  if (!EMPTY) {
    const cellSel = 'td[data-lane][data-year]';
    const cellEls = [...sec.querySelectorAll(cellSel)];
    if (!cellEls.length) out.push('cells: 一个只读格子都没找到（选择器 ' + cellSel + ' 失效，格子这条审不了）');
    const asControl = cellEls.filter(c => /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(c.tagName));
    const withClick = cellEls.filter(c => c.hasAttribute('onclick') || c.getAttribute('role') === 'button');
    const focusable = cellEls.filter(c => c.getAttribute('tabindex') !== null && c.getAttribute('tabindex') !== '-1');
    if (asControl.length) out.push('cell/readonly: ' + asControl.length + ' 个格子仍是可点元素 '
      + [...new Set(asControl.map(c => c.tagName))].join('/') + '（裁定：格子只读、不进 Tab 焦点序）');
    if (withClick.length) out.push('cell/no-click: ' + withClick.length + ' 个格子带 onclick 或 role=button');
    if (focusable.length) out.push('cell/taborder: ' + focusable.length + ' 个格子被显式给了 Tab 焦点');
    // 只读≠不可读：表格语义要在，且列头/行头齐（屏幕阅读器念一格得念出哪一年、哪一道）。
    const table = sec.querySelector('table');
    if (!table) out.push('cell/semantics: 格子的容器不是 <table>，屏幕阅读器念不出「年 × 十神」');
    else {
      const colHeads = [...table.querySelectorAll('thead th[scope="col"]')].length;
      const rowHeads = [...table.querySelectorAll('tbody th[scope="row"]')].length;
      const perRow = cellEls.length / Math.max(rowHeads, 1);
      if (colHeads !== ticks.length + 1)
        out.push('cell/semantics: 列头 ' + colHeads + ' 个，年份刻度 ' + ticks.length
          + ' 个（列头应为年份＋左上角那格）');
      const laneNames = [...new Set([...sec.querySelectorAll('span[data-lane]')].map(s => s.getAttribute('data-lane')))];
      if (rowHeads !== laneNames.length)
        out.push('cell/semantics: 行头 ' + rowHeads + ' 个，屏上泳道 ' + laneNames.length + ' 条（每条道应有一个 scope=row）');
      if (rowHeads && perRow !== ticks.length)
        out.push('grid: 每行 ' + perRow + ' 格，年份刻度却有 ' + ticks.length + ' 个（列不对齐）');
    }
    // 年票：≥44×44 是裁定的硬数，且它是唯一的选年入口。
    const yearChips = [...sec.querySelectorAll('button[data-tick]')];
    if (!yearChips.length) out.push('year/chip: 没有 button[data-tick] —— 选年这条路整个没了');
    const small = yearChips.filter(c => { const r = c.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
      .map(c => Math.round(c.getBoundingClientRect().width * 10) / 10 + 'x'
        + Math.round(c.getBoundingClientRect().height * 10) / 10 + '(' + c.textContent.trim() + ')');
    if (small.length) out.push('year/chip: ' + small.length + '/' + yearChips.length
      + ' 个年票不足 44×44：' + small.slice(0, 4).join(' '));
    const wrapped = yearChips.length > 1
      && new Set(yearChips.map(c => Math.round(c.getBoundingClientRect().top))).size > 1;
    const rail = yearChips.length ? yearChips[0].parentElement : null;
    if (rail && rail.scrollWidth > rail.clientWidth + 1)
      out.push('year/chip: 年票那排横向溢出（' + Math.round(rail.scrollWidth) + '>'
        + Math.round(rail.clientWidth) + 'px），裁定要求换行而不是横向滚动');
    tapFacts = { cells: cellEls.length, cellInteractive: asControl.length + withClick.length + focusable.length,
      chips: yearChips.length, chipsSmall: small.length, wrapped, table: !!table };
  }
  const lanes = [...new Set([...sec.querySelectorAll('span[data-lane]')].map(s => s.getAttribute('data-lane')))];
  if (JSON.stringify(lanes) !== JSON.stringify(${JSON.stringify(p.lanes)}))
    out.push('lanes: 泳道=' + JSON.stringify(lanes) + '（应为固定十条、顺序即命名序）');
  const cells = ${JSON.stringify(Object.keys(p.cells))};
  const filled = {};
  const text = {};
  cells.forEach(l => {
    // 格子自 #88 起是 <td>（只读），不再是 button。这里跟着换，否则选择器落空、
    // 逐格钉值会静默变成「一条都没比对」。
    const cs = [...sec.querySelectorAll('td[data-lane="' + l + '"]')];
    filled[l] = cs.filter(c => (c.textContent || '').trim() !== '·').map(c => c.getAttribute('data-year'));
    text[l] = cs.filter(c => (c.textContent || '').trim() !== '·').map(c => (c.textContent || '').trim());
  });
  const want = ${JSON.stringify(p.cells)}, wantText = ${JSON.stringify(p.cellText)};
  cells.forEach(l => {
    if (JSON.stringify(filled[l]) !== JSON.stringify(want[l]))
      out.push('cells[' + l + ']: 点亮年=' + JSON.stringify(filled[l]) + '（手工推应为 ' + JSON.stringify(want[l]) + '）');
    else if (JSON.stringify(text[l]) !== JSON.stringify(wantText[l]))
      out.push('cells[' + l + ']: 格子写的=' + JSON.stringify(text[l]) + '（手工推应为 ' + JSON.stringify(wantText[l]) + '）');
  });
  // 原 LIVE 模式专属的「列不对齐」这条并到上面 cell/semantics 的 perRow 里：
  // 同一条事实（每行格数 == 年份刻度数）现在三种模式都审，不再只在真盘那一路审。
  const secTxt = (sec.innerText || '').replace(/\\s+/g, '');
  // 落点的期望值是手工推的（写在 KLINE_PINS 上面的注释里），且是"屏上这一帧真的印出了
  // 这几行、各几行"—— 不是拿 kline.ts 的输出比它自己。
  const LAND = ${p.land ? 'true' : 'false'};
  if (LAND) {
    const flat = (sec.innerText || '').replace(/\\s+/g, '');
    (${JSON.stringify((p.land && p.land.has) || [])}).forEach(x => {
      if (flat.indexOf(x.replace(/\\s+/g, '')) < 0) out.push('落点缺条：' + x);
    });
    const lcounts = ${JSON.stringify((p.land && p.land.counts) || {})};
    for (const lkey of Object.keys(lcounts)) {
      const lgot = flat.split(lkey.replace(/\\s+/g, '')).length - 1;
      if (lgot !== lcounts[lkey]) out.push('落点数「' + lkey + '」=' + lgot + '（手工推应为 ' + lcounts[lkey] + '）');
    }
  }
  (${JSON.stringify(p.text)}).forEach(x => { if (secTxt.indexOf(x.replace(/\\s+/g, '')) < 0) out.push('text:' + x); });
  if (EMPTY) {
    const a = [...sec.querySelectorAll('a')].find(x => (x.getAttribute('href') || '').indexOf('/create') === 0);
    if (!a) out.push('降级分支缺 /create 入口');
    if (sec.querySelector('[data-lane]')) out.push('降级分支里还画着泳道格子');
  }
  return { miss: out, chips, lanes: lanes.length, filled, tapFacts };
})()`;

// 户型规则层那一块是否真的上了屏（注意 \\s：这是普通模板串，写一个反斜杠会被吃掉）。
const FS_PROBE = `(() => {
  const sec = [...document.querySelectorAll('section')].find(s => /规则层结果/.test(s.innerText || ''));
  if (!sec) return { miss: ['勾了确认、点了"算一遍"之后没有出现规则层结果那一块'] };
  const txt = (sec.innerText || '').replace(/\\s+/g, '');
  const out = [];
  if (!/fengshui-geometry-v\\d/.test(txt)) out.push('结果块里没有口径戳');
  if (!/依据：/.test(txt)) out.push('判定没有带「依据：」');
  if (!/说不准的：/.test(txt)) out.push('判定没有带「说不准的：」');
  if (!/不是方位吉凶/.test(txt)) out.push('没有声明这些不是方位吉凶');
  if (/已开放|进入/.test(txt)) out.push('结果块里出现了入口/推销字样（这一页只出判定）');
  return { miss: out, chars: txt.length };
})()`;

// 识别三态的钉值。
// 为什么不只靠验收套件：套件在 node 里喂 JSON，能证明解析对不对；但"页面收到 503 之后
// 到底有没有说人话、到底有没有自己再打第二次"只有真浏览器里点一次才知道。
// calls=1 这一条是不自动重试的**测量**，不是源码 grep —— grep 挡不住 setTimeout 循环。
const FS_RECOGNIZE_PINS = {
  'fengshui-recognize-fail': {
    state: '失败', line: '识别：失败', calls: 1, plan: false,
    must: ['HTTP 503', 'provider_error', '不会自动重试', '这条不装作成功', '还没有几何'],
    not: ['候选已载入', '墙 2 道'],
  },
  'fengshui-recognize-candidates': {
    state: '候选待确认', line: '墙 2 道 · 房间 2 间 · 门 1 · 窗 1 · 跨度按 9m', calls: 1, plan: true,
    must: ['每一项都要你逐条确认', '长边按 9m 估', '请在俯视图里拖角点对一下',
      '模型把握：未给出（0.5 是占位值，不是精确读数）', '模型把握：偏高',
      // 这一条是 aspect 的浏览器侧证据：fixture 是 200×100（2:1），两轴同缩会得到 33×31，
      // 分轴缩才是 33×16。图一旦解不出来（上一版就是这样）这里立刻红。
      '可行走网格 33×16 格'],
    unconfirmed: 2, disabled3d: true,
    ct: 'application/json', keys: 'imageBase64,visitorId', b64Head: 'data:image/png;base64,', visitor: 'v_',
    // 门+窗=2 时那条"请手动补"不许出现（它是给 0 门窗准备的）；空态话术也必须已经退场。
    not: ['还没有几何', '请手动补'],
  },
};
const fsRecognizeProbe = p => `(() => {
  // 选择器里必须带 span.qn-meta：置信度那一行是 <span class="qn-meta">，只收 p 的话
  // 页面上真实存在的文案会被判"找不到"，而这种假红最费人（它会指向错的那一层）。
  const txt = [...document.querySelectorAll('p.qn-alert, p.qn-meta, p.qn-note, span.qn-meta')]
    .map(x => (x.innerText || '').replace(/\\s+/g, ' ').trim()).join(' | ');
  const st = document.getElementById('fp-recognize-state');
  const chip = t => [...document.querySelectorAll('.qn-chip')].filter(b => (b.textContent || '').trim() === t);
  // 「未确认」必须只在门窗那一格里数：这一页下面还收着一份降级用的九宫格表单（藏在
  // 折叠的 <details> 里），它自己也有一个 朝向=未确认 的 chip。闭合的 details 仍然在 DOM 里，
  // 不划界就会数到 3 个 —— 这种假红会把人引向"识别多回来一条门窗"那个根本不存在的错。
  const cardChips = t => [...document.querySelectorAll('#fp-openings .qn-chip')].filter(b => (b.textContent || '').trim() === t);
  const out = [];
  if (!st) out.push('识别状态那一行不在页面上（#fp-recognize-state）—— 三态没有可见落点');
  const got = {
    state: st ? st.getAttribute('data-recognize-state') : null,
    line: st ? (st.innerText || '').replace(/\\s+/g, ' ').trim() : null,
    calls: window.__recCalls || 0, req: window.__recReq || null,
    unconfirmed: cardChips('未确认').length,
    chips: [...document.querySelectorAll('.qn-chip')].map(b => (b.textContent || '').trim()).join(','),
    disabled3d: (() => { const b = chip('3D')[0]; return b ? b.disabled : null; })(),
    plan: !!document.querySelector('#fp-confirm'),
    chars: txt.length,
  };
  if (got.state !== ${JSON.stringify(p.state)}) out.push('识别态应为 ${p.state}，实为 ' + got.state);
  if (!got.line || !got.line.includes(${JSON.stringify(p.line)})) out.push('状态行缺「${p.line}」');
  if (got.calls !== ${p.calls}) out.push('识别请求打了 ' + got.calls + ' 次，钉的是 ${p.calls} 次（多于 1 次就是自动重试）');
  if (got.plan !== ${p.plan}) out.push('确认勾与编辑区出现=' + got.plan + '，钉的是 ${p.plan}');
  ${p.must ? `for (const s of ${JSON.stringify(p.must)}) if (!txt.includes(s)) out.push('页面上找不到「' + s + '」');` : ''}
  ${p.not ? `for (const s of ${JSON.stringify(p.not)}) if (txt.includes(s)) out.push('页面上不该出现「' + s + '」');` : ''}
  ${p.unconfirmed !== undefined ? `if (got.unconfirmed !== ${p.unconfirmed}) out.push('未确认的开口 chip 应有 ${p.unconfirmed} 个，实得 ' + got.unconfirmed + '（识别回来的每一条都必须从待确认起步）');` : ''}
  ${p.disabled3d !== undefined ? `if (got.disabled3d !== ${p.disabled3d}) out.push('3D chip 的 disabled 应为 ${p.disabled3d}，实得 ' + got.disabled3d);` : ''}
  ${p.ct ? `if (!got.req || got.req.ct !== ${JSON.stringify(p.ct)}) out.push('请求 Content-Type 应为 ${p.ct}，实得 ' + (got.req && got.req.ct));` : ''}
  ${p.keys ? `if (!got.req || got.req.keys !== ${JSON.stringify(p.keys)}) out.push('请求体键应为 ${p.keys}，实得 ' + (got.req && got.req.keys));` : ''}
  ${p.b64Head ? `if (!got.req || got.req.b64Head !== ${JSON.stringify(p.b64Head)}) out.push('imageBase64 应以 ${p.b64Head} 开头，实得 ' + (got.req && got.req.b64Head));` : ''}
  ${p.visitor ? `if (!got.req || got.req.visitor !== ${JSON.stringify(p.visitor)}) out.push('visitorId 应以 ${p.visitor} 开头，实得 ' + (got.req && got.req.visitor));` : ''}
  return { miss: out, ...got };
})()`;

// 主题钉值（纠正一）。正向：/western 的 main 计算背景/正文色/卡片底必须等于裁定给的深紫 token，
// 且 color-scheme 是 dark。反向：东方、目录、建盘这三页必须还是浅底（正文是深色）。
// 两边都得算数 —— 只钉正向的话，"整套 token 被误挂到 :root"这种事故会把所有页面都染紫，
// 而截图对比不一定看得出（浅底页本来就白），只有反向断言能抓住。
const WESTERN_DARK = { bg: 'rgb(27, 16, 48)', text: 'rgb(243, 238, 255)', card: 'rgb(36, 26, 61)' };
const THEME_STATES = {
  western: 'dark', 'western-ask': 'dark',
  oriental: 'light', tools: 'light', create: 'light', fengshui: 'light', home: 'gate',
};
const themeProbe = kind => `(() => {
  const main = document.querySelector('main');
  if (!main) return { miss: ['没有 <main>，主题断言没地方落'] };
  const lum = s => { const m = String(s).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); if (!m) return null;
    const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    const [r, g, b] = [+m[1], +m[2], +m[3]].map(v => f(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cs = getComputedStyle(main), bs = getComputedStyle(document.body);
  const card = main.querySelector('.qn-card');
  const got = { mainBg: cs.backgroundColor, color: cs.color, bodyBg: bs.backgroundColor,
    scheme: cs.colorScheme, cardBg: card ? getComputedStyle(card).backgroundColor : null,
    bodyLum: Math.round(lum(bs.backgroundColor) * 1000) / 1000,
    colorLum: Math.round(lum(cs.color) * 1000) / 1000 };
  const out = [];
  const W = ${JSON.stringify(WESTERN_DARK)};
  if (${JSON.stringify(kind)} === 'dark') {
    if (got.mainBg !== W.bg) out.push('main 背景 ' + got.mainBg + ' 应为 ' + W.bg);
    if (got.color !== W.text) out.push('main 正文色 ' + got.color + ' 应为 ' + W.text);
    if (got.cardBg !== W.card) out.push('.qn-card 底 ' + got.cardBg + ' 应为 ' + W.card);
    if (got.bodyBg !== W.bg) out.push('body 背景 ' + got.bodyBg + ' 应为 ' + W.bg + '（body:has 那条没生效会白闪）');
    if (got.scheme !== 'dark') out.push('color-scheme 是 ' + got.scheme + '，深底页应为 dark（原生控件与滚动条跟着走）');
  } else if (${JSON.stringify(kind)} === 'light') {
    if (got.bodyLum < 0.5) out.push('body 亮度 ' + got.bodyLum + ' —— 浅底页被深紫污染了');
    if (got.colorLum > 0.5) out.push('正文亮度 ' + got.colorLum + ' —— 浅底页上正文变成了浅色');
    if (got.mainBg === W.bg || got.cardBg === W.card) out.push('深紫 token 漏到了这一页（mainBg=' + got.mainBg + ' cardBg=' + got.cardBg + '）');
  } else {
    // 门廊：本体浅底，两张卡一浅一深 —— "两扇门"就是这个意思
    if (got.bodyLum < 0.5) out.push('门廊本体不该是深底（body 亮度 ' + got.bodyLum + '）');
    const cards = [...main.querySelectorAll('a.domain-card')].map(c => {
      const s = getComputedStyle(c);
      return { mode: c.getAttribute('data-mode'), lum: Math.round(lum(s.backgroundColor) * 1000) / 1000 };
    });
    const w = cards.find(c => c.mode === 'western'), o = cards.find(c => c.mode === 'oriental');
    if (!w || !o) out.push('门廊两张卡没找全：' + JSON.stringify(cards));
    else if (!(w.lum < 0.5 && o.lum > 0.5)) out.push('门廊应当"东方浅、西方深"，实得 ' + JSON.stringify(cards));
    got.cards = cards;
  }
  return { miss: out, ...got };
})()`;

// 静态稿那三态在真盘上的对应物：default（刚加载）→ hover（CDP 真指针挪进栏里）→
// focus-visible（真键盘 Tab 进去）。两件事必须说清：
//  - el.focus() 不会点亮 :focus-visible，只有键盘导航会；所以这里一发一发按 Tab。
//  - 悬停态的文字对比度要拿**合成后的底**再算一次：叠层一亮，浅底变亮、墨底变暖，
//    这正是 ④ 禁 filter:brightness() 的原因 —— 那种改法这一层读不到，也就骗过了判定。
const OUTLINE_EAST = 'rgb(122, 95, 49)';    // --color-accent-gold-text #7a5f31
const OUTLINE_INK = 'rgb(227, 205, 150)';   // --color-accent-gold-on-ink #e3cd96（裁定③：深底用这一支）
async function gateInteraction(tag) {
  const bad = m => { fail.push(tag + ': ' + m); console.log('    FAIL ' + m); };
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const v0 = await evl(GATE_STATE_PROBE);
  if (!v0 || !Array.isArray(v0.cards) || !v0.cards.length) { bad('门廊两栏一个都没读到（选择器 a.domain-card 失效）'); return; }
  if (v0.cards.length !== 2) bad(`门廊应当恰好两栏，实得 ${v0.cards.length} 栏`);
  for (const c of v0.cards) {
    if (c.nested !== 0) bad(`栏 ${c.href} 里嵌了 ${c.nested} 个可点/可聚焦元素 —— 裁定①要的是整栏只有一个 <a>`);
    if (norm(c.filter) !== 'none') bad(`栏 ${c.href} 上有 filter:${c.filter}：它改渲染结果而不改声明，对比度判定会被骗过（裁定④）`);
    if (c.veilOpacity !== 0) bad(`默认态那一层悬停叠层不该亮着：opacity=${c.veilOpacity}`);
    for (const t of c.worst) if (!t.ok) bad(`AA(栏) ${t.ratio} ${t.size}px/${t.weight} ${t.fg} on ${t.ground} "${t.text}"`);
    // 那行数（形状 + 三档相加）不在这里判 —— 它在 check() 里由 firstScreen 那份读数判，
    // 两处各判一次就会在两处各漂一次。
  }
  const rects = await evl(`[...document.querySelectorAll('a.domain-card')].map(c => { const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), mode: c.getAttribute('data-mode') }; })`);
  // 悬停只在"这一轮模拟的是能悬的指针"时跑：触屏下 (hover: none)，:hover 本来就不该有读数，
  // 硬跑会把一条不存在的要求量成红。跳过要打印，不许静默。
  if (TOUCH) {
    console.log('    SKIP hover：本轮是触屏档（hover:none），悬停态只在桌面档量');
  } else if (rects && rects.length >= 2) {
    for (const r of rects) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, button: 'none' });
      await sleep(300);   // 叠层过渡 0.18s，等它亮到位再读，否则读到的是中间帧
      const hv = await evl(GATE_STATE_PROBE);
      const c = hv && hv.cards.find(x => x.mode === r.mode);
      if (!c) { bad(`悬停后读不到 ${r.mode} 栏`); continue; }
      if (!(c.veilOpacity > 0 && c.veilOpacity <= 0.08)) bad(`${r.mode} 栏悬停叠层 opacity=${c.veilOpacity}，应在 (0, .08]：要么没亮，要么亮过头`);
      if (norm(c.filter) !== 'none') bad(`${r.mode} 栏悬停用了 filter:${c.filter}（裁定④禁的是这个，不是叠层）`);
      const lit = c.worst.filter(t => !t.ok);
      for (const t of lit) bad(`悬停后 AA 掉档 ${r.mode}：${t.ratio} ${t.size}px ${t.fg} on ${t.ground} "${t.text}"`);
      console.log(`    HOVER[${r.mode}] veil=${c.veilOpacity} 底=${c.ground}→合成=${c.worst[0] && c.worst[0].ground} 最差=${Math.min(...c.worst.map(t => t.ratio || 99))}:1`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, button: 'none' });
      await sleep(240);
    }
    const off = await evl(GATE_STATE_PROBE);
    for (const c of off.cards) if (c.veilOpacity !== 0) bad(`${c.mode} 栏指针移开后叠层还亮着：opacity=${c.veilOpacity}`);
  } else bad('悬停找不到两栏的中心点（rects=' + JSON.stringify(rects) + '）');
  // 键盘：Tab 一发一发按，把两栏都走一遍（导航在前，所以要按若干下）。
  // 两栏各自都要钉一次：只验第一栏的话，"深底那一支焦点环"这条裁定就永远没被量过。
  const focusSeen = {};
  for (let i = 0; i < 24 && Object.keys(focusSeen).length < 2; i++) {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', text: '\t',
        windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    }
    await sleep(60);
    const landed = await evl(`(() => { const a = document.activeElement; if (!a) return null;
      const c = a.closest ? a.closest('a.domain-card') : null; if (!c) return null;
      const cs = getComputedStyle(c);
      const lum = s => { const m = String(s).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); if (!m) return null;
        const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        return 0.2126 * f(+m[1] / 255) + 0.7152 * f(+m[2] / 255) + 0.0722 * f(+m[3] / 255); };
      // 焦点环的对比度必须**在这一拍**算：焦点一移开，outline 就不再是 :focus-visible 那一条了，
      // 下一发 evl 读到的会是没聚焦时的样式，那个数没有任何意义。
      const x = lum(cs.outlineColor), y = lum(cs.backgroundColor);
      return { mode: c.getAttribute('data-mode'), focusVisible: c.matches(':focus-visible'),
        outline: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor].join('|'), ground: cs.backgroundColor,
        ratio: (x === null || y === null) ? null : Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100 }; })()`);
    if (landed && !focusSeen[landed.mode]) focusSeen[landed.mode] = landed;
  }
  const modes = Object.keys(focusSeen);
  if (!modes.length) bad('按了 24 下 Tab 也没把焦点送进任何一栏 —— 两栏不可键盘到达');
  else {
    if (modes.length < 2) bad(`键盘只到得了 ${modes.join('/')}，两栏都该 Tab 得到`);
    for (const mode of modes) {
      const landed = focusSeen[mode];
      const [style, width, color] = landed.outline.split('|');
      if (!landed.focusVisible) bad(`${mode} 栏拿到了焦点但 :focus-visible 没点亮 —— 判定读到的那圈描边不是用户看到的`);
      if (style !== 'solid') bad(`${mode} 栏焦点环是 ${style}，应为 solid`);
      if (!(parseFloat(width) >= 2)) bad(`${mode} 栏焦点环宽 ${width}，应 ≥2px`);
      const want = mode === 'western' ? OUTLINE_INK : OUTLINE_EAST;
      if (norm(color) !== want) bad(`${mode} 栏焦点环是 ${color}，裁定③要的是 ${want}（墨底用 #e3cd96，浅底用 #7a5f31）`);
      if (landed.ratio === null) bad(`${mode} 栏焦点环对比度算不出来（颜色解析失败）`);
      else if (landed.ratio < 3) bad(`${mode} 栏焦点环对底只有 ${landed.ratio}:1，非文本下限 3:1`);
      console.log(`    FOCUS[${mode}] ${landed.outline} 对底 ${landed.ratio}:1`);
    }
  }
  await evl('document.activeElement && document.activeElement.blur && document.activeElement.blur(); true');
}

// 状态圆点的对比度（裁定 ⑤ 的另一半）。钉的是**屏上真渲出来的那个点**：
// 源码里 var() 指对了、但落到底不是量过的那一块，照样掉下 3:1；西方那一档原来更狠 ——
// 它 var() 的是一支全站从没定义过的令牌，于是安静地画成近乎透明。
// 下限 3:1（非文本），并且每个徽章必须带文字：只靠颜色区分状态，色觉之外的人就读不到。
const DOT_STATES = { tools: 'three', western: 'one' };
const dotProbe = want => `(() => {
  const lum = s => { const m = String(s).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/); if (!m) return null;
    const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    const a = m[4] === undefined ? 1 : +m[4];
    return { l: 0.2126 * f(+m[1] / 255) + 0.7152 * f(+m[2] / 255) + 0.0722 * f(+m[3] / 255), a }; };
  // 底：沿祖先找第一层不透明背景色。徽章与它那块卡都是实色，没算渐变层
  // （要算的那一类由主审计的 bgSet 负责，这里不重复一套口径）。
  const ground = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor || ''; const L = lum(c);
      if (L && L.a > 0.9) return c; }
    return 'rgb(255, 255, 255)'; };
  const ratio = (fg, bg) => { const x = lum(fg), y = lum(bg); if (!x || !y) return null;
    return Math.round(((Math.max(x.l, y.l) + 0.05) / (Math.min(x.l, y.l) + 0.05)) * 100) / 100; };
  const out = []; const seen = {};
  const dots = [...document.querySelectorAll('.qn-badge__dot')];
  for (const d of dots) {
    const cs = getComputedStyle(d);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.1 || !d.getClientRects().length) continue;
    const g = ground(d.parentElement);
    const r = ratio(cs.backgroundColor, g);
    const badge = d.closest('.qn-badge');
    const label = ((badge && badge.innerText) || '').replace(/\\s+/g, '').trim();
    seen[label] = (seen[label] || 0) + 1;
    if (!(cs.borderRadius || '').startsWith('5')) out.push('圆点不是圆点（border-radius=' + cs.borderRadius + '）');
    const size = Math.round(parseFloat(cs.width) * 10) / 10;
    if (!(size >= 6 && size <= 10)) out.push('点径 ' + size + 'px，不在 6–10 那一档');
    if (r === null) out.push('颜色算不出来（探针解析失败） on ' + g);
    else if (r < 3) out.push(label + ' 点 ' + r + ':1 < 3:1（' + cs.backgroundColor + ' on ' + g + '）');
    if (!/可用|未开放/.test(label)) out.push('徽章没有文字，只有颜色：' + JSON.stringify(label));
  }
  const miss = [...new Set(out)];
  const kinds = Object.keys(seen);
  if (!dots.length) miss.push('这一页一个状态徽章都没有（.qn-badge__dot = 0）—— 这一态从未被测到，不是通过');
  else if ('${want}' === 'three' && kinds.length < 3) miss.push('三档状态没集齐，实得 ' + kinds.join('/'));
  return { miss, n: dots.length, kinds: seen };
})()`;

// 门廊两栏的悬停与焦点。为什么必须走 CDP 真指针 / 真键盘：
// :hover 与 :focus-visible 都不是能"设"出来的状态，el.focus() 也不会点亮 focus-visible，
// 用 JS 直接把样式写上去等于自测一张自己画的假状态。
const GATE_STATE_PROBE = `(() => {
  const cards = [...document.querySelectorAll('a.domain-card')];
  const lum = s => { const m = String(s).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/); if (!m) return null;
    const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    return { l: 0.2126 * f(+m[1] / 255) + 0.7152 * f(+m[2] / 255) + 0.0722 * f(+m[3] / 255), a: m[4] === undefined ? 1 : +m[4] }; };
  const over = (fg, bg) => { const x = lum(fg), y = lum(bg); if (!x || !y) return null;
    return Math.round(((Math.max(x.l, y.l) + 0.05) / (Math.min(x.l, y.l) + 0.05)) * 100) / 100; };
  // 前景合成：veil 压在栏底上，文字读到的底是合成后的那一块，不是 var() 里那个原始值。
  // alpha 用叠层自己的 computed opacity 乘上去 —— 这正是裁定④要的东西：叠层能被读出来，
  // filter:brightness() 就读不出来（它改的是渲染结果，不改声明）。
  const mix = (top, alpha, bottom) => {
    const m = String(top).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    const n = String(bottom).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m || !n) return bottom;
    const ch = i => Math.round(+m[i] * alpha + +n[i] * (1 - alpha));
    return 'rgb(' + [ch(1), ch(2), ch(3)].join(', ') + ')';
  };
  return {
    cards: cards.map(c => {
      const cs = getComputedStyle(c);
      const veil = c.querySelector('.domain-card__veil');
      const vcs = veil ? getComputedStyle(veil) : null;
      const alpha = vcs ? +vcs.opacity : 0;
      const ground = alpha > 0 ? mix(vcs.backgroundColor, alpha, cs.backgroundColor) : cs.backgroundColor;
      const texts = [...c.querySelectorAll('p,h1,h2,span')].filter(e => (e.innerText || '').trim().length
        && !e.querySelector('p,h1,h2,span')).map(e => {
        const t = getComputedStyle(e);
        const px = parseFloat(t.fontSize);
        return { text: (e.innerText || '').replace(/\\s+/g, '').slice(0, 14), size: px, weight: +t.fontWeight,
          fg: t.color, ground, ratio: over(t.color, ground) }; });
      return { mode: c.getAttribute('data-mode'), href: c.getAttribute('href'),
        rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }))(c.getBoundingClientRect()),
        ground: cs.backgroundColor, filter: cs.filter, veilOpacity: vcs ? +vcs.opacity : null,
        veilColor: vcs ? vcs.backgroundColor : null,
        outline: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor],
        nested: c.querySelectorAll('a,button,input,select,textarea,[tabindex],[role=button]').length,
        focusVisible: c.matches(':focus-visible'),
        tally: ((c.querySelector('.domain-card__tally') || {}).innerText || '').replace(/\\s+/g, ' ').trim(),
        worst: texts.map(t => ({ ...t, ok: t.ratio !== null && (t.size >= 24 || (t.size >= 19 && t.weight >= 700) ? t.ratio >= 3 : t.ratio >= 4.5) })) };
    }),
    active: document.activeElement ? document.activeElement.className : '',
  };
})()`;

// 纠正一还有一句「全部走变量，禁止硬编码色」。这一条只能静态查：计算样式分不出
// "这个 rgb 是写死的还是 token 展开的"，浏览器里看到的一切都一样。
// 扫之前必须剥掉 /* */ —— 注释里就出现过 #fff（"输入框写死了浅色值"那句正是拿它举例），
// 不剥就是模块咬自己的断言（这个坑本站已经踩到第三次）。
function cssTokenAudit() {
  const file = join(import.meta.dirname, '..', '..', 'frontend', 'app', 'globals.css');
  let css;
  try { css = readFileSync(file, 'utf8'); }
  catch (e) { return ['globals.css 读不到，token 纪律没法查：' + e.message]; }
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const scope = /\[data-mode="western"\][^{}]*\{([^}]*)\}/g;
  let m, n = 0;
  while ((m = scope.exec(stripped))) {
    n++;
    const lit = m[1].match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g);
    if (lit) out.push(`western 作用域第 ${n} 条规则里写死了色 ${JSON.stringify([...new Set(lit)])}，应改成 var(--color-western-*)`);
  }
  if (n === 0) out.push('一条 [data-mode="western"] 规则都没找到 —— 深紫主题没了，还是选择器改名了？');
  // 定义了却没人消费的 token = 那条改色根本没落地（真正的"漏"长这个样子，不是长得不对）。
  const declared = new Set([...stripped.matchAll(/(--color-western-[\w-]+)\s*:/g)].map(x => x[1]));
  const used = new Set([...stripped.matchAll(/var\((--color-western-[\w-]+)\)/g)].map(x => x[1]));
  for (const t of declared) if (!used.has(t)) out.push(`token ${t} 定义了但没有任何规则 var() 它`);
  return out;
}

// 问事框答完之后那一帧的读数：回答卡、卡上的入口、入口是否出自目录。
const qaProbe = p => `(() => {
  const turns = [...document.querySelectorAll('.qa-turn')];
  if (!turns.length) return { miss: ['提交了问题却一个回答卡都没渲染（.qa-turn = 0）—— 这一态从未到位'] };
  const t = turns[0];
  const txt = (t.innerText || '').replace(/\\s+/g, '');
  const out = [];
  (${JSON.stringify(p.mustSay)}).forEach(x => { if (txt.indexOf(x.replace(/\\s+/g, '')) < 0) out.push('回答里缺这句：' + x); });
  (${JSON.stringify(p.absent || [])}).forEach(x => { if (txt.indexOf(x.replace(/\\s+/g, '')) >= 0) out.push('回答里出现了不该有的：' + x); });
  const links = [...t.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim() }));
  const allow = ${JSON.stringify(CATALOG_HREFS)};
  links.filter(l => !allow.includes(l.href)).forEach(l => out.push('入口不在目录里：' + l.href));
  if (${JSON.stringify(p.entry || null)}) {
    const want = ${JSON.stringify(p.entry || null)};
    const hit = links.find(l => l.href === want.href && l.text.replace(/\\s+/g, '') === want.text.replace(/\\s+/g, ''));
    if (!hit) out.push('该给的入口没给（要 ' + want.href + ' ' + want.text + '，实得 ' + JSON.stringify(links) + '）');
  } else if (links.length) {
    out.push('这一系没有已开放的工具，回答里却出现了入口：' + JSON.stringify(links));
  }
  return { miss: out, links: links.length, chars: txt.length };
})()`;

// ---------------------------------------------------------------- chrome + cdp
// --disable-gpu 下 WebGL 走 SwiftShader（纯 CPU 光栅化），帧率量的是这台机器的 CPU，
// 不是用户的手机。3D 门禁的数字必须带着"哪个渲染器"这个标签才有意义，
// 所以留一个开关：VH_GPU=1 时不传 --disable-gpu，用来对照。
/** 软件光栅化的几种名字。这台 Windows 上 --disable-gpu 给的是
 *  "Microsoft Basic Render Driver"（WARP/CPU），Linux 上是 SwiftShader，Mesa 上是 llvmpipe。
 *  只测 SwiftShader 会漏 —— 实测过：漏了就把 39.2fps 判成产品回归。 */
const SOFTWARE_GL = /swiftshader|basic render driver|llvmpipe|softpipe/i;
const GPU = process.env.VH_GPU === '1';

/** 端口有没有人监听。用 connect 而不是 bind：bind 成功只证明"这个进程"占得住它，
 *  而真正的事故是第二个 census 连进了第一个已经起好的浏览器 —— 那一刻端口恰恰"能连上"。
 *  连上就是证据。 */
const portInUse = (port, host = '127.0.0.1') => new Promise(res => {
  const s = connect({ port, host });
  const done = v => { s.destroy(); res(v); };
  s.setTimeout(700);
  s.once('connect', () => done(true));
  s.once('timeout', () => done(false));
  s.once('error', () => done(false));
});

// 2026-10-20 裁定 ②：并发实例必须拒跑。两个 census 共用一个 CDP 端口时不会报任何错，
// 第二个直接接进第一个的浏览器，于是两边互相把对方导航走、注入脚本互相覆盖，
// 合盘的 sessionStorage 还串了页 —— 我第一次全量跑出 53 条红，全是假的。
// 一次假的红比一次不跑更贵：它会让人去修不存在的产品缺陷。
if (await portInUse(PORT)) {
  console.error(
    `CDP 端口 ${PORT} 上已经有人监听 —— 极可能是另一个 census 实例在跑。\n` +
    '并发不报错，只会出一份看着像证据的假读数（共用同一个浏览器：互相导航 + 存储串页）。\n' +
    `要么等它跑完，要么换端口：--port=${PORT + 1}`);
  process.exit(3);
}

// 每次运行一个独立的临时 profile。不传 --user-data-dir 时 Chrome 用的是这台机器的默认 profile，
// localStorage / cookie（比如 hundun_visitor_id）跨运行相连，
// "这一跑看到的页面"取决于上一跑留下了什么 —— 而同一条命令本该给出可比的对像。
const PROFILE = mkdtempSync(join(tmpdir(), 'hundun-vh-'));
let profileCleaned = false;
/** Windows 上浏览器还没退干净时删目录会 EPERM，所以要给它重试；
 *  真删不掉就把路径打出来（留一地没人认领的临时目录，比一句"删失败"更糟）。 */
const dropProfile = () => {
  if (profileCleaned) return;
  try {
    rmSync(PROFILE, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    profileCleaned = true;
  } catch (e) {
    console.log('  临时 profile 没删掉（可以手动清）：' + PROFILE + ' — ' + e.message);
  }
};
process.on('exit', dropProfile);

// 顺手回收历史遗留：只删 24 小时以前留下的那种目录。当前这一次用的是新建的路径，
// 另一个实例（换了 --port 跑的）用的也是它自己新建的，都不可能被误删。
try {
  const staleCut = Date.now() - 24 * 60 * 60 * 1000;
  for (const d of readdirSync(tmpdir())) {
    if (!d.startsWith('hundun-vh-')) continue;
    const p = join(tmpdir(), d);
    try { if (statSync(p).mtimeMs < staleCut) rmSync(p, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 }); }
    catch { /* 别人的进程还在用、或没权限 —— 跳过就是，回收是尽力而为 */ }
  }
} catch { /* tmpdir 读不了就不回收 */ }

const chrome = spawn(CHROME, ['--headless=new', ...(GPU ? [] : ['--disable-gpu']), '--no-first-run',
  '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' });
chrome.on('error', e => { console.error('cannot start chrome:', e.message, '\nset --chrome=/path/to/chrome'); process.exit(2); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;
for (let i = 0; i < 80 && !page; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = j.find(t => t.type === 'page');
  } catch { /* chrome not up yet */ }
  await sleep(250);
}
if (!page) { console.error('no CDP page target; is chrome installed?'); process.exit(2); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let seq = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise(res => {
  const n = ++seq;
  pending.set(n, msg => res(msg.result ?? { __error: msg.error }));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evl = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
  return r.result?.value;
};

// ---------------------------------------------------------------- boot script
// Paint observers run on every page. The fetch stub is only installed when --stub
// was asked for, so a default run measures the real service.
const OBSERVERS = `(() => {
  window.__vhBooted = 1;
  window.__cls = 0; window.__lcp = null; window.__clsSrc = [];
  try {
    new PerformanceObserver(list => { for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      if (e.value > 0.01 && window.__clsSrc.length < 14) window.__clsSrc.push({
        v: Math.round(e.value * 1000) / 1000, time: Math.round(e.startTime),
        t: (e.sources || []).slice(0, 9).map(s => {
          const n = s.node, o = s.previousRect, x = s.currentRect;
          const d = (o && x) ? 'dy=' + Math.round(x.top - o.top) + ' dx=' + Math.round(x.left - o.left) + ' h=' + Math.round(x.height) : 'inserted/removed';
          const cn = n && n.className ? String(n.className).slice(0, 34) : (n ? n.nodeName : '?');
          return cn + ' ' + d;
        })
      });
    } }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { const a = list.getEntries(); window.__lcp = a[a.length - 1].startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
})()`;

// 识别桩的成功体不在这里抄第二份：读的就是验收套件 cases/ 里那一份。
// 两处各写一遍的话，改了形状只红一边，另一边的绿是假的。
const FS_OK_BODY = readFileSync(join(import.meta.dirname, '..', 'fengshui-acceptance', 'cases', 'recognize-success.json'), 'utf8');

const STUB_BOOT = `(() => {
  const NL = String.fromCharCode(10);
  const MD = ['# 示例报告标题', '', '这是一段用于排版验收的示例正文，字数刻意写得偏长，用来测量小屏上的行数与行高是否仍然落在验收区间之内。', '', '## 第一节 结构', '', '- 第一条列点内容', '- 第二条列点内容稍长，检查在 375 宽度下换行时的悬挂缩进是否对齐', '- 第三条列点内容', '', '> 这是一条引用样式的示例文本。', '', '## 第二节 结构', '', '结尾段落，同样写得长一些，确保它不会被误判为三行以内的短段落，从而暴露出行数上限的问题。'].join(NL);
  // Synthetic fixtures only: no real name, no real birth data, no real chart.
  const mk = (id, type, title, status) => ({ id, userId: 'u_stub', type, title, inputJson: '{}', resultJson: null, analysisJson: null,
    reportText: status === 'FREE' || status === 'UNLOCKED' ? MD : null, previewText: status === 'GENERATING' ? '' : MD,
    status, createdAt: '2026-03-04T10:12:00.000Z', updatedAt: '2026-03-04T10:12:00.000Z' });
  const LIST = [mk('stub-free', 'bazi', '示例命盘 · 双盘合参摘要', 'FREE'), mk('stub-locked', 'ziwei', '示例紫微斗数十二宫报告（较长标题换行测试）', 'LOCKED'),
    mk('stub-generating', 'liuyao', '示例六爻卦象解读', 'GENERATING'), mk('stub-unlocked', 'bazi', '示例已解锁完整报告', 'UNLOCKED'),
    mk('stub-failed', 'liuyao', '示例生成失败报告', 'FAILED')];
  const FIX = Object.fromEntries(LIST.map(r => [r.id, r]));
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
  const of = window.fetch;
  window.fetch = async (u, init) => {
    const url = String(u);
    // 户型识别：三态里两个后端落点都在这儿造。计数是这条规则的重点之一 ——
    // "5xx 不自动重试"光看源码断言不算数，真打一次才知道页面有没有自己循环。
    if (url.includes('/api/fengshui/recognize')) {
      window.__recCalls = (window.__recCalls || 0) + 1;
      try {
        const b = JSON.parse((init && init.body) || '{}');
        window.__recReq = {
          ct: (init && init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || null,
          keys: Object.keys(b).sort().join(','),
          b64Head: String(b.imageBase64 || '').slice(0, 22),
          visitor: String(b.visitorId || '').slice(0, 2),
          bytes: JSON.stringify(b).length,
        };
      } catch (e) { window.__recReq = { err: String(e).slice(0, 60) }; }
      const mode = new URLSearchParams(location.search).get('recognize');
      if (mode === 'ok') return new Response(${JSON.stringify(FS_OK_BODY)}, { status: 200, headers: { 'Content-Type': 'application/json' } });
      return J({ ok: false, code: 'provider_error', message: '所有视觉供应商都失败了：glm-4v:timeout',
        attempts: [{ provider: 'glm-4v', ok: false, ms: 0, error: 'timeout' }] }, 503);
    }
    if (url.includes('/api/chart/result/')) { let p = null; try { p = JSON.parse(sessionStorage.getItem('chart_preview') || 'null'); } catch (e) {}
      return J({ success: true, data: { chartData: p && p.chart, name: p && p.chartName } }); }
    if (url.includes('/api/chart/status/')) return J({ success: true, data: { status: 'done' } });
    // 形状必须照 chart.controller.ts 的 getQuota 原样给：{used:0, remaining:null, limit:null, unlimited:true}。
    // 这里以前给的是 {remaining:3, limit:3} —— 那是桩自己在假装有配额，
    // 于是 D1 那行 UI 在桩下会显示"还可排 3 / 共 3 次"，而线上显示"内测免费"：
    // 同一个组件在两处读到两种事实，harness 就再也证不了任何关于额度的判据。
    if (url.includes('/api/chart/quota')) return J({ success: true, data: { used: 0, remaining: null, limit: null, unlimited: true } });
    if (url.includes('/api/reports?')) return J({ success: true, data: LIST });
    if (url.includes('/api/reports/')) { const k = url.split('/api/reports/')[1].split('?')[0]; return FIX[k] ? J({ success: true, data: FIX[k] }) : J({ success: false, error: '报告不存在' }); }
    // No fixture for this endpoint. Answering success:true + {} made
    // /admin/dashboard read stats.today['page_view'] and throw, i.e. the stub
    // invented a crash the app does not have. Every consumer gates on
    // d.success, so a false envelope puts them on their real "no data" path.
    if (url.includes('/api/')) return J({ success: false, error: 'visual-harness stub: no fixture for ' + url }, 404);
    return of.apply(window, arguments);
  };
})()`;

await send('Page.enable');
await send('Runtime.enable');
// The separator matters: two adjacent IIFEs without one parse as a call chain and
// throw, which silently kills the CLS/LCP observers.
await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB ? OBSERVERS + ';\n' + STUB_BOOT : OBSERVERS });
if (HAS_CHART) {
  // 按 pathname 选盘，选不中就清掉键 —— 否则上一张盘会顺着 sessionStorage 活到下一页，
  // 「完整盘」与「无四柱盘」两张测的其实是同一份内容，census 看不出来。
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{const m=' + JSON.stringify(CHART_BY_PATH) + ';const k=m[location.pathname];' +
      'if(k)sessionStorage.setItem("chart_preview",k);' +
      'else if(/^\\/chart\\/result\\//.test(location.pathname))sessionStorage.removeItem("chart_preview");}catch(e){}',
  });
}
// 合盘的对方数据活在本机，一张 Chrome 连跑十几个态时它也会顺着 sessionStorage 串页：
// 第一次把"并排对照"点出来之后，后面每一态的合盘节都从表单态变成已填态，
// 而 chart-result 那几态的截图与 44px 读数就再也不是同一张页面了。每个新文档先清掉。
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'try{sessionStorage.removeItem("hundun.hepan.partner.v1");}catch(e){}',
});
if (HAS_LIUYAO) {
  // 一张 Chrome 跑四张盘：注入按 pathname 选，选不中就把键清掉 —— 否则上一页那张盘会
  // 顺着 sessionStorage 活到下一页，四张截图其实是同一张盘，census 看不出来。
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{const m=' + JSON.stringify(LIUYAO_BY_PATH) + ';const k=m[location.pathname];' +
      'if(k)sessionStorage.setItem("liuyao_result",k);' +
      'else if(/^\\/liuyao\\/result\\//.test(location.pathname))sessionStorage.removeItem("liuyao_result");}catch(e){}',
  });
}

const consoleErrors = [];
const pageErrors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') consoleErrors.push(m.params.entry.text.slice(0, 160));
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160));
});
// 契约观测（fengshui-recognize-wire）：收 CDP Fetch 拦下来的**真实出站请求**，然后 abort。
// 上面那两态读的是 window.__recReq —— 那是 fetch() 拿到的参数。参数对不等于上线对：
// Content-Type 到底有没有真的进头、体有没有被序列化、visitorId 是不是本机那一个，
// 只有网络层看得见。拦下就 failRequest，所以这一枪不会真的送到供应商去。
const wirePauses = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method !== 'Fetch.requestPaused') return;
  const r = m.params.request || {};
  wirePauses.push({
    url: r.url, method: (r.method || '').toUpperCase(),
    headers: r.headers || {}, postData: r.postData || '',
  });
  // 每一发都必须应答，不然那一页永远挂在 pending 上，后面的态跟着遭殃。
  void send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'ConnectionRefused' });
});
await send('Runtime.enable');

// ---------------------------------------------------------------- measurement
// 两条 44px 通道与分段扫共用的同一段定义，只写一份。
// 上一轮之所以出「small=21 到底是哪 21 个」这种读不懂的数，就是因为
// smallTargets 数全文、tap 探针按视口过滤，两边各写各的「在与视口相交」。
// 现在两者跑在同一个 evaluate（TAP_AUDIT）里，共用 inView，不可能再分叉。
const VH_SHARED = String.raw`
  // nav before footer: region() matched footer first for elements inside the nav
  const region = el => { if (el.closest('svg')) return 'svg'; if (el.closest('nav')) return 'nav';
    if (el.closest('footer')) return 'footer'; if (el.closest('main')) return 'main'; return 'other'; };
  // 与视口相交：rect 本来就是视口坐标，所以这里只能用 0..innerHeight，
  // 不能拿"文档坐标的段窗口"去比 —— 那样除了第一段，后面每一段都在判错元素
  // （分段扫第一版就是这么错的：滚到 788px 那一段，窗口写成 [788,1688]，
  // 而屏幕上元素的 rect 仍在 0..900 里，于是整段命中 0 个，green 是假的）。
  // 分段的意义就在于 scrollTo 之后"视口"自己换了位置，判定式始终只有一条。
  const inView = r => !!r.width && !!r.height && r.bottom > 0 && r.top < innerHeight
    && r.right > 0 && r.left < innerWidth;
  const TAP = 44;
  // No <label>: a label with no associated control is not a pointer target, and the
  // form labels here are 422x20 blocks that would drown the real findings.
  const ctlSel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=tab],[role=radio],[role=button],[role=checkbox],[role=option]';
`;

const CENSUS = String.raw`(() => {
  ${VH_SHARED}
  // The ladder is read out of the page's own tokens, never restated here. A
  // hardcoded copy drifts from the source of truth silently, and it can quietly
  // start passing a page that gained a size nobody ruled in. Reading the declared
  // value (not a probe's computed font-size) also avoids the inherit trap: an
  // undefined custom property makes font-size fall back to the inherited 16px,
  // which would add a phantom tier instead of failing.
  const rootCS = getComputedStyle(document.documentElement);
  const LADDER = [];
  for (const tier of ['eyebrow', 'meta', 'legal', 'body', 'title', 'hero', 'display']) {
    const raw = rootCS.getPropertyValue('--qn-fs-' + tier).trim();
    const px = Math.round(parseFloat(raw) * 10) / 10;
    if (px > 0 && px < 400) LADDER.push(px); else LADDER.push(NaN);
  }
  const lum = c => { const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    return 0.2126 * f(c[0] / 255) + 0.7152 * f(c[1] / 255) + 0.0722 * f(c[2] / 255); };
  const parse = s => { const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const parseHex = s => { let h = String(s).slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16); const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a }; };
  const mix = (fg, bg) => fg.a >= 1 ? fg.rgb : [0, 1, 2].map(i => Math.round(fg.rgb[i] * fg.a + bg[i] * (1 - fg.a)));
  // a gradient element can sit on any of its stops: keep them all, worst ratio wins
  const gradStops = img => { if (!img || img === 'none') return []; const out = [];
    const re = /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g; let m;
    while ((m = re.exec(img))) { const c = m[0][0] === '#' ? parseHex(m[0]) : parse(m[0]); if (c) out.push(c); } return out; };
  const bgSet = el => { const uniq = a => { const s = []; for (const c of a) { const k = c.join(','); if (!s.some(x => x.join(',') === k)) s.push(c); } return s; };
    let cands = [[255, 255, 255]]; const chain = []; let n = el;
    while (n && n.nodeType === 1) { const cs = getComputedStyle(n);
      chain.push({ solid: parse(cs.backgroundColor), grads: gradStops(cs.backgroundImage),
        ink: !!(n.classList && n.classList.contains('qn-ink')) });
      n = n.parentElement; }
    chain.reverse();
    for (const L of chain) {
      if (L.solid && L.solid.a >= 1) cands = [L.solid.rgb.slice()];
      else if (L.solid && L.solid.a > 0) cands = cands.map(b => mix(L.solid, b));
      if (L.grads.length) { const g = [];
        for (const st of L.grads) { if (st.a >= 1) g.push(st.rgb.slice()); else for (const b of cands) g.push(mix(st, b)); }
        if (g.length) cands = uniq(g); }
      if (L.ink) { const g = []; const glow = { rgb: [178, 149, 93], a: 0.30 };
        for (const b of cands) { g.push(b); g.push(mix(glow, b)); } cands = uniq(g); }
    }
    return cands; };

  // token identity, collisions, and "data colour must not be used as ink"
  const probe = document.createElement('span'); probe.style.display = 'none'; document.body.appendChild(probe);
  const resolved = {};
  for (const fam of ['wx-jin', 'wx-mu', 'wx-shui', 'wx-huo', 'wx-tu', 'sihua-lu', 'sihua-quan', 'sihua-ke', 'sihua-ji',
    'shen-qinglong', 'shen-zhuque', 'shen-gouchen', 'shen-tengshe', 'shen-baihu', 'shen-xuanwu',
    'text-primary', 'text-secondary', 'text-muted', 'accent-gold-text']) {
    probe.style.color = 'var(--color-' + fam + ')';
    resolved[fam] = getComputedStyle(probe).color;
  }
  probe.remove();
  // Same rendered value under two names is what made 白虎 indistinguishable from
  // --color-text-muted. Reported, not failed: it is a palette decision, not a bug.
  const dataFams = Object.keys(resolved).filter(k => /^(wx|shen|sihua)-/.test(k));
  const textFams = Object.keys(resolved).filter(k => k.startsWith('text-') || k === 'accent-gold-text');
  const collisions = [];
  for (const d of dataFams) for (const t of textFams)
    if (resolved[d] === resolved[t]) collisions.push(d + ' == ' + t + ' (' + resolved[d] + ')');

  // Ruling: the 五行/六神/四化 palettes encode data through dots and blocks only.
  // Compare by declaration source, not by rendered value -- ink itself renders
  // rgb(29,29,31), which is 玄武's value, so a value match would flag every word.
  const INK_DATA = /(?:^|[;\s])color\s*:\s*var\(\s*--color-(?:wx|shen|sihua)-/;
  const inkedByStyle = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = n.getAttribute && n.getAttribute('style');
      if (s && INK_DATA.test(s)) return (s.match(/--color-(?:wx|shen|sihua)-[a-z]+/) || ['?'])[0];
      if (s && /(?:^|[;\s])color\s*:\s*#[0-9a-fA-F]{3,8}/.test(s)) {
        const hx = (s.match(/color\s*:\s*(#[0-9a-fA-F]{3,8})/) || [])[1];
        if (hx && dataFams.some(k => resolved[k].toLowerCase() === normHex(hx))) return 'literal ' + hx;
      }
    }
    return null;
  };
  const normHex = h => { let x = h.slice(1); if (x.length === 3) x = x.split('').map(c => c + c).join('');
    const n = parseInt(x.slice(0, 6), 16); return 'rgb(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ') + ')'; };
  const cssInked = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules || []) {
      if (!r.style) continue;
      const c = r.style.color || '';
      if (/var\(\s*--color-(?:wx|shen|sihua)-/.test(c) && cssInked.length < 6) cssInked.push(r.selectorText.slice(0, 48) + ' { color: ' + c + ' }');
    }
  }

  const R = {}; const off = []; const inked = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set(); let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
    seen.add(el);
    const g = region(el);
    R[g] = R[g] || { sizes: new Map(), aa: [] };
    const size = Math.round(parseFloat(cs.fontSize) * 10) / 10;
    R[g].sizes.set(size, (R[g].sizes.get(size) || 0) + 1);
    if (g !== 'svg' && !LADDER.includes(size))
      off.push({ size, text: t.slice(0, 16), tag: el.nodeName.toLowerCase(), cls: String(el.className || '').slice(0, 44), region: g });
    if (g !== 'svg') {
      const fg = parse(cs.color);
      if (fg) {
        const src = inkedByStyle(el);
        if (src && inked.length < 8)
          inked.push({ text: t.slice(0, 16), color: src, size, weight: cs.fontWeight, region: g });
        let worst = 99, onBg = null;
        for (const bg of bgSet(el)) { const l1 = lum(mix(fg, bg)), l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < worst) { worst = ratio; onBg = bg; } }
        const bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 19 && bold);
        // 顺手记下这一段里最差的实测比值和样本数。AA=0 只说"没违规"，不说"测过几个"；
        // 没有这两个数，一次全文只有 3 段文字的页面和 300 段的页面看起来一样绿。
        R[g].n = (R[g].n || 0) + 1;
        const wr = Math.round(worst * 100) / 100;
        if (!R[g].min || wr < R[g].min.ratio)
          R[g].min = { ratio: wr, size, text: t.slice(0, 12), on: 'rgb(' + onBg.join(',') + ')' };
        if (worst < (large ? 3 : 4.5)) R[g].aa.push({ text: t.slice(0, 20), color: cs.color,
          on: 'rgb(' + onBg.join(',') + ')', size, weight: cs.fontWeight, ratio: Math.round(worst * 100) / 100 });
      }
    }
    // 44px 那两条通道不在这里数：文本走查只看得到"含文字的可点元素"，
    // 图标按钮（弹窗那个 32px 关闭 X）天生看不见。它们统一交给 TAP_AUDIT 分段扫。
  }

  // ---- 44px 两条通道见下面的 TAP_AUDIT：CENSUS 不再自己数。----
  // 它们要靠 elementFromPoint，天生只能判"当前这一段视口"里的东西，所以必须由外层
  // 分段滚动逐段调用；留在 CENSUS 里就意味着每扫一段都要重跑一遍全文走查。

  // ---- Clipped-by-overflow must announce itself (ruling 2026-10-17). ----
  // "可见内容宽 <= 容器，或有显式可滚动标记". A scroller whose content is wider than the
  // box is not a pass by virtue of being scrollable: the user has to be told the rest
  // exists. Two ways to satisfy it, and both are explicit in the markup:
  //   data-ly-overflow="1" on the scroller + a [data-ly-overflow-hint] node  (measured at
  //     runtime by the component itself, used by 卦盘 because its need depends on width);
  //   data-vh-scroll="<what the affordance is>"  (a hand-authored strip that always scrolls
  //     and ships its own arrows, e.g. the homepage service carousel).
  // Anything else that spills is a silent cut and fails.
  const clips = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowX)) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom <= 0 || r.top >= innerHeight) continue;
    const hint = !!(el.parentElement && el.parentElement.querySelector('[data-ly-overflow-hint]'));
    const declared = el.getAttribute('data-vh-scroll');
    clips.push({
      sel: (el.getAttribute('class') || el.nodeName.toLowerCase()).slice(0, 30),
      sw: Math.round(el.scrollWidth), cw: Math.round(el.clientWidth),
      marked: el.getAttribute('data-ly-overflow') === '1', hint, declared: declared || null,
      region: region(el),
    });
  }

  const kong = document.querySelectorAll('.liuyao-plate [data-ly-kong]').length;
  // The plate has two distinct failure modes and they need different evidence:
  //  (a) it is wider than its own box -> scrollable, must carry an affordance (clips above);
  //  (b) it grows past the card that holds it (a flex item refusing to shrink, min-width:auto)
  //      -> the 六神 column paints over the page gutter and no scroller ever appears, so the
  //      clip check stays silent. Comparing against the card box is what catches that.
  const plate = (() => {
    const el = document.querySelector('.liuyao-plate'); if (!el) return null;
    const card = el.closest('.qn-card') || (el.parentElement && el.parentElement.parentElement);
    const r = el.getBoundingClientRect(); const c = card ? card.getBoundingClientRect() : null;
    return { sw: Math.round(el.scrollWidth), cw: Math.round(el.clientWidth),
      left: Math.round(r.left), right: Math.round(r.right),
      cardLeft: c ? Math.round(c.left) : null, cardRight: c ? Math.round(c.right) : null };
  })();

  const nav = document.querySelector('nav.qn-nav');
  const foot = document.querySelector('footer.qn-footer');
  const shell = document.querySelector('main') || document.querySelector('[class*="qn-shell"]');
  const out = {
    path: location.pathname,
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyText: (document.body.innerText || '').replace(/\s+/g, '').length,
    booted: !!window.__vhBooted,
    tokens: resolved,
    paletteCollisions: collisions,
    cssInkData: cssInked,
    inkedDataColors: inked,
    nav: nav ? { h: Math.round(nav.getBoundingClientRect().height), bg: getComputedStyle(nav).backgroundColor } : null,
    navLists: [...document.querySelectorAll('.qn-nav__links')].filter(e => e.getBoundingClientRect().width > 0).length,
    hasMain: !!document.querySelector('main'),
    ladder: LADDER,
    foot: foot ? { bg: getComputedStyle(foot).backgroundColor,
      top: Math.round(foot.getBoundingClientRect().top), bottom: Math.round(foot.getBoundingClientRect().bottom) } : null,
    docH: document.documentElement.scrollHeight,
    shell: shell ? (() => { const cs = getComputedStyle(shell); const w = Math.round(shell.getBoundingClientRect().width);
      const s = shell.querySelector('.qn-shell') || shell;
      // clientW：Chrome 的 innerWidth 含滚动条（本机 15px），clientWidth 不含。
      // 满幅那一支判据若拿 innerWidth 比，会把每一张没有 max-width 的页都判成"壳塌了"。
      return { tag: shell.tagName.toLowerCase(), w, max: getComputedStyle(s).maxWidth, cls: s.className.slice(0, 40),
        clientW: document.documentElement.clientWidth }; })() : null,
    bodyDisplay: getComputedStyle(document.body).display,
    regions: {}, offLadder: off,
    overflowClips: clips, kongMarks: kong, plate,
    clsSrc: (window.__clsSrc || []).slice(0, 8),
  };
  for (const [k, v] of Object.entries(R)) out.regions[k] = {
    sizes: [...v.sizes.keys()].sort((a, b) => a - b),
    aaCount: v.aa.length, aa: v.aa.slice(0, 20), n: v.n || 0, min: v.min || null };
  return out;
})()`;

// ---- Tap targets: *effective* tappability, not just the painted box. ----
// Two blind spots made a green small=0 meaningless before:
//  (a) the text walker only ever saw a control that contains a text node, so an
//      icon-only button -- the launcher's 32px close X -- was invisible to it;
//  (b) it read getBoundingClientRect, so a control that deliberately grows its hit
//      area past its visual box (::after overflow) still read as "small".
// Rule: a control whose own box is already >=44x44 passes. Otherwise a centred
// 44x44 box is probed at its four corners with elementFromPoint, and every corner
// must resolve to the control or a descendant of it. A pseudo-element hit is
// attributed by the browser to its originating element, so a real 44px hit area
// passes; a clipped one (ancestor overflow:hidden) or one stolen by an adjacent
// control's overlapping hit area fails -- which is the correct outcome, because
// overlapping expansions cause mis-taps rather than fixing them.
// Why >=44x44 short-circuits instead of being probed: these controls are pills
// (border-radius 999px), and the browser clips hit-testing to the rounded shape,
// so the corner of a 56x44 pill's own bounding box is genuinely not part of it.
// Measured, not assumed. Probing such a control reports a miss no user can hit.
// Both numbers come out of this ONE loop, so "small" and "TAP44" can never again
// describe two different populations -- that is what the 2026-10-19 ruling asks for.
const TAP_AUDIT = String.raw`(() => {` + VH_SHARED + String.raw`
  const small = new Set(); const issues = new Set(); const seen = new Set();
  // 2026-10-20 裁定：不许用"句中链接豁免"过关。WCAG 2.5.5 的 inline 例外在规范里确实存在，
  // 但它在这里成了一个可以悄悄变大的桶 —— 被点名的真实违例（选择体系 52x17）正走这条道变绿。
  // 所以豁免通道整个删掉：不足 44px 就是违例，修法是把它做成真的 44px 控件或改成非交互文本，
  // 不是给它找一个例外。
  let inWindow = 0;
  const why = {};
  const note = (el, k) => { const key = k + ' ' + el.nodeName.toLowerCase() + '.' + String(el.className || '').split(' ')[0].slice(0, 24);
    why[key] = (why[key] || 0) + 1; };
  for (const el of document.querySelectorAll(ctlSel)) {
    if (seen.has(el)) continue;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') { note(el, 'skip-disabled/aria-hidden'); continue; }
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { note(el, 'skip-zero-box'); continue; }
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.1) { note(el, 'skip-invisible'); continue; }
    if (cs.pointerEvents === 'none') { note(el, 'skip-pointer-none'); continue; }
    if (!inView(r)) { note(el, 'out-of-window'); continue; }
    seen.add(el); inWindow++;
    note(el, 'IN-WINDOW');

    el.setAttribute('data-vh-t', '1');   // 段间重叠会重复数到同一个元素，用标记取全文去重

    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
    const label = txt.slice(0, 12) || (el.getAttribute('aria-label') || '').trim().slice(0, 12) || '(icon-only)';
    // 尺寸带一位小数 + 类名：上一轮那条"43.6px 的 summary"就是被四舍五入成 44 之后
    // 再也认不出是谁的 —— 只报"44x44 没达标"没法修，也没法核。
    const cls = (el.getAttribute('class') || el.nodeName.toLowerCase()).split(' ')[0].slice(0, 18);
    const box = Math.round(r.width * 10) / 10 + 'x' + Math.round(r.height * 10) / 10 + '.' + cls;
    if (r.width < TAP || r.height < TAP) {
      el.setAttribute('data-vh-s', '1');   // 同一个元素被相邻两段都数到，计数按 DOM 身份去重
      small.add(region(el) + '|' + label + '|' + box);
    }
    if (r.width >= TAP && r.height >= TAP) continue;   // 见上面那条"圆角药丸不能探角"的实测结论
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Only audit a control reachable at its own centre. When a modal is open,
    // everything behind its backdrop is inert -- reporting those as tap failures
    // would be noise, not a finding. That is the state the home AFTER-click creates.
    const self = document.elementFromPoint(cx, cy);
    if (!self || !(self === el || el.contains(self))) continue;
    const half = TAP / 2 - 0.5;
    let miss = 0, untestable = 0;
    for (const [dx, dy] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
      const x = cx + dx, y = cy + dy;
      // A corner pushed outside the window cannot be judged -- the edge of the
      // document sits there for a reason unrelated to this control.
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { untestable++; continue; }
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) miss++;
    }
    if (miss && untestable < 4) {
      const key = region(el) + '|' + label + '|' + box + '|miss' + miss + (txt ? '' : '|ICON');
      issues.add(key);
    }
  }
  return { small: [...small].sort(), issues: [...issues].sort(), inWindow,
    distinct: document.querySelectorAll('[data-vh-t]').length,
    smallTotal: document.querySelectorAll('[data-vh-s]').length,
    dump: ['scrollY=' + Math.round(window.scrollY) + ' docTop=' + Math.round(document.documentElement.scrollTop)
      + ' 视口高=' + innerHeight + ' 命中 ' + inWindow + ' / 标记 ' + document.querySelectorAll('[data-vh-t]').length]
      .concat(Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => '   ' + n + '  ' + k)) };
})()`;

const fail = [];
const warns = [];
const exempts = [];
const results = {};

let W = 1280, H = 900, TOUCH = false, RM = 'no-preference';
async function metrics(w, h, touch) {
  W = w; H = h; TOUCH = !!touch;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!touch });
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!touch, maxTouchPoints: touch ? 5 : 0 });
  // Turning touch emulation off does not always clear (pointer: coarse) inside the
  // same target, so desktop states were being reported as coarse. Emulate the
  // media features directly instead of inferring them from the touch flag.
  await send('Emulation.setEmulatedMedia', { features: [
    { name: 'pointer', value: touch ? 'coarse' : 'fine' },
    { name: 'hover', value: touch ? 'none' : 'hover' },
    { name: 'prefers-reduced-motion', value: RM },
  ] });
}
async function shot(name, full = false) {
  if (!SHOTS) return;
  if (full) {
    const hh = await evl('Math.max(document.documentElement.scrollHeight, 900)');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: Math.min(hh, 18000), deviceScaleFactor: 1, mobile: W < 700 });
    await sleep(600);
  }
  // Freeze before capture. The home hero ring rotates continuously, so two shots of the
  // SAME build differed by ~6500px in one band while the cross-build diff was ~6000px —
  // an unchanged page looked like a regression. pause() alone is not enough: it stops the
  // clock at whatever phase that run happened to reach, so the ticks still land differently
  // a few hundred ms apart. Infinite animations are rewound to 0, i.e. the authored position;
  // finite entrance animations keep their finished state, because rewinding those to 0 would
  // screenshot the page before it faded in.
  await evl(`[...document.getAnimations()].forEach(a => { try {
    a.pause();
    const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
    if (t && t.iterations === Infinity) a.currentTime = 0;
  } catch (e) {} })`);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.data, 'base64'));
  if (full) await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: TOUCH });
  console.log('    shot ' + name + '.png' + (full ? ' [full]' : ''));
}

async function goto(url) {
  consoleErrors.length = 0; pageErrors.length = 0;
  const r = await send('Page.navigate', { url: BASE + url });
  if (r.__error) throw new Error('navigate rejected ' + url + ': ' + JSON.stringify(r.__error));
  await sleep(2600);
}

// 首屏探针。必须在 AFTER 点击之前跑 —— 首页那个「开始使用」会把页面滚走，而「首屏」的定义
// 就是滚动位置为 0 时能看到什么。裁定 ① 的四条里有三条在这里测：四类意图各 ≥1 个可点入口、
// 导航 ≤5 项、首屏不塞营销话。
const INTENTS_EXPECT = ['认识自己', '问一件事', '择时看周期', '看关系'];
const MARKETING_WORDS = ['限时', '立即', '爆款', '专属', '超值', '急速', '一键测算', '准确率', '最准', '权威', '大师', '开运'];
const FIRST_SCREEN = `(() => {
  const vh = window.innerHeight;
  const inFold = el => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.width > 0 && r.height > 0; };
  const links = [...document.querySelectorAll('a[href]')].filter(inFold);
  const texts = [...document.querySelectorAll('h1,h2,h3,p,span,a,button')].filter(inFold).map(e => (e.innerText || '')).join(' ');
  const hit = {};
  for (const t of ${JSON.stringify(INTENTS_EXPECT)}) hit[t] = links.some(a => (a.innerText || '').includes(t));
  return { scrollY: window.scrollY, vh, links: links.length, intents: hit,
    marketing: ${JSON.stringify(MARKETING_WORDS)}.filter(w => texts.includes(w)),
    // 「导航 ≤5 项」= 站头那一条里**实际可见**的入口：宽屏全名与窄屏两字简称同时在 DOM 里，
    // 靠 CSS 切换，所以必须按可见性数；品牌 logo 链接也不算导航项。
    navItems: [...document.querySelectorAll('.qn-nav__links a')].filter(a => a.offsetParent !== null && a.getClientRects().length)
      .map(a => (a.innerText || '').trim()).filter(Boolean),
    // 门廊那两张卡：入口指向哪、在不在首屏、卡片上写的数是多少。
    // 数是从目录算出来渲染的，这里把它读回来，与 GATE_EXPECT 对 —— 门廊说谎就在这露馅。
    domainCards: [...document.querySelectorAll('a.domain-card')].map(a => ({
      href: a.getAttribute('href'), fold: inFold(a),
      // 类名跟着门廊改版换了（原来那行挂在 .qn-axis 上）。这里必须跟着换，
      // 否则读回来的是空串，形状判定会在"什么都没读到"上一直绿着。
      tally: ((a.querySelector('.domain-card__tally') || {}).innerText || '').replace(/\s+/g, ' ').trim() })),
    // 导航是 position:fixed，不占文档流 —— 页面主体必须自己让出那 56px。
    // 这条判据是批A 补的：门廊改版后 h1 顶到 49px，被吸顶导航压掉上半截，而当时
    // 没有任何一条断言看这件事（宽度、溢出、命中区、对比度全都过了 —— 压住的字照样是"够对比度的字"）。
    // 只查"自己带文字"的元素：整块背景压在那条半透明带底下是设计，字被压住不是。
    navClash: (() => {
      const nav = document.querySelector('.qn-nav');
      if (!nav) return [];
      const nb = nav.getBoundingClientRect().bottom;
      const bad = [];
      for (const e of document.querySelectorAll('main *')) {
        if (e.children.length) continue;
        if (!(e.innerText || '').trim()) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.top < nb - 1 && r.bottom > 4) {
          bad.push((e.tagName + '.' + (e.className || '')).slice(0, 34) + ' top=' + Math.round(r.top) + '「' + (e.innerText || '').trim().slice(0, 12) + '」');
          if (bad.length >= 4) break;
        }
      }
      return bad;
    })() };
})()`;

function check(tag, v) {
  const base = tag.replace(/^(d1|m1)-/, '');
  const ex = EXEMPT[base];
  const bad = m => { fail.push(tag + ': ' + m); console.log('    FAIL ' + m); };
  const exempt = m => { exempts.push(tag + ': ' + m); console.log('    EXEMPT(by decision) ' + m); };
  if (!v || v.__err) { bad('census probe failed ' + JSON.stringify(v)); return; }
  if (!v.nav) bad('nav.qn-nav missing');
  if (!v.foot) bad('footer.qn-footer missing');
  if (v.nav && (v.nav.h < 56 || v.nav.h > 57)) bad(`nav height ${v.nav.h}px, expected 56 (+0.5px hairline)`);
  if (v.nav && v.nav.bg === 'rgba(0, 0, 0, 0)') bad('nav background token did not resolve');
  if (v.foot && v.foot.bg === 'rgba(0, 0, 0, 0)') bad('footer background token did not resolve');
  if (v.navLists !== 1) bad(`visible nav link lists = ${v.navLists}, expected exactly 1`);
  if (v.bodyDisplay !== 'flex') bad('body is not a flex column, footer cannot pin');
  if (v.bodyText < 100) bad(`page rendered almost no text (${v.bodyText} chars) — did the data load?`);
  if (!v.booted) bad('boot script never ran: CLS/LCP observers are dead, so the perf numbers are meaningless');
  if (v.overflowX > 0) bad(`horizontal overflow ${v.overflowX}px`);
  // 吸顶导航是 position:fixed，不占文档流 —— 每一态都在 scrollY=0 量一次"正文有没有被它压住"。
  // 这条是批A 补的：门廊改版后 h1 顶到 49px（导航底 57px），上半截字被压在毛玻璃底下，
  // 而宽度 / 溢出 / 命中区 / 对比度四条判据全都绿 —— 被压住的那半截字仍然是"够对比度的字"。
  for (const c of ((v.firstScreen && v.firstScreen.navClash) || [])) {
    bad(`正文压在吸顶导航底下（主体没让出那 56px）：${c}`);
  }
  // D2：CLS 以前只印不判，而且印的是加载值 —— 交互之后把整页推走那种位移没人管
  // （/western 问事态实测 0.106，元凶是提交按钮在 flex-wrap 里换了行）。
  // 分工要说清：交互引起的位移直接红；加载期就有的位移单独喊（本轮量到六爻结果页 0.17–0.24，
  // 那是既有缺陷，不在这一批里顺手修，但绝不能因为"没人断言"而继续被读成没问题）。
  if (typeof v.cls !== 'number') bad('CLS 没测到（observer 或 perf 读数坏了）—— 这一态的位移没被测量过');
  else {
    const load = typeof v.clsAtLoad === 'number' ? v.clsAtLoad : v.cls;
    const after = Math.round((v.cls - load) * 1000) / 1000;
    if (after >= 0.1) bad(`交互后 CLS +${after}（累计 ${v.cls}）—— 有内容在点击之后把页面推走了`);
    if (load >= 0.1) warns.push(`${tag}: 加载期 CLS ${load} ≥ 0.1（既有缺陷，本批不修，等排期）`);
    console.log(`   CLS load=${load} after-interaction=${after}${load >= 0.1 ? ' [加载期超标，已记 warn]' : ''}`);
    // 把"页面被滚了一下/被夹紧"与"内容真的被推走"分开。CLS 用视口坐标算，
    // 文档变矮导致 scrollY 被夹紧时，视口里所有元素都会同向平移，分数上看着像布局位移。
    const p = v.perf || {};
    if (p.preScroll && p.postScroll) {
      const dy = p.postScroll.y - p.preScroll.y;
      const dh = p.postScroll.h - p.preScroll.h;
      const clampable = p.preScroll.y + p.postScroll.vh > p.postScroll.h;
      console.log(`   SCROLL y ${p.preScroll.y}→${p.postScroll.y} (Δ${dy}) · docH ${p.preScroll.h}→${p.postScroll.h} (Δ${dh}) · vh ${p.postScroll.vh}`
        // Δ 非零时先怀疑探针自己：TRUSTED 那条路每次都 scrollIntoView 把目标滚到中间，
        // 这是探针造成的，不是页面自己滚的。把它说成"页面自己滚了"就会引出一个假缺陷。
        + (dy !== 0 ? ` · 滚动变了 ${dy}px${TRUSTED[base] ? '（探针自己 scrollIntoView 打的，不是页面行为）' : clampable ? '（文档变矮把 scrollY 夹紧）' : ''}` : ''));
      // 这里只印不判：dy 现在已知主要是探针自己 scrollIntoView 造成的，
      // 而 CLS 的判定在上面的 after>=0.1 那条里，它用的是可信点击下的真实读数。
      // 曾经这里还有一条"dy 非零就判红"的断言，理由是"文档高度塌陷"——
      // 实测 docH 是 907→2843（变大），那个假设不成立，所以删掉，不留一条理由写错的闸。
    }
  }
  if (!!v.pointerCoarse !== !!v.wantTouch) bad(`pointer mismatch: asked ${v.wantTouch ? 'coarse' : 'fine'}, page sees ${v.pointerCoarse ? 'coarse' : 'fine'}`);
  for (const c of (v.cssInkData || [])) bad(`stylesheet paints data colour as ink: ${c}`);

  // shell must fill up to its own max-width, never collapse to max-content
  if (v.shell && v.shell.max && v.shell.max !== 'none') {
    const cap = parseInt(v.shell.max, 10) || 1e9;
    const want = Math.min(cap, v.iw || W);
    if (Math.abs(v.shell.w - want) > 1) bad(`SHELL COLLAPSED: ${v.shell.tag}.${v.shell.cls.split(' ')[0]} is ${v.shell.w}px, expected ${want}px`);
  } else if (v.shell && v.shell.max === 'none') {
    // 满幅版式（门廊两栏，以及东方页那种没有 max-width 的 main）没有上限可核对 —— 旧写法在这里
    // 直接跳过，于是"壳塌成内容宽"这一整类缺陷在这些页上根本不会被测到。跳过换成另一条判据：
    // 壳必须铺满可用的视口宽（clientWidth，不含滚动条）。
    const want = v.shell.clientW || v.iw || W;
    if (Math.abs(v.shell.w - want) > 1) bad(`SHELL COLLAPSED(满幅): ${v.shell.tag}.${v.shell.cls.split(' ')[0] || '(无类名)'} 是 ${v.shell.w}px，满幅应为 ${want}px`);
  }
  // footer sits on the bottom of the viewport when the page is short
  if (v.foot && v.docH <= (v.ih || H) + 1) {
    const dead = (v.ih || H) - v.foot.bottom;
    if (dead > 1) bad(`footer not pinned: ${dead}px of dead band under it`);
  }

  const m = v.regions.main || {}, nv = v.regions.nav || {}, ft = v.regions.footer || {};
  // Contrast is never exempted, so a page cannot hide low-contrast copy by
  // sitting outside <main>.
  if ((m.aaCount || 0) > 0) for (const a of m.aa.slice(0, 8)) {
    const known = (KNOWN_CONTRAST[base] || []).find(e => normColor(e.fg) === normColor(a.color) && normColor(e.bg) === normColor(a.on));
    const line = `AA ${a.ratio} ${a.size}px/${a.weight} ${a.color} on ${a.on} "${a.text}"`;
    // 已知条目走 warns（打印 + 进 census.json + 末尾点名），其余照旧直接红。
    if (known) { warns.push(tag + ': KNOWN-CONTRAST ' + line + ' — ' + known.why); console.log('    KNOWN-CONTRAST(by ruling) ' + line); }
    else bad(line);
  }
  if ((nv.aaCount || 0) > 0) for (const a of nv.aa.slice(0, 4)) bad(`nav AA ${a.ratio} "${a.text}"`);
  if ((ft.aaCount || 0) > 0) for (const a of ft.aa.slice(0, 4)) bad(`footer AA ${a.ratio} "${a.text}"`);
  const aaOther = Object.entries(v.regions).filter(([g]) => g !== 'main' && g !== 'nav' && g !== 'footer' && g !== 'svg');
  for (const [g, r] of aaOther) for (const a of (r.aa || []).slice(0, 4)) bad(`AA(${g}) ${a.ratio} ${a.size}px/${a.weight} "${a.text}"`);

  // Ladder escapes are closed for good: the old filter only looked inside <main>,
  // so anything outside a landmark (a modal, a page root that never became one)
  // sat in region "other" and was never compared to anything. Now every non-svg
  // region is checked, and the tier set itself is verified to have resolved --
  // otherwise a missing token would empty the ladder and make every page pass.
  const offHits = (v.offLadder || []).filter(o => o.region !== 'svg');
  const ladderBad = !v.ladder || v.ladder.length < 7 || v.ladder.some(x => !Number.isFinite(x));
  if (ex) {
    if (!v.hasMain || ladderBad || offHits.length)
      exempt(`${offHits.length} off-ladder size(s)` + (v.hasMain ? '' : ', no <main> landmark') + ' — ' + ex);
  } else {
    if (ladderBad) bad('ladder did not resolve from --qn-fs-* tokens: ' + JSON.stringify(v.ladder));
    if (!v.hasMain) bad('no <main> landmark: shell/pin checks are vacuous here');
    for (const o of offHits.slice(0, 20)) bad(`off-ladder ${o.size}px "${o.text}" ${o.tag}.${o.cls.split(' ')[0]} in ${o.region}`);
    if (offHits.length > 20) bad(`off-ladder list truncated at 20, ${offHits.length - 20} more`);
  }
  for (const i of (v.inkedDataColors || [])) bad(`DATA COLOUR USED AS INK ${i.color} ${i.size}px "${i.text}" in ${i.region}`);
  for (const s of (v.smallTargets || []).filter(x => x.startsWith('nav|') || x.startsWith('footer|'))) bad(`sub-44 target in shell: ${s}`);
  // D1：44px 的"有效可点"以前只打印不判定，于是 375px 上一堆 13x13 / 43x44 / 17px
  // 的违例都能带着 ALL PASSED 出门。现在违例直接红，且没有任何豁免通道（2026-10-20 裁定）。
  for (const s of (v.tapIssues || [])) bad(`TAP44 有效命中区不可点：${s}`);

  for (const [k, want] of Object.entries(WX_FROZEN)) {
    const got = v.tokens['wx-' + k];
    if (got && hexOf(got) && hexOf(got).toLowerCase() !== want) bad(`wx-${k} renders ${got}, frozen value is ${want}`);
  }
  for (const [k, want] of Object.entries(SIHUA_FROZEN)) {
    const got = v.tokens['sihua-' + k];
    if (got && hexOf(got) && hexOf(got).toLowerCase() !== want) bad(`sihua-${k} renders ${got}, frozen value is ${want}`);
  }

  // 裁定 ①：首屏四类意图各 ≥1 个可点入口、导航 ≤5 项、首屏不塞营销话。
  // 探针没跑起来也算失败 —— 否则这条要求会静默变成「没人测过」。
  // #双体系 之后四类意图在 /oriental 的首屏（门廊 / 上没有，也不该有）。
  if (/-oriental$/.test(tag)) {
    const f = v.firstScreen;
    if (!f) bad('first-screen probe did not run — 四类意图的要求没被测量过');
    else {
      for (const t of INTENTS_EXPECT) {
        if (!f.intents || !f.intents[t]) bad(`首屏没有「${t}」的可点入口（scrollY=${f.scrollY}、首屏内 ${f.links} 个链接）`);
      }
      console.log(`   FIRST-SCREEN intents=${f.intents ? Object.values(f.intents).filter(Boolean).length : '?'}/4 links=${f.links}`);
    }
  }
  if (/-home$/.test(tag)) {
    const f = v.firstScreen;
    if (!f) bad('first-screen probe did not run — 门廊的要求没被测量过');
    else {
      if (!f.navItems || !f.navItems.length) bad('导航探针一个都没数到 —— 选择器失效时这条要求会静默通过');
      else if (f.navItems.length > 5) bad(`导航 ${f.navItems.length} 项，超过裁定的 ≤5：${f.navItems.join('/')}`);
      if (f.marketing && f.marketing.length) bad(`门廊首屏出现营销话：${f.marketing.join('、')}`);
      // 门廊的全部职责就是这两个入口：少一个是没有路，多一个就是它又开始当第三套工具主页。
      const cards = f.domainCards || [];
      if (cards.length !== 2) bad(`门廊首屏应当恰好两张体系卡，实得 ${cards.length} 张（选择器 a.domain-card 失效也会是这个数）`);
      const want = ['/oriental', '/western'];
      const got = cards.map(c => c.href).sort();
      if (JSON.stringify(got) !== JSON.stringify(want.slice().sort()))
        bad(`门廊两张卡的入口必须是 ${want.join(' 与 ')}，实得 ${JSON.stringify(got)}`);
      for (const c of cards) {
        if (!c.fold) bad(`门廊卡片 ${c.href} 不在首屏内（这就是"进来先选体系"这件事没做到）`);
        // 裁定①的补充：那行不再写「已开放 9 / 10」—— 分子把"部分可用"（有入口但缺一段）
        // 也算进去了，读者看不出 9 里有几项是半开的。改成三档并列 + 总数，并当场验相加等于总数。
        const m = /^可用 (\d+) · 部分可用 (\d+) · 未开放 (\d+) · 共 (\d+) 项$/.exec(c.tally || '');
        if (!m) bad(`门廊卡片 ${c.href} 上那行数读不成「可用 N · 部分可用 N · 未开放 N · 共 N 项」：${JSON.stringify(c.tally)}`);
        else {
          const [open, partial, closed, total] = m.slice(1).map(Number);
          if (open + partial + closed !== total)
            bad(`门廊卡片 ${c.href} 上 ${open}+${partial}+${closed}≠${total} —— 数是从目录现算的，出现这种结果就是算错了`);
          if (total === 0) bad(`门廊卡片 ${c.href} 上总项数 0：那一侧的目录没读进来（空目录会安静地印出 0）`);
          if (open > total || closed > total) bad(`门廊卡片 ${c.href} 上单项大于总数：${open}/${partial}/${closed} vs ${total}`);
        }
      }
      console.log(`   GATE cards=${cards.length} [${cards.map(c => `${c.href}:${c.tally.replace(/\s+/g, '')}`).join(' ')}] nav=${(f.navItems || []).length} marketing=${(f.marketing || []).length}`);
    }
  }

  // Ruling 2026-10-17: 不接受靠 overflow 兜住不报. The 卦盘's 五行/干支 columns were being
  // cut off at 375px with nothing telling the user the rest exists.
  for (const c of (v.overflowClips || [])) {
    if (c.declared) continue;
    if (c.marked && c.hint) continue;
    bad(`overflow hides ${c.sw - c.cw}px in ${c.region} content: ${c.sel} is ${c.sw}px wide in a ${c.cw}px box` +
      (c.marked ? ' (marked but the hint did not render)' : ' (no scroll affordance at all)'));
  }
  if (v.plate && v.plate.cardLeft !== null) {
    const spillL = v.plate.cardLeft - v.plate.left, spillR = v.plate.right - v.plate.cardRight;
    if (spillL > 1 || spillR > 1) {
      bad(`plate escapes its card by ${Math.max(spillL, spillR)}px (plate ${v.plate.left}->${v.plate.right}, ` +
        `card ${v.plate.cardLeft}->${v.plate.cardRight}) — a flex item that refuses to shrink, not a scroller`);
    }
  }
}
const hexOf = rgb => { const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('') : null; };

// 裁定 2026-10-19：长页按视口分段扫，别再靠一次性脚本「滚到某一节」。
// 只有 44px 那两条通道要分段（它们靠 elementFromPoint，天生只判得出当前窗口里的东西）；
// AA、字阶、shell、footer 与滚动无关，一律只读 band 0，下面用一次末段 CENSUS 反证这一点。
const TAP_BANDS = 40;   // 一次 TAP_AUDIT 只遍历可点元素，很便宜；封顶只为兜住异常长的页
async function sweepTap(v, tag) {
  const docH = Math.max(v.docH || 0, H);
  const need = Math.max(1, Math.ceil(docH / (H * 0.9)));   // 段间留 10% 重叠：跨段元素至少完整落进一段
  const bands = Math.min(need, TAP_BANDS);
  const small = new Set(); const issues = new Set();
  let distinct = 0, smallTotal = 0, lastY = 0, broken = 0;
  for (let i = 0; i < bands; i++) {
    const y = i === 0 ? 0 : Math.min(Math.round(docH * i / bands), Math.max(0, docH - H));
    if (i > 0) {
      await evl(`window.scrollTo({ top: ${y}, behavior: 'instant' }); true`);
      await sleep(120);   // sticky、以及要一帧后才稳定的布局：不给这一帧就是拿上一段的位置测
      lastY = y;
    }
    const s = await evl(TAP_AUDIT);
    if (!s || !Array.isArray(s.small) || !Array.isArray(s.issues)) {
      broken++;
      fail.push(`${tag}: 第 ${i + 1}/${bands} 段 tap 探针跑不起来 ${JSON.stringify(s).slice(0, 100)}`
        + ' —— 这一段的 44px 通道没被测过，不算通过');
      continue;
    }
    distinct = Math.max(distinct, s.distinct || 0);
    smallTotal = Math.max(smallTotal, s.smallTotal || 0);
    if (process.env.QN_TAP_DUMP) (s.dump || []).forEach(d => console.log('      ' + d));
    for (const k of s.small) small.add(k);
    for (const k of s.issues) issues.add(k);
  }
  // 「读数与滚动无关」不能只是我这么说：末段再跑一遍全文 CENSUS，与 band 0 比。
  // 不等就说明内容是滚下来才渲染的，那 band 0 那份根本不代表这一屏，直接红。
  if (bands > 1) {
    await evl(`window.scrollTo({ top: ${lastY}, behavior: 'instant' }); true`);
    await sleep(120);
    const s = await evl(CENSUS);
    const aa = s && !s.__err ? ((s.regions || {}).main || {}).aaCount : null;
    const off = s && !s.__err ? ((s.offLadder || []).length) : null;
    if (aa === null) fail.push(`${tag}: 末段对照 CENSUS 跑不起来 —— 「读数与滚动无关」这条没被验证过`);
    else if (aa !== ((v.regions.main || {}).aaCount || 0) || off !== (v.offLadder || []).length)
      fail.push(`${tag}: 读数随滚动变化（main AA ${(v.regions.main || {}).aaCount}→${aa}、`
        + `off-ladder ${(v.offLadder || []).length}→${off}）—— 内容是滚下来才渲染的，band 0 那份不算这一屏`);
  }
  await evl(`window.scrollTo({ top: 0, behavior: 'instant' });`
    + ` document.querySelectorAll('[data-vh-t],[data-vh-s]').forEach(e => { e.removeAttribute('data-vh-t'); e.removeAttribute('data-vh-s'); }); true`);
  v.smallTargets = [...small].sort();
  v.tapIssues = [...issues].sort();
  v.tapBands = bands; v.tapDistinct = distinct; v.tapIncomplete = broken;
  v.tapSmallTotal = smallTotal;
  if (need > bands)
    warns.push(`${tag}: 页面 ${docH}px 高、需要 ${need} 段，按 ${TAP_BANDS} 段封顶，`
      + `段距 ${(docH / bands).toFixed(0)}px > ${(H * 0.9).toFixed(0)}px，中间可能有带没逐段审到`);
  // 空过断言：整页扫下来一个可点元素都没进过窗口，只可能是探针或滚动坏了。
  if (!broken && distinct === 0)
    fail.push(`${tag}: 分了 ${bands} 段扫，窗口内可点元素去重 0 个 —— tap 通道这一态是空过，`
      + '不接受（宁可红，不要一个静默的小=0）');
  console.log(`   TAP SWEEP ${bands} 段 / 全文 ${docH}px，窗口内可点元素去重 ${distinct} 个，`
    + `其中 <44 的 ${smallTotal} 个 / ${v.smallTargets.length} 种标签×尺寸`
    + `（TAP44 未达 ${v.tapIssues.length}${broken ? '，有 ' + broken + ' 段没跑起来' : ''}）`);
}

// 改了某一节的交互，就得看一眼那一节。整页截图在 18000px 高的图上根本读不出格子；
// 这里按当前视口截一节（与分段扫同一个"滚过去再测"的思路，只是顺手把画面留下）。
const SECTION_SHOTS = { 'chart-result': '.qn-kline', 'chart-hepan': '#hepan' };
async function shotSection(tag, sel) {
  if (!SHOTS) return;
  const st = await evl(`(() => { const el = document.querySelector(${JSON.stringify(sel)});`
    + ` if (!el) return 'not-found'; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'ok'; })()`);
  if (st !== 'ok') { warns.push(`${tag}: 分区截图的目标 ${sel} ${st === 'not-found' ? '不在页面上' : '滚不动'}`); return; }
  await sleep(150);
  await evl(`[...document.getAnimations()].forEach(a => { try {
    a.pause();
    const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
    if (t && t.iterations === Infinity) a.currentTime = 0;
  } catch (e) {} })`);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  if (s.data) writeFileSync(`${OUT}/${tag}--section.png`, Buffer.from(s.data, 'base64'));
  await evl(`window.scrollTo({ top: 0, behavior: 'instant' }); true`);
  console.log('    shot ' + tag + '--section.png ← ' + sel);
}

// 需要"真人级"点击的态：点完之后会插入大块内容的，必须走 CDP 的真实输入。
// 为什么：CLS 的定义里，500ms 内有过用户输入的位移不计分（entry.hadRecentInput）。
// element.click() 是脚本合成的，永远不会置这个标志，于是"用户点一下展开内容"这种
// 本不该扣分的位移被记成了 0.329 的回归。用 Input.dispatchMouseEvent 打真实事件，
// 测出来的才是用户实际会被扣的分 —— 这是把量法修对，不是把闸门放宽。
const TRUSTED = {
  'fengshui-filled': ['样例 · 两室夹一厅', '#fp-confirm'],
  'fengshui-3d': ['样例 · 两室夹一厅', '#fp-confirm', '3D'],
  // 识别两态：勾同意与按"送给模型提候选"都会改版面，必须真实事件。顺序有意义 ——
  // 不先勾同意，那个按钮是 disabled，点了等于没点，而 harness 因为打到了元素也不会报错。
  // 这条正好也是 privacy/consent-gates-request 那条闸门的浏览器侧证据。
  'fengshui-recognize-fail': ['@file', '#fp-consent', '送给模型提候选'],
  'fengshui-recognize-candidates': ['@file', '#fp-consent', '送给模型提候选'],
  // 契约态：真的把那一枪打到网络层（再由 CDP 拦停）。与上面两态同一串动作，
  // 区别只在观测点从 window.__recReq 换成了浏览器实际发出的请求。
  'fengshui-recognize-wire': ['@file', '#fp-consent', '送给模型提候选'],
  // 编辑闭环：顺序有意义。加一间房会顺手选中它，「厨房」那颗 chip 在没有选中房间时是禁用的，
  // 先点它就是空跑一趟（而 harness 因为打到了元素也不会报错 —— 这类假绿最费人）。
  // 「加门」取的是页面上第一道墙那一行，「宽」取的是第一个开口那一行。
  'fengshui-edit': ['手工画', '加一间房', '厨房', '加一道墙', '加门', '宽', '#fp-confirm'],
  // 勾同意与按对照这两下都会改版面，必须真实事件。顺序有意义：不先勾同意，
  // 「并排对照」是 disabled，点了等于没点，而 harness 会因为打到了元素而不报错。
  'chart-hepan': ['#hp-consent', '并排对照'],
  // 建盘页那一栏的同意框/闰月开关都是这一批新加的；先真实点开 tab 再测，
  // 否则这些控件从来没有出现在任何一屏里。
  'create-double': ['双人合盘'],
  // 四柱那一档会把日期区整块换掉，必须真实点击才量得到换完之后那一屏（也才不计 CLS）。
  'create-sizhu': ['四柱'],
  // 闰月开关是 AFTER 选完 2025/6 才出现的；真实点它一下，既是测命中区也是测状态翻转。
  'create-lunar': ['闰6月'],
};

// 三种"只在某一种运行模式下成立"的态，写成一个集合而不是散在各处的 if：
//  - STUB_ONLY：钉值全部来自注入（503 与契约成功体都是 STUB_BOOT 造的）。真后端下既不保证
//    有这个落点，而且那一枪会把图真的送给供应商烧一次调用 —— 所以 live 下不点、不钉，
//    版面/对比度/命中区那些审计照做（它们与后端无关）。
//  - LIVE_ONLY：靠 CDP Fetch 拦真实出站请求。--stub 下 window.fetch 被桩换掉了，
//    网络层根本没有这一枪，拦不到不等于契约不合，只能 SKIP。
const STUB_ONLY = new Set(['fengshui-recognize-fail', 'fengshui-recognize-candidates']);
const LIVE_ONLY = new Set(['fengshui-recognize-wire']);

// 2026-10-21 裁定：live 全量只跑只读态 —— 生产库已经有真实客户盘，测试数据一条都不许落库。
// 这张表是**读产品代码逐条确认**的，不是按页面名猜的：每一行都指向"哪一下会 POST"。
// 为什么必须有这张表而不是"live 下别传 --chart-id"：不传 id 只挡住了八字那两态，
// 而六爻结果那四态是 fixture 注入 sessionStorage 跑的，live 模式照样会跑（原来的注释写着
// "live 模式也一样 —— 这个页面不请求 API"，实测是错的：app/liuyao/result/[id]/page.tsx:33
// 只要 sessionStorage 里有盘就 saveReport，也就是**挂载即写**）。
const WRITE_STATES = {
  'chart-result': '挂载即 POST /api/reports 两次（chart/result/[id]/page.tsx:99-133，bazi + ziwei，带姓名/生日/出生地）',
  'chart-result-empty': '同上（同一个页面，盘缺 siZhu 也照样保存报告）',
  'chart-result-barren': '同上',
  'chart-hepan': '同上（同一个页面，只是被真人点击推到"已并排"）',
  'liuyao-result': '挂载即 POST /api/reports（liuyao/result/[id]/page.tsx:33-41，sessionStorage 有盘就写一条）',
  'liuyao-result-time': '同上',
  'liuyao-result-number': '同上',
  'liuyao-result-legacy': '同上',
  'oriental-ask': '点「问一下」POST /api/assistant（lib/assistant/route-client.ts:45；问题文本进去，后端没这条路由时回落本机）',
  'western-ask': '同上',
  'fengshui-recognize-fail': '点「送给模型提候选」POST /api/fengshui/recognize（图真的发给供应商）',
  'fengshui-recognize-candidates': '同上',
};
// fengshui-recognize-wire 不在表里是**有意的**：它在 Request stage 就被 CDP Fetch abort 掉，
// 那一发永远到不了服务端 —— 拦下来看的就是真实出站，放过去就失去这一态存在的理由。

async function measure(tag, url) {
  // 契约态必须在导航之前就开拦截：POST 是点出来的，但拦晚一发的风险不值得留。
  const wireBase = tag.replace(/^(d1|m1)-/, '');
  const wire = !STUB && wireBase === 'fengshui-recognize-wire';
  if (wire) {
    wirePauses.length = 0;
    const on = await send('Fetch.enable', { patterns: [{ urlPattern: '*fengshui/recognize*', requestStage: 'Request' }] });
    if (on && on.__error) fail.push(tag + ': Fetch.enable 被拒 ' + JSON.stringify(on.__error).slice(0, 120));
  }
  await goto(url);
  await sleep(900);   // let late LCP / CLS candidates land
  const base = tag.replace(/^(d1|m1)-/, '');
  // 首屏必须在任何点击/滚动之前抓，晚了测的就不是首屏了。
  const fold = await evl(FIRST_SCREEN);
  if (AFTER[base]) {
    // A programmatic .click() does not set hadRecentInput, so the expansion shift
    // would land in CLS and look like a load regression. Mark both load values first:
    // content the click reveals is also a fresh LCP candidate, which reads as a
    // multi-second load regression on a page that paints fine.
    await evl(`window.__clsAtLoad = window.__cls; window.__lcpAtLoad = window.__lcp;
      // 交互前的滚动现场。CLS 用视口坐标算位移，所以"页面被滚了一下"和"内容真的被推走"
      // 在分数里长得一模一样 —— 分不清就只能猜。这三个数就是为了不猜。
      window.__preScroll = { y: Math.round(window.scrollY),
        h: document.documentElement.scrollHeight, vh: window.innerHeight };
      true`);
    const ok = await evl(AFTER[base]);
    if (ok !== true) fail.push(tag + ': 该状态没到位（' + (typeof ok === 'string' ? ok : JSON.stringify(ok)) + '）—— 这一屏从未被测量');
    else { await sleep(800); console.log('    clicked expand control'); }
  }
  if (TRUSTED[base] && STUB_ONLY.has(base) && !STUB) {
    console.log('    SKIP 交互：这一态的落点靠 --stub 注入（503 / 契约成功体），'
      + '真后端下既不保证有这个落点，而且点下去会把图真的送给供应商烧一次调用');
  } else if (TRUSTED[base]) {
    await evl(`window.__clsAtLoad = window.__cls; window.__lcpAtLoad = window.__lcp;
      window.__preScroll = { y: Math.round(window.scrollY),
        h: document.documentElement.scrollHeight, vh: window.innerHeight }; true`);
    const miss = [];
    for (const target of TRUSTED[base]) {
      if (target === '@file') {
        // 真人选图 = 一次真实输入。先对页面上一个**非交互**的位置（h1）打一发真实点击，
        // 把 hadRecentInput 置起来，再注入文件 —— 于是"预览卡出现把下面推下去"这段位移
        // 按 CLS 定义不计分，量出来的才是用户真会被扣的分。
        // 不打「选户型图」那一枪：它会唤起原生文件对话框，headless 下有挂住的风险。
        const at = await evl(`(() => { const h = document.querySelector('h1');
          if (!h) return null; const r = h.getBoundingClientRect();
          return { x: r.left + 4, y: r.top + 4 }; })()`);
        if (at && typeof at.x === 'number') {
          for (const type of ['mousePressed', 'mouseReleased']) {
            await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
          }
        }
        const inj = await evl(FS_PICK);
        if (inj !== true) miss.push('@file → ' + (typeof inj === 'string' ? inj : JSON.stringify(inj)));
        continue;
      }
      // 先把目标滚进视口再取中心点：CDP 的 Input 坐标是视口 CSS 像素，
      // 元素在折叠线以下时按文档坐标打会点到别的东西上，而且点错了也"不会报错"。
      const at = await evl(`(() => {
        const byText = ${JSON.stringify(target)}.startsWith('#') ? null
          : [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === ${JSON.stringify(target)});
        const el = byText || document.getElementById(${JSON.stringify(target)}.replace('#',''));
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      if (!at || typeof at.x !== 'number') { miss.push(target); continue; }
      await sleep(60);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
      }
      await sleep(220);   // 让 React 把这一拍渲染完，下一枪才打在真 DOM 上
    }
    if (miss.length) fail.push(tag + ': 真实点击没打到 ' + miss.join('、') + ' —— 这一屏从未被测量');
    else { await sleep(800); console.log(`    trusted-click ${TRUSTED[base].length} 次（CDP Input，计入 hadRecentInput）`); }
  }
  // The injected state has to be provably on screen before anything else here means
  // anything: an empty-state fallback is also "a page with nav, footer and ladder".
  if (LIUYAO_PINS[base]) {
    const got = await evl(liuyaoProbe(LIUYAO_PINS[base]));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 盘面探针跑不起来 ' + JSON.stringify(got).slice(0, 120));
    else for (const x of miss) fail.push(tag + ': 盘面不等于金标准 — ' + x);
    console.log(miss && miss.length ? '    PIN MISMATCH ' + miss.join(' | ')
      : `    pins n${String(LIUYAO_PINS[base].base).padStart(2, '0')}–n${String(LIUYAO_PINS[base].base + 11).padStart(2, '0')} 全中，空亡 ${got.kong} 处`);
  }
  if (CHART_PINS[base]) {
    const pins = { ...CHART_PINS[base] };
    if (LIVE_CHART && base === 'chart-result') pins.pillars = []; // 真盘：四柱钉值不适用
    const got = await evl(chartProbe(pins));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 场景矩阵探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else for (const x of miss) fail.push(tag + ': 场景矩阵不等于钉值 — ' + x);
    console.log(miss && miss.length ? '    PIN MISMATCH ' + miss.join(' | ')
      : `    场景矩阵 ${got.rows} 行全中，约定标签 ${got.conv} 行，藏干命中 ${got.cang} 条`);
  }
  if (KLINE_PINS[base]) {
    const kp = { ...KLINE_PINS[base] };
    // 真盘（--chart-id）下没有 fixture 的手工钉值可言：换成 live 模式，只测结构与声明句。
    // 与运维 5a4edb4 对 CHART_PINS 四柱钉值的处理同一条路，否则真盘回归永远红、就没人跑。
    if (LIVE_CHART && base === 'chart-result') {
      kp.mode = 'live'; kp.segments = 0; kp.years = []; kp.cells = {}; kp.cellText = {}; kp.land = null;
      kp.text = ['人生K线 · 类别轴', '本图不构成吉凶评分', '落点取的是流年支', '格子只读'];
    }
    const got = await evl(klineProbe(kp));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': K线探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else for (const x of miss) fail.push(tag + ': K线不等于手工钉值 — ' + x);
    console.log(miss && miss.length ? '    PIN MISMATCH ' + miss.join(' | ')
      : (KLINE_PINS[base].mode === 'empty'
        ? `    K线 降级卡：0 条泳道、0 个运段、/create 入口在`
        : `    K线 ${got.lanes} 条泳道、${got.chips} 个运段，比肩/正官逐格手工值全中`));
    // #88 的三条硬数打出来：格子数/年票数/年票不足 44 的个数。不打出来就没人知道
    // 这一态到底审没审到格子（探针跑起来但选择器落空，是最容易骗过自己的一种绿）。
    if (got && got.tapFacts) {
      const tf = got.tapFacts;
      console.log(`    格子 ${tf.cells} 个（可点 ${tf.cellInteractive} 个）· 表格语义 ${tf.table ? '在' : '不在'}`
        + ` · 年票 ${tf.chips} 个（<44 的 ${tf.chipsSmall} 个，${tf.wrapped ? '已换行' : '单行'}）`);
      if (tf.cells === 0) fail.push(tag + ': K线 格子数为 0 —— 选择器落空，这一节的只读断言是空过');
      if (tf.chips === 0) fail.push(tag + ': K线 年票数为 0 —— 选年入口没测到');
    } else if (KLINE_PINS[base].mode !== 'empty') {
      fail.push(tag + ': K线 没交出 #88 的格子/年票读数（tapFacts 为空）—— 这一节的只读与 44px 没被测量过');
    }
  }
  // 合盘那一节：探针跑完必须把块数打出来。0 块既可能是"这一节没挂上"，也可能是
  // "填了但一条对照都没推出来" —— 两种都该红，而不能因为页面上还有表单和说明文字就过。
  if (HEPAN_PINS[base]) {
    // 真盘模式：合盘八条的关系文案随"我这张盘"而变，fixture 钉值不适用（与 chart-result 的
    // LIVE_CHART 同一处理）。保留结构断言：8 块、每块依据+不确定项、四条隐私声明、无 null/undefined/NaN、
    // 结论块内无评分/吉凶词。钉值只在 fixture 模式生效。
    const hepanPins = LIVE_CHART && base === 'chart-hepan'
      ? { ...HEPAN_PINS[base], text: [] }
      : HEPAN_PINS[base];
    const got = await evl(hepanProbe(hepanPins));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 合盘探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else {
      for (const x of miss) fail.push(tag + ': 合盘不等于钉值 — ' + x);
      // 0 块单独再点名一次：它既可能是"这一节没挂上"，也可能是"填了但一条对照都没推出来"，
      // 两种都不该因为页面上还剩着表单和说明文字就过去。
      if (HEPAN_PINS[base].mode !== 'degraded' && got.blocks === 0) fail.push(tag + ': 合盘 0 个立项块 —— 这一节从未真的并排出报告');
    }
    console.log(miss && miss.length ? '    HEPAN PIN MISMATCH ' + miss.join(' | ')
      : (HEPAN_PINS[base].mode === 'degraded'
        ? '    合盘 降级态：0 块、表单入口在、四条隐私声明都在屏上'
        // 真盘模式下 text 被清空（八条关系随盘而变），这时候打「八条全中」就是谎报，
        // 所以把这一跑实际核了几条文句打出来。
        : `    合盘 ${got.blocks} 个立项块，结构断言全中；关系文案钉值这一跑核了 ${hepanPins.text.length} 条`));
  }
  // 紫微那张卡：分区数与宫名都要核。0 张重点卡不是"没测到"，是这一节整块没渲染 —— 得说出来。
  if (ZIWEI_PINS[base]) {
    const got = await evl(ziweiProbe(ZIWEI_PINS[base]));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 紫微探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else for (const x of miss) fail.push(tag + ': 紫微分区不等于钉值 — ' + x);
    console.log(miss && miss.length ? '    ZIWEI PIN MISMATCH ' + miss.join(' | ')
      : `    紫微 重点 ${got.key} 张 + 其余 ${got.other} 张 = 十二宫全覆盖，宫名逐个命中`);
  }
  // 问事框：答完之后那一帧必须被逐条读过。只测空输入框等于什么都没测（路由、来源标注、
  // 未开放不给入口，全在提交之后才成立）。
  if (QA_PINS[base]) {
    const got = await evl(qaProbe(QA_PINS[base]));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 问事探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else for (const x of miss) fail.push(tag + ': 问事结果不等于钉值 — ' + x);
    console.log(miss && miss.length ? '    QA MISMATCH ' + miss.join(' | ')
      : `    问事「${QA_PINS[base].q}」→ 入口 ${got.links} 个，回答 ${got.chars} 字，全部对得上`);
  }
  if (base === 'fengshui-filled') {
    const got = await evl(FS_PROBE);
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 户型探针跑不起来 ' + JSON.stringify(got).slice(0, 160));
    else for (const x of miss) fail.push(tag + ': 户型规则层输出不等于钉值 — ' + x);
    console.log(miss && miss.length ? '    FS MISMATCH ' + miss.join(' | ')
      : `    户型规则层上屏 ${got.chars} 字，依据/不确定项/口径戳/边界话术齐备`);
  }
  if (FS_RECOGNIZE_PINS[base]) {
    if (!STUB) {
      // 钉值全部来自注入：HTTP 503 / provider_error 那句话、墙 2 道那行汇总、可行走网格 33×16、
      // calls=1、未确认 2 个 —— 真后端给的是别的图、别的数、别的落点。
      // 在这里判"不等于钉值"是假红；判"等于"更不可能。版面/对比度/命中区的审计照做。
      console.log('    SKIP 识别三态钉值：只在带 --stub 时有效 —— 钉的每一个值都是 STUB_BOOT 注入进去的那一份契约体');
    } else {
    const got = await evl(fsRecognizeProbe(FS_RECOGNIZE_PINS[base]));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 识别探针跑不起来 ' + JSON.stringify(got).slice(0, 180));
    else for (const x of miss) fail.push(tag + ': 识别三态不等于钉值 — ' + x);
    console.log(miss && miss.length ? `    RECOGNIZE MISMATCH ${miss.join(' | ')} ／ chip=[${got ? got.chips : '?'}]`
      : `    识别态 ${got.state}，请求打了 ${got.calls} 次（>1 就是自动重试），未确认开口 ${got.unconfirmed} 个，3D disabled=${got.disabled3d}`);
    }
  }
  // 编辑闭环态的钉值。每一条都是"按了某个新按钮之后画面真的变了"的证据，
// 而不是"按钮存在" —— 存在性由 fengshui-acceptance 的 copy/promise-has-control 管。
const FS_EDIT_PINS = {
  walls: '墙体（3 道）', openings: 2, 未确认: 1, doorWidth: '宽 1m', 手工: '手工标注',
  kindOn: '厨房', report: ['厨房', '房间 3 间', '入户门所在宫'],
  // 手工加的那道门必须真的喂进判定：加之前那一行是"入户门所在宫：未标"。
  notReport: ['入户门所在宫：未标'], d3enabled: true,
};
const fsEditProbe = p => `(() => {
  const txt = sel => { const el = document.querySelector(sel); return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : null; };
  const walls = txt('#fp-walls'), opens = txt('#fp-openings');
  const sec = [...document.querySelectorAll('section')].find(s => /规则层结果/.test(s.innerText || ''));
  const rep = sec ? (sec.innerText || '').replace(/\\s+/g, ' ') : null;
  const chips = t => [...document.querySelectorAll('.qn-chip')].filter(b => (b.textContent || '').trim() === t);
  const d3 = chips('3D')[0];
  const out = [];
  if (!walls) out.push('墙体那一格不在页面上（#fp-walls）');
  if (!opens) out.push('门窗那一格不在页面上（#fp-openings）');
  if (walls && !walls.includes(${JSON.stringify(p.walls)})) out.push('墙体数应为「' + ${JSON.stringify(p.walls)} + '」，实得「' + walls.slice(0, 40) + '」');
  if (opens && (opens.match(/手工标注|模型把握/g) || []).length !== ${p.openings}) out.push('开口行应有 ${p.openings} 条，实得 ' + (opens.match(/手工标注|模型把握/g) || []).length);
  if (opens && !opens.includes(${JSON.stringify(p.doorWidth)})) out.push('按过一次「宽」之后新门应显示 ' + ${JSON.stringify(p.doorWidth)});
  if (opens && !opens.includes(${JSON.stringify(p.手工)})) out.push('手工画的开口要标「手工标注」（置信度 null），不能冒充模型给的');
  // 门窗格里"未确认" chip 的个数：starter 那道门是识别语义（未确认），手工新加的那道算已确认。
  const unconf = [...document.querySelectorAll('#fp-openings .qn-chip')].filter(b => (b.textContent || '').trim() === '未确认').length;
  if (unconf !== ${p.未确认}) out.push('门窗格里未确认的开口应剩 ${p.未确认} 个（自己画的那个算已确认），实得 ' + unconf);
  const kc = [...document.querySelectorAll('.qn-chip')].find(b => (b.textContent || '').trim() === ${JSON.stringify(p.kindOn)});
  if (!kc) out.push('用途 chip「' + ${JSON.stringify(p.kindOn)} + '」不在页面上');
  else if (!kc.className.includes('qn-chip--on')) out.push('点了「' + ${JSON.stringify(p.kindOn)} + '」之后它不是选中态（用途没写回几何）');
  if (!rep) out.push('规则层结果那一块没出现');
  ${JSON.stringify(p.report)}.forEach(s => { if (rep && !rep.includes(s)) out.push('规则层输出里找不到「' + s + '」（编辑没喂进判定）'); });
  ${JSON.stringify(p.notReport || [])}.forEach(s => { if (rep && rep.includes(s)) out.push('规则层输出里还有「' + s + '」—— 手工加的门窗没有参与判定'); });
  if (!d3) out.push('「3D」chip 不在页面上');
  else if (d3.disabled !== !${p.d3enabled}) out.push('勾了确认之后「3D」的 disabled=' + d3.disabled + '，应为 ' + !${p.d3enabled});
  return { miss: out, walls, openings: opens ? opens.length : 0, d3: d3 ? !d3.disabled : null };
})()`;

// 3D 舞台那一态。两条路都算通过：真出了 canvas，或者真降级了且原因写在页面上。
  // 不通过的是"什么都没发生"—— 黑屏、永久转圈、或者悄悄换了一张图却不说为什么。
  if (base === 'create-sizhu') {
    // 那句话必须**在提交键之前**就在屏上，而且要说清"不会存进我的报告"。
    const got = await evl(`(() => {
      const n = document.getElementById('create-persist-note');
      const txt = n ? (n.innerText || '').replace(/\\s+/g, ' ').trim() : null;
      const miss = [];
      if (!txt) miss.push('选了四柱之后 #create-persist-note 不在屏上（这话得说在提交之前）');
      else {
        if (!txt.includes('四柱直批')) miss.push('那句里没有「四柱直批」');
        if (!txt.includes('不会存进')) miss.push('那句里没有明说不会存进服务器');
        if (!txt.includes('刷新')) miss.push('那句里没说刷新就没了（用户需要知道怎么留档）');
      }
      return { miss, txt: txt ? txt.slice(0, 90) : null };
    })()`);
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 四柱披露探针跑不起来 ' + JSON.stringify(got).slice(0, 140));
    else for (const x of miss) fail.push(tag + ': 四柱披露不合格 — ' + x);
    console.log(miss && miss.length ? '    SIZHU MISMATCH ' + miss.join(' | ')
      : '    四柱披露在屏：' + got.txt);
  }
  // D4/D5 口径披露（批4）：紫微盘上那两行必须真的在屏上，且带口径戳。
  // fixture 模式额外钉死那两个时刻 —— 它们是那份committed盘算出来的，不是手抄的。
  if (base === 'chart-result') {
    // 这两个时刻从**当前绑定的那张 fixture** 里读（不是另抄一份期望值，也不在 --chart-fixture
    // 换盘时失效）；真盘模式 --chart-id 下不钉，因为那张盘是别人的生辰。
    let pinCivil = null; let pinSolar = null;
    if (!LIVE_CHART) {
      try {
        const tstBody = JSON.parse(CHART_BY_PATH['/chart/result/stubchart0001'] || '{}')?.chart?.bazi?.trueSolarTime;
        pinCivil = tstBody?.civilTime ?? null;
        pinSolar = tstBody?.trueSolarTime ?? null;
      } catch { /* 读不到就不钉那两个值，结构断言照旧 */ }
    }
    const got = await evl(`(() => {
      const n = document.getElementById('ziwei-caliber');
      const miss = [];
      if (!n) miss.push('紫微口径披露不在屏上（#ziwei-caliber）—— 引擎字段改了的话它就是会安静地整块消失');
      else {
        const txt = (n.innerText || '').replace(/\\s+/g, ' ').trim();
        const ps = n.querySelectorAll('p').length;
        if (n.getAttribute('data-caliber') !== 'ziwei-clock-hour-v1') miss.push('口径戳不是 ziwei-clock-hour-v1，实得 ' + n.getAttribute('data-caliber'));
        if (ps < 2) miss.push('只有 ' + ps + ' 行，时辰与年界两行都该在');
        if (!/时辰/.test(txt)) miss.push('没有「时辰」那一行');
        if (!/年界/.test(txt)) miss.push('没有「年界」那一行');
        if (!/未做真太阳时校正/.test(txt)) miss.push('没明说紫微这一侧未做真太阳时校正');
        if (/已跨时辰/.test(txt)) miss.push('披露替这张盘判了"已跨时辰"—— 那需要时辰边界，属安星输入');
        ${pinCivil ? `if (!txt.includes(${JSON.stringify(pinCivil)})) miss.push('钟表时刻没上屏（该有 ${pinCivil}）');` : ''}
        ${pinSolar ? `if (!txt.includes(${JSON.stringify(pinSolar)})) miss.push('真太阳时时刻没上屏（该有 ${pinSolar}）');` : ''}
      }
      return { miss, txt: n ? (n.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : null };
    })()`);
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 紫微口径探针跑不起来 ' + JSON.stringify(got).slice(0, 140));
    else for (const x of miss) fail.push(tag + ': 紫微口径披露不合格 — ' + x);
    if (miss && !miss.length) console.log('    紫微口径在屏：' + got.txt);
  }
  // D1 配额那一行：桩现在照 getQuota 原样返回 unlimited:true，所以这一行必须显示"内测免费"。
  // 这一条同时管两件事：前端确实去读了额度，以及桩没有再假装有配额。
  if (/^create/.test(base)) {
    const q = await evl(`(() => {
      const n = document.getElementById('create-quota');
      const txt = n ? (n.innerText || '').replace(/\\s+/g, ' ').trim() : null;
      const miss = [];
      if (!n) miss.push('额度那一行不在页面上（#create-quota）');
      else {
        if (n.getAttribute('data-quota-kind') !== '内测免费') miss.push('data-quota-kind 是 ' + n.getAttribute('data-quota-kind') + '，桩给的应是 内测免费');
        if (!/不限次数/.test(txt || '')) miss.push('那一行没写"不限次数"，实得「' + txt + '」');
        if (/\\d/.test(txt || '')) miss.push('那一行出现了数字（' + txt + '）—— 额度只能来自服务端，不许有兜底常量');
      }
      return { miss, txt };
    })()`);
    const miss = q && Array.isArray(q.miss) ? q.miss : null;
    if (!miss) fail.push(tag + ': 额度探针跑不起来 ' + JSON.stringify(q).slice(0, 140));
    else for (const x of miss) fail.push(tag + ': 配额显示不等于钉值 — ' + x);
    if (miss && !miss.length) console.log('    配额行：' + q.txt);
  }
  if (base === 'fengshui-edit') {
    const got = await evl(fsEditProbe(FS_EDIT_PINS));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 编辑探针跑不起来 ' + JSON.stringify(got).slice(0, 180));
    else for (const x of miss) fail.push(tag + ': 编辑闭环不等于钉值 — ' + x);
    console.log(miss && miss.length ? `    EDIT MISMATCH ${miss.join(' | ')}`
      : `    编辑闭环：${(got.walls || '').slice(0, 14)}、手工门窗已进判定、3D disabled=${!got.d3}`);
  }
  if (base === 'fengshui-3d') {
    await evl(`window.__fp = { frames: 0, t0: performance.now() };
      (function loop(){ window.__fp.frames++; requestAnimationFrame(loop); })(); true`);
    await sleep(2000);
    const got = await evl(`(() => {
      const fps = Math.round(window.__fp.frames / ((performance.now() - window.__fp.t0) / 1000) * 10) / 10;
      const stage = document.querySelector('[data-fp-stage]');
      const canvas = stage ? stage.querySelector('canvas') : null;
      const reason = [...document.querySelectorAll('p.qn-alert')].map(p => (p.textContent || '').trim())
        .filter(t => /等轴|帧率|上下文/.test(t));
      const readout = [...document.querySelectorAll('span.qn-meta')].map(s => (s.textContent || '').trim())
        .find(t => /首帧/.test(t)) || null;
      return { fps, canvas: !!canvas, canvasW: canvas ? canvas.width : 0, reason, readout,
        rendererRaw: (() => { try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl'); const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
          return dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'no-debug-info';
        } catch { return 'probe-failed'; } })(),
        scrollHijack: stage ? getComputedStyle(stage).touchAction : null,
        bodyTouch: getComputedStyle(document.body).touchAction };
    })()`);
    if (!got || typeof got.fps !== 'number') fail.push(tag + ': 3D 探针跑不起来 ' + JSON.stringify(got).slice(0, 140));
    else {
      if (!got.canvas && !got.reason.length)
        fail.push(`3D 既没有 canvas，也没有写明降级原因（fps ${got.fps}）—— 静默失败`);
      if (got.canvas && got.canvasW < 100) fail.push(`canvas 宽度只有 ${got.canvasW}，尺寸没铺开的 3D 不算渲染出来`);
      // 帧率下限 45 是对着用户的 GPU 定的。--disable-gpu 那套跑的是 SwiftShader（CPU 光栅化），
      // 同一个场景实测 42.8fps，而 VH_GPU=1 下是 58.9 / 62.2 —— 差的是渲染器，不是产品。
      // 所以这条只在"软件光栅化"这个可测量的事实上让步，并且两个数都印出来；
      // 不降下限，也不把红改成无。
      if (got.canvas && got.fps < 45) {
        if (SOFTWARE_GL.test(got.rendererRaw || '')) warns.push(`${tag}: 3D 帧率 ${got.fps}fps < 45，但 WebGL 跑在软件光栅器上（${got.rendererRaw}）—— 用 VH_GPU=1 复测`);
        else fail.push(`3D 帧率 ${got.fps}fps < 45（连续 2s 采样；渲染器=${got.rendererRaw}，不是软件光栅）`);
      }
      // 裁定：touch-action:none 只许落在舞台这一块，页面纵向滚动不能被劫持。
      // 所以两头都要钉：舞台是 none（否则 OrbitControls 收不到手势），body 不是 none（否则整页滚不动）。
      if (got.scrollHijack !== 'none') fail.push(`舞台 touch-action=${got.scrollHijack}，应为 none`);
      if (got.bodyTouch !== 'auto') fail.push(`body touch-action=${got.bodyTouch}，页面滚动被劫持`);
      console.log(`   3D[chrome=${GPU ? 'gpu' : 'no-gpu'}] canvas=${got.canvas} 宽=${got.canvasW} fps=${got.fps}`
        + ` 实测渲染器=${got.rendererRaw} 首帧读数="${got.readout ?? '无'}" 降级="${got.reason.join(' / ') || '无'}"`);
    }
  }
  // 主题正反向断言（纠正一）。跑在 census 之前、AFTER 之后：/western 的问答卡插进来
  // 不该改变任何计算色，所以先后无所谓；但必须在滚动扫之前跑完，别拿别的段的位置说事。
  if (THEME_STATES[base]) {
    const kind = THEME_STATES[base];
    const got = await evl(themeProbe(kind));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 主题探针跑不起来 ' + JSON.stringify(got).slice(0, 140));
    else for (const x of miss) fail.push(tag + ': 主题不等于钉值 — ' + x);
    console.log(`   THEME[${kind}] main=${got && got.mainBg} card=${got && got.cardBg} body=${got && got.bodyBg}`
      + ` text=${got && got.color} scheme=${got && got.scheme}${got && got.cards ? ' cards=' + JSON.stringify(got.cards) : ''}`);
  }
  // 动爻的金漆只在「最后一条记录正好是动爻」时才上屏 —— 实测约一半的跑法里根本没有对象
  // （每爻老阴/老阳各 1/8）。不把这个数打出来，一次绿会被读成「对比度没问题」，
  // 而那可能只是这盘没有动爻。0 处不是通过，是没测。
  if (base === 'liuyao-done') {
    const n = await evl(`(() => { const ink = document.querySelector('.qn-ink'); if (!ink) return -1;
      const gold = e => (getComputedStyle(e).color || '').replace(/\\s+/g, '') === 'rgb(227,205,150)';
      // 只有点亮那一行会合成出 rgb(95,80,51) 这个棕底；其余行压在墨底上，同一个前景本来
      // 就有 4.73:1，不构成 AA 对象。所以"有没有对象"要按行底判，不能只数前景。
      const lit = e => { for (let p = e; p && p !== ink; p = p.parentElement)
        if ((getComputedStyle(p).backgroundColor || '').replace(/\\s+/g, '') === 'rgba(178,149,93,0.12)') return true; return false; };
      return [...ink.querySelectorAll('*')].filter(e => gold(e) && lit(e)).length; })()`);
    console.log('    金漆压在点亮行上的 AA 对象 ' + n + ' 个' + (n === 0 ? '（本轮 AA 检查没有对象，不是「已通过」）' : ''));
  }
  // 状态圆点（裁定 ⑤ 的屏侧）。钉值不齐就判红，不接受"这一屏恰好没对象"当通过 ——
  // 与金漆那一档同一教训：0 个对象不是通过，是没测。
  if (DOT_STATES[base]) {
    const got = await evl(dotProbe(DOT_STATES[base]));
    const miss = got && Array.isArray(got.miss) ? got.miss : null;
    if (!miss) fail.push(tag + ': 状态点探针跑不起来 ' + JSON.stringify(got).slice(0, 140));
    else for (const x of miss) fail.push(tag + ': 状态点不达标 — ' + x);
    console.log(`   STATUS-DOT 点=${got && got.n} 各档=${JSON.stringify(got && got.kinds)}`);
  }
  // 门廊两栏的 default / hover / focus 三态（静态稿那三条并排，这里要在真盘上同样成立）。
  if (base === 'home') await gateInteraction(tag);
  const v = await evl(CENSUS);
  if (v && !v.__err) { v.iw = W; v.ih = H; v.wantTouch = TOUCH; v.url = url; v.firstScreen = fold; }
  results[tag] = v;
  const perf = await evl(`({ lcp: window.__lcpAtLoad === undefined ? (window.__lcp && Math.round(window.__lcp)) : (window.__lcpAtLoad && Math.round(window.__lcpAtLoad)),
    lcpInteract: window.__lcpAtLoad === undefined || !window.__lcp || window.__lcp === window.__lcpAtLoad ? undefined : Math.round(window.__lcp),
    cls: Math.round(window.__cls * 1000) / 1000,
    clsAtLoad: window.__clsAtLoad === undefined ? undefined : Math.round(window.__clsAtLoad * 1000) / 1000,
    preScroll: window.__preScroll || null,
    postScroll: { y: Math.round(window.scrollY), h: document.documentElement.scrollHeight, vh: window.innerHeight } })`);
  results[tag + '__perf'] = perf;
  // D2：CLS 以前只印不判，而且印的是加载值 —— 交互之后把整页推下去那种位移没人管
  // （/western 问事态实测 0.155）。把两个值都挂到这一态上，交给 check() 判。
  if (v && !v.__err) { v.cls = perf.cls; v.clsAtLoad = perf.clsAtLoad; v.perf = perf; }
  // 分段扫必须排在 perf 读数之后：scrollTo 会让懒加载图片进来，那会把 LCP 改成滚动后的值。
  if (v && !v.__err) await sweepTap(v, tag);
  console.log(`\n== ${tag}  ${v && v.path ? v.path : url}`);
  console.log(`   perf ${JSON.stringify(perf)}   ${STUB ? '[FETCH STUB — not a live measurement]' : '[real backend]'}`);
  if (v && !v.__err) {
    const m = v.regions.main || {};
    console.log(`   coarse=${v.pointerCoarse} ovfX=${v.overflowX} text=${v.bodyText} ladder=${JSON.stringify(v.ladder)} | main AA=${m.aaCount || 0} sizes=${JSON.stringify(m.sizes)} | nav AA=${(v.regions.nav || {}).aaCount || 0} | footer AA=${(v.regions.footer || {}).aaCount || 0} | small=${v.tapSmallTotal || 0}个/${(v.smallTargets || []).length}种`);
    // 实测对比度（纠正一 验收①要求"打印实测"，不是只报 0 条违规）。
    const cr = g => { const r = v.regions[g]; if (!r || !r.min) return g + '=未采样';
      return `${g} 最差 ${r.min.ratio}:1(${r.min.size}px「${r.min.text}」压 ${r.min.on}) / 共 ${r.n} 处`; };
    console.log(`   CONTRAST ${cr('main')} | ${cr('nav')} | ${cr('footer')}`);
    if (v.foot) console.log(`   nav=${v.nav && v.nav.h}px shell=${v.shell && v.shell.w}px foot=${v.foot.top}->${v.foot.bottom} docH=${v.docH}${v.docH <= H + 1 ? ' (dead band ' + (H - v.foot.bottom) + 'px)' : ''}`);
    if ((v.clsSrc || []).length) console.log('   CLS-SRC ' + v.clsSrc.map(s => `${s.v}@${s.time}ms: ${s.t.join(' ; ')}`).join('\n          '));
    if ((v.paletteCollisions || []).length) console.log('   COLLIDE (data token shares a rendered value with a text token) ' + v.paletteCollisions.join(' | '));
    if ((v.tapIssues || []).length) console.log('   TAP44 (effective 44px box not reachable) ' + v.tapIssues.join(' | '));
    if ((v.overflowClips || []).length) console.log('   CLIP ' + v.overflowClips.map(c =>
      `${c.sel} ${c.sw}>${c.cw}px ` + (c.declared ? `[declared:${c.declared}]`
        : c.marked && c.hint ? '[affordance]' : '[NO AFFORDANCE]')).join(' | '));
    if (v.plate) console.log(`   PLATE box=${v.plate.cw}px content=${v.plate.sw}px card=${v.plate.cardLeft}->${v.plate.cardRight} plate=${v.plate.left}->${v.plate.right} kong=${v.kongMarks}`);
  }
  if (pageErrors.length) {
    console.log('   PAGEERROR ' + pageErrors.join(' | '));
    for (const e of pageErrors) {
      if (/not valid JSON|Failed to fetch|NetworkError|Load failed/i.test(e)) warns.push(tag + ' threw only because the API was unreachable: ' + e.slice(0, 90));
      else fail.push(tag + ' page error: ' + e.slice(0, 160));
    }
  }
  if (consoleErrors.length) console.log('   CONSOLE ' + consoleErrors.join(' | '));
  // 契约态的判定：网络层看到的这一枪，加上页面落到哪一格。
  if (wire) {
    await send('Fetch.disable');
    const miss = [];
    const rq = wirePauses[0];
    if (wirePauses.length !== 1) {
      miss.push(`出站请求应有 1 发，实得 ${wirePauses.length} 发`
        + (wirePauses.length === 0 ? '（一发都没有 = 拦截 pattern 没命中，或者按钮根本没发东西 —— 这一态就成了空跑）'
          : '（多于 1 发就是自动重试）'));
    } else {
      const hdr = k => Object.entries(rq.headers).find(([h]) => h.toLowerCase() === k)?.[1];
      if (rq.method !== 'POST') miss.push('方法是 ' + rq.method + '，应为 POST');
      const ct = hdr('content-type');
      if (ct !== 'application/json') miss.push('上线的 Content-Type 应为 application/json，实得 ' + JSON.stringify(ct)
        + '（整个头：' + Object.keys(rq.headers).join(',') + '）');
      let body = null;
      try { body = JSON.parse(rq.postData); } catch { miss.push('请求体不是合法 JSON，实得前 60 字：' + rq.postData.slice(0, 60)); }
      if (body) {
        const keys = Object.keys(body).sort().join(',');
        if (keys !== 'imageBase64,visitorId') miss.push('请求体键应正好是 imageBase64,visitorId，实得 ' + keys);
        if (typeof body.imageBase64 !== 'string' || !body.imageBase64.startsWith('data:image/png;base64,'))
          miss.push('imageBase64 应以 data:image/png;base64, 开头，实得 ' + String(body.imageBase64).slice(0, 40));
        // 这条是契约（server 侧 VISITOR_RE 同一条规则），不是前端实现细节：
        // 8..64 个 [A-Za-z0-9_-]。以前只在桩里看过 'v_' 前缀，那是本机生成器的形状，不是契约。
        if (typeof body.visitorId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.visitorId))
          miss.push('visitorId 不合契约形状 ^[A-Za-z0-9_-]{8,64}$，实得 ' + JSON.stringify(body.visitorId));
      }
    }
    const ui = await evl(`(() => {
      const st = document.getElementById('fp-recognize-state');
      const txt = [...document.querySelectorAll('p.qn-alert, p.qn-meta, p.qn-note')]
        .map(x => (x.innerText || '').replace(/\\s+/g, ' ').trim()).join(' | ');
      return { state: st ? st.getAttribute('data-recognize-state') : null,
        calls: window.__recCalls || null, hasNotRetry: /不自动重试|一次都没重试/.test(txt),
        hasHonest: /不装作成功/.test(txt), hasNoGeom: /还没有几何|手工画/.test(txt) };
    })()`);
    if (!ui || typeof ui.state !== 'string') miss.push('识别状态那一行读不到（#fp-recognize-state）');
    else {
      if (ui.state !== '失败') miss.push('拦停之后应落到「失败」那一格，实为 ' + ui.state);
      if (!ui.hasNotRetry) miss.push('页面上没有"不会自动重试"那半句');
      if (!ui.hasHonest) miss.push('页面上没有"这条不装作成功"');
      if (!ui.hasNoGeom) miss.push('没有给出下一步（手工画 / 合成样例）');
    }
    for (const x of miss) fail.push(tag + ': 识别契约（网络层）不合格 — ' + x);
    console.log(miss.length ? '    WIRE CONTRACT MISMATCH ' + miss.join(' | ')
      : `    契约上线核对过：1 发 POST、${Object.keys(wirePauses[0].headers).length} 个头、体 ${wirePauses[0].postData.length} 字，页面落在「${ui && ui.state}」`);
  }
  check(tag, v);
  if (SECTION_SHOTS[base]) await shotSection(tag, SECTION_SHOTS[base]);
  await shot(tag, true);
  return v;
}

// --only filters by tag or url fragment, e.g. --only=chart-result,legal
const keep = (tag, url) => !ONLY.length || ONLY.some(o => tag.includes(o) || url.includes(o));

const pages = [];
for (const [tag, url] of STATIC_PAGES) {
  if (!keep(tag, url)) continue;
  // 契约态要的是浏览器真的把那一枪发出去。--stub 下 window.fetch 被桩换掉了，
  // 网络层根本没有这一发，拦不到不等于契约不合 —— 那种红会把人引向不存在的问题。
  if (LIVE_ONLY.has(tag) && STUB) { console.log(`\nSKIP ${tag}: 需要真实网络层，去掉 --stub 再跑（其余态仍可用 --stub）`); continue; }
  pages.push([tag, url, false]);
}
if (!STUB) {
  for (const [tag, url, kind] of DYNAMIC_PAGES) {
    if (!keep(tag, url)) continue;
    if (IDS[kind]) pages.push([tag, url + IDS[kind], false]);
    else console.log(`\nSKIP ${tag}: pass --${kind}-id=<id> to measure it against live data`);
  }
} else {
  for (const [tag, [id]] of Object.entries(CHART_ROUTES)) {
    if (!keep(tag, '/chart/result')) continue;
    if (CHART_BY_PATH['/chart/result/' + id]) pages.push([tag, '/chart/result/' + id, false]);
  }
  if (keep('report', '/report')) pages.push(['report', '/report/stub-locked', false]);
}

// 六爻结果态：只有注入 fixture 才画得出来。**live 模式不跑**（挂载即 saveReport，见 WRITE_STATES）。
// 四种盘各测一遍：三种起卦方式（摇卦 / 时间 / 报数）+ 一张去掉口径版本戳的老盘。
for (const [tag, [id]] of Object.entries(LIUYAO_ROUTES)) {
  if (!keep(tag, '/liuyao/result')) continue;
  if (LIUYAO_BY_PATH['/liuyao/result/' + id]) pages.push([tag, '/liuyao/result/' + id, false]);
  else console.log(`\nSKIP ${tag}: 盘面来自 sessionStorage，--liuyao-id 渲染不出它，缺 fixture 就是缺 fixture`);
}

// live 只读闸门：把会写的态从这一趟里摘掉，**跑前**就把清单打在日志最前面（裁定要求）。
const liveBlocked = [];
if (!STUB) {
  for (let i = pages.length - 1; i >= 0; i--) {
    const t = pages[i][0];
    if (WRITE_STATES[t]) { liveBlocked.push(t); pages.splice(i, 1); }
  }
  if (liveBlocked.length) {
    console.log(`\nLIVE 只读模式：下面 ${liveBlocked.length} 个态被摘掉，因为它们会 POST 到生产（裁定：测试数据不许落库）`);
    for (const t of new Set(liveBlocked)) console.log(`  - ${t}: ${WRITE_STATES[t]}`);
  }
}

console.log(`\nbase=${BASE}  out=${OUT}  stub=${STUB}  chrome=${CHROME}`);
console.log(`cdp port=${PORT}  profile=${PROFILE}（每次运行独立，跑完删）`);
console.log(`mode: ${STUB ? 'FIXTURES (local dev only)' : 'REAL BACKEND'}`);

// Viewport phases run desktop-first and never interleave, and the orphan sweep has
// to stay in this phase too. Once touch emulation is turned on it cannot be turned
// off again in the same Chrome target — measured here: after a mobile state, both
// setTouchEmulationEnabled(false) and setEmulatedMedia(pointer:'fine') leave
// (pointer: coarse) matching, across navigations. globals.css has a live
// @media (pointer: coarse) rule (.qn-chip min-height), so an interleaved run
// measures every later desktop state with mobile CSS.
await metrics(1280, 900, false);
for (const [tag, url] of pages) { await metrics(1280, 900, false); await measure('d1-' + tag, url); }

// orphan routes only have to answer without throwing
await metrics(1280, 900, false);
for (const [tag, url] of ORPHAN_PAGES) {
  if (!keep(tag, url)) continue;
  await goto(url);
  const chars = await evl('(document.body.innerText || "").replace(/\\s+/g,"").length');
  const body = await evl('document.body.innerText.slice(0,400)') || '';
  console.log(`\n== ${tag} ${url}  text=${chars}`);
  // an unreachable API shows up as "HTML where JSON was expected" or a network
  // error; that is an environment fact, not a route bug, so it warns instead of
  // failing. Everything else is a real throw and does fail.
  for (const e of pageErrors) {
    if (/not valid JSON|Failed to fetch|NetworkError|Load failed/i.test(e)) warns.push(tag + ' threw only because the API was unreachable: ' + e.slice(0, 90));
    else fail.push(tag + ' orphan threw: ' + e.slice(0, 160));
  }
  if (/This page could not be found|404/i.test(body)) fail.push(tag + ' orphan renders a 404 body');
  if (chars < 20) fail.push(tag + ' orphan renders no content (' + chars + ' chars)');
}

// second phase: same routes at 375x812 with touch, now that coarse is allowed to stick
await metrics(375, 812, true);
for (const [tag, url] of pages) { await metrics(375, 812, true); await measure('m1-' + tag, url); }

// prefers-reduced-motion must leave nothing moving
console.log('\n===== reduced motion =====');
RM = 'reduce';
await metrics(375, 812, true);
for (const [tag, url] of STATIC_PAGES.slice(0, 3)) {
  if (!keep(tag, url)) continue;
  await goto(url);
  const r = await evl(`(() => { const bad = []; let total = 0;
    for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e);
      const a = cs.animationName; if (!a || a === 'none') continue; total++;
      const d = parseFloat(cs.animationDuration) || 0, dl = parseFloat(cs.animationDelay) || 0;
      if (d > 0.01 || dl > 0.01) bad.push(String(e.className).slice(0, 30) + ' ' + a + ' ' + d + 's/' + dl + 's'); }
    return { animated: total, stillMoving: bad.slice(0, 4) }; })()`);
  console.log(`  ${tag} ${JSON.stringify(r)}`);
  if (r && r.stillMoving && r.stillMoving.length) fail.push('reduced-motion ' + tag + ': ' + r.stillMoving.join(', '));
}
RM = 'no-preference';

writeFileSync(`${OUT}/census.json`, JSON.stringify({ base: BASE, stub: STUB, fail, warns, exempts, results }, null, 1));
console.log('\n' + '='.repeat(60));
if (warns.length) {
  console.log(`${warns.length} WARNING(S)`);
  for (const w of warns) console.log('  ~ ' + w);
}
if (exempts.length) {
  console.log(`${exempts.length} EXEMPTED VIOLATION(S) — tracked, not passed`);
  for (const e of exempts) console.log('  ! ' + e);
}
const cssBad = cssTokenAudit();
for (const x of cssBad) fail.push('CSS-TOKEN ' + x);
if (!cssBad.length) console.log('CSS-TOKEN western 作用域内零写死色，western token 全部有人用');

// --only 打空了也报"ALL PASSED — 0 态"，是一种静默绿：写错一个斜杠（Git Bash 会吃掉
// 参数开头的 /western）就整轮什么都没测，退出码还是 0。筛过就必须筛到东西。
const ranStates = Object.keys(results).filter(k => !k.endsWith('__perf')).length;
if (ONLY.length && ranStates === 0) {
  fail.push(`--only=${ONLY.join(',')} 一个态都没匹配到（0 态）—— 拼错了，这一轮不算通过`
    + `${liveBlocked.length ? `。另一种可能不是拼错：live 只读刚把 ${liveBlocked.length} 个会 POST 的态摘掉了（${[...new Set(liveBlocked)].join('、')}），`
      + '筛出来的恰好全是被摘掉的那些时，请在 --stub 下跑这些态' : ''}`);
}
if (fail.length) {
  console.log(`${fail.length} FAILURE(S)`);
  for (const f of fail) console.log('  - ' + f);
} else {
  console.log(`ALL CHECKS PASSED — ${ranStates} states` +
    (exempts.length ? ` (with ${exempts.length} exempted violation(s) above)` : '') +
    (warns.length ? ` (with ${warns.length} warning(s) above — 含 KNOWN-CONTRAST)` : ''));
}
// 跑完把"因只读而被摘掉的态"再报一次（裁定要求跑前列清单、跑后报跳过项 ——
// 只报一遍的话，日志一翻过那段就没人知道这一趟少跑了 12 个态）。
if (!STUB) {
  console.log(`live 只读：这一趟跑 ${ranStates} 个态，因会 POST 而跳过 ${liveBlocked.length} 个`
    + `${liveBlocked.length ? '（' + [...new Set(liveBlocked)].join('、') + '）。' : '。'}`
    + '这些态只能在 --stub 下测，或对着本机后端跑 —— 生产库不接测试数据。');
}
console.log('evidence written to ' + OUT);
ws.close();
chrome.kill();
// 等浏览器真的退出再删目录：Windows 上它还握着文件句柄时 rmSync 直接 EPERM，
// 而 process.on('exit') 那个兜底是同步的，重试也救不了"进程还没退"这种情况。
await new Promise(res => { chrome.once('close', res); setTimeout(res, 4000); });
dropProfile();
process.exit(fail.length ? 1 : 0);
