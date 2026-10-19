# tools/visual-harness

视觉验收探针。驱动真实 Chrome（CDP，无协议包装），按路由 × 视口逐态测量，
任何一条契约破了就 exit 1。只读像素与 computed style：不改应用、不写数据。

给上线验证用：`--base` 指到真实站点即可，**默认不拦截 fetch**。

## 跑起来

```bash
# 依赖：Node >= 22（用全局 WebSocket/fetch）、任一 Chrome/Chromium/Edge。零 npm 安装。
node tools/visual-harness/census.mjs \
  --base=http://localhost:3001 \
  --out=/tmp/vh
```

真实服务器上（要打动态路由就必须给 id，否则这些态会被跳过并打印 SKIP）：

```bash
node tools/visual-harness/census.mjs \
  --base=https://hundunmp.vip \
  --out=/tmp/vh-live \
  --chart-id=<已完成命盘 id> \
  --report-id=<报告订单 id>
```

六爻结果态不需要任何 flag：四张 fixture 已随仓库提交，路径有默认值
（`tools/visual-harness/fixtures/`），不带参数也测得到。
八字结果态同理，`--stub` 下测两张：完整盘 + 无四柱盘（降级那一支）。

浏览器找不到时显式给路径，支持逗号分隔候选表（第一个存在的胜出），也可用 `QN_CHROME`：

```bash
  --chrome=/usr/bin/google-chrome-stable,/usr/bin/chromium
```

| flag | 作用 |
| --- | --- |
| `--base` | 站点地址，默认 `http://localhost:3001`，亦可用 `QN_BASE` |
| `--out` | 证据目录，默认 `.visual-harness` |
| `--chart-id` / `--report-id` | 动态路由用的真实 id |
| `--stub` | 本地无 API 时用 fixture 顶替 fetch |
| `--chart-fixtures=<dir>` | 八字两张盘所在目录，默认 `tools/visual-harness/fixtures` |
| `--chart-fixture=<file>` | 只覆盖完整那张盘（临时换一张用；`--stub` 下才起作用） |
| `--liuyao-fixtures=<dir>` | 六爻四张盘所在目录，默认 `tools/visual-harness/fixtures` |
| `--liuyao-fixture=<file>` | 只覆盖摇卦那一张（临时拿另一张盘调试用） |
| `--only=home,legal` | 按 tag 或 url 片段过滤 |
| `--no-shots` | 不截图，只出 census.json |
| `--port` | CDP 端口，默认 9399，需空闲 |

id 从哪来：harness **只 GET 页面**，不建命盘、不下单、不点按钮。请自己先用一次
真实流程（或复用一条测试数据）拿到 id。全站没有 `onmount` 写接口：前端只在提交
「生成」按钮时 `POST /api/event`，探针不点按钮，所以对着线上跑不会往统计里加数。

`--stub` 只用于本地开发机。它的每个数字都来自 fixture 文案，不是服务返回，
**不要用 `--stub` 判定任何一次上线是否合格**。

`--chart-fixture`：`/chart/result` 的数据在真实流程里来自上一个页面写进
sessionStorage 的 `chart_preview`。现在不必现场抓了 —— 两张合成盘随仓库提交，
由 `tools/visual-harness/make-chart-fixture.ts` 用站点引擎排出来（判据取自
`tools/bazi-acceptance/cases/bazi-validation-v1.json` 那条公开用例，不是从盘面抄的）：

| tag | 文件 | 测的是哪一态 |
| --- | --- | --- |
| `chart-result` | `fixtures/chart-result.json` | 完整盘（戊辰 己未 辛未 乙未）：四柱行 + 「场景矩阵」11 行 |
| `chart-result-empty` | `fixtures/chart-result-no-sizhu.json` | 同一张盘只摘掉 `chart.bazi.siZhu` → 无盘降级那一支（说明 + /create，一行矩阵都不许出） |

```bash
# 重新生成（要带 --check 前先跑这个）
NODE_PATH="$PWD/frontend/node_modules" node server/node_modules/tsx/dist/cli.mjs \
  --tsconfig=frontend/tsconfig.json tools/visual-harness/make-chart-fixture.ts
# 只验不写：committed 与现排逐字节比；八字半边变了 = DRIFT，只有紫微当前大限随年漂 = STALE
NODE_PATH="$PWD/frontend/node_modules" node server/node_modules/tsx/dist/cli.mjs \
  --tsconfig=frontend/tsconfig.json tools/visual-harness/make-chart-fixture.ts --check
```

