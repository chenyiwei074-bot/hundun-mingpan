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
| `--stub` | 本地无 API 时用 fixture 顶替 fetch。**不加 `--stub` 跑全量会在这台机上红 16 条**：`create` 那 8 个态钉的是配额显示（`内测免费` / 「不限次数」），而配额只有真后端才答 —— 实测 `GET :3019/api/charts/quota` 是 404，页面老实落成「未知」。所以 live 要么 `--only=fengshui` 这类收窄跑，要么先把 Express 起起来。批5/批6 记的"live 6 态 / 20 态 PASS"就是收窄跑的结果。 |
| `--chart-fixtures=<dir>` | 八字两张盘所在目录，默认 `tools/visual-harness/fixtures` |
| `--chart-fixture=<file>` | 只覆盖完整那张盘（临时换一张用；`--stub` 下才起作用） |
| `--liuyao-fixtures=<dir>` | 六爻四张盘所在目录，默认 `tools/visual-harness/fixtures` |
| `--liuyao-fixture=<file>` | 只覆盖摇卦那一张（临时拿另一张盘调试用） |
| `--only=home,legal` | 按 tag 或 url 片段过滤。**写 tag，别写 `/western` 这种带斜杠的**：Git Bash 会把参数开头的 `/x` 改成本地路径（实测变成 `C:/Program Files/Git/western`），于是一个态都没筛到。筛到 0 个态现在直接判红，不再报"ALL PASSED — 0 states"。 |
| `--no-shots` | 不截图，只出 census.json |
| `--port` | CDP 端口，默认 9399。**被占用时启动即硬失败（exit 3）并提示换 `--port=`** —— 见下面「并发跑会出假证据」 |

id 从哪来：harness **只 GET 页面**，不建命盘、不下单、不点按钮。请自己先用一次
真实流程（或复用一条测试数据）拿到 id。全站没有 `onmount` 写接口：前端只在提交
「生成」按钮时 `POST /api/event`，探针不点按钮，所以对着线上跑不会往统计里加数。

`--stub` 只用于本地开发机。它的每个数字都来自 fixture 文案，不是服务返回，
**不要用 `--stub` 判定任何一次上线是否合格**。

`--chart-fixture`：`/chart/result` 的数据在真实流程里来自上一个页面写进
sessionStorage 的 `chart_preview`。现在不必现场抓了 —— 几张合成盘随仓库提交，
由 `tools/visual-harness/make-chart-fixture.ts` 用站点引擎排出来（判据取自
`tools/bazi-acceptance/cases/bazi-validation-v1.json` 那条公开用例，不是从盘面抄的）：

| tag | 文件 | 测的是哪一态 |
| --- | --- | --- |
| `chart-result` | `fixtures/chart-result.json` | 完整盘（戊辰 己未 辛未 乙未）：四柱行 + 「场景矩阵」11 行 + 合盘那一节的**降级态**（表单在、0 个立项块） |
| `chart-result-empty` | `fixtures/chart-result-no-sizhu.json` | 同一张盘只摘掉 `chart.bazi.siZhu` → 无盘降级那一支（说明 + /create，一行矩阵都不许出） |
| `chart-hepan` | 同上（`fixtures/chart-result.json`） | 同一张盘，页内那一节被**真实鼠标**推到"已并排"：勾同意 → 按对照 → 八条立项必须逐字对上 census.mjs 里的 `HEPAN_PINS` 手推值（日主相生 / 偏印回指月柱 / 辰巳暗合 / 未亥暗合 / 纳音「同」） |

`chart-hepan` 的对方表单值由 AFTER 钩子填（`1990-2-3`，时辰留默认 12:00），而"勾同意 + 按对照"那两下走
`TRUSTED` 的真实 CDP 点击：它们会在页面里插入整段报告，脚本合成点击不计入 `hadRecentInput`，
会被记成一屏加载位移回归（与户型那两态同一个理由）。另外每个新文档都会先清掉
`hundun.hepan.partner.v1` —— 对方数据活在 sessionStorage 里，不清的话第一次点完之后
后面每一态的合盘节都从表单态变成已填态，`chart-result` 那几态的截图与 44px 读数就不再是同一张页面。

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

## 44px 通道：长页必须分段扫，别写一次性脚本

