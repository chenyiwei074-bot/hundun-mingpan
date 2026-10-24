// 合盘规则层：把两张盘读得到的事实并排，逐条给观察 + 依据 + 不确定项。
//
// 这一层刻意只做"读"和"对照"，不做任何裁决：
//  - 不打分、不给匹配度、不说合适不合适（裁定：不出合盘评分）；
//  - 不引古籍：docs/classics 里没有一条合婚原文，原典之外不发明，整节标「自研 · 非还原」；
//  - 不写日志、不发请求：全部计算在调用方本机完成，对方生辰不进任何持久层。
//
// 关系表一律复用算法层已有的实现（ganPair / zhiPairRelations / getShiShen / shengKe），
// 不在这里另抄一份五合六合表 —— 同一件事两处实现是这个仓库反复出错的根源
// （getShiShen 现在就有三份，只是三份实测 100 对完全一致才敢用）。

import type { ChartResult, Dizhi, GanZhi, Tiangan } from '@/app/lib/core/yiqi-core/types';
import { ganPair } from '@/app/lib/core/bazi-enrich/gan-relations';
import { zhiPairRelations } from '@/app/lib/core/bazi-enrich/zhi-relations';
import type { PairRelationType } from '@/app/lib/core/bazi-enrich/zhi-relations';
import { GAN_WUXING, ZHI_WUXING, getShiShen, shengKe } from '@/app/lib/core/bazi-enrich/tables';
import type { WuXing } from '@/app/lib/core/bazi-enrich/tables';
import { getNaYinWuXing } from '@/app/lib/core/yiqi-core/nayin';
import { HEPAN_BASIS } from './types';
import type { HepanItem, HepanPartyMeta, HepanReport } from './types';

export interface HepanParty {
  chart: ChartResult;
  meta: HepanPartyMeta;
  /**
   * 五行统计要调用方现算传进来，不能从 chart 里读：服务端 chart.service.ts:91 才把
   * enrichment 挂到 bazi 上，而对方那张盘是本机 createChart 现排的，根本没有这个字段。
   * 真去读 bazi.enrichment 的后果是这一条永远静默不出 —— 类型上也不存在，tsc 会拦。
   */
  五行统计?: Record<string, number>;
}

export interface HepanInput {
  我: HepanParty;
  对方: HepanParty;
}

/** 引擎里四柱与十神的键是英文（SiZhu / shiShen 都是 year|month|day|hour），
 *  中文只用于上屏。想当然按"年月日时"索引的后果是整层读成 undefined，
 *  而且不报错 —— #40 把藏干从 29 条读成 6 条就是同一类错。 */
const PILLARS = ['year', 'month', 'day', 'hour'] as const;
type PillarKey = typeof PILLARS[number];
const 柱名: Record<PillarKey, string> = { year: '年', month: '月', day: '日', hour: '时' };

const sz = (c: ChartResult) => c.bazi?.siZhu;

/** 某柱十神落在哪几柱 —— "以我为本回指盘内事实"的落点查询。 */
function myPillarsWithShiShen(mine: ChartResult, target: string): string[] {
  const s = mine.bazi?.shiShen;
  if (!s) return [];
  return PILLARS.filter(p => s[p] === target).map(p => 柱名[p]);
}

function relationPhrase(types: PairRelationType[]): string {
  return types.length ? types.join('、') : '无（这一对地支不构成六合/六冲/六害/相刑/暗合中任何一项）';
}

/** 纳音五行。表里没有的（或 getNaYinWuXing 走默认分支的）一律不当成数据用。 */
function nayinWuxing(name?: string): WuXing | null {
  if (!name || typeof name !== 'string') return null;
  const known = ['金', '木', '水', '火', '土'].some(w => name.includes(w));
  return known ? getNaYinWuXing(name as never) : null;
}

/** 按宫位名找宫。
 *  两种写法都要认：types.ts 的 ZiweiGong 声明成 '夫妻宫''命宫'…（除命宫外都带"宫"），
 *  而 ziwei-standard.ts:22 的 GONG_NAMES 实际产出 '夫妻''兄弟'…（除命宫外都不带）。
 *  声明与产出不一致是算法层的事，本批不动它；但合盘这一侧只按声明找宫的话，
 *  后果是"我盘夫妻宫"永远找不到、永远静默走「没做的部分」—— 这个错我在写套件前就犯了。 */
