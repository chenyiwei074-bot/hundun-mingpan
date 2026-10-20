# 前后端引擎拷贝：哪些是真的同源，哪些不是

这份文档只解决一个问题：**有人改了 `frontend/app/lib/core/**` 之后，以为把同名文件
逐字节复制到 `server/src/core/**` 就叫"同步"。** 有几处不是，硬推一致会编译失败或改掉行为。
站点规则是「agent 不碰 `server/`，那份拷贝由运维改」，所以这里记的是运维改的时候要知道的事。

维护约定：每次有人在前端引擎层改了与 server 同名文件的**行为**（不只是格式），
如果两边不能逐字对齐，必须在这里加一条，写清差在哪、为什么不推平。

---

## 一、总则

- 前端：`frontend/app/lib/core/{yiqi-core,bazi-enrich}/**`
- 后端：`server/src/core/{yiqi-core,bazi-enrich}/**`
- 期望状态是 **byte 同步**。`diff` 不为 0 时要么在这里有登记，要么就是漏同步。
- 判断"这次改动同不同步得了"的办法：改完之后两边各跑一次同一组用例
  （四柱那份是 `tools/bazi-acceptance/cases/bazi-validation-v1.json`，
  地支关系那份是 `tools/zhi-relations/make-golden.ts --check`，都是 20736/全枚举级）。

## 二、已登记的差异（不是漏同步）

### 1. `yiqi-core/bazi.ts` —— 不做 byte 同步

- 后端这份**没有 `dayBoundaryMode`**（夜子时 23:00 归次日的开关在前端引擎与用例里）。
  这是 `bazi-acceptance` 长期"前端 8/8、仓库后端 7/8"的唯一那条红，属于口径差异而不是缺陷。
- 因此 2026-10-20 那次删调试打印时，运维只做了一件事：**外科式删掉
  `console.error('🔍 八字计算结果 - zhangSheng/naYin', …)` 那两行**，没有整份覆盖。
  拿前端那份盖下去会直接 `TS2339`（后端类型里没有那个字段）。
- 结论：这份文件两边会长期不完全一致。**别为了 diff=0 去补 `dayBoundaryMode`** ——
  那等于给后端加一个后端没人调的口径开关。

### 2. `bazi-enrich/gan-relations.ts` —— 已 diff 0

2026-10-20 两次改动都同步过了：抽 `ganPair`（合盘 #49 裁定①批准的那个就地导出）、
以及删掉 `PillarVerdict.verdict` 并集里不可达的 `'天地异气无生克'`（运行时判词一个字没变）。

## 三、引擎里的打印口径（2026-10-20 裁定 ①）

- `console.log` / `info` / `debug` / `trace`：**一律禁**。这类东西跟着成功路径走，
  等于把一张别人的命盘打在任何人 F12 都看得见的地方。
- `console.error` / `warn`：**只在错误路径里允许**（catch、查不到、越界退回）。
- 前端这份由 `tools/kline-acceptance` 的 `core/no-unconditional-engine-prints` 钉住
  （扫 `frontend/app/lib/core/yiqi-core/*.ts`，剥注释后匹配）。后端那份没有对应闸门，
  靠这条口径人工守。

## 四、还有谁在前端引擎里留了打印（都在条件/异常路径，属允许类，未清）

`ziwei-standard.ts:720`（测试功能未实现）、`bazi.ts:95`（晚子时换日）、
`nayin.ts:91`（未找到纳音）、`jieqi.ts:155`（节气校正）。
这些不是"待修的缺陷"，是"允许存在但没人读过"——要清的话得单独一批，别顺手。