规则与六爻那四张一样：**不许手改 fixture 文件**；`--chart-fixture=<file>` 仍保留，
用来临时顶替完整那一张（现场抓的真实盘也可以用这条路径进来）。

`--liuyao-fixtures`：`/liuyao/result/[id]` 的盘只从 sessionStorage 的 `liuyao_result` 读，
**不请求 API**，所以 `--liuyao-id` 从来画不出结果态（它落到「未找到卦象数据」空态，然后被
「正文 ≥100 字」判负）。这条路由因此改成注入制，live 模式也一样。仓库里带四份**纯合成**的盘
（问题文案是占位符、时刻与地点写死，无真实客户资料），全部由
`tools/liuyao-ganzhi/make-fixture.ts` 生成：

| tag | 文件 | 钉的是 |
| --- | --- | --- |
| `liuyao-result` | `fixtures/liuyao-result.json` | 摇卦：雷火丰／坎宫 → 泽雷随，空亡 2 爻 |
| `liuyao-result-time` | `fixtures/liuyao-result-time.json` | 时间起卦：火雷噬嗑／巽宫 → 火泽睽，另有取数过程 |
| `liuyao-result-number` | `fixtures/liuyao-result-number.json` | 报数：乾为天／乾宫 → 地雷复，空亡 3 爻 |
| `liuyao-result-legacy` | `fixtures/liuyao-result-legacy.json` | 老盘 = 摇卦那张去掉两个口径版本戳 → A4 那句标注 |

```bash
cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
  node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
  tools/liuyao-ganzhi/make-fixture.ts              # 重新生成四张盘 + 覆盖报告
  # 同一个命令加 --check：只验不写。committed 盘与「现在重跑引擎」逐字节比对，
  # 不一致就 STALE + exit 1 —— 「fixture 过期」本身变成检得出来的状态。
```

两条硬规矩（2026-10-17 #66 事故的直接后果：引擎改了、盘还留着修前的值，
绿灯于是认证了一份过期数据）：

1. **不许手改 fixture 文件。** 盘上存的是引擎算出来的纳甲，手改等于把错值焊进绿灯 gate。
2. **生成前先断言。** 脚本把每张盘逐爻对上 `tools/liuyao-ganzhi/gold.ts` 那份手写京房纳甲
   金标准（干支／六亲／世应／宫；每爻空亡按「已钉死的干支 + 当日旬空」推导，不另立第二份表），
   对不上就 exit 1、一个文件都不写。它同时要求「修前那种取法复算出来的四五六爻必须与金标准
   不同」，防止断言自己退化成恒真。

五个必需状态（四柱+旬空行、每爻空亡、口径与经度行、跨时辰、跨日）是**扫**出来的：
3 天 × 24 时 × 2 分 × 5 组摇卦 × 2 个地点，缺任何一个就 exit 1，清单印在
`fixtures/liuyao-coverage.txt`。当前摇卦那张是 2026-10-12 00:00 钟表 + 乌鲁木齐
→ 真太阳时 10-11 22:03（−116.2 分钟，跨时辰且跨日），四柱 丙午年 戊戌月 戊午日 癸亥时
· 子丑旬空，2 个爻带空亡。

## 注入态必须真的在屏上，而且必须逐爻对得上

六爻这一半用的是 `LIUYAO_PINS`（不是整页 `includes`）：读 `.liuyao-plate` 的行结构，
每爻比「六亲＋干支＋五行」整串 + 世应标记，`[data-ly-kong]` 只对**精确**计数，
再比盘头卦名／宫／变卦，并断言老盘独有的 A4 标注在、其余三张盘上它**不在**。
token 编号 `n01–n48`（每张盘 12 个：本卦 6 + 变卦 6），值全部取自
`gold.ts` 那份金标准（`make-fixture.ts` 的 PINS 段落印的就是同一份），
没有一个字从 fixture 抄——从 fixture 抄等于让盘面自己证明自己对。

理由：本 harness **没有 golden-pixel 比对**，只有文本 token 与结构计数。所以「绿」的含义
必须靠钉得足够细来支撑。空态也有 nav、footer 和合规阶梯，光看「正文够长」会把
「fixture 没被读到」审成通过——与首页那次假绿同一类。断言不过直接判负。

证伪跑过两次：把某一张盘的第 4 爻改成修前的错值 → 只有 `d1/m1-liuyao-result` 那两条
`n04` 报 `屏上「兄弟庚子水」不含金标准「妻财庚午火」`，其余 47 个 token 照旧绿；
把 `getNaJia.ts` 的下标退回 #66 写法 → acceptance 里 8 条断言一起红。两头都有牙齿。

