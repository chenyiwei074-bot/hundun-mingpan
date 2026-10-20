# 交后端 / 运维的待办（2026-10-21）

前端能自己做完的都已经做完并验过（每批一个回滚点，见 `git log`）。这份只列**必须后端或产品点头**的事，
每条都带我今天核过的证据位置 —— 没有一条是凭印象写的。

## 1. 户型识别：网关的请求体上限（会静默砍掉这个功能）

`POST /api/fengshui/recognize` 吃 JSON `{visitorId, imageBase64}`。5MB 的图 base64 之后是
`5 × 1024 × 1024 / 3 × 4 ≈ 6.99MB`，加 JSON 外壳约 7.0MB。

nginx 的 `client_max_body_size` 默认是 **1MB**。如果线上没显式放宽，实际能上传的图只有约 **0.75MB**，
而且超限时用户看到的是 nginx 那一页**不是 JSON 的 413**。

- 前端已经把这个情况说清楚了（"服务端回了 413 但正文不是 JSON —— 可能是网关挡的"），
  所以不会假装识别失败，但功能等于被砍掉一大截。
- 请确认线上这一项 ≥ 8MB；如果不动 nginx，就把服务端上限从 5MB 降到网关能吃下的值，
  两边不一致时用户只会看到"莫名其妙被拒"。

## 2. AI 问事：后端半边不存在，需要产品决定

`server/src/api/routes.ts` 里**没有** `/assistant` 这一条（全文 21 行路由，逐行看过）。
nginx 的精确 location 已通，线上 `POST {}` 返回的是 Next 的 400，不是 Express。

现在前端做的是**本机目录匹配**：命中已开放的工具就给入口，没命中就明说没有，
`assistant-acceptance` 的 46 条钉的就是"未开放的一项都不给入口"。页面上也写了"本机目录匹配、未经模型"。

所以这是一个**产品决定**，不是缺陷：

- 要么补后端（把问事交给模型 + 受控路由到工具），前端把措辞从"本机匹配"改掉；
- 要么维持现状，那这一条可以从待办里划掉。

## 3. 配额：服务端说"不限次"，前端根本没读

`chart.controller.ts:246 getQuota` 返回 `{used: 0, remaining: null, limit: null, unlimited: true}`，
而前端**没有任何一处**调用 `/api/chart/quota`（全仓 grep `quota` 只命中 harness 的桩）。

队列里的 D1「配额显式化」卡在这里：要显示什么，得先定"到底有没有额度"。
两个方向都能做，但需要一句裁定：真限额（那 `getQuota` 要真算），还是明写"当前不限次"（那前端去读这个字段并显示）。

## 3b. 四柱直批：后端加一档枚举，这一类盘就能存下来（今天已确认的缺陷）

建盘页有三个 tab：公历 / 农历 / **四柱**（直接给四柱干支排盘）。而
`CreateChartSchema.calendar` 是 `z.enum(['公历','农历'])`，`birthday` 又必须是
`YYYY-MM-DD HH:mm`。所以四柱那条提交**一定被拒**：`birthday` 发的是
`四柱:甲子,乙丑,丙寅,丁卯` 这种串，两个字段同时不合格。

前端这一批已经把它改成"不发 + 明说"（选了四柱就在提交键之前写明"这条不会存进「我的报告」，
刷新就没了"，并由 `tools/api-contract-acceptance` 14 条闸门钉住）。
但这是绕，不是修。**要真正修好得后端加一档**，比如：

- `calendar` 加 `'四柱'`，同时给一个放四柱的字段（`siZhu` 之类），
  `birthday` 的 regex 对这一档放宽或改判；
- 或者定一个"四柱直批"的独立端点。

哪种都行，关键是 `calendar`/`birthday` 现有取值的**语义不能改**：
`charts.birth_data.calendar` 一直表示"用户选的历法"，历史行里就有 `isLunar:true/calendar:'农历'`。
如果为了收四柱而复用这两个字段、把它们改成别的意思，同一列的新旧行就分叉了 ——
那是静默的数据污染。所以这一条需要新字段，不是改旧字段的解释。

## 4. 支付解锁仍然下线，`/report/[id]` 的解锁按钮是死的

`chart.controller.ts:292 confirmPayment` 返回 503 且不写库，路由表里也没有注册它（只有一行注释说明下线）。
结果：`LOCKED` 状态的报告无法解锁。前端已经把这个按钮做成 disabled 并写明原因，
但真正的解锁路径要等支付接入。

## 5. 前后端两份引擎拷贝的口径差（影响 D4）

见 `docs/engine-copy-divergence.md`：`server/src/core/yiqi-core/bazi.ts` **没有** `dayBoundaryMode`，
前端那份有。所以夜子时/年界相关的任何显示（D4「紫微真太阳时 + 年界显式」）都会出现
"前端算得出、后端算不出"的分家。要么后端补这个入参，要么 D4 只做纯前端的那一半。

`gan-relations.ts` 两边 diff 已经是 0，打印口径也已统一（error/warn 限错误路径）。

## 6. 台账读取路径的响应形状没定

`POST /api/receipts` 与 `GET /api/receipts/:recordHash` 都已在路由表里。
前端（`4bba6d2`）接的是"未锚定 / 等待锚定"两态，而 `anchored` 一律显示「状态未知」——
因为 GET 的返回体形状没定，前端不猜。给一份 GET 的成功体样例就能补完这一态。

## 7. 户型图取回（可选，需要点头）

`GET /api/fengshui/image/:id?visitorId=` 服务端已实现（7 天保留、仅本人）。
前端目前**不使用**它：这一页明写"几何与判定都在这台设备的内存里，刷新即失"。
要做"7 天内恢复上次那张图"，得在本机存 imageId 并加一条恢复路径 —— 这会改掉现在这条口径，
所以先问，不擅自做。

## 已经修好、不用再管的（推翻旧记录）

`GET /api/reports/:id` **现在校验归属**：`report.controller.ts:94-109` 比对 `report.visitorId`，
不存在或不属于你就返回 404（不是 403，避免被枚举），并且只下发页面需要的字段，
`inputJson / resultJson / analysisJson` 一律不下发。

这条推翻了 2026-10-18 记的"`GET /api/reports/:id` 无鉴权返回 inputJson"—— 那个洞已经堵上了。