`small` 与 `TAP44` 这两条都靠 `document.elementFromPoint()`，而它只认**视口坐标**，
所以天生只能判「当前这一屏」。一页 13000px 的结果盘如果只测第一屏，那一次绿只覆盖
了首屏，而打印出来的 `small=21` 读起来却像整页的结论——这正是 2026-10-19 那条裁定
要修的东西。现在：

- **两条通道由同一个 `TAP_AUDIT` 的同一个循环产出**，共用同一个 `inView`。以前
  `smallTargets` 数全文、tap 探针按视口过滤，两边数的不是同一批元素，所以「small=21
  到底是哪 21 个」根本没法回答。同一个循环 ⇒ 不可能再分叉。
- **`sweepTap` 按视口分段滚下去**，段距 `0.9 × 视口高`（留 10% 重叠，跨屏元素至少
  完整落进一段），各段结果取并集；扫完把滚动位置还原到 0，再截图。段数封顶 40，
  真的被封顶会 warn 并写出段距，不会静默少扫。
- 打印格式 `其中 <44 的 119 个 / 30 种标签×尺寸`：**个**是按 DOM 身份去重的元素数
  （相邻两段重复数到同一个元素不会翻倍），**种**是 `区间|文案|尺寸` 去重后的条数。
  以前只有「种」，把 110 个格子读成 30 个是必然误读。
- 每条明细带一位小数与类名（`56.3x30.qn-hit`）。四舍五入过的读数修不动也核不了：
  `126x44` 那种「看着像 44 其实 43.6」的猜测就是这么来的。

四条前提断言（没有它们，这几条会退化成「没人测过」）：某段探针跑不起来 ⇒ 判负并点名
第几段；整页扫下来 `去重 0 个` ⇒ 判负（宁红不静默）；末段再跑一遍全文 CENSUS 与首段比，
AA 或阶梯读数**随滚动变化** ⇒ 判负（说明内容是滚下来才渲染的，首段那份根本不代表这一屏）；
封顶 ⇒ warn。

坑（分段扫第一版就是这么错的）：`getBoundingClientRect()` 返回的已经是**视口**坐标，
不能拿「文档坐标的段窗口」去比。滚到 788px 那段，窗口写成 `[788,1688]` 而屏幕上的元素
rect 仍在 0..900，于是整段命中 0 个——每一段都"通过"，全文却是空的。分段的作用就在于
`scrollTo` 之后「视口」自己换了位置，判定式始终只有那一条。

要看某一态到底数到了什么，不用自己写脚本：

```bash
QN_TAP_DUMP=1 node tools/visual-harness/census.mjs --base=... --only=chart-result --no-shots
```

逐段印 `scrollY`、视口高、命中数，以及每个「没数到」的原因归类
（`skip-disabled/aria-hidden`、`skip-zero-box`、`skip-invisible`、`skip-pointer-none`、
`out-of-window`、`IN-WINDOW`），各取前 10 项。≥44×44 的元素**不探角**：这些控件是
`border-radius: 999px` 的药丸，浏览器把命中测试裁进圆角里，探它的包围盒角会得到一个
用户永远点不到的 miss（实测过，不是推测）。

## 双体系：门廊、两套工作页与"答完之后"那一态

`/` 只剩两个入口，原来的首页搬到 `/oriental`。于是 tag 的归属也换了：