function findGong<T extends { gong: string }>(gongs: T[] | undefined, 名: string): T | undefined {
  if (!gongs) return undefined;
  return gongs.find(g => g.gong === 名 || g.gong === `${名}宫`);
}

export function analyzeHepan(input: HepanInput): HepanReport {
  const { 我, 对方 } = input;
  const a = sz(我.chart), b = sz(对方.chart);
  const 项目: HepanItem[] = [];
  const 未出: string[] = [];

  const 摘要 = [
    `我：${我.meta.称呼 || '本人'}（${我.meta.性别}）· ${a ? PILLARS.map(p => `${a[p].gan}${a[p].zhi}`).join(' ') : '四柱不齐'}`
      + ` · 原始输入 ${我.meta.原始输入}`,
    `对方：${对方.meta.称呼 || '未命名'}（${对方.meta.性别}）· ${b ? PILLARS.map(p => `${b[p].gan}${b[p].zhi}`).join(' ') : '四柱不齐'}`
      + ` · 原始输入 ${对方.meta.原始输入}`,
    `我的日主：${a?.day.gan ?? '?'}（${a ? GAN_WUXING[a.day.gan] : '?'}）· 对方日主：${b?.day.gan ?? '?'}（${b ? GAN_WUXING[b.day.gan] : '?'}）`,
    '口径：两张盘各自独立排盘后并排对照，关系表复用八字内核同一份实现。',
  ];

  if (!a || !b) {
    return {
      输入摘要: 摘要, 项目: [],
      未出: ['有一方的四柱没排全，没有任何一条对照可推 —— 缺输入就空着，不猜。'],
      口径戳: HEPAN_BASIS,
    };
  }

  // 1. 日主相待：两个日干之间存不存在五合/相克/相生/相同
  const 日干关系 = ganPair(a.day.gan as Tiangan, b.day.gan as Tiangan);
  项目.push({
    立项: '日主相待',
    观察: `我日主 ${a.day.gan}、对方日主 ${b.day.gan}，两者之间是「${日干关系 ?? '无（既不合也不生克）'}」。`,
    依据: [`我日柱 ${a.day.gan}${a.day.zhi}`, `对方日柱 ${b.day.gan}${b.day.zhi}`,
      `五行：${GAN_WUXING[a.day.gan]} / ${GAN_WUXING[b.day.gan]}`],
    不确定项: ['天干合能不能化成某一五行，要看月令与整盘配置，两盘分开排算不出"化与不化"。'],
  });

  // 2. 对方日主对我是什么十神，并回指我盘里这个十神落在哪几柱
  const 对我是 = getShiShen(a.day.gan as Tiangan, b.day.gan as Tiangan);
  const 落点 = myPillarsWithShiShen(我.chart, 对我是);
  项目.push({
    立项: '对方日主在我盘里的位置',
    观察: `以我的日主 ${a.day.gan} 论，对方日主 ${b.day.gan} 是「${对我是}」。`
      + `我盘里${落点.length ? `${落点.join('、')}柱的天干也是这个十神` : '没有哪一柱天干是这个十神'}。`,
    依据: [`getShiShen(日主=${a.day.gan}, 目标=${b.day.gan}) = ${对我是}`,
      `我盘 shiShen：年${我.chart.bazi.shiShen?.year} 月${我.chart.bazi.shiShen?.month} 日${我.chart.bazi.shiShen?.day} 时${我.chart.bazi.shiShen?.hour}`],
    不确定项: [
      '这只说明"对方日主对我是哪种十神关系"，不说明这段关系好不好；本站不往这一步推。',
      落点.length ? '' : '我盘里没有同十神可回指，可能是这一柱本来就没有，也可能是藏干里有而未上屏。',
    ].filter(Boolean),
  });

  // 3. 年支关系
  const 年支 = zhiPairRelations(a.year.zhi as Dizhi, b.year.zhi as Dizhi);
  项目.push({
    立项: '年支对照',
    观察: `我年支 ${a.year.zhi}、对方年支 ${b.year.zhi}：${relationPhrase(年支.map(r => r.type))}。`,
    依据: [`我年柱 ${a.year.gan}${a.year.zhi}`, `对方年柱 ${b.year.gan}${b.year.zhi}`,
      `五行：${ZHI_WUXING[a.year.zhi]} / ${ZHI_WUXING[b.year.zhi]}`],
    不确定项: ['只看年支这一支。两人盘上还有七支，之间的关系这里一条都没算。'],
  });

  // 4. 日支关系
  const 日支 = zhiPairRelations(a.day.zhi as Dizhi, b.day.zhi as Dizhi);
  项目.push({
    立项: '日支对照',
    观察: `我日支 ${a.day.zhi}、对方日支 ${b.day.zhi}：${relationPhrase(日支.map(r => r.type))}。`,
    依据: [`我日柱 ${a.day.gan}${a.day.zhi}`, `对方日柱 ${b.day.gan}${b.day.zhi}`],
    不确定项: ['日支坐支在各自盘里的角色（是财是官是印）取决于各自日主，两盘之间不做这层换算。'],
  });

  // 5. 年命纳音
  const 我纳音 = 我.chart.bazi.naYin?.year, 对方纳音 = 对方.chart.bazi.naYin?.year;
  const 我纳音五行 = nayinWuxing(我纳音), 对方纳音五行 = nayinWuxing(对方纳音);
  if (我纳音五行 && 对方纳音五行) {
    // shengKe 在 WuXing 上是全函数（同为一种五行时返回「同」），这里不需要为 null 兜底。
    const rel = shengKe(我纳音五行, 对方纳音五行);
    项目.push({
      立项: '年命纳音',
      观察: `我年命纳音「${我纳音}」属${我纳音五行}，对方「${对方纳音}」属${对方纳音五行}，两者是「${rel}」。`,
      依据: [`我 naYin.year = ${我纳音}`, `对方 naYin.year = ${对方纳音}`],
      不确定项: ['纳音五行是从纳音名里的字面五行读出来的（表里没有的会被跳过），不是另行推算。'],
    });
  } else {
    未出.push('年命纳音没出：至少一方盘上没有 naYin.year 这个字段，缺就不补。');
  }

  // 6. 紫微夫妻宫与对方命宫的主星对照
  const 我夫妻宫 = findGong(我.chart.ziwei?.gongs, '夫妻');
  const 对方命宫 = findGong(对方.chart.ziwei?.gongs, '命宫');
  if (我夫妻宫 && 对方命宫) {
    const 我星 = [...(我夫妻宫.mainStars || [])];
    const 对星 = [...(对方命宫.mainStars || [])];
    const 同星 = 我星.filter(x => 对星.includes(x));
    项目.push({
      立项: '我盘夫妻宫 × 对方命宫',
      观察: `我盘夫妻宫坐${我夫妻宫.dizhi}${我夫妻宫.tiangan ? `（${我夫妻宫.tiangan}）` : ''}，主星 ${我星.join('、') || '无'}；`
        + `对方命宫坐${对方命宫.dizhi}，主星 ${对星.join('、') || '无'}。${同星.length ? `两边同见 ${同星.join('、')}。` : '两边主星无同星。'}`
        + `${(我夫妻宫.sihua || []).length ? `我夫妻宫带的四化：${我夫妻宫.sihua.join('、')}。` : ''}`,
      依据: [`我 ziwei 夫妻宫（${我夫妻宫.dizhi}${我夫妻宫.tiangan}）mainStars = ${我星.join('、') || '无'}`,
        `对方 ziwei 命宫（${对方命宫.dizhi}${对方命宫.tiangan}）mainStars = ${对星.join('、') || '无'}`],
      不确定项: ['两盘主星是否同星只是集合比对，不构成"配不配"的判断。',
        '对方星曜落不落入我夫妻宫，需要把两张盘叠在同一套宫位上重排，本站没做这个换算（也不宣称能做）。'],
    });
  } else {
    未出.push('紫微宫位对照没出：至少一方盘上取不到夫妻宫或命宫。');
  }

  // 7. 五行数量并排（只报数，不判互补）
  const 我五行 = 我.五行统计, 对方五行 = 对方.五行统计;
  if (我五行 && 对方五行) {
    const keys = ['木', '火', '土', '金', '水'] as const;
    const fmt = (o: Record<string, number>) => keys.map(k => `${k}${Number(o[k] ?? 0)}`).join(' ');
    const 我缺 = keys.filter(k => Number(我五行[k] ?? 0) === 0);
    const 对方有 = 我缺.filter(k => Number(对方五行[k] ?? 0) > 0);
    项目.push({
      立项: '五行数量并排',
      观察: `我盘 ${fmt(我五行)}；对方盘 ${fmt(对方五行)}。`
        + `${我缺.length ? `我盘计数为 0 的是 ${我缺.join('、')}${对方有.length ? `，其中 ${对方有.join('、')} 在对方盘里有` : '，对方盘里同样为 0'}。` : '我盘五行都有。'}`,
      依据: ['本机 enrichBazi(我四柱).五行统计', '本机 enrichBazi(对方四柱).五行统计'],
      不确定项: ['统计口径是本机八字引擎的那一份，两人同一口径才可比。',
        '「我缺所以需要你补」是另一套说法，本站不做：这里只报两个计数。'],
    });
  } else {
    未出.push('五行数量没出：至少一方没算出五行统计（本机引擎没跑成）。');
  }

  // 8. 当前大运并排
  const 我运 = 当前大运(我.chart), 对方运 = 当前大运(对方.chart);
  if (我运 && 对方运) {
    项目.push({
      立项: '当前大运并排',
      观察: `我现行大运 ${我运.ganZhi}（${我运.startYear}–${我运.endYear ?? '?'} 年，${我运.startAge} 岁起）；`
        + `对方现行大运 ${对方运.ganZhi}（${对方运.startYear}–${对方运.endYear ?? '?'} 年，${对方运.startAge} 岁起）。`
        + `两人天干「${ganPair(我运.ganZhi[0] as Tiangan, 对方运.ganZhi[0] as Tiangan) ?? '无'}」、`
        + `地支「${relationPhrase(zhiPairRelations(我运.ganZhi[1] as Dizhi, 对方运.ganZhi[1] as Dizhi).map(r => r.type))}」。`,
      依据: [`我 dayun 命中 ${我运.startYear} 年`, `对方 dayun 命中 ${对方运.startYear} 年`,
        `起运岁数：我 ${我.chart.bazi.dayunStart} / 对方 ${对方.chart.bazi.dayunStart}`],
      不确定项: ['大运各走各的时段，同年同干不等于同处境。',
        '这里取的是"今年落在哪一步大运"，不是两人时间轴的对齐。'],
    });
  } else {
    未出.push('当前大运没出：至少一方盘上没有覆盖今年的一步大运。');
  }

  未出.push(
    '合盘评分 / 匹配度百分比：不做（裁定）。',
    '吉凶宜忌、择日、化解法：不做。',
    '方法说明：本站自研，目前未关联可核验的合婚古籍出处。',
  );

  return { 输入摘要: 摘要, 项目, 未出, 口径戳: HEPAN_BASIS };
}

/** 今年落在哪一步大运。引擎给的 dayun 是"前 10 步"，越界就当没有。 */
function 当前大运(c: ChartResult, year = new Date().getFullYear()) {
  const list = c.bazi?.dayun || [];
  const hit = list.find(d => d.startYear <= year && (d.endYear == null || year <= d.endYear));
  if (!hit) return null;
  const gan = String(hit.ganZhi || '').charAt(0) as Tiangan;
  const zhi = String(hit.ganZhi || '').charAt(1) as Dizhi;
  if (!gan || !zhi) return null;
  return { ganZhi: String(hit.ganZhi), startYear: hit.startYear, endYear: hit.endYear, startAge: hit.startAge, gan, zhi };
}
