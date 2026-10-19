// 八字场景矩阵（#40）：把同一张盘按 11 个关系/处境场景各读一遍。
//
// 这一层只做两件事 —— ① 声明每个场景取哪几颗星、看哪一宫（引公版原文或明写本站约定），
// ② 回到盘里报事实：那颗星在不在、落在哪一柱（天干还是藏干）、那一宫被谁冲合刑害、
// 哪几步大运正走到它。**不出分、不断语、不预测。**
//
// 三条来自裁定的硬约束，由 tools/scenario-acceptance 钉住：
// - 引文必须是 docs/classics/ 里那份入仓原文的连续子串，差一字即红；
// - 输出对象不得有顶层数值字段（岁运年份是日历事实，一律嵌在字符串里）；
// - 性质只有三档：有出处 / 体系定义 / 本站约定，且约定行必须自带「本站约定，非古籍原目」。
//
// 断语（「父母不全」「妻妾不完」「子息凶頑」「妻妾不賢」之属）在原典里紧挨着宫分句，
// 本模块一律不取 —— 那是别人的吉凶判断，我们只借用它里面"哪一柱管哪一伦"这一层结构。

import type { BaziChart, ShiShen } from '@/app/lib/core/yiqi-core/types';
import { enrichBazi } from '@/app/lib/core/bazi-enrich/enrich';
import type { BaziEnrichment } from '@/app/lib/core/bazi-enrich/enrich';

export const SCENARIO_SOURCE_KINDS = ['有出处', '体系定义', '本站约定'] as const;
export type ScenarioSource = typeof SCENARIO_SOURCE_KINDS[number];

/** 约定行必须带的这句 —— 写在一处，四行共用，漏了会被断言抓住。 */
export const CONVENTION_NOTE = '本站约定，非古籍原目';

/** 宫分：哪一柱管哪一伦。两本原文的次序与用词不同，映射一致，故可直取。
 *  注意：这两句在原典里本身就是吉凶断语（父母不全／子息凶頑…）。裁定第 9 条要求断语不入页面，
 *  所以它们**只作为出处凭据留在代码与 docs 里**，页面讲的是下面 PALACE_MAP 这句自己的话，
 *  并把「逐字原文见哪份文件」指出来。scenario-acceptance 双向钉：这两句必须是底本子串，
 *  而任何渲染字段里都不许出现它们。 */
export const PALACE_SOURCE = {
  渊海子平: '年带伤官，父母不全；月带伤官，兄弟不完；日带伤官，妻妾不完；时带伤官，子息无传。',
  三命通会: '秘訣云傷官太重子必有虧又云年帶傷官父母不全月帶傷官兄弟不完時帶傷官子息凶頑日帶傷官妻妾不賢',
  文件: ['docs/classics/yuanhai-ziping-lun-shangguan.md', 'docs/classics/sanming-tonghui-juan5-yin-mijue.md'],
};

/** 本站自己的话 —— 页面上出现的就这一句，不含判词。 */
export const PALACE_MAP = '宫分：年柱管父母、月柱管兄弟、日柱管配偶、时柱管子女。';

const PILLARS = [
  { key: 'year', 名: '年柱' },
  { key: 'month', 名: '月柱' },
  { key: 'day',   名: '日柱' },
  { key: 'hour',  名: '时柱' },
] as const;
type PillarKey = typeof PILLARS[number]['key'];

const CZ = (v: readonly string[]) => v as unknown as ShiShen[];
/** 财 = 正财＋偏财；印 = 正印＋偏印；官星只取正官（原注说的是"官星"，七杀另列，不并派）。 */
const STARS = {
  财: CZ(['正财', '偏财']),
  印: CZ(['正印', '偏印']),
  比劫: CZ(['比肩', '劫财']),
  官星: CZ(['正官']),
  官杀: CZ(['正官', '七杀']),
  食伤: CZ(['食神', '伤官']),
};

export interface StarHit {
  /** 星名（十神）。 */
  星: string;
  /** 落在哪一柱、是天干还是该柱地支的藏干。 */
  位置: string;
  /** 该位置的干支。 */
  干支: string;
}

