# Hundun 前端续做交接（2026-10-24）

## 当前工作树状态

- 仓库：D:\gpt-frontend-sync\main-09d4-worktree
- 当前 HEAD：09d4afa（detached HEAD；没有活动分支）
- 52 个已跟踪文件有未提交修改；另有本地备份副本和视觉验收产物。
- 本快照没有提交、推送或部署。后端/运维负责合并与上线。
- server/、根和 frontend 的 package.json、package-lock.json 均无修改；没有新增依赖。
- 请保留工作树内现有修改、未跟踪的 *.codex-backup-* 文件及 .visual-harness-final/。不要 reset、checkout 或清理它们。
- 较早的 docs/HANDOFF-frontend-redesign.md 记录此前阶段；本文记录 09d4afa 之后的当前本地快照。

## 本地完成内容

- 全站采用暖纸东方与深紫西方主题；门廊在手机首屏即可选择东方或西方，工作页、目录、表单、结果、法律页共用字号、间距、焦点与动画规范。
- 问事入口、目录状态、东方/西方导航和公开文案已统一。对外 AI 名称沿用“混沌自研 AI”；按用户明确要求，不写其它模型名或“底层模型未训练”等表述。协议与免责声明现在用“盘面与规则按本站规则生成”，不暴露实现术语。
- 塔罗支持三张过去/现在/未来、正位与逆位、78 张原创 SVG 牌面、逐张抽取/翻牌、牌义与已核验来源、键盘交互及减少动态效果。牌面不直接复刻现代有版权图像。
- 六爻报数起卦公开入口要求三个正整数：第一数定上卦，第二数定下卦，第三数独立定动爻。页面拒绝两数；旧内部调用仍保留兼容路径。调用已有的三数报数规则，不重写八字、紫微或六爻核心公式；取数版本戳升为 meihua-qishu-v2。
- 六爻盘面展示天干、地支和纳甲信息；没有已核验古籍来源时明确标“本站自研”。
- 移动端问事回答面板按内容自然展开，不裁切回答；户型图保留 2D 标注、3D 舞台、候选确认、错误恢复和移除图片流程。
- 命盘分享生成、复制、撤回、只读分享页和海报请求已接上分享令牌契约；出处区按 sourceIds 展示，空来源显示本站自研。
- 公开页目前遵守用户批准的“混沌自研 AI”口径。隐私页列出处理内容、用途和 7 天保留说明，但不列模型供应商名称。

## 当前验证

- frontend 的 npm run build：通过；Next.js 16.2.11，TypeScript 检查通过，29 条页面/API 路由生成。
- 分组视觉巡检累计 110 个桌面/375px 状态，最终工作树证据全部通过：
  - 门廊、东方/西方、工具目录、问事及分享：28 态；
  - 占星和塔罗：16 态；
  - 户型风水：12 态；
  - 建盘与六爻：除六爻完成态两态外 20 态通过；完成态修正后桌面和移动 2 态复测通过；
  - 八字演示、梅花、合宿、黄历、工具、验真：12 态；
  - 账户、管理、联系、隐私、协议、免责：12 态；协议/免责声明改词后又复测 6 个相关桌面/移动态，通过；
  - 命盘结果、等待、报告和空态：8 态。
- --stub 视觉验收测的是前端夹具和交互，不代表真实 AI、数据库或外部网络服务可用。户型实时识别网络线未在 stub 模式验证。
- 9 个受当前改动影响的接受套件刚复跑，均为 0 failures：assistant 68、astro 63、directory 61、fengshui 123、hepan 57、receipt 72、western 20、liuyao-ganzhi 82、meihua 27。
- 浏览器实测六爻报数：输入 3, 8 会显示“三个正整数”的错误；输入 3, 8, 5 会进入 /liuyao/result 页面并显示生成的卦象。
- 浏览器实测分享/出处/户型等路径的证据见本任务视觉验收产物；git diff --check 通过。
- 两份 lockfile 使 Next.js 显示 workspace root 推断警告，构建成功；没有改动 lockfile。
- 之前 K 线套件的 scope guard 曾因本地 origin/main 仍指向 432d3ba 而把历史 server 文件计入 diff。当前工作树的 server/ 没有变更；本次没有更新 Git refs 来消除该测试环境问题。

