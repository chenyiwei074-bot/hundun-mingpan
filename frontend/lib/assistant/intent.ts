// 本机问事路由：不联网、不调模型，纯按声明好的关键词把一句话对到目录里的一个工具。
//
// 它是 /api/assistant/route 上线之前的默认路径，也是那之后的兜底路径（模型挂了、
// 网关 404、超时都要有个东西能给出下一步）。两条纪律写在这里：
//  1. 这里只产出 slug，绝不产出 URL —— 能不能给入口由 types.ts 的 reconcile() 查目录决定；
//  2. 关键词表按 slug 声明，验收会双向核对（每个已开放工具都要有人问得到，
//     表里也不许有目录中不存在的 slug），所以这张表不会悄悄与目录漂移。

import type { ToolEntry } from '@/lib/tools/catalog';
import type { AssistantRouteResult, Mode } from './types';

export type NeedField = 'date' | 'time' | 'gender' | 'place' | 'question';

interface Spec { ask: string[]; needs: NeedField[] }

// needs 说的是"进那个页面之后要填什么"，本机这一路只按问题里有没有给过线索来提醒，
// 不替用户补任何值。
export const ROUTER_SPECS: Record<string, Spec> = {
  'bazi': { ask: ['八字', '四柱', '命盘', '紫微', '命格', '出生', '生日', '大运', '流年', '命', '排盘'], needs: ['date', 'time', 'place'] },
  'xiu-benming': { ask: ['星宿', '二十八宿', '本命宿', '值日宿', '宿曜', '哪一宿'], needs: ['date'] },
  'liuyao': { ask: ['六爻', '摇卦', '铜钱', '起卦', '这一卦', '占卜', '问事', '卦'], needs: ['question'] },
  'meihua': { ask: ['梅花', '时间起卦', '报数', '数字起卦', '易数'], needs: ['question'] },
  'huangli': { ask: ['黄历', '宜忌', '择日', '选日子', '好日子', '吉日', '冲煞', '哪天', '适合', '搬家', '入宅', '开业', '动土', '订婚'], needs: ['date'] },
  'dayun': { ask: ['人生曲线', '人生k线', '运势走势', '走什么运', '近几年', '十年'], needs: ['date', 'time'] },
  'xiu-he': { ask: ['合宿', '两人宿', '星宿配对'], needs: ['date'] },
  'fengshui': { ask: ['户型', '房屋', '住宅', '房间', '采光', '动线', '朝向', '风水', '装修', '门窗'], needs: [] },
  'hepan': { ask: ['合盘', '两人合', '婚配', '配对', '合八字'], needs: ['date', 'time', 'gender'] },
  'xingming': { ask: ['姓名', '名字', '五格', '剖象', '测名'], needs: ['question'] },
  // E2 裁定后 astro-natal 只到"落座与度数"这一层，所以路由词表里不许再留 上升 / 宫位 / 星盘 / 本命盘
  // 这些**它不做**的说法：拿没做的东西当关键词，等于问事框替页面许愿（catalog 那边有
  // astro/no-undelivered-promise 钉同一件事，两侧一起钉才咬得住）。
  // 问"星盘/上升"的人会落到"没对上这一系已开放的工具"那一句，并被指向目录 —— 那里写着缺什么。
  'astro-natal': { ask: ['占星', '本命行星位置', '太阳星座', '月亮星座', '行星', '落座', '黄经', '黄道'], needs: ['date', 'time', 'place'] },
  'astro-synastry': { ask: ['占星合盘', '两人星盘', 'synastry'], needs: ['date', 'time', 'place'] },
  'tarot-draw': { ask: ['塔罗', '抽牌', '牌阵', '牌卡'], needs: ['question'] },
  'lunar-phase': { ask: ['月相', '满月', '新月', '朔望', '农历几时月'], needs: ['date'] },
  'numerology': { ask: ['生命灵数', '数字命理', ' numerology', '幸运数字', '生日数'], needs: ['date'] },
};

