// 报告章节定义 — 每个章节描述 AI 应输出什么

import type { ReportSection, SectionId } from './types';

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: 'overview',
    title: '一、卦象总览',
    order: 1,
    description: '根据本卦、变卦、动爻数量，给出卦象的核心含义和整体判断',
    keyPoints: [
      '本卦卦名及含义',
      '变卦卦名及含义（如有）',
      '动爻数量及意义（静卦/一爻动/多爻动）',
      '卦宫五行属性',
      '起卦时间干支对整体卦象的影响',
    ],
    dataPaths: ['benGua', 'bianGua', 'dongYao', 'ganZhi', 'xunKong'],
  },
  {
    id: 'shiying',
    title: '二、世应关系',
    order: 2,
    description: '分析世爻和应爻的关系，世爻代表问卦人自身',
    keyPoints: [
      '世爻位置及六亲（代表问卦人状态）',
      '应爻位置及六亲（代表所问之事/对方）',
      '世应五行生克关系',
      '世应是否相冲或相合',
      '世爻旺衰对整体卦象的影响',
    ],
    dataPaths: ['shiYing', 'wangShuai'],
  },
  {
    id: 'yongshen',
    title: '三、用神判断',
    order: 3,
    description: '根据所问事项类型，判断用神状态',
    keyPoints: [
      '用神是什么（妻财/官鬼/父母/子孙/兄弟）',
      '用神在当前卦中是否出现',
      '用神的旺衰状态',
      '用神是否持世/应',
      '用神是否发动',
      '如用神不现，是否有伏神',
    ],
    dataPaths: ['yongShen', 'fuShen', 'wangShuai'],
  },
  {
    id: 'dongyao',
    title: '四、动爻解析',
    order: 4,
    description: '分析每一个动爻的变化及其对卦象的影响',
    keyPoints: [
      '每个动爻的原爻和变爻',
      '动爻的变化方向（化进/化退/化生/化克）',
      '动爻对用神的影响',
      '动爻对世爻的影响',
      '多爻动时的主次判断',
    ],
    dataPaths: ['dongYao', 'yongShen', 'shiYing'],
  },
  {
    id: 'wangshuai',
    title: '五、旺衰分析',
    order: 5,
    description: '逐爻分析旺衰状态及月建日辰影响',
    keyPoints: [
      '各爻旺衰等级（旺/相/休/囚/死）',
      '月建对各爻的生克',
      '日辰对各爻的生克',
      '动爻之间的生克关系',
      '旬空爻位的特殊影响',
    ],
    dataPaths: ['wangShuai', 'dongYao', 'xunKong'],
  },
  {
    id: 'trend',
    title: '六、趋势判断',
    order: 6,
    description: '综合以上分析，给出所问事项的趋势判断',
    keyPoints: [
      '整体吉凶判断',
      '有利因素总结',
      '不利因素总结',
      '关键时间节点（应期）',
      '变卦揭示的发展方向',
    ],
    dataPaths: ['benGua', 'bianGua', 'shiYing', 'yongShen', 'dongYao', 'wangShuai', 'relations'],
  },
  {
    id: 'advice',
    title: '七、行动建议',
    order: 7,
    description: '基于卦象分析，给出具体可操作的建议',
    keyPoints: [
      '当前阶段应采取的策略',
      '需要注意的禁忌事项',
      '适合行动的时机',
      '需要借助的外部力量（六亲对应）',
    ],
    dataPaths: ['yongShen', 'shiYing', 'dongYao', 'wangShuai'],
  },
];

export function getSectionsByDataPath(path: string): SectionId[] {
  return REPORT_SECTIONS
    .filter(s => s.dataPaths.includes(path))
    .map(s => s.id);
}

export function getSectionById(id: SectionId): ReportSection | undefined {
  return REPORT_SECTIONS.find(s => s.id === id);
}