| tag | 路由 | 钉的是哪一态 |
| --- | --- | --- |
| `home` | `/` | 门廊：恰好两栏（`a.domain-card`）、都在首屏、栏底那行是「可用 N · 部分可用 N · 未开放 N · 共 N 项」且三档相加 = 总数；再加 default / hover / focus 三态（见下面第 5 条纪律） |
| `oriental` | `/oriental` | 原首页那一整套（首屏四类意图、启动器、核心引擎）—— `AFTER['oriental']` 点的是「开始使用」 |
| `western` | `/western` | 西方工作页（目录全未开放那一态） |
| `oriental-ask` / `western-ask` | 同上两条 | **问事框提交之后**那一帧：回答卡、来源标注、该给的入口 / 不该给的入口 |
| `oriental-choices` / `oriental-chosen` | `/oriental` | 批B：命中两个同分工具 → 两枚 chip、系统一枚都不替选；再点其中一枚 → 入口出现、来源换成「你在并列的候选里自己挑的」、chip 必须收起 |
| `western-example` | `/western` | 批B：点西方那一系的示例问题（示例不再按状态过滤）→ 必须落到「还没开放」那一支，零入口 |
| `oriental-ime` | `/oriental` | 批B：中文输入法门闩。组词中按 Enter → 一轮都不许多；组词结束再按 → 必须发出去。两步都量，只量后一步的话"根本没实现门闩"也能过 |
| `fengshui` / `fengshui-filled` | `/fengshui` | 空表单，以及勾了确认、点了"算一遍"之后的规则层输出 |
| `fengshui-recognize-fail` / `-candidates` | `/fengshui?recognize=503` / `=ok` | 识别三态里两个后端落点：503 失败、成功但待确认。查询串只给桩看，页面自己不读。**只在 `--stub` 下钉值**（见下面第 3 条纪律） |
| `fengshui-recognize-wire` | `/fengshui` | 契约那一枪的**网络层**核对：CDP Fetch 拦下真实出站请求，验 Content-Type / 体里正好两个键 / base64 前缀 / visitorId 合服务端形状，然后 abort 并验页面落在「失败」。**只在去 `--stub` 时跑** |
| `fengshui-edit` | `/fengshui` | 编辑闭环：真加一道墙、在墙上开个门、调宽、改一间房的用途，再逐条钉回来（墙体数、开口数、未确认数、用途 chip 是否真的选中、手工门有没有进判定、3D 是否解禁） |

纪律写在这里（第 4 条是 2026-10-21 的 live 只读裁定，第 5、6、7 条是同天的改版批A/批B 补的）：

1. **门廊的数不许写死。** 栏底那一行是页面从两套目录现算出来的，harness 只读回来验形状与
   "三档相加 = 总数"；数与目录是否相等由 `directory-acceptance` 的 `gate/*` 在源码侧钉。
   写法在 2026-10-21 从「已开放 N / M 项」改成三档并列 + 总数，理由不是审美：生产上那行印的是
   **已开放 9 / 10**，而 9 里有一项是"部分可用"（有入口但缺一段）—— 旧写法把两种不同的东西
   压成一个分子，读者分不清。三档并列之后，"半开"必须自己说自己是半开的。
2. **问事框必须测"答完之后"。** 只测空输入框等于什么都没测 —— 路由对不对、未开放有没有被
   伪装成可进、来源有没有明写"本机目录匹配、未经模型"，全在提交之后那一帧。
   `western-ask` 的期望是**零个入口**（西方一项都没开放），它防的正是"AI 说有个工具，页面就给了个按钮"。

3. **哪个态在哪个模式下成立，必须写在代码里并且打印出来。** 这三态里两个的每一个钉值
   （503、`provider_error`、墙 2 道、可行走网格 33×16、calls=1、未确认 2 个）都是 `STUB_BOOT`
   注入的那一份契约体 —— 真后端给的是别的图、别的数。所以 `STUB_ONLY` 里那两个态在 live 下
   **既不钉也不点**：点下去会把图真的送给供应商烧一次调用，那不是测试该顺手做的事。
   反过来 `LIVE_ONLY` 那个契约态在 `--stub` 下必须 SKIP —— 桩换掉了 `window.fetch`，
   网络层根本没这一发，**拦不到不等于契约不合**，判负会把人引向一个不存在的问题。
   两种 SKIP 都要打印原因，静默少跑一个态和跑错一样糟。
   版面 / 对比度 / 命中区那些与后端无关的审计，两种模式下都照跑。

4. **live 全量只跑只读态，会 POST 的态一律跳过并把原因打出来（2026-10-21 裁定）。**
   生产库已经有真实客户盘，测试数据一条都不许落库。`WRITE_STATES` 那张表是**读产品代码逐条确认**的，
   不是按页面名猜的 —— 最容易漏的一类不是"点了提交"，而是**挂载即写**：
   `app/liuyao/result/[id]/page.tsx:33` 只要 sessionStorage 里有盘就 `saveReport`，
   而 census 原来那句注释写着"live 模式也一样 —— 这个页面不请求 API"，实测是错的，
   四种六爻盘在 live 下全跑过，每跑一次落四行报告。八字那张同理（`chart/result/[id]/page.tsx:99-133`
   挂载即存 bazi + ziwei 两份，带姓名/生日/出生地）。
   跑前把被摘掉的态列在日志最前面，跑完再报一次跳过数；`--only` 筛出来恰好全是被摘掉的态时，
   那条"0 态"红会附带说明是只读闸门摘的，不是拼错了。
   `GET /api/charts/quota` 这类只读请求照常真跑（本机没有后端时它是 404，页面落「未知」，
   那一档的钉值只在有后端的地方有效）。`fengshui-recognize-wire` 不在跳过表里是有意的：
   它在 Request stage 就被 CDP Fetch abort，那一发永远到不了服务端。

