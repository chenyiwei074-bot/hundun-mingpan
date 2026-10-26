# 八字四柱独立解读实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Follow repository rule: no commit unless the user explicitly requests it.

**Goal:** 在 `/create` 开放已知四柱的独立八字结构解读，不生成紫微、大运、起运或完整命盘记录。

**Architecture:** 前端复用当前四柱选择控件，新增合法干支校验、计算 API client 和独立结果区。后端沿用既有 `enrichBazi(siZhu)`，新增无持久化的计算端点与 `bazi-pillars` AI profile；前端先按契约接线，并交付明确的后端交接书。

**Tech Stack:** Next.js App Router、React、TypeScript、Express、现有 `enrichBazi` 与 `ToolInterpretation`。

## Global Constraints

- 不修改八字完整排盘算法、紫微算法或六爻算法。
- 四柱模式只验证每一柱是否合法，不推算或伪造出生时间、地点、真太阳时、紫微、大运和起运。
- 四柱模式不要求、不显示、不发送姓名、性别、出生地、现居地或 visitorId，不创建 `charts` / `reports` 记录。
- AI 只读取本次已计算的四柱与 `enrichBazi` 结果；公开文案统一使用“混沌自研 AI”。
- 无已核验来源时显示“本站自研”；不新增 sourceId。
- 每次代码修改前按仓库要求备份；每次回复最多改 1–2 个文件；不提交 Git。
- 不新增或运行测试；完成后运行前端生产构建、后端 TypeScript 检查，并按仓库要求检查 `http://localhost:3001/` 返回 200。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `frontend/lib/bazi/direct-pillars.ts` | 四柱请求/响应类型与六十甲子单柱合法性校验。 |
| `frontend/app/lib/api.ts` | 调用 `/api/bazi/pillars/calculate` 的前端 API 函数。 |
| `frontend/components/bazi/DirectPillarsReading.tsx` | 展示输入四柱、已有增强结果与通用 AI 解读卡。 |
| `frontend/app/create/page.tsx` | 暴露四柱模式、隐藏无关个人资料、提交计算并在本页展示独立结果。 |
| `frontend/lib/tools/catalog.ts` | 将八字条目的输入范围说明更新为出生资料排盘与独立四柱解读两种入口。 |
| `docs/backend-handoff/BAZI-PILLARS-DIRECT-20261026.md` | 交给后端的精确 API、验证、AI profile、隐私与验收契约。 |

后端文件不由本计划修改；后端按交接书实现专用路由及 AI profile。

## Task 1: 前端四柱类型、校验与 API client

**Files:**
- Create: `frontend/lib/bazi/direct-pillars.ts`
- Modify: `frontend/app/lib/api.ts`

**Interfaces:**
- `DirectPillar = { gan: string; zhi: string }`
- `DirectPillarsInput = { 年: DirectPillar; 月: DirectPillar; 日: DirectPillar; 时: DirectPillar }`
- `DirectPillarsResult = { siZhu: DirectPillarsInput; enrichment: Record<string, unknown> }`
- `isValidSexagenaryPillar(pillar: DirectPillar): boolean`：只在天干、地支均合法且序号奇偶相同（六十甲子合法配对）时返回 `true`。
- `calculateDirectPillars(siZhu: DirectPillarsInput): Promise<DirectPillarsResult>`：POST `/api/bazi/pillars/calculate`，只发送 `{ siZhu }`，非 2xx 或 `success:false` 时抛出面向用户的中文错误。

- [ ] 新建类型/纯校验函数，不复制新的干支表；从现有 `TIANGAN`、`DIZHI` 导入合法取值。
- [ ] 在 `frontend/app/lib/api.ts` 导入输入/响应类型并增加 API 函数，保持请求体只含 `siZhu`。
- [ ] 读取文件 diff，确认 API client 不读取或附带 visitorId、姓名、出生地或完整命盘字段。

## Task 2: 独立四柱结果组件

**Files:**
- Create: `frontend/components/bazi/DirectPillarsReading.tsx`

**Interfaces:**
- Props: `{ result: DirectPillarsResult }`
- 使用 `result.siZhu` 按年、月、日、时展示用户输入。
- 使用现有 `BaziEnrich` 展示 `result.enrichment`，不自行推导额外规则结果。
- 使用 `ToolInterpretation`，参数为 `tool="bazi-pillars"`、`payload={{ siZhu: result.siZhu, enrichment: result.enrichment }}`。

