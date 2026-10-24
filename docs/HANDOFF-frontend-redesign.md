# Hundun 全站前端重做交接

## 分支与范围

- 仓库：`hundun-mingpan`
- 分支：`feat/frontend-redesign`
- 基线：`432d3ba5799d8871a5ec128092a192e26544423c`
- 本次实现代码 tip（交接文档提交的父提交）：`49d7da5e681d30bd6edfb8d433c1e2e46c0f2acf`
- 本次补完后新增提交及最终分支 tip 以交付时 `git rev-parse HEAD` 输出为准。
- 只改前端与前端视觉验收探针；未改 `server/`、命理/历法/六爻计算核心、API 行为、catalog 的 `status/href/note` 语义、依赖清单或 lockfile，也未部署。

本次增量 `git show --stat 49d7da5`：

```text
frontend/app/globals.css                               |  64 +++++++++--
frontend/app/tarot/page.tsx                             | 120 +++++++++++++++------
frontend/components/assistant/QuestionComposer.tsx      |   5 +-
frontend/components/tarot/TarotIllustration.tsx         |  94 ++++++++++++++++
frontend/lib/tarot/deck.test.mjs                        |  41 +++++++
frontend/lib/tarot/deck.ts                              |   9 +-
frontend/lib/tarot/meanings.ts                           |  95 ++++++++++++++++
frontend/lib/tools/western-catalog.ts                   |  18 ++--
tools/assistant-acceptance/acceptance.ts                |  21 ++--
tools/visual-harness/census.mjs                         |  56 ++++++++--
tools/western-acceptance/acceptance.ts                  |  24 +++--
11 files changed, 465 insertions(+), 82 deletions(-)
```

提交顺序：

```text
52da13b feat(frontend): add mixed depth visual foundation
110e3ce feat(frontend): add verifiable tarot MVP
ddd5d88 style(frontend): polish admin and floorplan controls
ea723ad fix(frontend): deal tarot cards from the deck
49d7da5 feat(frontend): complete tarot orientations and eastern polish
<final handoff commit> docs(frontend): record redesign handoff
```

## 页面逐项记录

全站共用样式将东方页面统一为暖纸底、墨色正文与旧金强调，将西方页面统一为深紫底、月白正文与淡金强调。入口、主视觉与卡片表面增加克制的立体层次；排盘数据仍以易读的平面信息呈现。既有表单、命盘结果、依据、隐私、免责和回执状态继续使用原有语义与数据。

| 路由 | 改前 → 改后 |
|---|---|
| `/` | 单一内容入口 → 两块整区可点击的东方/西方入口；东方用暖纸与立体罗盘，西方用深紫与星盘球体，整块链接内没有二级小按钮。 |
| `/oriental` | 东方工具与问事入口 → 沿用已验证的中文问事框和四类意图，在统一暖纸工作页中展示工具与独立户型入口。 |
| `/western` | 西方工具入口 → 复用相同工作页秩序，使用深紫主题；界面仍为中文，并保留目录的可用状态和缺口说明。 |
| `/tools` | 两套工具清单 → 统一到共用卡片与状态样式，继续由目录提供状态、入口和口径说明。 |
| `/astro` | 占星输入、星体结果与依据 → 统一为西方深紫主题；星体结果、来源原文/白话/口径三层仍分层显示。 |
| `/fengshui` | 户型上传和标注流程 → 统一暖纸表单、五步状态与编辑控制；保留 2D/3D 舞台和本地图片移除路径，删除目标尺寸由 44 调整为 48 像素。 |
| `/create` | 生辰信息表单 → 沿用单人/合盘和日期输入语义，使用统一的暖纸表单、按钮和焦点样式。 |
| `/bazi-chart` | 输入演示页 → 重排为清晰的出生信息卡片与主操作，补齐首屏标题层级；未接入的命盘数据仍如实标注。 |
| `/chart/[id]`、`/chart/loading/[id]`、`/chart/preview`、`/chart/preview2/[id]`、`/chart/result/[id]` | 命盘查看、等待、预览与结果 → 延续原有计算/AI 分层与证据组件，在全站卡片、间距、正文和焦点系统中保持统一。 |
| `/liuyao`、`/liuyao/create`、`/liuyao/result/[id]` | 六爻入口、起卦与结果 → 沿用既有问题、起卦方式、卦盘和回执流程；共用暖纸页面与控件样式，不更改卦盘或回执事实。 |
| `/meihua`、`/xiu`、`/huangli` | 梅花、星宿、黄历工具 → 统一到共用纸面表单、数据卡片和页脚，同时保留各自的计算与口径内容。 |
| `/tarot` | 原来没有三张牌页面 → 新增西方深紫三张牌阵，显示过去/现在/未来，先公布 SHA-256 承诺，抽牌后公开种子以便本地复算。 |
| 问事空状态与东方框架 | 纯留白问事结果区 → 增加印章式空状态文案，并把字号接回全站字阶；东方共用暖纸底、罗盘纹样和中文工具入口。 |
| `/verify` | 验真表单 → 沿用纯本地 SHA-256 流程，统一输入卡片与说明排版，继续明确页面不发网络请求及其证明边界。 |
| `/report/[id]`、`/dashboard` | 报告正文与空报告状态 → 延续原有报告和自动保存入口，统一到共享卡片、空状态与导航样式。 |
| `/admin/dashboard` | 深色硬编码运营面板 → 使用共用暖纸/数据卡片样式，保留现有统计请求和转化漏斗。 |
| `/agreement`、`/privacy`、`/disclaimer`、`/contact` | 法律与联系信息 → 保留事实和文本结构，统一导航、页脚、正文宽度与全站字阶。 |

