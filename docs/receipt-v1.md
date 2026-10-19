# 结果回执与存证契约 v1（hundun-receipt-v1）

> 状态：**冻结**（2026-10-18）。客户端实现已在 main；服务端台账（P1）按本文实现。
> 首个样板：六爻。其余术数接入时复用同一契约，只换 `kind` 与盘身白名单。
> 2026-10-19 追加 **v2：随机承诺**（§10）。v1 的字段语义、规范化与摘要定义一字未动。

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
**前缀与台账的换算（重要）**：回执 JSON 内展示统一带 `sha256:` 前缀；但 `anchor_ledger.py` 的 leaf 是 `sha256(canonical(record))` 的**裸 hex**，`manifest.leaves` 也是 32 字节裸 hex（如 `2c052a9f…`）。
因此：**提交台账时一律去前缀存裸 hex**；`POST /api/receipts` 接受带/不带前缀并归一化；`GET /api/receipts/:recordHash` 两种写法都接受；验真页展示时自行补前缀。**严禁在台账内写入带前缀的字符串**（会让 manifest 与既有账本格式不一致）。

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

存储：`/srv/chaos/output/receipts/YYYY-MM/YYYY-MM-DD.jsonl`（按提交 UTC 日的**月度分片 + 日文件名**），一行一条规范化 JSON（含提交时间，**不含问题、姓名、生辰、盐**）。
JSONL 单行结构（哈希一律**裸 hex**）：
```json
{"schemaVersion":"hundun-receipt-v1","kind":"liuyao-plate","method":"coin",
 "castAtUTC":"2026-10-18T12:00:00.000Z","tzOffsetMinutes":480,
 "recordHash":"<64 hex>","plateHash":"<64 hex>","reportHash":null,"parentHash":null,
 "subjectHash":"<64 hex>","basis":{...},"submittedAtUTC":"…"}
```
幂等键：`recordHash`。同一 recordHash 重复提交返回 `already:true`，不追加第二行。

### GET /api/receipts/:recordHash

```
响应 200: {
  ok: true, state: 'unanchored' | 'pending',
  day, leaf, reason, root?, prevRoot?, manifestPath?, otsPath?
}
未找到 → 404 { ok: false, error: '回执摘要未提交或已过期（仅保留 45 天查询窗口；台账永久有效）' }
recordHash 非法 → 400
```

**`anchored` 目前不会下发**：服务端本机无 bitcoind，`ots verify` 无法独立确认，所以已进 Merkle 也只报 `pending`。
客户端（`frontend/lib/receipt/anchor.ts`）因此只认两态，界面措辞固定为：

| 来源 | 界面 |
| --- | --- |
| 404（未提交过） | 未提交 |
| `state: 'unanchored'` | 未锚定 |
| `state: 'pending'` | 等待锚定 |
| 其它（含将来可能的 `anchored`） | 状态未知 |

**「状态未知」不是偷懒**：本站不替运维宣布链上事实。将来运维真下发 `anchored` 时，改措辞要连着改
`tools/receipt-acceptance` §13 的 `anchor/state-vocabulary` 与 `anchor/no-chain-wording` 两条断言，
不是一行 if 的事。台账状态是**独立读取**，不写回回执本体 —— 回执里的 `anchor` 恒为 `null`、
`anchorState` 恒为「未锚定」，否则同一份文件会因查询时点不同而得到不同摘要。

**两个端点都不返回报告内容**，验真页不得按报告 ID 取原文；结果页只允许打 `/api/receipts`，
提交体是白名单摘要（`schemaVersion/kind/method/castAtUTC/tzOffsetMinutes/recordHash/plateHash/
reportHash?/parentHash?/subjectHash/basis`），**不含 `subjectSalt`** —— 摘要抗字典反查靠的就是盐不外泄。

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
- 2026-10-19 按第一条升了 **v2**（见 §10）。v1 仍是「没有随机承诺」时的出盘版本，同一盘重算得到同一个 hash。

## 10. v2：随机承诺（hundun-receipt-v2）

铜钱摇卦在首掷之前先铸一个 32 字节 seed 并公布其哈希，六轮面值全部由 seed 派生，
所以回执可以多证明一层：盘上那六个爻值确实来自事先的承诺，事后改不动。