- [ ] 新建独立结果组件，顶部固定显示“按你输入的四柱计算”，并说明这不是完整出生盘。
- [ ] 输出四柱卡片和 `BaziEnrich`，AI 解读由用户主动点击触发。
- [ ] 不渲染完整命盘组件，不展示紫微、大运、起运和出生地点字段。

## Task 3: `/create` 接入四柱模式

**Files:**
- Modify: `frontend/app/create/page.tsx`

**Interfaces:**
- 复用已有表单状态：`yearGan/yearZhi`、`monthGan/monthZhi`、`dayGan/dayZhi`、`hourGan/hourZhi`。
- `calendar === '四柱'` 分支通过 Task 1 的 `calculateDirectPillars` 获取结果，并渲染 Task 2 的 `DirectPillarsReading`。

- [ ] 备份页面后，仅在单人模式的历法切换中新增“已知四柱”选项；双人模式仍只提供公历/农历。
- [ ] 四柱模式隐藏姓名、性别、出生地、现居地和命盘额度说明；不触发地点查询。
- [ ] `validate()` 在四柱模式不校验姓名/日期，只要求四柱完整并逐柱调用 `isValidSexagenaryPillar`；错误指出具体柱位。
- [ ] `handleSubmit` 在四柱模式调用专用 API 并显示结果，不调用本机完整排盘、`/chart/create`、保存、分享或配额写入流程。
- [ ] 四柱模式按钮文案改为“计算四柱结构”；加载、失败、重试状态与结果区清楚可见。
- [ ] 其余公历、农历与双人合盘路径保持原样。

## Task 4: 更新目录口径与后端交接契约

**Files:**
- Modify: `frontend/lib/tools/catalog.ts`
- Create: `docs/backend-handoff/BAZI-PILLARS-DIRECT-20261026.md`

**Interfaces:**
- 计算接口：`POST /api/bazi/pillars/calculate`
- 请求：`{ "siZhu": { "年": {"gan":"甲","zhi":"子"}, "月": ..., "日": ..., "时": ... } }`
- 成功响应：`{ "success": true, "data": { "siZhu": <原样四柱>, "enrichment": <现有 enrichBazi 返回值> } }`
- 失败响应：`{ "success": false, "error": "按柱位说明的中文错误" }`，非法输入 HTTP 400。
- AI profile：`bazi-pillars`，白名单仅接收 `siZhu` 与 `enrichment`，按字段产生 `factRefs`，`sourceIds` 由服务端覆盖；不得调用命盘、紫微或大运分析。

- [ ] 目录说明加入“已知四柱可做独立八字解读；不生成紫微和大运”。
- [ ] 交接书明确使用现有 `enrichBazi`，不得创建完整命盘或数据库记录，不记录原始 payload/prompt。
- [ ] 写明前后端完成边界、错误处理和验收项，供用户转交后端实现。

## Task 5: 构建与交接检查

**Files:**
- No source changes unless a build error identifies a specific defect.

- [ ] 运行 `npm run build`（目录：`frontend`），应生成成功的生产构建。
- [ ] 运行 `npx tsc --noEmit`（目录：`server`）；本计划不修改后端代码，既有类型错误应记录但不扩大范围。
- [ ] 运行 `curl.exe --noproxy "*" -s -o NUL -w "%{http_code}" http://localhost:3001/`，期望 `200`。
- [ ] 检查 `git diff --check` 与工作区状态；确认改动仅在计划列出的前端文件和后端交接文档内，没有提交。
- [ ] 把后端交接文档路径、API contract 与未联调限制告知用户；后端端点未上线前，不宣称四柱功能已生产可用。

## 自检

- Spec coverage：输入范围、合法柱校验、现有增强计算复用、AI 引用、隐私、不保存、错误处理、移动端和后端契约分别由 Task 1–5 覆盖。
- Placeholder scan：无 TODO/TBD 或留给实施者猜测的接口字段。
- Type consistency：Task 1 的 `DirectPillarsInput`、`DirectPillarsResult` 在 Task 2/3/4 使用同名结构；API 的路径与请求结构在 Task 1 与 Task 4 一致。
- Execution choice：用户已明确“继续”，按当前会话内联执行；不启动子代理，不提交 Git。