上述既有功能路由大多通过全局令牌和共享组件重设视觉，保留了其成熟的表单、结果和资料结构；页面级结构重排集中在体系门廊、八字演示、管理面板与新增塔罗页。浏览器抽查覆盖东方/西方工作页、工具目录、占星、户型、建盘、六爻起卦、八字演示、验真、报告、塔罗和管理空状态。项目中没有独立登录页路由。

## 塔罗实现与口径

- `frontend/lib/tarot/deck.ts` 提供 78 张牌的名称/花色/编号事实数据，`drawThree(seedHex)` 以公布的本地随机种子确定性抽出不重复牌，并同时确定正位或逆位。
- `frontend/lib/tarot/meanings.ts` 为 78 张牌分别提供正位与逆位的中文译述和章节来源；大牌参照 Waite《The Pictorial Key to the Tarot》（1910）Part III §3，小牌参照 §2，补充义标为 §4。这里记录的是所列历史底本的意译，不宣称学界共识或科学结论。
- 洗牌使用 `crypto.getRandomValues` 生成种子，并在抽牌前显示 SHA-256 承诺。三张揭晓后展示种子，页面说明这只是本地承诺，不是区块链存证，也不发送到服务器。
- 抽牌动画读取牌堆、舞台和固定槽位的浏览器坐标：每张牌从牌堆中心飞向对应的过去/现在/未来槽位，再翻面。槽位始终保留固定宽高比，动画覆层不参与排版；减少动态效果时直接显示三张牌，不等待动画。
- 牌堆待机时只有轻微起伏与封印缓慢旋转；指针可让牌堆和已揭晓牌面产生有限角度的 3D 倾斜。点选任意牌会展开对应方向的牌义与出处，再点其他牌可切换；进场牌与展开的记录按序淡入。键盘焦点保留可见状态，系统减少动态效果时关闭新增动画与倾斜。
- 支持正位和逆位，抽牌记录逐项显示方向匹配的牌义、牌位、牌名、花色/序号与章节出处，并回显本次问题。牌面是原创 SVG，保留韦特—史密斯体系中可辨认的编号、符号、人物与场景线索；不直接复刻原牌图像。
- `tools/visual-harness/census.mjs` 验证 idle、抽牌、记录、375px、键盘和减少动态效果状态；检查方向徽标、逆位旋转、牌义来源、问题回显、舞台尺寸和无外部牌面请求。互动展开记录后页面增长是预期披露内容，版面位移检查仍验证固定牌槽与 CLS。

## 验证记录

最终源码验证：

```text
npm run build
✓ Compiled successfully (Next.js 16.2.11)
✓ TypeScript
✓ Generating static pages (28/28)
```

构建有一条已存在的多 lockfile 根目录警告：仓库根和 `frontend/` 各有 `package-lock.json`；本任务未改 lockfile。

定向静态检查：

```text
npx eslint app/tarot/page.tsx lib/tarot/deck.ts app/bazi-chart/page.tsx app/admin/dashboard/page.tsx
PASS
node --check tools/visual-harness/census.mjs
PASS
git diff --check
PASS
```

全站 lint 的当前结果：