## 仍需规则或后端契约，不能由前端安全补造

1. 西方上升点与整宫制页面：需要确定算法版本、地点/时区输入契约，以及至少 20 组对拍数据和 0.05° 内的验收公差。未拿到前不在前端伪造宫位。
2. 西方目录中尚未开放的相位、Placidus、月相、数字命理等功能：需要经过确认的计算规则、来源说明和金标准夹具；目录继续如实标记未开放/部分可用。
3. 中国地点在西方占星流程中的选择与时区/坐标映射：用户已交后端处理。前端等其最终接口和地点数据契约，不用猜测时区或硬编码城市坐标。
4. 六爻、紫微、风水、合盘若要挂古籍出处，需要提供已入仓底本、版本/卷次/定位、连续原文与 sourceId。没有之前继续显示“本站自研”，不伪造来源。
5. 塔罗当前正逆位牌义和来源已接入；如果要多牌综合 AI 报告，需要后端给自研 AI 的请求/响应契约、错误状态及隐私流转规则，再由前端接线。
6. 公开隐私文案依用户批准不显示模型供应商名或训练声明。若今后要更改这项公开口径，需要用户重新裁定；本轮不擅自改动。

分享链接、命盘/报告 7 天保留、户型图删除接口和 sourceIds 契约已有后端实现，不列为前端阻塞；前端对应入口已接线。

## 当前 52 个已跟踪修改文件

frontend/app/agreement/page.tsx
frontend/app/astro/page.tsx
frontend/app/chart/result/[id]/page.tsx
frontend/app/disclaimer/page.tsx
frontend/app/fengshui/page.tsx
frontend/app/globals.css
frontend/app/liuyao/create/LiuYaoPlate.tsx
frontend/app/liuyao/create/page.tsx
frontend/app/liuyao/result/[id]/ReceiptPanel.tsx
frontend/app/liuyao/result/[id]/page.tsx
frontend/app/meihua/page.tsx
frontend/app/page.tsx
frontend/app/privacy/page.tsx
frontend/app/report/[id]/page.tsx
frontend/app/share/chart/[token]/page.tsx
frontend/app/tarot/page.tsx
frontend/app/tools/page.tsx
frontend/app/verify/page.tsx
frontend/app/xiu/page.tsx
frontend/components/assistant/QuestionComposer.tsx
frontend/components/bazi/BaziPillars.tsx
frontend/components/bazi/LifeCurve.tsx
frontend/components/bazi/ScenarioMatrix.tsx
frontend/components/chart/HepanSection.tsx
frontend/components/fengshui/FloorPlanForm.tsx
frontend/components/fengshui/FloorPlanStudio.tsx
frontend/components/home/ModeLanding.tsx
frontend/components/home/OrientalBody.tsx
frontend/components/tools/ToolCatalog.tsx
frontend/components/western/BasisQuote.tsx
frontend/components/western/NatalPlanets.tsx
frontend/components/western/WesternWorkspace.tsx
frontend/components/ziwei/ZiweiGongs.tsx
frontend/lib/astro/planets.ts
frontend/lib/chart/ai-wait.ts
frontend/lib/fengshui/recognize.ts
frontend/lib/hepan/engine.ts
frontend/lib/liuyao/methods/number.ts
frontend/lib/meihua/engine.ts
frontend/lib/receipt/anchor.ts
frontend/lib/tools/catalog.ts
frontend/lib/tools/western-catalog.ts
tools/assistant-acceptance/acceptance.ts
tools/astro-acceptance/acceptance.ts
tools/directory-acceptance/acceptance.ts
tools/fengshui-acceptance/acceptance.ts
tools/hepan-acceptance/acceptance.ts
tools/receipt-acceptance/acceptance.ts
tools/visual-harness/census.mjs
tools/visual-harness/fixtures/liuyao-result-number.json
tools/visual-harness/fixtures/liuyao-result-time.json
tools/western-acceptance/acceptance.ts

## Handoff rules

Do not assume this detached snapshot is a branch tip. Do not commit, push, merge or deploy from this worktree. The user has assigned merge/deploy to the backend/operations process. Use this document as the current status snapshot and retain all local changes for that handoff.