5. **状态类判定必须拿"真按出来的那一帧"和"真渲出来的那个色"，不许拿声明猜（批A，2026-10-21）。**
   门廊那三态是这么量的：
   - `hover` 用 `Input.dispatchMouseEvent{type:'mouseMoved'}` 真把指针移进栏里，再读那一层
     `.domain-card__veil`（一个真实的 `<span>`，不是伪元素 —— 伪元素的样式读不到就等于读不到）的
     `opacity` 与 `background-color`，**把它合成进栏底**之后重判一次文字对比度。
     裁定④禁 `filter:brightness()` 就在这儿兑现：filter 改渲染结果不改声明，判定读到的还是老底。
     触屏档 `(hover:none)` 不跑这一段，并且**打印 SKIP** —— 静默少跑一种状态和跑错一样糟。
   - `focus-visible` 用逐下 `Tab`（`Input.dispatchKeyEvent`）走进去，因为 `el.focus()` 点不亮
     `:focus-visible`，那样读到的是假状态。两栏各验一次：浅底 `#7a5f31`、墨底 `#e3cd96`，
     环宽 ≥2px，对底 ≥3:1（实测 5.35 / 11.55）。只验第一栏的话，"深底那一支"这条裁定就永远没被量过。
   - 状态圆点（`STATUS-DOT`）按**实际渲染底色**算对比度，阈值 3:1，三种状态都要在场：
     点数为 0 判红不判过（"这一页恰好没有徽章"不是通过）。这条一落地就咬到了改版前就存在的红
     ——`部分可用` 那颗 `#b2955d` 在白底只有 2.87:1，而它在墨底有 5.70:1，同一支金不可能两头都达标，
     所以按底分叉取值。
   - 满幅版式（`max-width:none`）以前在 SHELL 那条里是**静默跳过**的，于是"壳塌成内容宽"这一整类
     缺陷在门廊与东方页上从没被测过。现在跳过换成判据：壳宽必须等于 `documentElement.clientWidth`。
     注意用 `clientWidth` 不用 `innerWidth`：后者含滚动条 15px，用错会把每一张满幅页都判成塌了。
   - `navClash`：导航是 `position:fixed`（不占文档流），所以每一态在 `scrollY=0` 扫一遍 `main` 里
     "自己带文字"的元素，凡顶边落在吸顶导航底边之上就红。加这条的起因就是门廊第一版：h1 顶到 49px
     而导航底在 57px，标题上半截压在毛玻璃底下，而宽度 / 溢出 / 命中区 / 对比度**四条全绿** ——
     被压住的那半截字照样是"够对比度的字"。判据两头验过：撤掉 `padding-top` 就点出两行，装上返回空。
     只查带文字的元素：整块背景压在那条半透明带底下是设计，字不是。

6. **来源与降级理由钉"配对"，不钉某一句（批B）。** 桩下 `/api/assistant` 回 404 → 必然回落本机，
   那就必须同时写着「这一轮由本机目录匹配给出，未经模型」**和**「服务端这一轮没用上：服务端返回 404」；
   真后端答了 → 只许写「这一轮来自服务端路由」，不许还挂着降级理由。四种组合里两种合法两种是 bug，
   钉配对关系一次覆盖两种模式；各钉一句的话，缺陷① 修好那天这套钉值就集体过期。
   并列那一支同理：chip 少于两枚就判红 —— "系统替你选了一个"在屏上看起来跟"匹配成功"一模一样。
