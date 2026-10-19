// 西方玄学目录（#双体系）。
//
// 这一份与 lib/tools/catalog.ts 共用同一套词汇（ToolStatus / ToolEntry / IntentGroup），
// 不另立第二份状态枚举 —— 两套目录各写各的状态词，UI 与路由就会给出两种"可用"的含义。
//
// 现在整份目录都是未开放，这是有意的：占星的宫制/黄道口径、塔罗的牌组与抽取随机源、
// 数字命理取哪种字母-数字表，都还没有裁定的出处与算法口径（见 待裁 清单）。
// 未开放 = 没有 href，因此既进不了路由结果，也不会在页面上被伪装成能用的东西。

import type { IntentGroup, ToolEntry, ToolStatus } from './catalog';

export type { ToolStatus };

// 口径戳纪律：basis 里不许出现 `xxx-yyy-vN` 形状的字串，除非引擎真的导出同名戳
// （directory-acceptance 对东方目录就是按这个形状扫的，西方这一份由 western-acceptance 盯）。
// 现在一个版本戳都还没有，所以全部用大白话写"缺什么"。
export const WESTERN_INTENTS: IntentGroup[] = [
  {
    intent: '看本命',
    lead: '用出生时刻与地点，看一套行星落座与宫位的记录。',
    tools: [
      {
        slug: 'astro-natal', name: '西洋占星 · 本命盘', status: '未开放',
        question: '我的太阳、月亮与上升落在哪里，各行星落在哪一宫？',
        method: '由出生日期、时刻与地点换算行星黄道位置与宫位，再按落座与相位读盘。',
        basis: '缺项未定：热带还是恒星黄道、用哪种宫制、时区与夏令时怎么取、历表出处是谁。'
          + '这几项没裁定之前不排盘 —— 换一种宫制就是另一张盘，不是同一张盘的另一种读法。',
        reading: '一张标注了行星落座、落宫与主要相位的盘，外加每条结论用的是哪两个天体。',
        note: '引擎与口径尚未裁定，因此没有入口。本站不拿星座性格测试冒充本命盘。',
      },
      {
        slug: 'astro-synastry', name: '西洋占星 · 合盘', status: '未开放',
        question: '两个人的盘叠在一起是什么关系？',
        method: '两张本命盘叠合（或各取中点），看跨盘的行星相位。',
        basis: '依赖本命盘先成立；本命盘的缺项没解决，合盘就无从谈起。',
        reading: '跨盘相位表与逐条依据。',
        note: '与东方合盘是两套不同体系，不互相换算，也不共用算法。',
      },
    ],
  },
  {
    intent: '问一件事',
    lead: '抽牌、记牌阵，再按牌义与位置读。',
    tools: [
      {
        slug: 'tarot-draw', name: '塔罗 · 牌阵抽取', status: '未开放',
        question: '这件事眼下、阻碍与建议各是哪一张？',
        method: '由可复验随机源抽牌并保存牌组与牌阵版本，AI 只按牌义与位置解释。',
        basis: '缺项未定：用韦特还是马赛、78 张还是 22 张大牌、正逆位算不算、牌阵版本怎么标。',
        reading: '每一次抽取的牌、位置与牌组版本，可离线复验摘要。',
        note: '抽取随机源与牌组版本没定案前不开入口。牌面绝不交给模型"抽"，那是编造。',
      },
    ],
  },
  {
    intent: '择时看周期',
    lead: '月亮盈亏与行星小时的周期表。',
    tools: [
      {
        slug: 'lunar-phase', name: '月相 · 盈亏周期', status: '未开放',
        question: '某一天是农历几时月相？下一个朔与望在什么时候？',
        method: '由天文历表算朔望时刻与月相角，换算到用户所在时区。',
        basis: '缺项未定：历表出处与允许误差。黄历的宜忌是另一套体系，不拿它顶这一项。',
        reading: '朔望时刻表与当日月相照亮比例，逐条标计算来源。',
        note: '等西方线的历表出处裁定后开工。',
      },
    ],
  },
  {
    intent: '看名字与数字',
    lead: '把姓名或出生日期按一种取数表化成数字含义。',
    tools: [
      {
        slug: 'numerology', name: '数字命理 · 生命灵数', status: '未开放',
        question: '我的出生日数与姓名数各是多少？',
        method: '按一张字母-数字表与化简规则求和。',
        basis: '缺项未定：用毕达哥拉斯表还是卡巴拉表、母数与业力数留不留、中文姓名怎么取数。',
        reading: '每个数的取数过程逐步摊开，让人能自己复算。',
        note: '与东方五格剖象是两套表，不混用，也不互相改名。',
      },
    ],
  },
];

export const WESTERN_TOOLS: ToolEntry[] = WESTERN_INTENTS.flatMap(g => g.tools);
export const WESTERN_TOOL_BY_SLUG: Record<string, ToolEntry> = Object.fromEntries(
  WESTERN_TOOLS.map(t => [t.slug, t]));
export const WESTERN_LIVE_HREFS: string[] = [...new Set(
  WESTERN_TOOLS.filter(t => t.status !== '未开放' && t.href).map(t => t.href!))];
export const WESTERN_CLOSED_TOOLS: string[] = WESTERN_TOOLS.filter(t => t.status === '未开放').map(t => t.name);