```text
npm run lint
✖ 241 problems (187 errors, 54 warnings)
```

错误来自原有未修改文件；本次改动的四个 TypeScript 页面/数据文件已通过定向 ESLint。

此前 18 个既有验收套件通过 816 项；本次改动后重新运行了受影响的牌库、assistant、directory 与 western 检查。下表 western 为本次 20 项结果，累计为 817 项：

| 套件 | 通过数 |
|---|---:|
| ai-wait | 17 |
| api-contract | 22 |
| assistant | 66 |
| astro | 63 |
| bazi | 11 |
| directory | 61 |
| fengshui | 123 |
| hepan | 57 |
| huangli | 25 |
| kline | 60 |
| liuyao-ganzhi | 82 |
| meihua | 27 |
| random | 20 |
| receipt | 72 |
| scenario | 40 |
| western（本次） | 20 |
| xiu | 35 |
| ziwei | 16 |
| **合计** | **817** |

视觉与浏览器检查：

```text
塔罗浏览器验收：ALL CHECKS PASSED — 12 states（桌面/375px、抽牌、记录、键盘、减弱动态）
东方问事定向复验：ALL CHECKS PASSED — 10 states（含桌面/375px、入口与中文输入）
目录 → 页面：东方入口 6 个、西方与总工具 8 个均可达
风水状态浏览器复核：2D 几何标注、3D 舞台、识别失败/候选确认与编辑闭环均可操作
3020 前端预览和 3001 共享服务均返回 HTTP 200；TypeScript、定向 ESLint、塔罗 78 牌数据测试通过。
塔罗交互复验：生产构建后的 3020 预览完成洗牌、三张逐一揭牌、点选牌义和切换选择；`node lib/tarot/interaction.test.mjs` 验证指针倾斜居中为零且边界限制在 ±6° / ±8°。
```

视觉验收使用本地 fixture/stub；它覆盖前端状态、样式、牌位、几何编辑和交互，不代表生产网络/API 的可用性。东方全量初检发现问事空状态印章字重用了 17px；改用 `--qn-fs-body` 后，东方问事 10 态全量复验通过。

全站交互动效补充（2026-10-24）：根布局挂载 `MotionEnhancer`，让所有路由的主要内容块按视口进入并限制延迟；新增导航当前页下划线、按钮/标签按压反馈、输入焦点过渡、卡片聚焦状态与原生详情折叠展开动效，保留已有各页动画和塔罗专属牌堆、揭牌交互。`prefers-reduced-motion` 下关闭新增动效并直接显示内容。浏览器抽查 `/`、`/oriental`、`/tools`、`/fengshui`、`/western`、`/tarot`；风水页“手工画”状态可正常展开房间编辑与结果区域。构建、TypeScript、定向 ESLint、全站动效及塔罗交互测试、`git diff --check` 均通过。

## 默认决策与未做项

- 门廊继续使用两张整块入口，不增加体系切换小按钮；东方为暖纸，西方为深紫；西方术数仍全中文。
- 立体感集中在体系入口、占星/星盘装饰、牌堆和户型 3D 舞台；命盘数字与证据仍用平面排版，避免影响阅读。
- 现有 API、结果与隐私/免责口径保持原文；不新增链上、代币或 NFT 功能承诺。
- 仍按 brief 暂不接入依赖业务规则或服务端的能力：E3 上升/整宫制对拍页、批 G 六爻纳甲展示裁定、西方目录中的未开放工具、账户保存、AI 综合牌阵解读。它们不是缺失的视觉控件；需先有确定的计算口径或后端接口，不能在前端伪造结果。
- 全站 `npm run lint` 仍被既有 187 个错误和 54 个警告阻断；全量错误修复不属于本次前端视觉范围。
- `/admin/dashboard` 的线上统计需要有效 `ADMIN_STATS_TOKEN`；本地 route smoke 不验证线上统计源。
- 视觉验收和当前本地预览使用 Chrome、端口 3020；共享服务 3001 仅做 HTTP 200 smoke check。

## 回滚

在本分支回滚本次基线之后的提交：

```powershell
git switch feat/frontend-redesign
git revert --no-commit 432d3ba..feat/frontend-redesign
git commit -m "revert: frontend redesign"
```

若尚未合并，直接删除分支即可丢弃本次提交；合并后优先用上述 revert 保留审计记录。不要对 `main` 执行 reset。

推送命令：

```powershell
git push origin feat/frontend-redesign
```
