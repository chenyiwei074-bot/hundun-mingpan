// AI Prompt 构建器 — 将结构化数据转为六爻专用的 LLM Prompt

import type { LiuyaoReportContext } from './types';
import { REPORT_SECTIONS } from './sections';

/** 生成系统角色 Prompt */
function systemPrompt(): string {
  return `你是一位资深六爻预测师，精通《周易》六十四卦和纳甲筮法。你的分析基于真实卦象数据，不编造不存在的爻象。

分析原则：
1. 以卦象数据为准，不凭空发挥
2. 世爻代表问卦人，应爻代表所问之事或对方
3. 用神根据事项类型自动判断（财运→妻财、事业→官鬼、考试→父母、健康→子孙）
4. 动爻揭示变化关键，静卦以世应为主
5. 旺衰结合月建日辰判断，旺相为吉，休囚为凶
6. 六合主和美顺利，六冲主变动波折
7. 旬空之爻力量减弱，出空填实后方显

输出格式：使用 Markdown，章节标题用 ##，重点用 **粗体**，数据引用用 > 引用块。`;
}

/** 生成卦象数据 JSON 块 */
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

  return `\`\`\`json
{
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
${ctx.wangShuai.map(w => `    { "爻":"${w.label}", "六亲":"${w.liuQin}", "地支":"${w.zhi}", "旺衰":"${w.level}", "月":"${w.monthInfluence}", "日":"${w.dayInfluence}" }`).join(',\n')}
  ],

  "冲合关系": [
${ctx.relations.details.map(d => `    "${d}"`).join(',\n')}
  ],

  "伏神": [
${fuShenBlock}
  ]
}
\`\`\``;
}

/** 生成报告章节要求 */
function sectionsPrompt(): string {
  const ordered = [...REPORT_SECTIONS].sort((a, b) => a.order - b.order);
  return ordered.map(s =>
    `### ${s.title}\n${s.description}\n要点：${s.keyPoints.join('；')}`
  ).join('\n\n');
}

/** 构建完整 AI Prompt */
export function buildReportPrompt(ctx: LiuyaoReportContext): string {
  return `${systemPrompt()}

---

## 卦象数据（必须基于此数据分析，不可编造）

${dataBlock(ctx)}

---

## 报告要求

请按以下结构输出六爻分析报告。每个章节都要有实质性内容，引用具体数据。

${sectionsPrompt()}

---

## 输出要求

1. 使用 Markdown 格式
2. 每个章节以 ## 开头
3. 用 > 引用关键数据
4. 用 **粗体** 标注吉凶关键字
5. 趋势判断需要给出明确方向（吉/凶/平）
6. 建议要具体可操作
7. 结尾注明"以上分析仅供参考，不构成决策建议"
8. 不要输出"根据卦象"等套话，直接分析

现在请输出完整报告。`;
}

/** 生成简短摘要 Prompt（用于卡片展示） */
export function buildSummaryPrompt(ctx: LiuyaoReportContext): string {
  return `${systemPrompt()}

根据以下卦象数据，用一段话（不超过150字）总结这个卦的核心信息：

${dataBlock(ctx)}

要求：直接给出最核心的判断，包括本卦含义、吉凶方向、最关键的动爻信息。`;
}