7. **预留高度这件事，两种模式都要量，而且要量"第二次"。** 东方 hero 里那一版问事框以前不预留
   （怕把四类意图挤出首屏，那是另一条钉着的契约）。实测桌面 1280×900：一条回答 CLS 0.039、
   两条就 0.103 超线；而 375 那一档两次都是 0 —— 不是没问题，是 hero 比视口高、被推走的东西本来就在屏外。
   现在 compact 也预留 132px + 内部滚动，空着的那一块渲染提示文字（预留不等于留一截空白），
   `FIRST-SCREEN intents=4/4` 在两种视口都还在。批B 之前这个交互从未被量过第二次。
8. **预留过高度的那一类态，判据是"零位移"，不是 0.1。** 0.1 那条线咬不住这一类回归：
   实测把 compact 的 132px 预留撤掉，桌面 `d1-oriental-chosen` 只到 0.096、`d1-oriental-ask` 0.036，
   全都不红 —— "修好了"与"又坏了"用通用阈值读出来是同一个颜色。所以 `RESERVED_PANES` 里那几态
   动了就红。这条判据上线当天就抓到一件谁也没看见的事：提交那一刻标签从「问一下」换成「在想」，
   按钮盒子窄 16px，它在 flex 行尾所以左边线右移（`QN_CLS_SRC_MIN=0.0001` 量到 `dx=-16`），
   移动端两态各 +0.001。修法是把按钮宽度钉成「问一下」的实测盒宽（110px），标签换字不许改变盒子。
   位移来源记录的门槛可以用 `QN_CLS_SRC_MIN` 调（默认 0.01，判定读的是总分，不受它影响）。
9. **预留格里"给了结论"不等于"给了下一步"：入口必须量看得见（批B 看截图补的）。**
   `qaProbe` 对带入口的那几态读 `.qa-pane` 的可视高度与最后一个 `a[href]` 的底线，入口落在折线以下就红，
   并把两个数一起打出来（`预留格 152px / 入口要到 143px`）。加这条的当场就红 4 态：132px 那一版
   matched 卡的按钮要到 220px（375 那一档 258px）—— 页面写着"该用的是八字 & 紫微斗数"，
   而"进入"要滚才看得到，宽度/命中区/对比度/CLS 四条全绿。修法两半：卡片顺序改成
   结论 → 入口 → 还要补 → 怎么读，预留高度按量到的 143/139 取 152。
   同批另一条也是看截图才看见的：`align-items:stretch` 把提交按钮拉到 textarea 那么高（110×128），
   而 `.qn-btn` 是 `border-radius:999px` —— 屏幕上是一颗金蛋。改成 `flex-end`。

React 受控 input 在探针里必须走**该元素自己那一族**的原生 setter + `input` 事件（直接改 `.value` 不触发 onChange，
点提交就是空跑一趟 —— 那种绿最骗人）。批B 把问事框换成 `<textarea>` 之后，写死 `HTMLInputElement.prototype`
会直接 wrong-this 抛错，所以 `askHook` 按 `instanceof HTMLTextAreaElement` 选原型。`QA_PINS` 里每条期望都是照 `lib/assistant/intent.ts`
的关键词表人工推出来的，与 kline 那 144 组成对表同一做法。

## 通用规则：任何比较代码文本的闸门，先剥注释（2026-10-21 裁定）

这条不只管 harness，管 `tools/` 下**所有**套件。公共件在 `tools/_lib/codesrc.ts`：
`stripComments`（剥 `//` 与 `/* */`）与 `stripLiterals`（再剥字符串/模板/正则字面量）。
判据是"这一处 `readFileSync` 外面有没有包一层剥注释"，而这条判据本身也被机检：
`tools/kline-acceptance` 的 `gate/text-comparing-gates-strip-comments` 扫 `tools/` 下每个 `.ts`，
列出没包的读点（读 `.json`/`.png` 这类无注释工件除外）。

为什么值得单独立一条：**反向判据**（"这行不许出现 X"）被注释命中只是假红，吵人；
**正向判据**（"X 必须出现在代码里"）被注释满足是假绿 —— 那一格代码早就删了，闸门还在替它说话。
本仓一天内各咬到一次：① tst 同步表的 `forbid` 正则命中了 ops 照搬时保留的说明注释
「原来 return '海中金'」，三份已同步的文件报成 PENDING；② 批7 新加的引用扫描把另一套件
reason 文案里"server 别留 runZiweiTests"那句话算成了调用点。

