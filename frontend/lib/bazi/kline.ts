// 人生K线（#41，A 案：类别轴）。
//
// 这层只做一件事 —— 把盘里已经算出来的岁运事实按「十神 × 年份」摆成泳道：
// x 是年份与虚岁，y 是十天干十神的固定十条道，格子里写的就是那一年引动了哪一颗。
// **没有 y 轴的数值方向：不排高低、不计轻重、不给吉凶，也就画不出「曲线」。**
// 裁定原文：不做吉凶方向、不出分；每点回指盘内事实；将来若要数值曲线，单独立项并标
// 「自研评分·非还原」。
//
// 三条来自裁定的硬约束，由 tools/kline-acceptance 钉住：
// - 输出对象任何一层都不得有顶层数值字段（年份与虚岁是日历事实，一律嵌在字符串里）；
// - 十神的取值不自建：流年天干用 bazi-enrich/tables.ts:54，地支藏干用 yiqi-core/bazi.ts:74，
//   大运两级直接用盘面已发的 ganShiShen/zhiShiShen —— 本模块不写第三张十神表；
// - 事件标注只能来自用户输入；没有输入就是「无事件」，不预置、不推测。
//
// 落点（流年支、大运支与命局四柱支的成对关系）走 bazi-enrich/zhi-relations.ts 新导出的
// zhiPairRelations —— 那张表原来全是 module-private，detectZhiRelations 只遍历命局自身四柱
// 的六对，结构上表达不出"流年 vs 日柱"（ZhiRelation.pillars 只能装 年/月/日/时）。
// 2026-10-19 裁定就地开一个成对入口、让现有 detectZhiRelations 改调它，因此本模块既不抄表、
// 也不新建第二套关系逻辑；改前那一次全枚举 12^4=20736 组四柱的输出摘要已钉成
// tools/zhi-relations/zhi-relations-golden.json，导出的 digest 与改前逐字节相同。
// 成对入口只报成对成立的关系（六冲/六合/六害/相刑/自刑/暗合）；三合三会拱合拱会是三支族，
// 一支对一支报出去就是假的三合，所以不在这里报。相破本站不存在，也不往页面上写。

import type { BaziChart, DayunDetail, ShiShen } from '@/app/lib/core/yiqi-core/types';
import { getZhiCangGanFull } from '@/app/lib/core/yiqi-core/bazi';
import { getShiShen } from '@/app/lib/core/bazi-enrich/tables';
import { zhiPairRelations } from '@/app/lib/core/bazi-enrich/zhi-relations';
import type { Tiangan } from '@/app/lib/core/bazi-enrich/tables';
import type { Dizhi } from '@/app/lib/core/bazi-enrich/tables';

export const KLINE_BASIS = 'kline-category-v1';

/** 泳道固定十条，顺序即比劫→食伤→财→官杀→印的成对序；不排序、不加权。 */
export const KLINE_LANES: ShiShen[] = ['比肩', '劫财', '食神', '伤官', '偏财', '正财',
  '七杀', '正官', '偏印', '正印'];

/** 同族的五组名，只用于图例分组，不表示任何轻重。 */
export const KLINE_GROUPS: Record<ShiShen, '比劫' | '食伤' | '财' | '官杀' | '印'> = {
  比肩: '比劫', 劫财: '比劫', 食神: '食伤', 伤官: '食伤', 偏财: '财', 正财: '财',
  七杀: '官杀', 正官: '官杀', 偏印: '印', 正印: '印',
};

export const KLINE_NO_SCORE = '不构成吉凶评分';
export const KLINE_LICHUN_NOTE = '流年干支按立春换年：公历 1 月 1 日至立春之间，盘面干支仍属上一年。';
export const KLINE_RELATION_NOTE = '落点取的是流年支（以及大运支）与命局四柱支的成对关系，'
  + '查的是本站已有那张关系表（bazi-enrich/zhi-relations.ts 导出的成对函数），不另立一套、不改权重。';
export const KLINE_RELATION_MISSING = '这份数据里没有完整四柱，落点无从配对，因此只报十神引动。';

/** 四柱支的轴名，用于落点回指到"哪一柱"。 */
const PILLAR_LABEL: Record<'year' | 'month' | 'day' | 'hour', string> = {
  year: '年柱', month: '月柱', day: '日柱', hour: '时柱',
};
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;

export interface KlineMark {
  年纪: string;      // 公历「1996」
  岁纪: string;      // 虚岁「九」由引擎给的数，写成字符串
  干支: string;      // 「丙子」
  干十神: string;    // 流年天干对日主的十神
  支藏十神: string[];// 流年地支藏干（本气/中气/余气）各自的十神
  落点: string[];    // 「流年支 丑 × 日柱 未 → 六冲」这样的一条条成对关系
}

export interface KlineLane {
  十神: string;
  分组: string;
  标注: string[];    // 「1996·丙子·流年干」这样的串，一格里出现几次就列几条
}