```ts
RECEIPT_VERSION_V1 = 'hundun-receipt-v1'   // 无承诺（时间/报数、以及本批之前的摇卦）
RECEIPT_VERSION_V2 = 'hundun-receipt-v2'   // core 里多一个 randomness
COIN_COMMIT_SCHEMA = 'coin-commit-v1'      // 取 bit 与派生的口径戳

ReceiptCore {
  ...v1 的全部字段，语义不变
  randomness?: {
    schema: 'coin-commit-v1'
    seedHex: string      // 32 字节小写 hex（64 字符），揭晓时公开
    seedHash: string     // 'sha256:' + SHA-256(utf8(seedHex)) —— 揭晓前唯一公布过的东西
    bits: string         // seed 前 18 字节各取 1 bit，写成 18 个 '0'/'1'（1=花 0=字）
    committedAtLocal: string  // 仅展示，不进任何摘要（本地时钟不可信）
  }
}
```

规则：

1. `randomness` **在承诺内核之内**，参与 `recordHash`。放在外面等于承诺可拆，那就不如不做。
2. 它**不进盘身白名单**（在 `PLATE_EXCLUDED` 里）：同一个事实被 `plateHash` 与 `core.randomness`
   各摘要一次，改一处会让两处互相矛盾而看不出哪处是原件。
3. 验真三项独立检查（`tools/receipt-acceptance` §9 逐条钉）：`seedHash == sha256(seedHex)`、
   `bits == seed 前 18 bit`、`seed 重放的六个爻值 == 盘上爻值`。三项各管一段，缺一环就漏。
4. v1 回执在新验真器下：`randomness` 一项标 **「未承诺」**（`na`，不计入通过也不计入失败），
   时间/报数标 **「不适用」**。不拿"没测过"冒充"测过了"。
5. 不认识的 `schema` 一律判失败，不"照旧试着重放一下"。
6. 取数口径：`seed` 前 18 字节，每字节 `& 1`（一字节一 bit，无取模偏差），第 r 轮用第
   `3r..3r+2` 个 bit。直取不上 HKDF —— seed 本身 256 bit 均匀，前 18 bit 与其余统计独立，
   且这样第三方能用手算复核。
7. **v2 的 `plateHash` 不含 `plate.id`**：`sha256(canonical(omit(plate, ['id'])))`。id 是客户端现铸的
   定位符（`'coin_' + Date.now().toString(36) + randomToken(6)`，三式同此），把它算进承诺会让同一盘
   两次回执得到两个 `plateHash`。回执里仍保留 `plate.id` 供定位，验真按同一规则（v1 仍含 id，见下）。
   台账侧不受影响：leaf 用的是 `recordHash`，不是 `plateHash`。
8. **机制上限（页面文案与目录都按这个写）**：它证明「这一盘与事先的承诺对得上、事后没被改过」；
   不证明掷钱这个动作真的在物理世界发生过，也管不到揭晓之前的整盘重来（重来即新 seed、新承诺，
   只有最后揭晓的那一份进回执）。要证「承诺早于结果」需要把 `seedHash` 也送进每日台账 leaf，
   那是台账侧的独立决定，本文档不预设。

版本分叉一览（改任何一条都要升版本，见 §9）：

| 规则 | v1 | v2 |
| --- | --- | --- |
| `core` 字段集 | 无 `randomness` | 多一个 `randomness`，参与 `recordHash` |
| `plateHash` 覆盖范围 | 含 `plate.id` | **不含** `plate.id` |
| 已发出的旧回执 | 按 v1 规则仍可验（金标准钉在 `tools/receipt-acceptance`） | — |

对服务端台账（P1）的影响：**提交信封与幂等键都不变**（§6 的 `schemaVersion` 仍按信封写，
`recordHash` 仍是幂等键）。变的只是 v2 的 `recordHash` 覆盖范围多了一个 `randomness`，
所以同一盘在 v1 与 v2 下是两个不同的回执号 —— 这不是冲突，是两个不同的承诺文档。
已入台账的 v1 leaf **永不重算**（与盘面口径戳「老盘只标注不重算」同一条规矩）。

`tools/receipt-acceptance` 里钉了四个 v1 冻结金标准值（盘 id 固定为 `coin_frozen_v1` 时的
`plateHash` / `subjectHash` / `recordHash` / 规范化内核全文），由 main(`4bf95d1`) 那份实现跑出。
任何动到 v1 摘要范围的改动都会让它红，ops 侧要复核自己的实现时也可以拿这四个值对拍。