export interface ScenarioRow {
  场景: string;
  取用星: string[];
  宫位: string;
  性质: ScenarioSource;
  /** 人读的一句话依据。 */
  依据: string;
  /** 逐字引文（只放无判词的映射子句；有出处时非空）。 */
  引文: string[];
  /** 出处指针：哪份入仓底本承载这行的依据（页面显示路径，不显示判词原文）。 */
  出处: string[];
  /** 盘内命中：每条形如「正财·年柱天干·甲辰」。 */
  命中: string[];
  /** 盘内不见的星 —— 明说，不推断。 */
  不见: string[];
  /** 那一宫被哪些干支关系牵动。 */
  宫位关系: string[];
  /** 哪些大运正走到取用星（年份是日历事实，写成字符串）。 */
  岁运: string[];
  /** 两说并存时，各说一条；单说时为空。 */
  并存: { 说法: string; 取用: string[]; 引文: string }[];
}

function hitsFor(chart: BaziChart, stars: ShiShen[]): { 命中: string[]; 不见: string[] } {
  const 命中: string[] = [];
  const want = new Set<string>(stars);
  for (const p of PILLARS) {
    const ss = chart.shiShen?.[p.key as keyof typeof chart.shiShen];
    if (ss && want.has(ss)) {
      命中.push(`${ss}·${p.名}天干·${chart.siZhu[p.key].gan}${chart.siZhu[p.key].zhi}`);
    }
    // 藏干的十神在引擎里实际叫 shiShen（yiqi-core/bazi.ts:74 getZhiCangGanFull 就是这么产出的），
    // 而 types.ts:136 那份声明写的是 tenGod?: string —— 声明是错的。按真实字段读，
    // 读错一个键就是整层藏干命中静默归零，盘面看着只是"这盘没这颗星"。types.ts 属算法层，不动它。
    for (const c of chart.cangGan?.[p.key as keyof typeof chart.cangGan] ?? []) {
      const god = (c as { shiShen?: string; tenGod?: string }).shiShen ?? (c as { tenGod?: string }).tenGod;
      if (god && want.has(god)) 命中.push(`${god}·${p.名}藏干·${c.gan}（支 ${chart.siZhu[p.key].zhi}）`);
    }
  }
  const seen = new Set(命中.map(h => h.split('·')[0]));
  const 不见 = stars.filter(s => !seen.has(s));
  return { 命中, 不见 };
}

function palaceRelations(enrich: BaziEnrichment | undefined, palace: string): string[] {
  if (!enrich) return [];
  const out: string[] = [];
  for (const r of enrich.地支关系 ?? []) {
    if ((r.pillars as string[]).includes(palace)) out.push(`地支${r.type}：${r.pillars.join('／')}（${r.zhi.join('')}）`);
  }
  for (const r of enrich.天干关系 ?? []) {
    if ((r.pillars as string[]).includes(palace)) out.push(`天干${r.type}：${r.pillars.join('／')}（${r.gans.join('')}）`);
  }
  return out;
}

function luckFor(chart: BaziChart, stars: ShiShen[]): string[] {
  const want = new Set<string>(stars);
  const out: string[] = [];
  for (const d of chart.dayun ?? []) {
    const hit = [d.ganShiShen, d.zhiShiShen].filter(x => x && want.has(x));
    if (hit.length) {
      out.push(`${d.ganZhi.gan}${d.ganZhi.zhi} 运（${d.startYear}–${d.endYear}，虚岁 ${d.startAge} 起）天干见${d.ganShiShen}、地支主气见${d.zhiShiShen}`);
    }
  }
  return out;
}

/** 盘面关系事实。enrichment 目前只有服务端算（chart.service），走 sessionStorage 预览那条路时
 *  它是空的 —— 这里用同一个 enrichBazi 现算一次，而不是复制一份关系表。四柱不全就返回空，
 *  那一栏会写「该宫未见干支关系」，不会假装算过。 */
export function palaceFacts(chart: BaziChart): BaziEnrichment | undefined {
  const s = chart?.siZhu;
  if (!s?.year || !s?.month || !s?.day || !s?.hour) return undefined;
  try {
    return enrichBazi({ 年: s.year, 月: s.month, 日: s.day, 时: s.hour } as never);
  } catch {
    return undefined;
  }
}

const DTS = 'docs/classics/ditian-sui-liu-qin-lun.md';