## 溢出必须自己说清楚

裁定 2026-10-17「不接受靠 overflow 兜住不报」。两条断言：

1. 任何 `overflow-x:auto|scroll` 且 `scrollWidth > clientWidth` 的元素，必须有显式可滚动
   标记：要么组件自己量出来（`data-ly-overflow="1"` + 同块的 `[data-ly-overflow-hint]`
   文案，卦盘走这条，因为它是否溢出取决于视口宽度），要么手写声明
   `data-vh-scroll="<affordance>"`（首页功能轮播走这条：6 张卡 × 100%，永远溢出，
   显式凭据是左右两个 44px 箭头）。其余一律判负。
2. `.liuyao-plate` 不得越出所在 `.qn-card`。这条单独存在是因为溢出有两种成因，
   第 1 条只抓得到一种：外层 `display:flex` 的 item 默认 `min-width:auto`，
   整个盘被撑到 min-content 再向两侧溢出卡片，此时滚动容器自己 `scrollWidth ==
   clientWidth`，第 1 条静默通过，而六神列已经画到屏幕边缘（375px 实测）。
   修法是给外层 `width:100%; min-width:0`，让溢出发生在盘自己身上。

## 产物

- `census.json` — `{ base, stub, fail, warns, exempts, results }`，逐态全部测量值
  （token 解析值、区间字号分布、AA 失败明细、CLS 位移来源、命中元素）。
- `<tag>.png` — 逐态整页截图，tag 形如 `d1-chart-result`（d1=1280×900，m1=375×812）。
- 退出码：0 全通过，1 有 FAIL，2 Chrome/CDP 起不来。

## 判负（exit 1）的硬契约

`nav.qn-nav` 与 `footer.qn-footer` 各恰好 1 个；nav 高 56–57px；可见
`.qn-nav__links` 恰好 1 组；`body` 为 flex 列（页脚才能钉底）；正文 ≥100 字
（防止「数据没加载」被当成通过）；boot 脚本确实执行（否则 CLS/LCP 是假数）；
无横向溢出；短页页脚下死区 ≤1px；`main` 区间 0 个 AA 不达标（nav/footer 同样为 0）；
**所有非 svg 区间** 0 个阶梯外字号——阶梯不是写死在本脚本里的，而是从页面自己的
`--qn-fs-*` 令牌逐个读出来（7 档全部解析成功才继续，读不出来直接判负，防止某个令牌
被删空后「阶梯为空 ⇒ 人人通过」）；数据色（`--color-wx-*` / `--color-shen-*`）
**0 次出现在文字色上**——内联 style、字面 hex、样式表三路都查；
五行五个值与冻结十六进制逐个相等；nav/footer 内 0 个 <44px 可点目标；
`prefers-reduced-motion: reduce` 下 0 个仍在动的动画；orphan 路由不抛异常、不渲染 404 体；
被 `overflow-x` 兜住的横向内容必须自带可滚动标记（见「溢出必须自己说清楚」）；
注入进来的态必须在屏上，六爻那四张还要逐爻对得上金标准（见「注入态必须真的在屏上，
而且必须逐爻对得上」）。

只上报不判负：`COLLIDE`（数据色与文字色解析出同一个值，例如
`shen-baihu == text-muted`，属调色板决策不是 bug，但它使「按值比对」不可用，
所以数据色用作墨色一律按**声明来源**判定）；`EXEMPT(by decision)`（见下）。

## EXEMPT 登记表

`census.mjs` 里 `EXEMPT` **现在是空的**。历史上只有一条：首页——`.hp` 自带
`--fs` 标度（hero 44–56、小节 24–30、正文 17、元信息 12），根节点是 `div` 不是
`main`，早于批 0 冻结的阶梯。批 5 按裁定把它收口了：display 档（44/48/56，断点分档
而非 `clamp()`）正式成为阶梯第 6 级，首页正文整体包进 `<main>`，`.hp` 的自带标度
删除。所以这里没有「隐形例外」可登记了。

再往里加条目需要先有裁定：写明为什么不算事故、以及什么条件下清掉。这张表只豁免字号/
地标，**对比度从不查这张表**。

## KNOWN-CONTRAST 登记表（对比度专用，现空）

