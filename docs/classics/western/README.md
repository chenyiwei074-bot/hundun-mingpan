# `docs/classics/western/` —— 西方底本层

业主 2026-10-23 两条裁定定死这一层的形状：**只把 Gutenberg 键入本当可引底本（窄路）**；
**查不到公版古籍出处的口径一律标「近代约定 / 近代体系 · 非古籍」**。父目录
`../README.md` 的收录规则（只收公版原文、逐字入仓、引文必须是连续子串）在这里同样成立，
本文件只补西方侧多出来的部分。

## 一、底本 = 规范化后的 PG 文本，由脚本生成

```
原始下载文件  +  tools/western-acceptance/make-classics.ts  +  tools/_lib/pgnorm.ts
        →  docs/classics/western/<book>.txt
```

规范化只做排版，不碰字符：剥 PG 头尾（许可块与 `*** START/END ***` 两行标记）、去 CR、
段落摊平（段内硬换行并入同一行）、空白归一；**不合并断词连字符** —— 那等于修原文。
规则本身有版本戳 `pgnorm-v1`；改任何一条都要升版本并整档重生成，否则老底本的哈希与新规则
的产物对不上，而"对不上"看起来像原文变了。

每个文件头部是机器可读的元数据：

| 字段 | 作用 |
| --- | --- |
| 载体（PG 编号 + URL） | 重新取一次就能比 |
| 版本与译者 | 公版判断落在哪一版上 |
| 抓取日期 | 同一 URL 的内容也会变（PG 会重排） |
| **原始文件 sha256** | 钉住"是从这份字节切出来的" |
| **规范化整档 sha256** | 钉住规范化结果 |
| 每条 PASSAGE：该版位置 / 规范化整档字符偏移 / 规范化段 sha256 | 一段一个凭据 |

复现命令（`--check` 逐字比；不给原始文件时打 **SKIP** 并说明，绝不计 PASS）：

```
QN_PG_TETRABIBLOS=<pg70850.txt> QN_PG_DELACERENCE1916=<pg43548.txt> \
  node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
  tools/western-acceptance/make-classics.ts --check
```

## 二、引文规则

1. 底本与引文**都过同一个规范化**（`tools/_lib/pgnorm.ts` 的 `canon`）再判连续子串 ——
   两边折叠方式不同会伪装成"引文不一致"，那种红最浪费人时间。
2. **引文不许带 PG 注号**（`[43]`、`[44]` 之属）。注号是注者锚点，其注释文字是 19–20 世纪人写的，
   不入底本、不得引用 —— 相位容许度那组度数在全部公版文本里**只出现在译者注**，
   把它引成正文就是把近代约定包装成古籍。
3. 页面展示**可以截断**，但必须是原句的连续片段；截断处不许拼接（引两段就写两处）。
4. 章节编号**按底本那一版登记**并写映射：Ashmand/Foulsham 1900 版的 Book I 第十四章≈今本 I.14 一带、
   第十六章 ≈ 今本 I.13。页面与文档一律不许裸写今本编号。

## 三、每条口径的三层块

`原文（标底本 + 该版位置） / 本站白话 / 口径标注` —— 缺任一层不算有出处，机检在
`tools/astro-acceptance`（页面侧）与 `tools/western-acceptance`（底本侧）。
口径标注只分三种：**古籍原文** / **近代文献（标年份与作者）** / **无古籍出处 · 近代约定**。
白话是本站自己写的解释，页面上自证「非原文、非他人译本」。

## 四、首批登记（两份底本，四条 PASSAGE）

| 底本 | PASSAGE | 站点取用 | 口径层 |
| --- | --- | --- | --- |
| `tetrabiblos.txt`（PG #70850，Ashmand 译，原出版 1900） | `i-xiv-tropical-signs` | `/astro`「地心、回归黄道」那条口径 | 古籍原文；「每宫恰 30°、经度化、不作岁差换算」= 本站实现选择 |
| 同上 | `i-xvi-mutual-configurations` | 相位表（未做）的几何定义：180/120/90/60 | 古籍原文；**orb ±8°/±6°/±8° = 无古籍出处 · 近代教科书约定** |
| `delaurence-illustrated-key-1916.txt`（PG #43548） | `celtic-method-opening` | 塔罗牌阵抽取（未做）的操作法 | 近代文献（1916 · De Laurence）；书中"Ancient/Celtic"是作者自称，本站不背书 |
| 同上 | `celtic-method-ten-cards` | 同上，"头十张"那一步 | 同上 |

## 五、明确不收 / 不引的

| 东西 | 状态 | 原因 |
| --- | --- | --- |
| Sextus Empiricus《Adversus Astrologos》(IA 1718) | **待复核** | 只有 OCR，长 s 与粘连未修；核到字节之前**不许引用**。E3 整宫制页面写「整宫制（Hellenistic）· 底本待转录」 |
| Lilly《Christian Astrology》1647 (IA) | 首批不收 | OCR；且其 orb 是 9°/7°，与本站数值无关，收进来只会让人以为要改数值 |
| Balliett 1908 (IA) / 生命灵数 | **标近代体系，不引原文** | 只有 OCR，且那一页自己在转引她更早的著作（转引关系未核清） |
| Mathers《Key of Solomon》1889 (IA) / 行星时 | 标近代文献，不引原文 | 同上，OCR |
| Vettius Valens《Anthology》 | 不引 | 无公版英译（Riley/Layton 有版权；Kroll 1908 校勘本的 OCR 丢了希腊文） |
| archive.org 的 `*_djvu.txt` 整体 | 只作校勘与导航 | 实测有 `Colors→Golors`、长 s、词间双空格、句中硬换行 —— 当底本的话，失败方式看起来像有人改了原文 |
