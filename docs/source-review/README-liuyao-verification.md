# 六爻来源候选·校对交接

给 GPT 的校对任务：把 `liuyao-verification-sheet.csv` 里的 40 条候选，逐条对照**可靠公版底本**核验。

## 输入

- `liuyao-verification-sheet.csv`：40 条，来自 `ROTl24/wenyao` 的 `resources/corpus.json`（代码 MIT；文本标为 user-provided-plain-text，**不是**已核验底本）。
- 每条都有 `candidateId / book / title / candidate_location / candidate_text`。

## 底本要求

1. 优先使用可公开访问的公版底本：维基文库、中国哲学书电子化计划（ctext）、Kanripo、Internet Archive 扫描件；
2. 必须记录**具体版本**，不能只写书名；
3. 必须给出**可复核定位**：卷/篇 + 页码或行号（电子文本写章节/段落编号）；
4. 只把**连续原文**算通过；意译、改写、拼接、模型记忆都不算。

## 填写规则

| 列 | 填什么 |
|---|---|
| `verdict` | `PASS` / `FAIL` / `HOLD` 三选一；找不到底本写 `HOLD`，不要猜 |
| `evidence_url` | 底本链接（可多个用空格分隔） |
| `edition` | 版本，如“文渊阁四库全书本”“某刻本影印”“维基文库某页面” |
| `volume_page_line` | 卷/篇/页/行或段落编号 |
| `verified_text` | 底本中逐字对应的连续原文；与候选有异体字/标点差异时注明 |
| `notes` | 异文、缺卷、OCR 不确定、需要换底本等原因 |

**硬规则**

- 未找到底本 → `HOLD`，不要写“应该是”；
- 只找到二手转述 → `HOLD`；
- 原文一致但版本不明 → `HOLD`，补齐版本后改 `PASS`；
- **任何 `PASS` 都仍要人工复核签字**，GPT 不能作为最终核验人。

## 交付

- 回传填好的 CSV；
- 另附一段汇总：PASS / FAIL / HOLD 各多少条、哪些书缺可靠底本；
- 不要新增 sourceId，不要改候选原文；sourceId 由我方在人工确认后登记。

## 最终入库标准

只有同时满足以下条件才登记 `sourceId`：

1. `verdict=PASS`；
2. 版本、卷/篇/页行、连续原文齐全；
3. 人工复核签字；
4. 原文与 `docs/classics/**` 中保存的底本逐字可检索。