对比度不许走 EXEMPT，但裁定「本轮不修（P2）」的问题也不能静默飘过。所以有第二张表
`KNOWN_CONTRAST`：按页面 base 分组，条目必须同时钉死**前景与背景**两个实测值（归一化
空白后等值才命中）。命中就降级进 `warns` 通道 —— 打印、写进 `census.json`、并在末尾
`ALL CHECKS PASSED` 那行点名条数；不命中照旧直接红。换任何一组色值都拦不住，
所以这张表替不了别的问题挡刀。

用法只有一条：**修掉了就把条目删干净**。留着 = 给一个已修的问题发免死牌。
登记过并已了结的例子：`liuyao-done` 在 375px 把 13px/11px 的金漆 `#d4b87a` 压在点亮行
合成出的 `rgb(95,80,51)` 上 = 4.08:1（2026-10-19 裁定 ②，改 `--color-accent-gold-on-ink`
`#e3cd96` → 同底 5.01:1，条目随即删除）。

同一批还加了一条前提探针：`liuyao-done` 会打印「金漆压在点亮行上的 AA 对象 N 个」。
动爻要正好落在最后一条记录上才有对象（实测约一半的跑法里 N=0），所以 N=0 的那次绿
**不是**「对比度通过」，是「这次没东西可测」。绿屏要看这一行才算数。

## 观察清单（还没被量到的对比度风险，不是已通过的证明）

裁定 ② 修掉的是**点亮行**那一处。墨底上用 `#d4b87a` 当文字的还有两处，本批不动，
但也不是"没问题"——只是当前没有一个被测状态会让它上屏：

| 位置 | 本批的实际状态 | 什么条件下会红 |
| --- | --- | --- |
| `globals.css:581` `.qn-ink .qn-eyebrow` | eyebrow 只压在 `.qn-ink` 渐变本体上（rgb(35,32,26) 一档），#d4b87a 有 8.46:1 —— 这是算出来的，不是从 census 报出来的 | 任何 ink 面板里再叠一层金雾/选中 wash，把合成底抬到 rgb(95,80,51) 附近 |
| `app/chart/loading/[id]/page.tsx:74,86` active 态文字 | **没测过**：`/chart/loading/<id>` 只在带 `--chart-id` 的真盘模式才进页面表，本轮 `--stub` 一轮都没走到它 | 给载入态补一个可注入状态（或线上跑 `--chart-id`）后，若那两处落在 18px 以下且底不是深墨 |

规矩与 KNOWN-CONTRAST 一致：**量到才收**，不许预先按"应该没问题"发豁免，也不许为它
新增一条 SKIP。要清掉这张表里的某一行，就把它变成一次实测（补一个被测状态 → 出红 → 改 token）。

## 交互态（AFTER）

`AFTER` 里的页面在载入后会点一次控件再测，覆盖只有点开才存在的内容：首页点
「开始使用」打开功能弹层（`.sheet-*` 只在里面渲染），命盘页点「展开」。两点副作用
已经处理：程序化 `.click()` 不设 `hadRecentInput`，展开位移会算进 CLS；点开才出现的
文字也会成为新的 LCP 候选，看起来像几秒的载入回归。所以点之前先快照
`__clsAtLoad` / `__lcpAtLoad`，`lcp` 报载入相的值，交互后的值单独放 `lcpInteract`。
控件找不到时**判负**（"这一半页面从没被测过"），不会静默少测。

## 两条别踩的实现事实

1. **Chrome 的触摸模拟不可逆**。同一个 target 里开过 touch 之后，
   `setTouchEmulationEnabled(false)` 和 `setEmulatedMedia(pointer:'fine')` 都清不掉
   `(pointer: coarse)`（跨导航仍然匹配）。`globals.css` 里有一条
   `@media (pointer: coarse) { .qn-chip { min-height: 44px } }`，所以 d1/m1 两相
   **必须分开跑、桌面相在前**，交错跑会让后面每个桌面态带手机 CSS 测。
2. **注入脚本之间必须有 `;`**。`addScriptToEvaluateOnNewDocument` 里相邻两个 IIFE
   没有分隔符会被解析成调用链并抛错，CLS/LCP observer 静默失效——所以有
   `window.__vhBooted` 这条硬断言。

## 加页面

`STATIC_PAGES`（`[tag, path]`）加一行即可；需要真实数据的加进 `DYNAMIC_PAGES`
并给一个 `kind`，它只在传了对应 `--*-id` 时才跑。被裁掉不重设计的旧路由加进
`ORPHAN_PAGES`：那里只要求「渲染出内容且不抛」。
