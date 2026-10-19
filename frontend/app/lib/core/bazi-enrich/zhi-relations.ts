// 地支关系检测 — 刑冲合害、三合三会、暗合、拱合拱会

import { Dizhi, DIZHI, ZHI_CANG_GAN, Tiangan } from './tables';

export type ZhiRelation = {
  type: '六冲'|'六合'|'三合'|'三会'|'相刑'|'自刑'|'六害'|'暗合'|'拱合'|'拱会';
  zhi: Dizhi[];      // 参与的地支
  pillars: string[]; // 参与的柱名(年/月/日/时)
  detail?: string;   // 备注，如拱合的目标支
};

// 六冲
const LIU_CHONG: [Dizhi, Dizhi][] = [
  ['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']
];

// 六合
const LIU_HE: [Dizhi, Dizhi][] = [
  ['子','丑'],['寅','亥'],['卯','戌'],['辰','酉'],['巳','申'],['午','未']
];

// 三合局 (申子辰水 / 亥卯未木 / 寅午戌火 / 巳酉丑金)
const SAN_HE: Array<{zhi: [Dizhi, Dizhi, Dizhi], wuxing: string}> = [
  {zhi:['申','子','辰'], wuxing:'水'},
  {zhi:['亥','卯','未'], wuxing:'木'},
  {zhi:['寅','午','戌'], wuxing:'火'},
  {zhi:['巳','酉','丑'], wuxing:'金'}
];

// 三会方 (寅卯辰东方木 / 巳午未南方火 / 申酉戌西方金 / 亥子丑北方水)
const SAN_HUI: Array<{zhi: [Dizhi, Dizhi, Dizhi], wuxing: string}> = [
  {zhi:['寅','卯','辰'], wuxing:'木'},
  {zhi:['巳','午','未'], wuxing:'火'},
  {zhi:['申','酉','戌'], wuxing:'金'},
  {zhi:['亥','子','丑'], wuxing:'水'}
];

// 相刑 (无礼之刑 子卯; 恃势之刑 寅巳申; 无恩之刑 丑戌未)
const XIANG_XING: Array<{zhi: Dizhi[], name: string}> = [
  {zhi:['子','卯'], name:'无礼之刑'},
  {zhi:['寅','巳','申'], name:'恃势之刑'},
  {zhi:['丑','戌','未'], name:'无恩之刑'}
];
const ZI_XING: Dizhi[] = ['辰','午','酉','亥']; // 自刑

// 六害
const LIU_HAI: [Dizhi, Dizhi][] = [
  ['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']
];

// 暗合 — 地支藏干之间相合
// 天干五合: 甲己 乙庚 丙辛 丁壬 戊癸
const GAN_HE: Record<Tiangan, Tiangan> = {
  甲:'己',己:'甲', 乙:'庚',庚:'乙', 丙:'辛',辛:'丙', 丁:'壬',壬:'丁', 戊:'癸',癸:'戊'
};

type Pillar = '年'|'月'|'日'|'时';