第一次按这条全量清扫就抓到一条真假绿：`honesty/boundary-on-pages` 要求回执那句边界声明
「不证明掷钱这个动作真的发生过」出现在起卦页 —— 它一直绿，因为那句话只在
`app/liuyao/create/page.tsx` 的 JSX 注释里，屏上那行只印了「已锁定 … seedHash …」。
这条断言的消息本来就写着"不能只活在注释里"，判据与意图一直是对的，只是没人剥注释。

## 户型识别三态：桩怎么造、文件怎么塞、以及一次假绿（2026-10-20）

裁定要的三个态是"识别失败 / 成功未确认 / 确认后进 3D"。后两个由这两态 + `fengshui-filled`
合起来覆盖，全部走 `STUB_BOOT` 里那条 `/api/fengshui/recognize` 规则：

- 落点由 **URL 查询串**选（`?recognize=503` / `?recognize=ok`），页面自己不读它。
  同一张 Chrome 连跑十几个态，用状态变量选分支迟早会串页。
- 失败态按运维给的口径**用"路由返回 503"注入，不改端点**。成功体也不在 census 里抄第二份：
  它 `readFileSync` 的是 `tools/fengshui-acceptance/cases/recognize-success.json`，
  验收套件校形状、这里原样 serve，改形状两边一起红。
- 桩里带一个 `window.__recCalls` 计数，探针钉的是**"请求打了 1 次"这个测量**，不是源码 grep。
  "5xx 不自动重试"用 grep 挡不住 `setTimeout` 循环；数一次请求才叫证据。

**但桩看到的是参数，不是上线。** 桩里那份 `window.__recReq` 记的是 `fetch(url, init)` 拿到的
`init.headers` —— 它等于"我打算发什么"。2026-10-21 拿这个区别做过一次证伪：把 `init` 里的
`Content-Type` 整条删掉，桩侧读出的是 `undefined`（看起来像"没设头"），而浏览器**实际发出去**的是
`Content-Type: text/plain;charset=UTF-8` —— 一个真实的、服务端会照它判定的错值。
所以有了 `fengshui-recognize-wire`：`Fetch.enable(pattern)` → 收 `Fetch.requestPaused` 拿
`request.headers/postData` → `Fetch.failRequest` 拦停 → `Fetch.disable`。四段少最后一段，
拦到而不应答的那一发会让那一页永远挂在 pending 上，后面每一态跟着遭殃
（`harness/wire-state-observes-the-network` 就是把这四段钉住）。
abort 之后页面走的是网络异常那一格，所以这一态同时是"发不出去必须明说发不出去"的浏览器侧证据。

文件注入走 TRUSTED 里的 **`'@file'`** 那一步，不在 `AFTER` 里做：先对 `h1` 这种**非交互**位置打一发
真实 `Input.dispatchMouseEvent`（把 `hadRecentInput` 置起来），再在页面里构造
`atob` → `Uint8Array` → `new File(...)` → `DataTransfer` → `input.files = dt.files` → 派发 `change`。
两个理由：

1. **不用 `DOM.setFileInputFiles`。** 这条路径要测的正是"选完图之后页面自己做了什么"
   （本地校验、读字节、量宽高比、出预览），而 `setFileInputFiles` 绕过了 `accept` 之外的所有判断。
2. **不放在 `AFTER` 里。** `TRUSTED` 在自己的循环前会**再快照一次** `__clsAtLoad`，于是
   "预览卡出现、把下面整块推下去"那段位移被算进"加载期 CLS"。真人选图是用户输入，按定义不计分 ——
   第一版就是这么量出两条 0.139 的**假** warn，改成 `@file` 之后 `CLS load=0`（两视口四态都是 0）。
   不打「选户型图」那一枪，是因为它会唤起原生文件对话框，headless 下有挂住的风险。

**踩到的一次假绿，值得记下来**：`fixtures/floorplan-sample.png` 第一版是我手写 CRC-32 生成的，
我又用**同一份算法**去验它，于是"CRC 全对"而 Chrome 从不解码 —— `readImageAspect` 静默落到 1，
"按宽高比分两轴换算"那条路径看着被真图跑过，一次都没跑过。发现它是因为读了页面上那个
不相干的数（可行走网格 33×31，而 2:1 的图应该是 33×16）。现在两件事都钉住了：
`fengshui-acceptance` 的 `harness/fixture-decodes-under-an-independent-oracle` 用 `node:zlib`
的 `crc32` / `inflateRaw`（另一份实现）复核这张图，探针里 `可行走网格 33×16 格` 是它的
浏览器侧证据。自证要用另一份实现，这是第三次学到同一条。