export interface KlineSegment {
  段序: string;        // 「第 1 步大运」
  干支: string;
  区间: string;        // 「1996–2005」
  起岁: string;        // 「虚岁 9」
  运干十神: string;    // 盘面已发
  运支主气十神: string;// 盘面已发
  落点: string[];      // 大运支与四柱支的成对关系（整段共同，不逐年重复）
  流年: KlineMark[];
  泳道: KlineLane[];
}

export interface KlineView {
  日主: string;
  口径戳: string;
  边界: string[];
  段: KlineSegment[];
}

const CANGGAN_ROLES = ['本气', '中气', '余气'];

/**
 * 落点：一支（流年的、或大运的）与命局四柱各支的成对关系。
 * 逐柱各报一条，谁跟谁、什么关系，全写在串里 —— 不汇总、不数条数、不排强弱，
 * 因为"这一年被几柱冲"一旦成为数字，它就又是评分了。
 */
function landingOf(zhi: string, siZhu: BaziChart['siZhu'] | undefined, 主体: string): string[] {
  if (!siZhu) return [];
  const out: string[] = [];
  for (const k of PILLAR_KEYS) {
    const other = siZhu[k]?.zhi;
    if (!other) continue;
    for (const r of zhiPairRelations(zhi as Dizhi, other as Dizhi)) {
      out.push(`${主体} ${zhi} × ${PILLAR_LABEL[k]} ${other} → ${r.type}${r.detail ? '·' + r.detail : ''}`);
    }
  }
  return out;
}

function yearMarks(d: DayunDetail, dayMaster: string, siZhu: BaziChart['siZhu'] | undefined): KlineMark[] {
  return (d.liuNian || []).map(ln => {
    const gan = ln.ganZhi.gan, zhi = ln.ganZhi.zhi;
    // 藏干十神取自引擎自己那份 getZhiCangGanFull —— 与四柱藏干同一张表、同一个日主。
    const cang = getZhiCangGanFull(zhi, dayMaster) || [];
    return {
      年纪: String(ln.year),
      岁纪: `虚岁 ${ln.age}`,
      干支: `${gan}${zhi}`,
      // tables.ts 的入参是 Tiangan 字面量联合，盘面里本来就是同一套天干（types.ts:118
      // dayMaster: Tiangan），这里只做类型层的收口，不含任何换算或兜底。
      干十神: getShiShen(dayMaster as Tiangan, gan as Tiangan),
      支藏十神: cang.map(c => c.shiShen),
      落点: landingOf(zhi, siZhu, '流年支'),
    };
  });
}

function lanesFor(marks: KlineMark[]): KlineLane[] {
  return KLINE_LANES.map(lane => {
    const 标注: string[] = [];
    for (const m of marks) {
      if (m.干十神 === lane) 标注.push(`${m.年纪}·${m.干支}·流年干`);
      // 藏干按本气/中气/余气的位次标来源，读者才知道那是支里的哪一层，不是一句"支见某神"。
      m.支藏十神.forEach((g, i) => {
        if (g === lane) 标注.push(`${m.年纪}·${m.干支}·流年支${CANGGAN_ROLES[i] || '余气'}`);
      });
    }
    return { 十神: lane, 分组: KLINE_GROUPS[lane], 标注 };
  });
}

/** 盘里没有完整岁运数据时返回 null —— 由调用方走降级说明，不补一张假盘。 */
export function buildKline(chart: BaziChart | undefined | null): KlineView | null {
  const dayMaster = chart?.dayMaster;
  const dayun = chart?.dayun;
  if (!dayMaster || !Array.isArray(dayun) || dayun.length === 0) return null;
  const siZhu = chart?.siZhu && PILLAR_KEYS.every(k => chart.siZhu?.[k]?.zhi) ? chart.siZhu : undefined;
  const 段 = dayun.map((d, i) => {
    const marks = yearMarks(d, dayMaster, siZhu);
    return {
      段序: `第 ${i + 1} 步大运`,
      干支: `${d.ganZhi.gan}${d.ganZhi.zhi}`,
      区间: `${d.startYear}–${d.endYear}`,
      起岁: `虚岁 ${d.startAge}`,
      运干十神: d.ganShiShen,
      运支主气十神: d.zhiShiShen,
      落点: landingOf(d.ganZhi.zhi, siZhu, '运支'),
      流年: marks,
      泳道: lanesFor(marks),
    };
  });
  return {
    日主: dayMaster,
    口径戳: KLINE_BASIS,
    边界: [KLINE_NO_SCORE, KLINE_LICHUN_NOTE, KLINE_RELATION_NOTE].concat(siZhu ? [] : [KLINE_RELATION_MISSING]),
    段,
  };
}

/** 用户自填的年份标注。来源只有这一条路：输入。没有输入就写「无事件」。 */
export function eventLabel(ev: { 年纪: string; 标注: string } | undefined): string {
  return ev && ev.标注.trim() ? `${ev.年纪}：${ev.标注.trim()}` : '无事件（未由你标注）';
}
