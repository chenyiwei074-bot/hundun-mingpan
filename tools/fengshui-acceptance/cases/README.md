# `cases/` —— 识别响应的形状样例

**这些不是抓包。** 字段名与嵌套取自 `server/src/services/vision.service.ts` 里那份
`RecognizedPlan` 接口 + `PlanSchema`（zod）+ `PROMPT` 里给模型看的输出示例，
外层 `{ ok, imageId, imageMime, imageBytes, plan }`
是 `server/src/controllers/fengshui.controller.ts` 的公开成功分支；provider/model/latency/attempts 只留服务端内部，不进入公开响应。
几何数值是本站编的一段两室夹一厅。

## 为什么只校形状、不校数值（裁定 2026-10-20）

视觉模型换供应商、换 prompt、换 temperature 都会改输出，`rooms` 的顶点坐标、
`confidence` 的数值、`latencyMs` 尤其会漂。把这些钉死等于埋一条假红：
某天它必然因为模型换了而失败，而那次失败和产品没有任何关系。

所以 `tools/fengshui-acceptance/acceptance.ts` 里对这份文件只做三件事：

1. `parseRecognize()` 能吃下它并返回 `ok: true`（形状不认识就是适配层要改）；
2. 它的 `plan` 键集合必须仍是服务端接口声明的那几个（**契约同步**闸门，服务端改字段这里就红）；
3. 门窗允许缺 `confidence`（模型常省略），此时必须落 0.5 占位而不是 null。

## 用途

| 文件 | 谁在用 |
|---|---|
| `recognize-success.json` | 验收套件（形状）；`tools/visual-harness/census.mjs` 的 `?recognize=ok` 桩（原样作为响应体 serve，不另抄一份） |

`recognize=503` 那一态的失败体是 census.mjs 内联的，不进这个目录：
它的价值全在 `code` 这一个字段上，抄成 JSON 反而多一处会分家的地方。
