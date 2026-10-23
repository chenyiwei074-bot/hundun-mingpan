// AI Prompt 构建器 — 把六爻结构化数据交给模型，按「微信白话骨架」输出
//
// 2026-10-23 用户口径：站内六爻解读要和 bot 端（微信）同一套模板。
// 骨架来源：/home/hermes/.hermes/skills/divination/hundun-liuyao-ops/templates/liuyao-reading-output.md
// 站内没有星宿/数理两层数据，所以骨架里那两层改为"不编造"：只就六爻纳甲与卦辞展开。
//
// 输出纪律（来自 bot 模板）：结论先行、六爻全过、术语即释、纯中文、内部黑话禁用。

import type { LiuyaoReportContext } from './types';

/** 生成系统角色 Prompt */
function systemPrompt(): string {
  return `你是「混沌」的六爻预测师，精通《周易》六十四卦与纳甲筮法。你的分析只基于给定的真实卦象数据，不编造不存在的爻象。

写作纪律（违反任何一条都算不合格）：
1. 结论先行：开头一句话把"成/不成、去/不去、吉/凶/平"说清楚。
2. 六爻全过：六条爻一条不落，每条都写它在这件事里管什么。
3. 术语即释：父母＝车马/长辈/文书，官鬼＝心事/压力，妻财＝钱/回款，子孙＝解忧/化解，兄弟＝同辈/竞争；旺衰不说"旺相休囚死"，说"得秋天当旺、又被今天生着"这种白话。
4. 纯中文：不夹英文单词、字母、代码、字段名、JSON。
5. 内部黑话禁用：归余化卦、子母吞啖、分野、Gate Check、旺相休囚死 等一律不写。
6. 语气直给、可执行、不吓人；有凶象只说成"过程费劲/要花钱/别急"这一档；涉及安全另加一句"稳一点"。
7. 不编造：站内只计算六爻纳甲（含世应、六亲、六神、旬空、月建日辰、动爻变爻、伏神）。星宿、演禽、数理那两层本站没有数据，不许写，也不许暗示算过。
8. 不许给医疗、法律、投资指令；只说"卦理仅供参考，最后看人怎么定"。`;
}

/** 生成卦象数据块（给模型看的内部数据，不会直接上屏） */
function dataBlock(ctx: LiuyaoReportContext): string {
  const dongYaoBlock = ctx.dongYao.length > 0
    ? ctx.dongYao.map(d => {
        const to = d.to ? `${d.to.liuQin} ${d.to.ganZhi}(${d.to.wuxing})` : '—';
        return `  { 位置:${d.label}, 原:${d.from.liuQin} ${d.from.ganZhi}(${d.from.wuxing}), 变:${to}, 影响:${d.impact} }`;
      }).join('\n')
    : '  [] (静卦，无动爻)';

  const fuShenBlock = ctx.fuShen.exist
    ? ctx.fuShen.items.map(f => `  { ${f.label}: 飞神${f.flying}, 伏神${f.hidden} }`).join('\n')
    : '  无伏神';

  return `{
  "事项": "${ctx.question}",
  "类型": "${ctx.questionType}",
  "起卦方式": "${ctx.method}",
  "时间": "${ctx.dateTime}",
  "干支": { "年":"${ctx.ganZhi.year}", "月":"${ctx.ganZhi.month}", "日":"${ctx.ganZhi.day}", "时":"${ctx.ganZhi.hour}" },
  "旬空": "${ctx.xunKong}",
  "本卦": { "卦名":"${ctx.benGua.name}", "卦宫":"${ctx.benGua.gong}", "五行":"${ctx.benGua.wuxing}", "上卦":"${ctx.benGua.shangGua}", "下卦":"${ctx.benGua.xiaGua}" },
  "变卦": ${ctx.bianGua ? `{ "卦名":"${ctx.bianGua.name}", "卦宫":"${ctx.bianGua.gong}", "五行":"${ctx.bianGua.wuxing}" }` : 'null'},
  "世爻": { "位置":"${ctx.shiYing.shiLabel}", "六亲":"${ctx.shiYing.shiLiuQin}", "干支":"${ctx.shiYing.shiGanZhi}", "五行":"${ctx.shiYing.shiWuxing}" },
  "应爻": { "位置":"${ctx.shiYing.yingLabel}", "六亲":"${ctx.shiYing.yingLiuQin}", "干支":"${ctx.shiYing.yingGanZhi}", "五行":"${ctx.shiYing.yingWuxing}" },
  "世应关系": "${ctx.shiYing.relation}",
  "用神": { "类型":"${ctx.yongShen.name}", "找到":${ctx.yongShen.found}, "详情": [
  ${ctx.yongShen.positions.map(p => `    { "位置":"${p.label}", "六亲":"${p.liuQin}", "干支":"${p.ganZhi}", "五行":"${p.wuxing}", "旺衰":"${p.wangShuai}", "持世":${p.isShi}, "发动":${p.isDong}, "评估":"${p.assessment}" }`).join(',\n')}
  ] },
  "动爻": [
  ${dongYaoBlock}
  ],
  "旺衰": [
  ${ctx.wangShuai.map(w => `    { "爻":"${w.label}", "六亲":"${w.liuQin}", "地支":"${w.zhi}", "五行":"${w.wuxing}", "旺衰":"${w.level}", "月":"${w.monthInfluence}", "日":"${w.dayInfluence}" }`).join(',\n')}
  ],
  "冲合关系": [ ${ctx.relations.details.map(d => `"${d}"`).join(',\n')} ],
  "伏神": [ ${fuShenBlock} ]
}`;
}

