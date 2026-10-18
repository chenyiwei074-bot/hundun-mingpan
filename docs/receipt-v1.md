# 结果回执与存证契约 v1（hundun-receipt-v1）

> 状态：**冻结**（2026-10-18）。客户端实现已在 main；服务端台账（P1）按本文实现。
> 首个样板：六爻。其余术数接入时复用同一契约，只换 `kind` 与盘身白名单。

## 1. 三条硬规矩

1. **回执里绝不出现原始问题、姓名、生辰。** 问题只以带盐摘要 `subjectHash` 存在；盘身用**白名单**（`PLATE_FIELDS`）而不是黑名单，类型新增字段会编译报错，逼人决定它进不进回执。
2. **`recordHash` 只覆盖承诺内核（`core`）。** `anchor` 与 `createdAtUTC` 在内核之外——台账是后来才填的，填进去不能把已发出的回执验成失败。
3. **没拿到真实 Merkle 证明前，`anchor` 恒为 `null`、状态恒为「未锚定」。** 不做任何「已上链」暗示。

## 2. 数据结构（以 `frontend/lib/receipt/receipt.ts` 为准）

```ts
RECEIPT_VERSION = 'hundun-receipt-v1'

ReceiptCore {
  version: 'hundun-receipt-v1'
  kind: 'liuyao-plate' | 'liuyao-report'
  method: string            // coin | time | number
  castAtLocal: 'YYYY-MM-DD HH:mm'
  castAtUTC: ISO8601
  tzOffsetMinutes: number
  basis: Record<string,string>   // 口径版本：ganzhiBasis/najiaBasis/qiShu 等
  subjectSalt: string            // 16 字节随机 hex，随回执由用户自存
  subjectHash: string            // sha256(canonical({salt, question, questionType}))
  plateHash: string              // 卦盘回执：sha256(canonical(plate))
  reportHash?: string            // 解读回执：sha256(canonical({text: reportText}))
  parentHash?: string            // 解读回执 = 对应卦盘回执的 recordHash
}

Receipt {
  core: ReceiptCore
  recordHash: string      // sha256(canonical(core)) —— 只覆盖 core
  receiptId: string       // ≡ recordHash
  anchor: ReceiptAnchor | null
  anchorState: string     // '未锚定' | '等待锚定' | '已锚定'
  createdAtUTC: string    // 不在 recordHash 内
  plate: Record<string, unknown>   // 白名单投影，自包含
  reportText?: string              // 仅解读回执
}

ReceiptAnchor { date, root, prevRoot, manifestPath, otsPath }
```

盘身白名单（`PLATE_FIELDS`，共 20 项）：`id, method, questionType, date, ganZhi, dayGZ, monthZhi, xunKong, ganzhiBasis, najiaBasis, solar, qiShu, benGua, bianGua, yaoRecords, naJia, bianNaJia, dongYao, shiYing, liuShen`。
排除（`PLATE_EXCLUDED`）：`question`。

## 3. 规范化 canonical()

递归按键名升序排序后 `JSON.stringify`：数组保序、对象键排序、`undefined`/函数丢弃、`NaN`/`Infinity` → `null`、`bigint` → 字符串、`Date` → ISO。**任何实现方不得自创第二套规范化。**

## 4. 摘要定义

- `plateHash = sha256:hex(canonical(plate))`
- `reportHash = sha256:hex(canonical({ text: reportText }))`
- `subjectHash = sha256:hex(canonical({ salt, question, questionType }))`（盐不进台账、不公开）
- `recordHash = sha256:hex(canonical(core))`
- 统一前缀 `sha256:`，便于台账侧识别算法。

## 5. 锚定状态机

```
未锚定 → 等待锚定 → 已锚定
```

| 状态 | 判定条件 | 允许的对外措辞 |
|---|---|---|
| 未锚定 | 未提交站点台账 / 当日 manifest 无此 leaf | 「回执已在本地自洽，尚未进入每日台账」 |
| 等待锚定 | 当日 manifest 的 `leaves` 含该 leaf（`sha256(canonical(record))`），但 `.ots` 尚未确认 | 「已进入 2026-10-19 台账，等待比特币确认」 |
| 已锚定 | 上述 + `ots verify` 通过（可选补充区块高度） | 「已由每日台账锚定（含比特币时间证明）」 |

**禁止**：无 `ots verify` 通过就说「已上链 / 已写入区块链」。

## 6. 服务端契约（P1，最小增量，不建表）

### POST /api/receipts

提交回执摘要入台账（**不提交报告原文**）。

```
请求: {
  recordHash, kind, method, castAtUTC, tzOffsetMinutes,
  plateHash, reportHash?, parentHash?, subjectHash,
  schemaVersion: 'hundun-receipt-v1', basis: {...}
}
鉴权: visitorId（query/header，与 reports 一致）
响应 200: { ok: true, day: 'YYYY-MM-DD', already: false }
幂等: 同 recordHash 重复提交 → { ok: true, already: true }，不重复追加
```

存储：`/srv/chaos/output/receipts/YYYY-MM-DD.jsonl`，一行一条规范化 JSON（含提交时间与 visitor 关联，**不含问题、姓名、生辰**）。

### GET /api/receipts/:recordHash

```
响应 200: {
  state: 'unanchored' | 'pending' | 'anchored',
  day?, root?, prevRoot?, manifestPath?, otsPath?, blockHeight?
}
未找到 → 404 { ok: false }
```

**两个端点都不返回报告内容**，验真页不得按报告 ID 取原文。

## 7. 台账集成（anchor_ledger.py）

- `CONFIG["SOURCES"]` 从单源扩为多源：`review-log.jsonl` + `receipts/*.jsonl`；manifest 的 `sources` 数组如实反映。
- leaf 规则不变：`leaf = sha256(canonical(record))`；leaves 升序；两两 `sha256(lo_hex + hi_hex)`。
- **不改 Merkle 算法、不改 manifest 结构**；只增加输入源。

## 8. 验收要求

- `tools/receipt-acceptance`：改动任意一字节必须失败；回执不含问题原文；未锚定不宣称已锚定；端点幂等；双回执 `parentHash` 链一致。
- 服务端新增：`POST` 幂等、无原文落盘、`GET` 状态与 manifest 一致。
- 三套既有验收（receipt/huangli/directory）+ 视觉 harness 必须全绿才可合 main。

## 9. 版本演进

- 改 `core` 任何字段语义、规范化规则、摘要定义 → **必须**升 `RECEIPT_VERSION`（旧回执仍可验，验真页按版本分支）。
- 仅新增盘身白名单字段（不改变已发布语义）→ 可不升版本，但需 PR 说明并补编译期护栏。