## 44px 与 CLS 现在是判定，不是读数（D1 / D2）

**TAP44 进判定。** 以前 `tapIssues` 只打印，于是 375px 上一堆 `13x13` 的复选框、
`43x44` 的 chip、`17px` 高的链接都能带着 `ALL PASSED` 出门。现在每条 blocking 违例直接红。

唯一的豁免是 WCAG 2.5.5 的 **inline 例外**，判据写得很窄，四条同时成立才算：
`<a href>`、`display` 是 inline 系、所在块里链接前后都还有正文（整行只有它 = 独立入口，不豁免）、
且它不超过所在块的六成宽。豁免项**逐条打印并进 warns** —— 一个悄悄变大的桶比一条红更糟。
密网格上的控件（K线那种）不要用 `::after` 扩命中区，会互相抢；改语义（只读）或改布局。

**CLS 分两段判。** `交互后位移 = 累计 CLS − 点击前读数`，≥0.1 直接红；
加载期就存在的位移单独进 warn 并把数印出来（本轮量到六爻结果页 0.171–0.237，
是既有缺陷、不在这一批顺手修，但也不能因为"没人断言"被读成没问题）。
排查位移靠 `CLS-SRC`（每条最多列 9 个移动元素，含 `dx/dy/h`）——
`/western` 问事态那 0.106 就是靠它定位到"提交按钮在 `flexWrap:'wrap'` 的行里换了行"
（`dx=-192 dy=55`），而不是靠猜；固定高度面板与 `contain` 都排除过之后才找到真凶。

## 产物

- `census.json` — `{ base, stub, fail, warns, exempts, results }`，逐态全部测量值
  （token 解析值、区间字号分布、AA 失败明细、CLS 位移来源、命中元素）。
- `<tag>.png` — 逐态整页截图，tag 形如 `d1-chart-result`（d1=1280×900，m1=375×812）。
- 退出码：0 全通过，1 有 FAIL，2 Chrome/CDP 起不来。

## 并发跑会出假证据（2026-10-20 裁定 ②）

两个 census 实例同时跑**不会报错**：第二个连的是同一个 `--port`（默认 9399）上已经起好的
浏览器，于是两边互相把对方的页面导航走、注入脚本互相覆盖，sessionStorage 还会串页。
现场是：一次全量跑出 **53 条红**，其中"降级盘上场景矩阵不存在""合盘 degraded 却有 8 块"
这类根本不可能同时成立的东西混在一起 —— 全是并发串出来的，不是产品缺陷。第一次看到时我
差点去修那个不存在的缺陷。

所以启动前两道硬闸：

1. **端口探测**：`net.connect` 到 `127.0.0.1:PORT`，连得上就 **exit 3** 并提示
   `--port=<PORT+1>`。故意不用"试着 bind 一下看占不占得到"那种写法 —— bind 成功只证明
   这个进程占得住它，而事故恰恰发生在"能连上"的时候。
2. **每次运行一个独立临时 profile**（`--user-data-dir=<tmp>/hundun-vh-XXXXXX`）。不传这个参数时
   Chrome 用的是这台机器的默认 profile，`localStorage`（比如 `hundun_visitor_id`）与 cookie
   会跨运行相连，同一条命令看到的页面取决于上一跑留下了什么。
   跑完删：先等浏览器真的 `close` 再删（Windows 上它还握着句柄时 `rmSync` 直接 EPERM），
   再加同步重试；真删不掉就把路径打出来。启动时顺手回收 **24 小时以前**留下的同名目录
   （只认 `hundun-vh-` 前缀，当前这次用的是新建路径，另一个换 `--port` 跑的实例也一样 ——
   不可能误删正在用的）。

`base=... profile=... cdp port=...` 每次开跑都打一行，出问题能认出是哪一次运行。
退出码：0 全过 / 1 有断言红 / 2 起不了浏览器 / **3 端口被占**。

## 判负（exit 1）的硬契约

