# sourceIds 契约（2026-10-24）

前端把「没有 `sourceIds`」视为**本站自研**；后端只允许写入已登记、可核验、确实支持该段内容的来源。

## 命盘解读

`charts.ai_analysis` / `GET /api/chart/result/:id` 的 `aiAnalysis`：

```json
{
  "summary": "总述",
  "sections": [
    { "title": "一、天赋", "body": "…", "sourceIds": [] },
    { "title": "二、财运节奏", "body": "…", "sourceIds": [] }
  ]
}
```

- 每个 section 必须有 `sourceIds: string[]`；
- 空数组 = 无已核验出处 = 前端显示「本站自研」；
- **模型自报的 sourceIds 一律不信**，在 `server/src/services/analysis.service.ts` 的
  `attachVerifiedSourceIds()` 里统一覆盖；未来只在该函数内填已核验 ID。

## 六爻报告

`POST /api/liuyao/report` 响应：

```json
{ "report": "…", "context": {}, "validation": {}, "rewrote": false, "sourceIds": [] }
```

- 当前六爻没有已入仓的六爻古籍底本 → 空数组 → 前端显示「本站自研 · 本次报告未关联可核验的古籍出处」；
- 以后底本入仓并通过引文核验后，只填登记表中的 `sourceId`。

## 底本不足时

六爻、紫微、风水、合盘：当前没有足够可靠底本，统一按「本站自研」呈现；
不挂泛论/版本不明的出处，不用模型生成的书名或篇章充数。