// ── 成对（两支）查表 ────────────────────────────────────────────────────
// detectZhiRelations 与「流年 × 四柱」用同一份查表，不分叉出第二套关系逻辑。
// 这几个 helper 只查表、不产出结构：detectZhiRelations 的输出形状、顺序与柱名聚合全部不变，
// 所以这次加导出没有改变任何既有行为（golden 全枚举 12^4=20736 组四柱，输出串接 sha256 逐字节相同）。
// 相破这一族本站从来没有对应的表，也不在这里新增（原典之外不发明）—— 成对入口只报现有这六类。
function chongOf(a: Dizhi, b: Dizhi): boolean {
  return LIU_CHONG.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
function heOf(a: Dizhi, b: Dizhi): boolean {
  return LIU_HE.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
function haiOf(a: Dizhi, b: Dizhi): boolean {
  return LIU_HAI.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
// 相刑：子卯两支齐即成；寅巳申 / 丑戌未 三支族里任意两支齐即半刑，三支齐即全刑。
function xingOf(a: Dizhi, b: Dizhi): string | null {
  if (a === b) return null;                          // 同支不属族内相刑，自刑另有其位
  for (const xing of XIANG_XING) {
    if (xing.zhi.includes(a) && xing.zhi.includes(b)) {
      return xing.zhi.length === 2 ? xing.name : xing.name + '(半)';
    }
  }
  return null;
}
// 暗合的算法体，从原 detectZhiRelations 里原样搬出来，一字未改。
function anHeDetail(a: Dizhi, b: Dizhi): string {
  const aGans = ZHI_CANG_GAN[a].map(c => c.gan);
  const bGans = ZHI_CANG_GAN[b].map(c => c.gan);
  const hits: string[] = [];
  for (const ag of aGans) for (const bg of bGans) if (GAN_HE[ag] === bg) hits.push(`${ag}${bg}合`);
  return hits.join('、');
}

export type PairRelationType = '六冲' | '六合' | '六害' | '相刑' | '自刑' | '暗合';

/**
 * 任意两支之间的关系。给「流年 × 命局某柱」这类外部配对用 —— detectZhiRelations 只吃
 * 命局自身四柱（ZhiRelation.pillars 结构上只能装 年/月/日/时），表达不出"流年 vs 日柱"。
 *
 * 范围与既有实现完全对齐：只报成对成立的关系，即 六冲/六合/六害/相刑/自刑/暗合。
 * 三合/三会/拱合/拱会 是三支族的关系，不在成对里报 —— 一支对一支报出来就是假的三合。
 * 相破 本站不存在（原典之外不发明），也不在这里报。
 * 暗合的抑制规则沿用原来那一条：这对支之间已有显式关系时不再报暗合。
 */
export function zhiPairRelations(a: Dizhi, b: Dizhi): Array<{ type: PairRelationType; detail?: string }> {
  const out: Array<{ type: PairRelationType; detail?: string }> = [];
  if (chongOf(a, b)) out.push({ type: '六冲' });
  if (heOf(a, b)) out.push({ type: '六合' });
  if (haiOf(a, b)) out.push({ type: '六害' });
  const xing = xingOf(a, b);
  if (xing) out.push({ type: '相刑', detail: xing });
  if (a === b && ZI_XING.includes(a)) out.push({ type: '自刑' });
  if (out.length === 0 && a !== b) {
    const detail = anHeDetail(a, b);
    if (detail) out.push({ type: '暗合', detail });
  }
  return out;
}

export function detectZhiRelations(zhis: Record<Pillar, Dizhi>): ZhiRelation[] {
  const out: ZhiRelation[] = [];
  const pillars: Pillar[] = ['年','月','日','时'];
  const list = pillars.map(p => ({pillar: p, zhi: zhis[p]}));

  // 两两组合
  const pairs: Array<[typeof list[0], typeof list[0]]> = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i+1; j < list.length; j++) {
      pairs.push([list[i], list[j]]);
    }
  }

  // 六冲 / 六合 / 六害 —— 三类都是"表里查这一对支"，逐对推入，顺序与原来一致。
  for (const [a, b] of pairs) if (chongOf(a.zhi, b.zhi))
    out.push({type:'六冲', zhi:[a.zhi, b.zhi], pillars:[a.pillar, b.pillar]});
  for (const [a, b] of pairs) if (heOf(a.zhi, b.zhi))
    out.push({type:'六合', zhi:[a.zhi, b.zhi], pillars:[a.pillar, b.pillar]});
  for (const [a, b] of pairs) if (haiOf(a.zhi, b.zhi))
    out.push({type:'六害', zhi:[a.zhi, b.zhi], pillars:[a.pillar, b.pillar]});

  // 相刑
  for (const xing of XIANG_XING) {
    const matches = list.filter(p => xing.zhi.includes(p.zhi));
    if (xing.zhi.length === 2) {
      // 子卯刑：要两个都在
      const distinct = new Set(matches.map(m => m.zhi));
      if (distinct.size === 2) {
        out.push({type:'相刑', zhi:[...distinct] as Dizhi[], pillars: matches.map(m=>m.pillar), detail: xing.name});
      }
    } else {
      // 三刑：两个就构成半刑(实际三刑要全)
      const distinct = new Set(matches.map(m => m.zhi));
      if (distinct.size >= 2) {
        out.push({type:'相刑', zhi:[...distinct] as Dizhi[], pillars: matches.map(m=>m.pillar), detail: xing.name + (distinct.size === 3 ? '(全)' : '(半)')});
      }
    }
  }

  // 自刑
  for (const zx of ZI_XING) {
    const matches = list.filter(p => p.zhi === zx);
    if (matches.length >= 2) {
      out.push({type:'自刑', zhi:[zx, zx], pillars: matches.map(m=>m.pillar)});
    }
  }

  // 三合 / 三会 / 半合 / 拱合 / 拱会
  for (const sh of SAN_HE) {
    const present = list.filter(p => sh.zhi.includes(p.zhi));
    const distinctZhi = [...new Set(present.map(p => p.zhi))];
    if (distinctZhi.length === 3) {
      out.push({type:'三合', zhi: distinctZhi as Dizhi[], pillars: present.map(p=>p.pillar), detail: `三合${sh.wuxing}局`});
    } else if (distinctZhi.length === 2) {
      // 缺一支 → 拱合
      const missing = sh.zhi.find(z => !distinctZhi.includes(z))!;
      out.push({type:'拱合', zhi: distinctZhi as Dizhi[], pillars: present.map(p=>p.pillar), detail: `拱合${missing}(${sh.wuxing}局)`});
    }
  }
  for (const sh of SAN_HUI) {
    const present = list.filter(p => sh.zhi.includes(p.zhi));
    const distinctZhi = [...new Set(present.map(p => p.zhi))];
    if (distinctZhi.length === 3) {
      out.push({type:'三会', zhi: distinctZhi as Dizhi[], pillars: present.map(p=>p.pillar), detail: `三会${sh.wuxing}方`});
    } else if (distinctZhi.length === 2) {
      const missing = sh.zhi.find(z => !distinctZhi.includes(z))!;
      out.push({type:'拱会', zhi: distinctZhi as Dizhi[], pillars: present.map(p=>p.pillar), detail: `拱会${missing}(${sh.wuxing}方)`});
    }
  }

  // 暗合 — 地支藏干相合
  // 规则: 仅在该地支对没有其他显式关系(六冲/六合/六害/三合/三会/拱合/拱会/相刑)时才报暗合
  const explicitTypes: ZhiRelation['type'][] = ['六冲','六合','六害','三合','三会','拱合','拱会','相刑','自刑'];
  function hasExplicit(za: Dizhi, zb: Dizhi): boolean {
    return out.some(r =>
      explicitTypes.includes(r.type) &&
      r.zhi.includes(za) && r.zhi.includes(zb)
    );
  }
  for (const [a, b] of pairs) {
    if (a.zhi === b.zhi) continue;
    if (hasExplicit(a.zhi, b.zhi)) continue;
    const detail = anHeDetail(a.zhi, b.zhi);
    if (detail) {
      out.push({type:'暗合', zhi:[a.zhi, b.zhi], pillars:[a.pillar, b.pillar], detail});
    }
  }

  return out;
}
