# 《Tetrabiblos》第一卷第十四章 回归宫与分点宫（tropical / equinoctial signs）

> 本站西方侧第一份**逐字底本**。规则见 `../README.md` 的「西方底本」一节。
> 这一份支撑的口径是：`/astro` 用**回归黄道**（黄经以春分点为起点）、**每宫 30°**、**不做恒星黄道的岁差修正**。

## 元数据（九项，缺一即不可核）

| 字段 | 值 |
| --- | --- |
| 书名 | Ptolemy's Tetrabiblos; or Quadripartite, being four books of the influence of the stars … with a preface, explanatory notes |
| 作者／时代 | Claudius Ptolemaeus（约公元 100–170），《四书》第一卷 |
| 卷篇 | Book I，**该版第十四章**「TROPICAL, EQUINOCTIAL, FIXED, AND BICORPOREAL SIGNS」（该版目录页 23） |
| 章节编号注记 | **编号按本版本**（Ashmand/Foulsham 1900 排印）。通行今本的章节号与本页不一致（例：本页第十六章「Mutual Configurations of the Signs」≈ 今本 I.13）。**页面与文档一律不许裸写"I.13/I.14"这类今本编号**，要写就写"该版第几章 + 章名"。 |
| 转引关系 | 无转引，直接取该章正文。**正文里的 `[43]` 是该版注者加的注号锚点，其注释文字不入本底本、也不得引用** —— 注者语不是古籍正文（orb 度数那条教训，见 README）。 |
| 版本 | Project Gutenberg eBook **#70850**（2023-05-24 发布）；Translator: **J. M. Ashmand**；Original publication: United Kingdom, **W. Foulsham & Co. Ltd, 1900**；Adapter: Proclus；Credits: deaurider 与 Online Distributed Proofreading Team（PGDP 人工校勘键入本） |
| 公版判断 | 原作公元 2 世纪；该英译与 1900 原版出版物均已公版；PG 本按其许可可自由复制再分发。**PG 头尾的许可块与"Project Gutenberg"字样不随引文上屏。** |
| 取文方式 | `curl -sSL --ssl-no-revoke -x http://127.0.0.1:7897 https://www.gutenberg.org/cache/epub/70850/pg70850.txt` |
| 抓取日期 | 2026-10-23 |
| 源文件校验 | 整份 pg70850.txt **sha256 = 9acc3da34642eb0a54d8b14224bfa52017aec6bb7f8c0558f50e8492ed226fc1**，552667 字节；本段取该文件**字符偏移 118548…119374**（含首不含尾，按 UTF-8 解码后的字符串计数），826 字节 |
| 繁简与标点处理 | 英文原文，无繁简问题。**入仓时只做一件事：行尾 CRLF → LF**（源本段 826 字节 → 入仓 812 字节，差的 14 字节全是 14 处 `\r\n`→`\n`），未增删、未重排、未替换任何字符（含 `_tropical_`、`_turn_` 这类 PGDP 花体标记与 `[43]` 注号） |
| 比对规则 | 页面上的每条引文必须是下方「原文」块的**连续子串**；比对前两侧各自把**连续空白折叠为单空格**（源 TXT 是约 70 字符硬换行，不折叠就只能把换行位置抄进代码里，那种引用一改版就烂）。除空白以外的差异一律判红 —— 证伪方式是把某个字母改掉，必须红。 |

## 原文（逐字，本段自源文件字符偏移 118548 起）

```text
Among the twelve signs, some are termed tropical, others equinoctial,
others fixed, and others bicorporeal.

The tropical signs are two: viz. the first thirty degrees after the
summer solstice, which compose the sign of Cancer; and the first thirty
degrees after the winter solstice, composing the sign of Capricorn.
These are called _tropical_, because the Sun, after he has arrived at
their first points, seems to _turn_, and to change his course towards a
contrary latitude;[43] causing summer by the _turn_ he makes in Cancer,
and winter by that which he makes in Capricorn.

There are also two equinoctial signs: Aries, the first after the vernal
equinox; and Libra, the first after the autumnal equinox: they are so
called, because the Sun, when in the first point of either, makes the
day and night equal.
```

## 本站白话（本站自写，非原文、非他人译本）

- 「tropical」这两个宫，说的是**夏至点之后的头三十度**成巨蟹宫、**冬至点之后的头三十度**成摩羯宫；
  名字叫"回归"，因为太阳走到它们的起点看着像转了方向，纬度开始往回走。
- 「equinoctial」那两个宫，说的是**春分点之后的白羊宫**与**秋分点之后的天秤宫**，因昼夜平分得名。
- 本站由此采用的那一层只有一句：**黄经从春分点起算、三十度一宫、不随恒星背景漂移**。
  至于"用连续经度数值表达"（本站写成度数）与"每宫恰为 30.000°"的边界算法，是**本站实现选择**，
  原文没有给度数化的表述；页面上这两件事要分开写。

## 口径标注

| 说法 | 属于哪一层 |
| --- | --- |
| 回归黄道（宫名挂在至点/分点上） | 古籍原文（本页） |
| 每宫 30° | 原文可读到"头三十度"这一表述；全站十二宫一律 30° 是本站按同一体例的推定 |
| 黄经数值化、边界 30 的整数倍、无岁差修正 | 本站实现选择 |
| 星座守护星、Placidus 分宫、相位容许度 orb、synastry、Life Path | **近代约定 / 近代体系，非古籍**（查不到公版古籍出处） |
