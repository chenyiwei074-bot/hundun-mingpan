# 塔罗综合 AI 解读接口草案（v0，未实现）

状态：契约草案。当前塔罗页面只做本地三张牌抽取、正逆位与已核验牌义展示；
在以下接口实现之前，不新增“综合 AI 解读”入口。

## POST /api/tarot/reading

### 请求

```json
{
  "visitorId": "v_...",
  "question": "未来三个月这段关系会怎么发展？",
  "spread": "three-card",
  "cards": [
    { "cardId": "major-13", "position": "过去", "orientation": "正位" },
    { "cardId": "minor-cups-2", "position": "现在", "orientation": "逆位" },
    { "cardId": "major-19", "position": "未来", "orientation": "正位" }
  ]
}
```

- `cards` 必须恰好 3 张，位置固定为过去/现在/未来，`cardId` 必须属于本站 78 张牌；
- `question` 最长 300 字，可空；不接收姓名、生辰、地点；
- 路由只接受 `spread: "three-card"`。

### 成功响应

```json
{
  "success": true,
  "data": {
    "readingId": "tarot_...",
    "model": "self-developed-ai-v1",
    "createdAt": "2026-10-24T13:00:00.000Z",
    "cards": [
      {
        "cardId": "major-13",
        "position": "过去",
        "orientation": "正位",
        "text": "……",
        "sourceIds": []
      }
    ],
    "summary": "……",
    "notes": ["解读为传统文化参考，不构成专业建议。"]
  }
}
```

- `model` 只写本站自研版本标签，不写底层供应商/模型名；
- 每张牌的 `sourceIds` 只能来自已登记来源；无来源时必须空数组，前端显示“本站自研”；
- AI 文字不得替代牌名、正逆位、牌义出处等确定性字段。

### 错误

| HTTP | code | 前端文案 |
|---|---|---|
| 400 | `bad_cards` | 牌面数据不完整，请重新抽牌 |
| 400 | `bad_question` | 问题过长，请缩短后重试 |
| 404 | `card_unknown` | 这张牌不在牌组中，请重新抽牌 |
| 502 | `ai_unavailable` | 综合解读暂时不可用，请稍后再试；牌面与逐牌牌义仍可查看 |
| 429 | `rate_limited` | 请求过于频繁，请稍后再试 |

- 不返回供应商原始报错、HTTP 上游状态或内部 code；
- 5xx 不自动重试。

### 隐私与保留

- 问题原文不写入日志；请求结束即丢弃，除非用户主动保存为报告；
- 若保存，沿用命盘/报告 7 天保留规则，备份随 7 天滚动；
- 请求里不含姓名、生辰、地点；`visitorId` 只用于归属校验，不发给 AI。

### 实现顺序

1. 后端定义 zod 契约 + `POST /api/tarot/reading`，先用固定牌义拼装做无 AI 冒烟；
2. 接自研 AI 编排层，错误映射到上表；
3. 前端抽牌完成后接入；无来源时继续逐牌显示既有出处。

## 当前实现（2026-10-24）

`POST /api/tarot/reading` 已上线**规则拼装版**：

- 校验三张牌、过去/现在/未来顺序、正逆位、牌组内唯一性；
- 返回逐牌已登记牌义（来源字段来自 frontend/lib/tarot/meanings.ts），`sourceIds: []`；
- 响应硬字段 `mode: "rules-only"`、`aiReady: false`，`notes` 明确“不是 AI 综合解读”；
- 不调用模型、不写库、不保存问题；
- 前端 helper：`createTarotReading()`（frontend/app/lib/api.ts），页面接入时必须按 `aiReady` 标注，不得把这段文字当 AI 综合解读。

下一版才接自研 AI 编排；接口形状不变，只把 `mode/aiReady/model` 升级并补 AI 文字。


## AI 接入（2026-10-24，已实现）

`POST /api/tarot/reading` 现在会调用站内 AI 编排层（免费模型优先、DeepSeek 回落）：

- 成功：`mode:"ai"`、`aiReady:true`、`model:"hundun-self-developed-ai-v1"`；
  `cards[].text` 与 `summary` 为 AI 整理，逐牌牌面/方向仍是确定性输入；`sourceIds` 仍为空（未核验来源不伪造）。
- 失败/超时/输出不合格：返回 `mode:"rules-fallback"`、`aiReady:false`，只给逐牌已登记牌义，
  并在 notes 明说“AI 未参与”；不会把规则拼装说成 AI。
- 响应不写供应商名/底层模型名；日志只记内部耗时与错误，不记问题原文。