const DETECT: Record<NeedField, (t: string) => boolean> = {
  date: t => /\d{4}\s*[-/年.]|\d{1,2}\s*月\s*\d{1,2}|[一二三四五六七八九十冬]{1,3}月|生日|出生|今年|明年/.test(t),
  time: t => /\d{1,2}\s*[:：点]\s*\d{0,2}|[子丑寅卯辰巳午未申酉戌亥]时|时辰|几点/.test(t),
  gender: t => /男|女/.test(t),
  place: t => /省|市|县|区|自治|国|出生地|现居/.test(t),
  question: t => /问|卜|占|卦|事|能不能|会不会|该不该|如何|怎样|顺利/.test(t),
};

const norm = (s: string) => s.toLowerCase().replace(/[\s，。、？！；：,.?!;:"'“”‘’()（）]/g, '');

/** 这一系里"能被问到"的候选：状态与 href 由调用方给的目录决定，本函数不看目录内容。 */
function score(mode: Mode, text: string, catalog: ToolEntry[]) {
  const t = norm(text);
  const rows = catalog.map(tool => {
    const spec = ROUTER_SPECS[tool.slug];
    if (!spec) return { tool, hit: 0, matched: [] as string[] };
    const matched = spec.ask.filter(k => t.includes(norm(k)));
    return { tool, hit: matched.length, matched };
  }).filter(r => r.hit > 0).sort((a, b) => b.hit - a.hit);
  const top = rows[0];
  const second = rows[1];
  return { top, second, t };
}

const FIELD_LABEL: Record<NeedField, string> = {
  date: '日期或生日', time: '出生时辰', gender: '性别', place: '出生地点', question: '要问的那件事',
};

/**
 * 「进这个工具还要补什么」的唯一算法。
 * 单独导出是因为用户在并列里挑了一个之后也要算同一件事 —— 让页面自己抄一份 needs 表
 * 就是第二个真相（这张表随 ROUTER_SPECS 与 DETECT 变，抄的那份不会跟着变）。
 */
export function needsFor(slug: string, text: string): string[] {
  const t = norm(text);
  return (ROUTER_SPECS[slug]?.needs ?? []).filter(f => !DETECT[f](t)).map(f => FIELD_LABEL[f]);
}

export function routeLocal(mode: Mode, text: string, catalog: ToolEntry[], otherCatalog: ToolEntry[]): AssistantRouteResult {
  const trimmed = text.trim();
  const { top, second, t } = score(mode, trimmed, catalog);
  const empty = (clarification: string): AssistantRouteResult => ({
    mode, toolSlug: null, confidence: 0, needsClarification: true,
    clarification, missingFields: [], available: false,
  });

  if (!top) {
    // 本系一个都对不上，但另一系对得上 —— 这是跨体系问题，该问一句，而不是硬塞一个工具。
    const cross = score(mode, trimmed, otherCatalog).top;
    if (cross) {
      return empty(`「${cross.tool.name}」属于另一套体系。要换过去问，还是就在这一系里问？`);
    }
    return empty('这句话没对上这一系里已经开放的工具。可以说得更具体一点，或者直接看下面的目录。');
  }

  const tie = second && second.hit === top.hit;
  const missing = needsFor(top.tool.slug, trimmed);
  const confidence = Math.min(0.95, 0.35 + 0.2 * top.hit);

  if (tie) {
    return {
      mode, toolSlug: null, confidence, needsClarification: true,
      clarification: `这句话同时像「${top.tool.name}」和「${second!.tool.name}」，你要先看哪一个？`,
      // 并列不再只写成一句话：把两个 slug 一起交出去，由页面做成 chip 让用户挑。
      // 挑不挑得成由 reconcile 查目录决定，这里只负责"说清有哪两个可能"。
      candidates: [top.tool.slug, second!.tool.slug],
      missingFields: [], available: false,
    };
  }
  return {
    mode, toolSlug: top.tool.slug, confidence,
    needsClarification: missing.length > 0,
    clarification: missing.length
      ? `进入「${top.tool.name}」还要补：${missing.join('、')}。问题里没给，页面会再问你，这里不替你填。`
      : null,
    missingFields: missing, available: true,
  };
}