export function buildScenarios(chart: BaziChart, enrich?: BaziEnrichment): ScenarioRow[] {
  const facts = enrich ?? palaceFacts(chart);
  const male = chart.birthInfo?.gender === 'male';
  const row = (
    场景: string, 取用: ShiShen[], 宫位: string, 宫名: string, 性质: ScenarioSource,
    依据: string, 引文: string[] = [], 出处: string[] = [], 并存: ScenarioRow['并存'] = [],
  ): ScenarioRow => {
    const { 命中, 不见 } = hitsFor(chart, 取用);
    return {
      场景, 取用星: 取用, 宫位, 性质, 依据, 引文,
      出处: 性质 === '有出处' ? [...出处, ...PALACE_SOURCE.文件] : 出处,
      命中, 不见, 并存,
      宫位关系: palaceRelations(facts, 宫名),
      岁运: luckFor(chart, 取用),
    };
  };
  const 并存子女: ScenarioRow['并存'] = [
    { 说法: '一说取官星（《滴天髓》六親論子女段）', 取用: STARS.官星, 引文: '大率依官星看子' },
    { 说法: '一说取食神（同章女命段）', 取用: CZ(['食神']), 引文: '局中食神清顯' },
  ];

  return [
    row('自己', [], '日柱', '日', '体系定义',
      '日主即自身，日柱即已身所居之宫；不取星、不论吉凶。喜神用神体系本站尚未裁决，故此处不引。'),

    row('日常', [], '月柱（提纲）', '月', '本站约定',
      `${CONVENTION_NOTE}：古籍无「日常」一目。本站只把日主与月令（提纲）这两件既成事实并列，加当下所在大运，不取星、不推断。`),

    row('父母', [...STARS.财, ...STARS.印], '年柱、月柱', '年', '有出处',
      '父取财、母取印，宫看岁月。' + PALACE_MAP,
      ['子平之法，以財為父，以印為母，然看歲月為緊要'], [DTS]),

    row('兄弟姐妹与朋友', STARS.比劫, '月柱', '月', '有出处',
      '比肩、劫财为同辈，轻重与提纲相较。' + PALACE_MAP,
      ['劫財，比肩，陽刃，皆兄弟'], [DTS]),

    male
      ? row('恋爱', STARS.财, '日支', '日', '本站约定',
        `${CONVENTION_NOTE}：古籍只有"配偶"一层，无"恋爱"阶段。本站与婚姻行同取财星、同看日支，只报星与宫，不推断感情过程。`)
      : row('恋爱', STARS.官星, '日支', '日', '本站约定',
        `${CONVENTION_NOTE}：古籍只有"配偶"一层，无"恋爱"阶段。本站与婚姻行同取官星、同看日支，只报星与宫，不推断感情过程。`),

    male
      ? row('婚姻', STARS.财, '日支（妻宫）', '日', '有出处',
        '男命大率依财看妻，宫在日支。' + PALACE_MAP, ['大率依財看妻'], [DTS])
      : row('婚姻', STARS.官星, '日支（夫妻宫）', '日', '有出处',
        '女命以官星为夫，宫在日支。七杀不并入本次取用（原注说的是"官星"）。' + PALACE_MAP,
        ['局中官星明順'], [DTS]),

    row('子女', [...STARS.官星, ...STARS.食伤], '时柱', '时', '有出处',
      '两说并存，本站不裁决、也不按性别分派：一说取官星，一说取食神。原注同段还给了若干"活法"（官轻身旺须助官、伤官太旺以印为子…），那是变通说法，本站不把它当规则用。' + PALACE_MAP,
      ['大率依官星看子', '局中食神清顯'], [DTS], 并存子女),

    row('亲子（我为人子女）', [...STARS.财, ...STARS.印], '年柱、月柱', '年', '有出处',
      '与父母行同取同宫，只是视角反过来：这一行看的是"我作为子女"所对应的星与宫。' + PALACE_MAP,
      ['子平之法，以財為父，以印為母，然看歲月為緊要'], [DTS]),

    row('亲子（我为人父母）', [...STARS.官星, ...STARS.食伤], '时柱', '时', '有出处',
      '与子女行同取同宫，视角反过来；两说并存同样不裁决。' + PALACE_MAP,
      ['大率依官星看子', '局中食神清顯'], [DTS], 并存子女),

    row('共事合作', [...STARS.比劫, ...STARS.财], '月柱、日柱', '月', '本站约定',
      `${CONVENTION_NOTE}：原典只论兄弟，不论合伙。本站按同类相推 —— 同辈合作取比劫，所营之事取财，宫仍看月与日。`),

    row('上下级', STARS.官杀, '月柱', '月', '本站约定',
      `${CONVENTION_NOTE}：官杀是十神定义里"与我不同类而克制我"的一族，"上级／权责"是今义引申，原典无此目。本站只报官杀在盘中的落点与宫位关系。`),
  ];
}

/** 场景矩阵的口径戳：改了取用表就要升它，验收按它比对。 */
export const SCENARIO_BASIS = 'liuqin-scenario-v1';