`nav.qn-nav` 与 `footer.qn-footer` 各恰好 1 个；nav 高 56–57px；可见
`.qn-nav__links` 恰好 1 组；`body` 为 flex 列（页脚才能钉底）；正文 ≥100 字
（防止「数据没加载」被当成通过）；boot 脚本确实执行（否则 CLS/LCP 是假数）；
无横向溢出；短页页脚下死区 ≤1px；`main` 区间 0 个 AA 不达标（nav/footer 同样为 0）；
**所有非 svg 区间** 0 个阶梯外字号——阶梯不是写死在本脚本里的，而是从页面自己的
`--qn-fs-*` 令牌逐个读出来（7 档全部解析成功才继续，读不出来直接判负，防止某个令牌
被删空后「阶梯为空 ⇒ 人人通过」）；数据色（`--color-wx-*` / `--color-shen-*`）
**0 次出现在文字色上**——内联 style、字面 hex、样式表三路都查；
五行五个值与冻结十六进制逐个相等；nav/footer 内 0 个 <44px 可点目标（按分段扫全文取并集
后判，见「44px 通道」）；
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

`/create` 现在有四个态，各管一件事：`create`（默认的公历单人）、`create-double`
（真实点开「双人合盘」那一栏 —— 合盘接管后新增的同意框与对方闰月开关都在里面）、
`create-lunar`（点「农历」再把年/月设成 2025 年 6 月，把闰月开关逼出来）、
`create-sizhu`（点「四柱」，钉那句"这条不会存进我的报告"真的在提交键之前就在屏上）。第三个态存在的原因
是这批摘掉了三处 `.qn-chip` 上的内联 `minHeight:30`，不新增态就没法证明 44px 真的生效了；
农历这一整套输入以前从未被任何一屏量过。设 select 必须走 `HTMLSelectElement` 的原生 setter
加 `change` 事件，直接赋 `.value` 不触发 onChange，下一步就永远等不到那个 chip。

紫微那张卡另有一条 `ZIWEI_PINS`（钉在 `chart-result` / `chart-hepan` 两态）：按
`[data-zw-key]` / `[data-zw-other]` 数出 5 + 7 且并集恰好是十二宫，并核对按钮上写的
"其余N宫"与实数一致。它盯的是一个不报错的缺陷 —— 宫名照 `types.ts` 的 `ZiweiGong` 声明写
（除命宫外都带"宫"），而 `ziwei-standard.ts` 实际产出不带，find 不到就只是少渲染四张卡。
所以这条按 DOM 上的属性数，不读文案。

## 别踩的实现事实

1. **Chrome 的触摸模拟不可逆**。同一个 target 里开过 touch 之后，
   `setTouchEmulationEnabled(false)` 和 `setEmulatedMedia(pointer:'fine')` 都清不掉
   `(pointer: coarse)`（跨导航仍然匹配）。`globals.css` 里有一条
   `@media (pointer: coarse) { .qn-chip { min-height: 44px } }`，所以 d1/m1 两相
   **必须分开跑、桌面相在前**，交错跑会让后面每个桌面态带手机 CSS 测。
2. **注入脚本之间必须有 `;`**。`addScriptToEvaluateOnNewDocument` 里相邻两个 IIFE
   没有分隔符会被解析成调用链并抛错，CLS/LCP observer 静默失效——所以有
   `window.__vhBooted` 这条硬断言。
3. **时间起卦那几个态的读数跟着墙上时钟走**。`/meihua` 排的是"当下这一时刻"，
   所以它的 `docH` / 文字长度在跨**时辰**（每 2 小时一档）的两跑之间会差一截 ——
   实测：20:40 那一跑 `m1-meihua docH=2482 / bodyText=856`，21:20 那一跑
   `2456 / 855`（跨过 21:00 的戌→亥），中间同一时辰内连跑三次数值一字不差。
   拿两跑的数值做差之前先看它们是否在同一时辰内，别把时辰边界读成"某个改动改变了渲染"
   （我这次就先怀疑到了临时 profile 头上）。

## 加页面

`STATIC_PAGES`（`[tag, path]`）加一行即可；需要真实数据的加进 `DYNAMIC_PAGES`
并给一个 `kind`，它只在传了对应 `--*-id` 时才跑。被裁掉不重设计的旧路由加进
`ORPHAN_PAGES`：那里只要求「渲染出内容且不抛」。