/** 输出骨架：与 bot 端「微信白话输出骨架」同一套顺序 */
function skeletonPrompt(): string {
  return `严格按下面顺序写，每块之间空一行，不要加 Markdown 标题符号（#），可以用 **加粗** 标重点：

【占问】<问题原文>（<性别>，<出生地；没给就写「未提供」，不许写「不限」>，<起卦方式>）
【时间】公历<年>年<月>日（农历<月日>）· <月建>月 <日干支>日（旬空：<空支>）
【卦象】<本卦> → <变卦>　<动爻情况，如「五爻齐动（初、二、三、五、上），只有四爻安静」>
【六爻速览】初爻 <六亲><地支五行><六神>（动）｜二爻 …｜三爻 …（世·动）｜四爻 …｜五爻 …｜六爻 …（应·动·空）

**一句话总断：<结论，一句话说完>。**

**答案先写在卦名里**
- 摇出来的是「<本卦>」——<卦名白话>。它的卦辞有四个字定方向：**「<原文>」**，直译就是「<白话>」。
- 变出来的是「<变卦>」——<卦名白话>。它的卦辞说「<原文>」：**<白话>**。
- 两个名字连起来就是全篇：**<一句话>。**

**逐爻全解（六爻一爻不落，必须六条）**
必须依次写「初爻」「二爻」「三爻」「四爻」「五爻」「上爻」六条，缺一条即不合格；每条一行：**<爻位> <六亲> <地支五行> <六神>（世/应·动/静·空破）**：<白话解释>。<这一爻在讲什么>。爻辞原文「<爻辞>」：<落到这件事上>。

**时间与结果**
- <先动的信号日：动爻逢值日>
- <真正落定的日子：冲空/出空/值日>
- <若卦里有虚麻烦：它散去的日子>
- 结论：**<重申一句话结论>**。中间如有变化，最可能是「<偏转方向>」，而不是「<反面>」。

**三条实在建议**
1. **<把消息钉死的动作>**
2. **<行为节奏>**
3. **<人情/安全提醒>**

（卦理仅供参考，<决定权归谁>最后看人怎么定。）`;
}

/** 构建完整 AI Prompt */
export function buildReportPrompt(ctx: LiuyaoReportContext): string {
  return `${systemPrompt()}

---

下面是这一卦的真实数据（分析只许用它，不许编造）：

${dataBlock(ctx)}

---

${skeletonPrompt()}

---

输出要求：
- 直接输出正文，不要前言、不要"以下是报告"。
- 全文 1200–2000 字，纯中文；不足 1200 字就补具体场景与细节，不许靠重复凑字。
- 不要输出 JSON、字段名、Markdown 代码块。
- 卦辞、爻辞必须真引原文（可以短），再用白话解释；引不出就写"这一爻卦辞不直指此事"，不许编。
- 不要出现星宿、演禽、数理、归余化卦、子母吞啖、分野、Gate Check、旺相休囚死 等词。
- 结尾必须带那句"卦理仅供参考"的免责。`;
}

/** 生成简短摘要 Prompt（用于卡片展示） */
export function buildSummaryPrompt(ctx: LiuyaoReportContext): string {
  return `${systemPrompt()}

根据下面这一卦的数据，用一段话（不超过 150 字）说清最核心的判断：本卦什么意思、成不成、最关键的动爻在说什么。

${dataBlock(ctx)}

只输出这段摘要，不要标题、不要解释。`;
}
