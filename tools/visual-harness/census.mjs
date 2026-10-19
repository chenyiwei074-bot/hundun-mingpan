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
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

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
  ['home', '/'],
  ['create', '/create'],
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
const AFTER = {
  'home': `(() => { const b = [...document.querySelectorAll('button')]
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
};

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

// ---------------------------------------------------------------- chrome + cdp
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${PORT}`, 'about:blank'],
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
        t: (e.sources || []).slice(0, 3).map(s => {
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
  window.fetch = async (u) => {
    const url = String(u);
    if (url.includes('/api/chart/result/')) { let p = null; try { p = JSON.parse(sessionStorage.getItem('chart_preview') || 'null'); } catch (e) {}
      return J({ success: true, data: { chartData: p && p.chart, name: p && p.chartName } }); }
    if (url.includes('/api/chart/status/')) return J({ success: true, data: { status: 'done' } });
    if (url.includes('/api/chart/quota')) return J({ success: true, data: { used: 0, remaining: 3, limit: 3 } });
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
await send('Runtime.enable');

// ---------------------------------------------------------------- measurement
const CENSUS = String.raw`(() => {
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
  // nav before footer: region() matched footer first for elements inside the nav
  const region = el => { if (el.closest('svg')) return 'svg'; if (el.closest('nav')) return 'nav';
    if (el.closest('footer')) return 'footer'; if (el.closest('main')) return 'main'; return 'other'; };

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

  const R = {}; const touch = {}; const off = []; const inked = [];
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
        if (worst < (large ? 3 : 4.5)) R[g].aa.push({ text: t.slice(0, 20), color: cs.color,
          on: 'rgb(' + onBg.join(',') + ')', size, weight: cs.fontWeight, ratio: Math.round(worst * 100) / 100 });
      }
    }
    const ctl = el.closest('a,button,[role=radio],[role=tab]');
    if (ctl) { const b = ctl.getBoundingClientRect();
      if (b.height < 44 || b.width < 44) {
        const k = g + '|' + (ctl.textContent.trim().slice(0, 12) || '?') + '|' + Math.round(b.width) + 'x' + Math.round(b.height);
        touch[k] = (touch[k] || 0) + 1; } }
  }

  // ---- Tap targets v2: *effective* tappability, not just the painted box. ----
  // The pass above has two blind spots that made a green small=0 meaningless:
  //  (a) it only ever saw a control that contains a text node, so an icon-only
  //      button -- the launcher's 32px close X -- is invisible to it;
  //  (b) it read getBoundingClientRect, so a control that deliberately grows its
  //      hit area past its visual box (::after overflow) still reads as "small".
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
  const TAP = 44;
  const tapIssues = [];
  const ctlSeen = new Set();
  // No <label>: a label with no associated control is not a pointer target, and the
  // form labels here are 422x20 blocks that would drown the real findings.
  const ctlSel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=tab],[role=radio],[role=button],[role=checkbox],[role=option]';
  for (const el of document.querySelectorAll(ctlSel)) {
    if (ctlSeen.has(el)) continue;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.1 || cs.pointerEvents === 'none') continue;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    ctlSeen.add(el);
    if (r.width >= TAP && r.height >= TAP) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Only audit a control reachable at its own centre. When a modal is open,
    // everything behind its backdrop is inert -- reporting those as small targets
    // would be noise, not a finding. That is the state the home AFTER-click creates.
    const self = document.elementFromPoint(cx, cy);
    if (!self || !(self === el || el.contains(self))) continue;
    const half = TAP / 2 - 0.5;
    let miss = 0, untestable = 0;
    for (const [dx, dy] of [[-half, -half], [half, -half], [-half, half], [half, half]]) {
      const x = cx + dx, y = cy + dy;
      // A corner pushed outside the viewport cannot be judged -- the edge of the
      // document sits there for a reason unrelated to this control.
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { untestable++; continue; }
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) miss++;
    }
    if (miss && untestable < 4) {
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');
      const label = txt.slice(0, 12) || (el.getAttribute('aria-label') || '').trim().slice(0, 12) || '(icon-only)';
      tapIssues.push(region(el) + '|' + label + '|' + Math.round(r.width) + 'x' + Math.round(r.height) +
        '|miss' + miss + (txt ? '' : '|ICON'));
    }
  }

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
      return { tag: shell.tagName.toLowerCase(), w, max: getComputedStyle(s).maxWidth, cls: s.className.slice(0, 40) }; })() : null,
    bodyDisplay: getComputedStyle(document.body).display,
    regions: {}, offLadder: off,
    overflowClips: clips, kongMarks: kong, plate,
    smallTargets: Object.keys(touch).sort(),
    tapIssues: [...new Set(tapIssues)].sort(),
    clsSrc: (window.__clsSrc || []).slice(0, 8),
  };
  for (const [k, v] of Object.entries(R)) out.regions[k] = {
    sizes: [...v.sizes.keys()].sort((a, b) => a - b),
    aaCount: v.aa.length, aa: v.aa.slice(0, 20) };
  return out;
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
      .map(a => (a.innerText || '').trim()).filter(Boolean) };
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
  if (!!v.pointerCoarse !== !!v.wantTouch) bad(`pointer mismatch: asked ${v.wantTouch ? 'coarse' : 'fine'}, page sees ${v.pointerCoarse ? 'coarse' : 'fine'}`);
  for (const c of (v.cssInkData || [])) bad(`stylesheet paints data colour as ink: ${c}`);

  // shell must fill up to its own max-width, never collapse to max-content
  if (v.shell && v.shell.max && v.shell.max !== 'none') {
    const cap = parseInt(v.shell.max, 10) || 1e9;
    const want = Math.min(cap, v.iw || W);
    if (Math.abs(v.shell.w - want) > 1) bad(`SHELL COLLAPSED: ${v.shell.tag}.${v.shell.cls.split(' ')[0]} is ${v.shell.w}px, expected ${want}px`);
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

  for (const [k, want] of Object.entries(WX_FROZEN)) {
    const got = v.tokens['wx-' + k];
    if (got && hexOf(got) && hexOf(got).toLowerCase() !== want) bad(`wx-${k} renders ${got}, frozen value is ${want}`);
  }
  for (const [k, want] of Object.entries(SIHUA_FROZEN)) {
    const got = v.tokens['sihua-' + k];
    if (got && hexOf(got) && hexOf(got).toLowerCase() !== want) bad(`sihua-${k} renders ${got}, frozen value is ${want}`);
  }

  // 裁定 ①：首页首屏四类意图各 ≥1 个可点入口、导航 ≤5 项、首屏不塞营销话。
  // 探针没跑起来也算失败 —— 否则这条要求会静默变成「没人测过」。
  if (/-home$/.test(tag)) {
    const f = v.firstScreen;
    if (!f) bad('first-screen probe did not run — 首页四类意图的要求没被测量过');
    else {
      for (const t of INTENTS_EXPECT) {
        if (!f.intents || !f.intents[t]) bad(`首屏没有「${t}」的可点入口（scrollY=${f.scrollY}、首屏内 ${f.links} 个链接）`);
      }
      if (!f.navItems || !f.navItems.length) bad('导航探针一个都没数到 —— 选择器失效时这条要求会静默通过');
      else if (f.navItems.length > 5) bad(`导航 ${f.navItems.length} 项，超过裁定的 ≤5：${f.navItems.join('/')}`);
      if (f.marketing && f.marketing.length) bad(`首屏出现营销话：${f.marketing.join('、')}`);
      console.log(`   FIRST-SCREEN intents=${f.intents ? Object.values(f.intents).filter(Boolean).length : '?'}/4 nav=${(f.navItems || []).length} marketing=${(f.marketing || []).length} links=${f.links}`);
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

async function measure(tag, url) {
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
    await evl('window.__clsAtLoad = window.__cls; window.__lcpAtLoad = window.__lcp');
    const ok = await evl(AFTER[base]);
    if (ok !== true) fail.push(tag + ': 该状态没到位（' + (typeof ok === 'string' ? ok : JSON.stringify(ok)) + '）—— 这一屏从未被测量');
    else { await sleep(800); console.log('    clicked expand control'); }
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
  const v = await evl(CENSUS);
  if (v && !v.__err) { v.iw = W; v.ih = H; v.wantTouch = TOUCH; v.url = url; v.firstScreen = fold; }
  results[tag] = v;
  const perf = await evl(`({ lcp: window.__lcpAtLoad === undefined ? (window.__lcp && Math.round(window.__lcp)) : (window.__lcpAtLoad && Math.round(window.__lcpAtLoad)),
    lcpInteract: window.__lcpAtLoad === undefined || !window.__lcp || window.__lcp === window.__lcpAtLoad ? undefined : Math.round(window.__lcp),
    cls: Math.round(window.__cls * 1000) / 1000,
    clsAtLoad: window.__clsAtLoad === undefined ? undefined : Math.round(window.__clsAtLoad * 1000) / 1000 })`);
  results[tag + '__perf'] = perf;
  console.log(`\n== ${tag}  ${v && v.path ? v.path : url}`);
  console.log(`   perf ${JSON.stringify(perf)}   ${STUB ? '[FETCH STUB — not a live measurement]' : '[real backend]'}`);
  if (v && !v.__err) {
    const m = v.regions.main || {};
    console.log(`   coarse=${v.pointerCoarse} ovfX=${v.overflowX} text=${v.bodyText} ladder=${JSON.stringify(v.ladder)} | main AA=${m.aaCount || 0} sizes=${JSON.stringify(m.sizes)} | nav AA=${(v.regions.nav || {}).aaCount || 0} | footer AA=${(v.regions.footer || {}).aaCount || 0} | small=${(v.smallTargets || []).length}`);
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
  check(tag, v);
  await shot(tag, true);
  return v;
}

// --only filters by tag or url fragment, e.g. --only=chart-result,legal
const keep = (tag, url) => !ONLY.length || ONLY.some(o => tag.includes(o) || url.includes(o));

const pages = [];
for (const [tag, url] of STATIC_PAGES) if (keep(tag, url)) pages.push([tag, url, false]);
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

// 六爻结果态：只有注入 fixture 才画得出来，live 模式也一样 —— 这个页面不请求 API。
// 四种盘各测一遍：三种起卦方式（摇卦 / 时间 / 报数）+ 一张去掉口径版本戳的老盘。
for (const [tag, [id]] of Object.entries(LIUYAO_ROUTES)) {
  if (!keep(tag, '/liuyao/result')) continue;
  if (LIUYAO_BY_PATH['/liuyao/result/' + id]) pages.push([tag, '/liuyao/result/' + id, false]);
  else console.log(`\nSKIP ${tag}: 盘面来自 sessionStorage，--liuyao-id 渲染不出它，缺 fixture 就是缺 fixture`);
}

console.log(`\nbase=${BASE}  out=${OUT}  stub=${STUB}  chrome=${CHROME}`);
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
if (fail.length) {
  console.log(`${fail.length} FAILURE(S)`);
  for (const f of fail) console.log('  - ' + f);
} else {
  console.log(`ALL CHECKS PASSED — ${Object.keys(results).filter(k => !k.endsWith('__perf')).length} states` +
    (exempts.length ? ` (with ${exempts.length} exempted violation(s) above)` : '') +
    (warns.length ? ` (with ${warns.length} warning(s) above — 含 KNOWN-CONTRAST)` : ''));
}
console.log('evidence written to ' + OUT);
ws.close(); chrome.kill();
process.exit(fail.length ? 1 : 0);
