# 塔罗牌义出处·第一轮校对交接

给 GPT 的第一轮校对任务：逐张核对 78 张牌的牌义出处。

## 输入

`tarot-verification-sheet.csv`：78 行，每行一张牌，含当前中文正/逆位摘要和来源提示。
当前来源提示只写“参考 A. E. Waite《The Pictorial Key to the Tarot》（1910）· 本站译述（章节对应与底本待校核）”，
**没有逐张章节定位**，这正是本轮要补的。

## 底本

A. E. Waite, *The Pictorial Key to the Tarot* (1910), Part III: Divinatory Meanings。
公版；优先使用 Wikisource / Internet Archive 扫描件 / Project Gutenberg 文本。

## 填表规则

| 列 | 填什么 |
|---|---|
| `verdict` | `PASS` / `FAIL` / `HOLD`；没找到对应段落写 `HOLD` |
| `evidence_url` | 底本链接 |
| `edition` | 版本/年份（1910 原版或注明电子转录版本） |
| `chapter_paragraph` | 章节/小标题/段落编号，必须能定位到具体一段 |
| `verified_quote_en` | 底本中与该牌正/逆位对应的**英文连续原文**；正逆位分别用分号或换行标注 |
| `notes` | 译文偏差、异文、缺失、OCR 不确定 |

硬规则：
- 不能只写“Waite 说过”，必须给出可复核段落；
- 中文当前文字是译述，不是底本原文；`verified_quote_en` 必须是英文原文；
- 一张牌正逆位通常共用同一段，分开标注即可；
- 未找到 → `HOLD`，不要猜。

## 交付

回传填好的 CSV + 汇总：PASS/FAIL/HOLD 数量、哪些牌缺章节。
不要改当前中文摘要，不要新增 sourceId；最终仍需人工复核签字。

## 入库标准

`PASS` + 版本 + 章节/段落 + 英文连续原文齐全 + 人工复核签字，才登记塔罗 sourceId。
未通过前，塔罗 AI 的 `sourceIds` 继续为空，页面标“本站自研”。
