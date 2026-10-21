// 合盘（两人对照）验收。这一批要守的是四条裁定，四条都是"负面"的：
//  1. 不出分 —— 没有评分、没有匹配度、没有百分比，连一个数值字段都不许有；
//  2. 不引古籍 —— docs/classics 没有合婚原文，所以整节只能标「自研 · 非还原」；
//  3. 对方生辰只活在本机 —— 不进 API、不进报告、不进回执、不进台账、不上链；
//  4. create 页那栏 partner 死字段接管成真输入 —— 只喂本机计算。
// 外加一条算法层的：ganPair 是从 detectGanRelations 里就地抽出来的，
// 抽取前后本盘关系表的输出必须逐字相同（10^4 组全枚举钉住，不靠读 diff）。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/hepan-acceptance/acceptance.ts --out=.hepan.txt
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import { enrichBazi } from '../../frontend/app/lib/core/bazi-enrich/enrich';
import { ganPair, detectGanRelations, judgePillars } from '../../frontend/app/lib/core/bazi-enrich/gan-relations';
import { GAN_WUXING, ZHI_WUXING, shengKe } from '../../frontend/app/lib/core/bazi-enrich/tables';
import type { Dizhi, Tiangan } from '../../frontend/app/lib/core/bazi-enrich/tables';
import { analyzeHepan } from '../../frontend/lib/hepan/engine';
import { HEPAN_BASIS, HEPAN_FORBIDDEN } from '../../frontend/lib/hepan/types';
import type { HepanParty, HepanReport } from '../../frontend/lib/hepan/types';
import { HEPAN_STORE_KEY, HEPAN_TTL_MS, clearPartner, isPersisted, loadPartner, savePartner } from '../../frontend/lib/hepan/local-store';
import type { PartnerDraft } from '../../frontend/lib/hepan/local-store';
import { INTENTS, TOOL_BY_SLUG, CATALOG_STAMPS } from '../../frontend/lib/tools/catalog';
import { routeLocal } from '../../frontend/lib/assistant/intent';
import { reconcile } from '../../frontend/lib/assistant/types';
import type { AssistantRouteResult } from '../../frontend/lib/assistant/types';

const ROOT = join(__dirname, '../..');
const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.hepan.txt';
const lines: string[] = [];
let pass = 0; let fail = 0;
const fails: string[] = [];
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else { fail++; fails.push(id); }
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

/** 字样扫描前必须先剥注释 —— 这条在这个仓库踩过三次：模块自己的注释里写着
 *  "不发请求""不引古籍"，不剥掉的话反向断言会被作者本人的说明喂绿。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 1. ganPair 抽取：本盘关系表的输出逐字不变 ──
{
  const GANS = '甲乙丙丁戊己庚辛壬癸'.split('') as Tiangan[];
  // 抽取前的那份实现，原样抄在这里当 oracle（不是"我认为它应该怎样"，是它当时怎样）。
  const GAN_HE_PAIRS: Array<[Tiangan, Tiangan, string]> = [
    ['甲', '己', '土'], ['乙', '庚', '金'], ['丙', '辛', '水'], ['丁', '壬', '木'], ['戊', '癸', '火'],
  ];
  const oldDetect = (gans: Record<'年' | '月' | '日' | '时', Tiangan>) => {
    const out: Array<{ type: string; gans: Tiangan[]; pillars: string[] }> = [];
    const pillars: Array<'年' | '月' | '日' | '时'> = ['年', '月', '日', '时'];
    const list = pillars.map(p => ({ pillar: p, gan: gans[p] }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const he = GAN_HE_PAIRS.find(([x, y]) => (a.gan === x && b.gan === y) || (a.gan === y && b.gan === x));
        if (he) { out.push({ type: '天干合', gans: [a.gan, b.gan], pillars: [a.pillar, b.pillar] }); continue; }
        const rel = shengKe(GAN_WUXING[a.gan], GAN_WUXING[b.gan]);
        if (rel === '克' || rel === '被克') out.push({ type: '天干相克', gans: [a.gan, b.gan], pillars: [a.pillar, b.pillar] });
      }
    }
    return out;
  };
  let diffs = 0; let first = ''; let n = 0;
  for (const a of GANS) for (const b of GANS) for (const c of GANS) for (const d of GANS) {
    const g = { 年: a, 月: b, 日: c, 时: d };
    n++;
    const now = JSON.stringify(detectGanRelations(g));
    const before = JSON.stringify(oldDetect(g));
    if (now !== before) { diffs++; if (!first) first = `${a}${b}${c}${d}\n  现 ${now}\n  原 ${before}`; }
  }
  ok('core/detect-gan-unchanged', diffs === 0,
    `ganPair 是从本盘关系表里抽出来的，抽取前后 10^4=${n} 组四柱天干的输出必须逐字相同（新导出的"相生/相同"两类只给合盘用，不许漏进本盘表）：差异 ${diffs} 处${first ? `\n${first}` : ''}`);

  // 钉一个冻结摘要，而不是只信上面那份手抄 oracle —— 手抄的旧实现和现实现可以被一起改掉，
  // 摘要改不动。这个值 d1ea79065618a10d 是从 2971343（本批切出来的那个 main）的原文
  // 跑出来的，不是从抽完之后的输出倒读的。
  const digest = createHash('sha256');
  for (const a of GANS) for (const b of GANS) for (const c of GANS) for (const d of GANS) {
    digest.update(JSON.stringify(detectGanRelations({ 年: a, 月: b, 日: c, 时: d })));
  }
  const got = digest.digest('hex').slice(0, 16);
  ok('core/detect-gan-frozen-digest', got === 'd1ea79065618a10d',
    `本盘天干关系表在 10^4 组全枚举上的输出摘要必须等于抽取前那一份（这一条不许用重新算一遍的方式"更新"，要改先证明改动是被裁定过的）：实得 ${got}`);

  // 反手抄：套件里那份"抽取前"的实现必须真的来自 2971343 的原文。
  // 手抄一份自己以为的旧代码，测出来的是"我在测我自己"—— 这条是被 zhi-relations 那次教训换来的。
  try {
    const blob = execSync('git show 2971343:frontend/app/lib/core/bazi-enrich/gan-relations.ts',
      { cwd: ROOT, encoding: 'utf8' });
    const self = readFileSync(__filename, 'utf8').replace(/\s+/g, '');
    const marks = [
      "if (he) { out.push({type:'天干合', gans:[a.gan, b.gan], pillars:[a.pillar, b.pillar]});",
      "const rel = shengKe(GAN_WUXING[a.gan], GAN_WUXING[b.gan]);",
      "out.push({type:'天干相克', gans:[a.gan, b.gan], pillars:[a.pillar, b.pillar]});",
    ];
    const norm = (s: string) => s.replace(/\s+/g, '');
    const bad = marks.filter(m => !norm(blob).includes(norm(m)) || !self.includes(norm(m)));
    ok('core/oracle-is-the-real-old-file', bad.length === 0 && !blob.includes('export function ganPair'),
      `套件那份 oracle 的三行特征原文既要在 2971343 里，也要在本套件里逐字出现，而且那份原文不许已经有 ganPair（有的话说明我抄的是抽完之后的版本，比较就失去了对象）：不符 ${bad.join(' | ') || '0 处'}`);
  } catch (e) {
    ok('core/oracle-is-the-real-old-file', false, `git show 2971343 读不到原文，这条判不了（判不了要说出来，不算过）：${(e as Error).message}`);
  }

  const pair: Array<[string, string, string | null]> = [
    ['甲', '己', '天干合'], ['乙', '庚', '天干合'], ['庚', '乙', '天干合'],
    ['甲', '庚', '天干相克'], ['庚', '甲', '天干相克'], ['丙', '壬', '天干相克'],
    ['甲', '甲', '天干同'], ['庚', '庚', '天干同'],
    ['甲', '丙', '天干相生'], ['丙', '甲', '天干相生'],
    ['甲', '乙', null], ['壬', '癸', null],
  ];
  const badPair = pair.map(([a, b, want]) => [a, b, want, ganPair(a as Tiangan, b as Tiangan)] as const)
    .filter(([, , w, g]) => w !== g);
  ok('core/gan-pair-hand-derived', badPair.length === 0,
    `手推 ${pair.length} 对钉住五合/相克/同/相生/无关系五档（含双向）：错 ${badPair.map(([a, b, w, g]) => `${a}${b} 应 ${w ?? 'null'} 实 ${g ?? 'null'}`).join('、') || '0 对'}`);
  // 甲乙同为木，既不合也不生克；"同"只留给同一干。这一条若判错，合盘里大量对子会被叫成"同"。
  ok('core/gan-wuxing-same-not-tong', ganPair('甲' as Tiangan, '乙' as Tiangan) === null && ganPair('甲' as Tiangan, '甲' as Tiangan) === '天干同',
    '同为木的两个不同天干之间没有任何关系；"天干同"只指同一支干（否则合盘会把半数配对读成"同"）');

  // P2（既有缺陷批）：judgePillars 的判词并集里不许有进不去的成员。
  // shengKe 在 WuXing 上是全函数，五种返回值正好对上五档判词，所以原来并集里那个
  // '天地异气无生克' 永远赋不上值 —— 而它写在导出的类型上，下游照着它写一个
  // if (verdict === '天地异气无生克') 就是一个永假分支，与藏干那次同一类（声明比运行时宽）。
  const 判词五 = ['盖头', '截脚', '天干生地支', '地支生天干', '天地同气'];
  const G10 = '甲乙丙丁戊己庚辛壬癸'.split('') as Tiangan[];
  const Z12 = '子丑寅卯辰巳午未申酉戌亥'.split('') as Dizhi[];
  const seen = new Map<string, number>();
  let 越界: string[] = [];
  for (const g of G10) for (const z of Z12) {
    const v = judgePillars({ 年: { gan: g, zhi: z }, 月: { gan: g, zhi: z }, 日: { gan: g, zhi: z }, 时: { gan: g, zhi: z } })[0].verdict;
    seen.set(v, (seen.get(v) || 0) + 1);
    if (!判词五.includes(v)) 越界.push(`${g}${z}→${v}`);
  }
  const 缺档 = 判词五.filter(w => !seen.has(w));
  ok('core/judge-pillars-total-and-reachable', 越界.length === 0 && 缺档.length === 0 && seen.size === 5,
    `10×12 全组合跑下来，判词必须一个都不越界、五档每一档都真的出现（并集里多写一档 = 下游一个永假分支；少出现一档 = 表里少了一类关系）：越界 ${越界.join('、') || '0 处'} / 缺档 ${缺档.join('、') || '0 档'} / 分布 ${[...seen.entries()].map(([k, n]) => k + n).join(' ')}`);
  const 声明 = readFileSync(join(ROOT, 'frontend', 'app', 'lib', 'core', 'bazi-enrich', 'gan-relations.ts'), 'utf8');
  const 并集 = (声明.match(/verdict:\s*([^;]+);/s) || ['', ''])[1].replace(/[\s'"]/g, '').split('|');
  ok('core/judge-pillars-declaration-matches-runtime', 并集.length === 5 && 判词五.every(w => 并集.includes(w)),
    `PillarVerdict.verdict 的并集必须与运行时能产出的五档逐字相等（多出来的那一档就是这次删掉的 '天地异气无生克'，写而不可达比不写更贵）：声明 ${并集.join('/')} / 运行时 ${判词五.join('/')}`);
}

// ── 2. 真盘对照：八条立项在两张完整的盘上都应出得来 ──
const mkParty = (opts: { year: number; month: number; day: number; hour: number; minute: number; gender: 'male' | 'female' }): HepanParty => {
  const chart = createChart({ ...opts, isLunar: false, timeZone: 8, longitude: 116.4074, dstOffset: 1, enableTrueSolarTime: true } as never) as never as HepanParty['chart'];
  const s = chart.bazi.siZhu;
  const 五行统计 = enrichBazi({ '年': s.year, '月': s.month, '日': s.day, '时': s.hour } as never).五行统计 as unknown as Record<string, number>;
  return { chart, 五行统计, meta: { 称呼: opts.gender === 'male' ? '乾' : '坤', 性别: opts.gender === 'male' ? '男' : '女', 原始输入: `公历 ${opts.year}-${opts.month}-${opts.day} ${opts.hour}:${opts.minute}` } };
};
const 甲 = mkParty({ year: 1988, month: 7, day: 15, hour: 15, minute: 20, gender: 'male' });
const 乙 = mkParty({ year: 1990, month: 2, day: 3, hour: 7, minute: 30, gender: 'female' });
const 报告 = analyzeHepan({ 我: 甲, 对方: 乙 });
const 名字 = (r: HepanReport) => r.项目.map(x => x.立项);

{
  ok('engine/basis-stamp', 报告.口径戳 === HEPAN_BASIS,
    `口径戳必须是引擎导出的那一个常量（${HEPAN_BASIS}），不是套件里的第二个字面量：实得 ${报告.口径戳}`);
  const want = ['日主相待', '对方日主在我盘里的位置', '年支对照', '日支对照', '年命纳音', '我盘夫妻宫 × 对方命宫', '五行数量并排', '当前大运并排'];
  const got = 名字(报告);
  const miss = want.filter(w => !got.includes(w));
  ok('engine/eight-items-on-real-charts', miss.length === 0 && got.length === want.length,
    `两张完整真盘并排应当八条全出（缺一条通常是读错了键名 —— 引擎的 SiZhu/shiShen 是英文键，而 enrichBazi 吃中文键，读错的那一侧静默 undefined）：缺 ${miss.join('、') || '0 条'}；实出 ${got.length} 条`);
  const empty = 报告.项目.filter(x => !x.观察 || x.依据.length === 0 || x.不确定项.length === 0);
  ok('engine/every-item-has-basis-and-caveat', empty.length === 0,
    `每一条都必须同时带「依据」和「说不准的地方」，只有观察没有出处的断语就是本站一直在删的东西：缺项 ${empty.map(x => x.立项).join('、') || '0 条'}`);
  ok('engine/summary-carries-raw-input', 报告.输入摘要[0].includes('原始输入') && 报告.输入摘要[1].includes('原始输入'),
    `两人的原始输入要能核对（口径不同的两张盘不可比，而"我用的是农历还是公历"只有原始输入记得住）：${报告.输入摘要.slice(0, 2).join(' / ')}`);
  const 空值 = ['null', 'undefined', 'NaN'].filter(w =>
    [...报告.项目.map(x => [x.观察, ...x.依据, ...x.不确定项].join('|')), ...报告.输入摘要, ...报告.未出].join('|').includes(w));
  ok('engine/no-placeholder-leaks', 空值.length === 0,
    `屏上要出现的每个位置都得有自己的说法：模板里漏一档就会把 undefined/null/NaN 印到页面上，而那是用户唯一会当成"系统坏了"读的一类字。今天全绿靠的是 shengKe 全函数 + ganPair 的 ?? 兜底，这条是把这两件事钉住而不是信它们：泄漏 ${空值.join('、') || '0 处'}`);

  // 假声明陷阱：types.ts 的 ZiweiGong 声明成 '夫妻宫'…，而 ziwei-standard.ts:22 实际产出 '夫妻'…。
  // 按声明找宫 → 永远找不到 → 这一条永远静默走「没做的部分」，页面上一切照常。
  // 另一半陷阱：mingGongIndex 是"命宫落在哪个地支"(子=0)，不是 gongs 的下标 ——
  // 拿它索引 gongs 读到的是父母宫：有值、不报错、而且看着像数据。
  const 宫 = 报告.项目.find(x => x.立项 === '我盘夫妻宫 × 对方命宫')!;
  const 真夫妻 = (甲.chart as any).ziwei.gongs.find((g: any) => g.gong === '夫妻');
  const 真命宫 = (乙.chart as any).ziwei.gongs.find((g: any) => g.gong === '命宫');
  ok('engine/ziwei-gong-lookup-matches-runtime', !!宫
    && 宫.依据[0].includes(真夫妻.dizhi) && 宫.依据[1].includes(真命宫.dizhi)
    && 宫.依据[1].includes(真命宫.gong),
    `宫位对照读到的必须是真正的夫妻宫与命宫，依据里要带上各自坐的地支好让人核对（gongs[mingGongIndex] 实为 ${JSON.stringify((乙.chart as any).ziwei.gongs[(乙.chart as any).ziwei.mingGongIndex].gong)}，按它索引就读错宫）：${宫 ? 宫.依据.join('；') : '这一条没出'}`);
  ok('engine/ziwei-gong-names-sans-suffix', (甲.chart as any).ziwei.gongs.some((g: any) => g.gong === '夫妻')
    && !(甲.chart as any).ziwei.gongs.some((g: any) => g.gong === '夫妻宫'),
    '钉住运行时事实：引擎产出的宫名除命宫外不带"宫"字（这条红了说明产出方改了，而 ZiweiGong 声明和所有按名字找宫的消费者都没跟上）');

  // 纳音这两张真盘的年柱纳音都是大林木（戊辰/己巳同属），正是"同为一种五行"那一档。
  const 纳 = 报告.项目.find(x => x.立项 === '年命纳音')!;
  // 钉值而不是只钉句式：批7 之前这里只断言「两者是「同」」，我把表里 戊辰 那条删掉，
  // 引擎兜底返回 海中金，页面上就长成「我年命纳音「海中金」属金，对方「大林木」属木，两者是「克」」——
  // 一句结构完整、来源是假数据的结论。句式那条因为它恰好不再"同"才红，属于撞上的，不是钉住的。
  ok('engine/nayin-year-name-pinned', !!纳 && 纳.依据[0] === '我 naYin.year = 大林木'
    && 纳.依据[1] === '对方 naYin.year = 大林木',
    `两张真盘的年柱纳音必须是纳音歌里的「大林木」（1988 戊辰、1990-02-03 在立春前仍属己巳）：${纳 ? 纳.依据.join('；') : '这一条没出'}`);
  ok('engine/nayin-same-element-wording', !!纳 && 纳.观察.includes('两者是「同」'),
    `两边纳音同属一种五行时报「同」：shengKe 在 WuXing 上是全函数（tables.ts:42 的返回类型里没有 null），所以这一档本来就有说法，不需要另造。这条钉的是"别再给它加一个永远进不去的兜底分支"：${纳 ? 纳.观察 : '这一条没出'}`);
  const WX = ['木', '火', '土', '金', '水'] as const;
  const 不全 = WX.flatMap(a => WX.map(b => [a, b, shengKe(a, b)] as const)).filter(([, , r]) => !r);
  ok('core/shengke-is-total', 不全.length === 0 && WX.map(a => shengKe(a, a)).every(r => r === '同'),
    `shengKe 必须对 25 对五行都有返回值（它是合盘所有"两者是「X」"句式的唯一词源；一旦能返回 undefined，25 个位置里就有一个会在页面上印成空）：缺 ${不全.length} 对 / 同气档 ${WX.every(a => shengKe(a, a) === '同') ? '是「同」' : '不是「同」'}`);
  // 十神这一条最容易空过：落点为空的写法与"根本没有这条"在页面上看不出区别。
  const 十回指 = 报告.项目.find(x => x.立项 === '对方日主在我盘里的位置')!;
  ok('engine/shishen-fallback-when-no-anchor', 十回指.观察.includes('没有哪一柱天干是这个十神') === !/柱的天干也是这个十神/.test(十回指.观察),
    `回指落点要么给出柱名、要么明说没有，两种写法互斥且必居其一（含糊过去就等于编了一条依据）：${十回指.观察}`);
}

// ── 3. 不出分：反向断言 ──
{
  const 文本 = 报告.项目.map(x => [x.立项, x.观察, ...x.依据, ...x.不确定项].join('|')).join('\n');
  const hit = HEPAN_FORBIDDEN.filter(w => 文本.includes(w));
  ok('engine/no-verdict-words-in-items', hit.length === 0,
    `观察/依据/不确定项里不许出现 ${HEPAN_FORBIDDEN.join('、')} 任何一个（这些词一旦进入结论层就是评分的别名）。注意 未出 那一节会合法地提到它们 —— 那是"声明不做"，所以这里只扫结论字段：命中 ${hit.join('、') || '0 个'}`);
  const numeric = (v: unknown, p = ''): string[] => {
    if (typeof v === 'number' && !Number.isNaN(v)) return [p];
    if (Array.isArray(v)) return v.flatMap((x, i) => numeric(x, `${p}[${i}]`));
    if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => numeric(x, `${p}.${k}`));
    return [];
  };
  const nums = [...numeric(报告.项目), ...numeric(报告.输入摘要)];
  ok('engine/no-numeric-field-anywhere', nums.length === 0,
    `结论字段里一个 number 类型都不许有（五行只能报成"木3 火2"这样的字符串；一旦出现数值字段，页面上它就会被浏览成分数）：数值路径 ${nums.join('、') || '无'}`);
  const said = ['评分', '匹配度', '百分比', '吉凶', '宜忌', '古籍']
    .filter(w => 报告.未出.some(l => l.includes(w)));
  ok('engine/absence-is-declared', said.length >= 3,
    `没做的事要在「没做的部分」里点名，不能只是不说（用户分不清"没做"与"没显示"）：点名 ${said.join('、')}（${报告.未出.length} 条）`);
}

// ── 4. 关系是对称的、缺输入是不猜的（这一节用手工盘，不靠真排盘撞运气）──
{
  // 引擎只读盘上那几个字段，所以可以按字段造一张最小盘，把"子丑六合""甲己合"
  // 这类关系钉死在手上推得出的位置。用真盘的话，年份选得巧不巧决定了这条断言
  // 到底测没测到东西 —— 而"恰好没测到"是绿的。
  const gz = (gan: string, zhi: string) => ({ gan, zhi });
  const fake = (o: { 干: [string, string, string, string]; 支: [string, string, string, string];
    十神?: [string, string, string, string]; 纳音?: [string, string, string, string];
    运?: string; 夫妻?: string[]; 命?: string[]; 性别?: '男' | '女' }): HepanParty => {
    const [yg, mg, dg, hg] = o.干, [yz, mz, dz, hz] = o.支;
    const ss = o.十神 || ['比肩', '比肩', '比肩', '比肩'];
    const ny = o.纳音 || ['海中金', '炉中火', '大林木', '杨柳木'];
    const gong = (名: string, stars: string[]) => ({ gong: 名, dizhi: '子', tiangan: '甲', mainStars: stars, sihua: [] });
    return {
      五行统计: { 木: 1, 火: 2, 土: 3, 金: 0, 水: 4 },
      meta: { 称呼: '甲', 性别: o.性别 || '男', 原始输入: '手推盘' },
      chart: {
        bazi: {
          siZhu: { year: gz(yg, yz), month: gz(mg, mz), day: gz(dg, dz), hour: gz(hg, hz) },
          shiShen: { year: ss[0], month: ss[1], day: ss[2], hour: ss[3] },
          naYin: { year: ny[0], month: ny[1], day: ny[2], hour: ny[3] },
          dayun: [{ ganZhi: o.运 || '丙子', startYear: 1990, endYear: 2099, startAge: 3 }],
          dayunStart: 3,
        },
        ziwei: {
          mingGongIndex: 0,
          gongs: [gong('命宫', o.命 || ['紫微']), gong('夫妻宫', o.夫妻 || ['天机'])],
        },
      } as unknown as HepanParty['chart'],
    };
  };
  const 子 = fake({ 干: ['甲', '丙', '甲', '戊'], 支: ['子', '寅', '子', '午'], 性别: '男' });
  const 丑 = fake({ 干: ['己', '丁', '己', '己'], 支: ['丑', '卯', '丑', '未'], 性别: '女' });
  const 午 = fake({ 干: ['庚', '戊', '庚', '庚'], 支: ['午', '辰', '午', '申'], 性别: '男' });
  const pick = (r: HepanReport, n: string) => r.项目.find(x => x.立项 === n)?.观察 || '';

  const A = analyzeHepan({ 我: 子, 对方: 丑 }), B = analyzeHepan({ 我: 丑, 对方: 子 });
  ok('engine/he-both-directions', ['年支对照', '日支对照'].every(n =>
    pick(A, n).includes('六合') && pick(B, n).includes('六合')),
    `子/丑互为六合，两个人称本都必须报出六合（只在 a→b 方向查表的话，反过来就变成"无关系"，而这句话会直接上屏）：${pick(A, '年支对照')} ／ ${pick(B, '年支对照')}`);
  const C = analyzeHepan({ 我: 子, 对方: 午 });
  ok('engine/chong-named', pick(C, '年支对照').includes('六冲') && pick(C, '日主相待').includes('天干相克'),
    `子/午六冲、甲/庚相克这两类"不好看"的关系也必须照报，不许因为站点不判吉凶就把它们洗成"无关系"：${pick(C, '年支对照')} ／ ${pick(C, '日主相待')}`);
  ok('engine/gan-he-named', pick(A, '日主相待').includes('天干合'),
    `甲/己是五合，日主相待这一条要写出"天干合"：${pick(A, '日主相待')}`);
  const 同 = analyzeHepan({ 我: 子, 对方: fake({ 干: ['甲', '丙', '甲', '戊'], 支: ['子', '寅', '子', '午'], 性别: '女' }) });
  ok('engine/tong-named', pick(同, '日主相待').includes('天干同'),
    `同为甲日主时写"天干同"（这一档在抽取前根本不存在，合盘才用得上）：${pick(同, '日主相待')}`);

  const 落点 = analyzeHepan({ 我: fake({ 干: ['甲', '丙', '甲', '戊'], 支: ['子', '寅', '子', '午'],
    十神: ['比肩', '食神', '比肩', '偏财'], 性别: '男' }), 对方: fake({ 干: ['甲', '丁', '甲', '庚'], 支: ['子', '卯', '子', '申'], 性别: '女' }) });
  const 十 = pick(落点, '对方日主在我盘里的位置');
  ok('engine/shishen-anchor-names-pillars', /年、日柱的天干也是这个十神/.test(十),
    `对方日主对应的十神要回指到我盘里同十神的那几柱（甲见甲=比肩，我盘年干、日干都是比肩 —— 落点写错或写成 undefined 柱，就是拿英文键索引了中文键的表）：${十}`);

  const 无 = analyzeHepan({ 我: { ...子, chart: { ...子.chart, bazi: { ...子.chart.bazi, siZhu: undefined } as never } as never }, 对方: 丑 });
  ok('engine/missing-sizhu-yields-nothing', 无.项目.length === 0 && 无.未出.length === 1 && 无.未出[0].includes('四柱'),
    `一方四柱不齐时八条都不许出（缺输入就空着，靠默认值补出来的"甲子"也是编的）：项目 ${无.项目.length} 条 / 未出 ${JSON.stringify(无.未出)}`);

  const 无纳音 = analyzeHepan({ 我: { ...子, chart: { ...子.chart, bazi: { ...子.chart.bazi, naYin: undefined } as never } as never }, 对方: 丑 });
  ok('engine/missing-nayin-skips-rule', !名字(无纳音).includes('年命纳音')
    && 无纳音.未出.some(l => l.includes('纳音')),
    `盘上没有 naYin 时这条要落到「没做的部分」，而不是拿表里查不到时的默认五行顶上（getNaYinWuXing 对未知输入有兜底分支，兜出来的"金"会被当成数据）：${JSON.stringify(名字(无纳音))}`);

  const 假纳音 = analyzeHepan({ 我: { ...子, chart: { ...子.chart, bazi: { ...子.chart.bazi, naYin: { ...子.chart.bazi.naYin, year: '不在表里的一名' } } as never } as never }, 对方: 丑 });
  ok('engine/unknown-nayin-not-defaulted', !名字(假纳音).includes('年命纳音'),
    `纳音名读不出五行时整条不出：表里没有的一律不当成数据（兜底分支返回"金"，于是两个查不到的纳音会被报成"同为金、天地同气"）：${JSON.stringify(名字(假纳音))}`);

  const 无五行 = analyzeHepan({ 我: { ...子, 五行统计: undefined }, 对方: 丑 });
  ok('engine/missing-wuxing-skip-not-zero', !名字(无五行).includes('五行数量并排')
    && 无五行.未出.some(l => l.includes('五行')),
    `一侧算不出五行统计时要整条不出，不能把 undefined 报成 0（"我缺水"就是这么被造出来的）：${JSON.stringify(名字(无五行))}`);

  const 宫 = analyzeHepan({ 我: { ...子, chart: { ...子.chart, ziwei: undefined } as never }, 对方: 丑 });
  ok('engine/missing-ziwei-skip', !名字(宫).includes('我盘夫妻宫 × 对方命宫')
    && 宫.未出.some(l => l.includes('紫微')),
    `紫微那一条没有宫位时落到「没做的部分」（undefined 索引在 try 之外，靠 Optional Chaining 兜住不等于这条出得来）：${JSON.stringify(名字(宫))}`);
}

// ── 5. 本机存放：同意门控 + TTL + 清除 ──
{
  const mem = () => { const m = new Map<string, string>(); return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    _size: () => m.size, _has: (k: string) => m.has(k) }; };
  const ss = mem(), ls = mem();
  const g = globalThis as Record<string, unknown>;
  g.sessionStorage = ss; g.localStorage = ls;
  const realNow = Date.now;
  const draft = (over: Partial<PartnerDraft> = {}): PartnerDraft =>
    ({ 称呼: '阿明', 性别: '男', year: '1990', month: '2', day: '3', hour: '07', minute: '30',
      isLunar: false, isLeapMonth: false, 省份: '北京', 城市: '北京', savedAt: 0, ...over });

  clearPartner();
  ok('store/clear-both', ss._size() === 0 && ls._size() === 0, `清除要两个存储一起清：session ${ss._size()} 条 / local ${ls._size()} 条`);
  ok('store/load-empty', loadPartner() === null, '空存储读出来是 null，不是空对象（空对象会一路走到排盘并抛错）');

  savePartner(draft(), false);
  ok('store/no-persist-leaves-local-alone', ss._has(HEPAN_STORE_KEY) && !ls._has(HEPAN_STORE_KEY),
    `不勾留存时 localStorage 一个字都不写（对方生辰默认不保存，"只在本标签页"必须是存储层的事实）：session ${ss._has(HEPAN_STORE_KEY)} / local ${ls._has(HEPAN_STORE_KEY)}`);
  ok('store/session-reads-back', loadPartner()?.year === '1990', '本会话内读得回来（否则填一次刷一次就没了）');

  savePartner(draft(), true);
  ok('store/persist-writes-local', ls._has(HEPAN_STORE_KEY) && isPersisted(),
    `勾了留存才写 localStorage，且 isPersisted 如实反映（页面那句"存在这台设备上"靠它，不能靠用户勾了什么显示什么）`);

  // 关掉标签页（session 没了）之后长期那份仍要读得到，并且带着时间戳。
  ss.removeItem(HEPAN_STORE_KEY);
  ok('store/falls-back-to-local', loadPartner()?.称呼 === '阿明', '本会话没有时回落到本机长期那份');

  // 把时间往前拨过 TTL，同一条记录必须当场作废并被删掉。
  Date.now = () => realNow() + HEPAN_TTL_MS + 60_000;
  const 过期 = loadPartner();
  Date.now = realNow;
  ok('store/ttl-self-expires', 过期 === null && !ls._has(HEPAN_STORE_KEY),
    `超过 ${HEPAN_TTL_MS / 86400000} 天自动作废，而且是读到就删（只判不删会留一份没人认领的别人生日在磁盘上）：读到 ${JSON.stringify(过期)} / 盘上残留 ${!ls._has(HEPAN_STORE_KEY) ? '无' : '有'}`);

  Date.now = () => realNow() + HEPAN_TTL_MS - 60_000;
  savePartner(draft(), true);
  Date.now = realNow;
  ss.removeItem(HEPAN_STORE_KEY);   // 让这一次读的是长期那份，而不是被 sessionStorage 抢先命中
  ok('store/inside-ttl-survives', loadPartner() !== null, 'TTL 之内照常读得到（反向对照：证明上面那条红是时间戳造成的，不是 parse 挂了）');

  savePartner({ ...draft(), year: '' } as PartnerDraft, true);
  ok('store/garbage-not-read-as-data', (() => { ss.removeItem(HEPAN_STORE_KEY); return loadPartner() === null; })(),
    '缺年/月/日的残档一律当没有（半条记录排出来的盘与没填在页面上长得一样，那才是最怕的一种错）');

  g.sessionStorage = undefined; g.localStorage = undefined;
  ok('store/absent-storage-degrades', loadPartner() === null,
    '没有 window.storage（SSR / 隐私模式 / 老浏览器）时读为 null 而不是抛错 —— 这一节是无条件挂载的，抛错会把整页拖没了');
}

// ── 6. 隐私边界：字面扫描（剥注释后）──
{
  const files = ['frontend/lib/hepan/types.ts', 'frontend/lib/hepan/engine.ts', 'frontend/lib/hepan/local-store.ts',
    'frontend/components/chart/HepanSection.tsx'];
  const NET = /\bfetch\s*\(|XMLHttpRequest|axios|sendBeacon|new\s+EventSource|WebSocket|navigator\.geolocation/;
  const netHit = files.flatMap(f => {
    const t = strip(readFileSync(join(ROOT, f), 'utf8'));
    return (t.match(new RegExp(NET.source, 'g')) || []).map(m => `${f}: ${m}`);
  });
  ok('privacy/no-network-in-hepan', netHit.length === 0,
    `合盘这四个文件剥掉注释之后必须一处网络调用都没有（对方生辰不进 API 靠的是这里根本没有发请求的代码，不是"忘了发"）：命中 ${netHit.join(' | ') || '0 处'}`);

  const sec = readFileSync(join(ROOT, 'frontend/components/chart/HepanSection.tsx'), 'utf8');
  const secCode = strip(sec);
  const leaky = ['saveReport', 'trackEvent', 'apiCreateChart', '/api/', 'receipt', 'ledger', 'anchor']
    .filter(w => secCode.includes(w));
  ok('privacy/section-touches-no-persistence-api', leaky.length === 0,
    `结果页那一节不许碰报告/埋点/回执/台账任何一条通道：命中 ${leaky.join('、') || '无'}`);
  ok('privacy/section-never-calls-storage-api-directly',
    !/(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem)/.test(secCode),
    `这一节不许绕过 local-store 直接读写存储（TTL 与同意门控都在那一层，绕过它就绕过门）；注意"存在 localStorage 里"这种给用户看的说明文字是合法的，所以这里匹配的是调用形状不是词：${(secCode.match(/(localStorage|sessionStorage)\s*\.\s*\w+/g) || []).join(' | ') || '无直接调用'}`);

  const create = strip(readFileSync(join(ROOT, 'frontend/app/create/page.tsx'), 'utf8'));
  const callAt = create.indexOf('const res = await apiCreateChart({');
  const callEnd = callAt < 0 ? -1 : create.indexOf('});', callAt) + 3;
  const payload = callEnd > 2 ? create.slice(callAt, callEnd) : '';
  const leakedKeys = (payload.match(/[A-Za-z_]*[Pp]artner[A-Za-z_]*/g) || []);
  ok('privacy/partner-never-in-create-payload', callAt > 0 && payload.length > 40 && leakedKeys.length === 0,
    `建盘页 POST 给后端的那一个请求体对象里，一个 partner 字段都不许出现（这是裁定"只喂合盘本机计算、不进现有 API"的字面形态）：${payload ? `命中 ${leakedKeys.join('、') || '0 处'}` : '定位失败'}`);
  const consentAt = create.indexOf('form.partnerConsent');
  const saveAt = create.indexOf('savePartner(', consentAt);
  ok('privacy/consent-gates-the-write-before-it', consentAt > 0 && saveAt > consentAt,
    `同意检查必须排在 savePartner 之前（门在后头等于没门）：检查@${consentAt} 写入@${saveAt}`);
  ok('privacy/single-tab-submit-clears-partner', /else\s*\{[\s\S]{0,200}?clearPartner\(\)/.test(create),
    '从单人 tab 提交时要把上一次的对方数据清掉，否则结果页会拿旧对象跟新盘并排，而用户以为填的是同一次');
  ok('privacy/no-dead-partner-fields', !/partnerCurrent/.test(create),
    '对方"现居之地"那四个字段收了没有任何地方读，本批接管时一并删掉（不留第二个"收了就丢"的字段）');
  // 勾了"留存"不等于存下来了：无痕模式下 setItem 会抛，而 local-store 把异常吞了（不能让这一节崩）。
  // 所以那句状态必须来自 isPersisted() 的实测，不是来自复选框。
  ok('privacy/persist-status-reads-reality',
    /function onSubmit[\s\S]*?savePartner\([\s\S]*?isPersisted\(\)/.test(secCode)
    && !/已存 &&[\s\S]{0,80}留存 \?/.test(sec),
    `勾了留存但设备没让写时，页面不能说"存在这台设备上"（这一句是用户决定要不要清场的唯一依据）：onSubmit 里读 isPersisted=${/function onSubmit[\s\S]*?isPersisted\(\)/.test(secCode) ? '是' : '否'}`);

  const result = readFileSync(join(ROOT, 'frontend/app/chart/result/[id]/page.tsx'), 'utf8');
  const saveCall = result.slice(result.indexOf('saveReport({'), result.indexOf('saveReport({') + 900);
  ok('privacy/report-save-does-not-mention-hepan', !/hepan|合盘|partner/i.test(saveCall),
    `报告保存里不许出现合盘任何输入（报告是要落库的，对方生辰不落）：${saveCall.includes('hepan') || saveCall.includes('partner') ? '命中' : '未命中'}`);
}

// ── 7. 目录与入口：这一节"内嵌不新增入口"，但目录必须诚实说它做了 ──
{
  const t = TOOL_BY_SLUG['hepan'];
  ok('catalog/hepan-open', t.status !== '未开放' && t.href === '/create',
    `合盘条目现在应带入口且只指向 /create（裁定：结果页内嵌一节，不新增路由）：status ${t.status} / href ${t.href}`);
  ok('catalog/hepan-stamp-in-basis', t.basis.includes(HEPAN_BASIS) && CATALOG_STAMPS.hepan === HEPAN_BASIS,
    `目录里的口径戳 ${CATALOG_STAMPS.hepan} 必须逐字等于引擎常量 ${HEPAN_BASIS}（引擎改戳而目录没跟上，dir/stamps-equal-engine 也会红，这里再钉一次是因为合盘的戳只出现在这一条）`);
  ok('catalog/hepan-declares-no-score', t.note.includes('不出合盘评分') && t.note.includes('自研 · 非还原')
    && t.note.includes('不进 API'),
    `目录那条要当场写明三件事：不出评分、整节自研非还原、对方生辰不进 API。读者是在目录页做决定的，不是在结果页：${t.note}`);
  ok('catalog/hepan-declares-consent', t.method.includes('同意'),
    `方法段要写清"勾了同意才存"，让同意这件事在进来之前就被看到：${t.method}`);
  const dupName = INTENTS.flatMap(g => g.tools).filter(x => x.name.includes('合盘')).map(x => x.slug);
  ok('catalog/he-hepan-names-distinguished', dupName.join(',').includes('hepan') && dupName.join(',').includes('xingming'),
    `「合盘」与「姓名合盘」都含"合盘"三字，一个可用一个未做，套件里引用"未开放的那个"必须写 slug 不能写名字（写名字迟早指错条目）：${dupName.join(' / ')}`);

  const CATALOG = INTENTS.flatMap(g => g.tools);
  const base = (o: Partial<AssistantRouteResult>): AssistantRouteResult => ({
    mode: 'oriental', toolSlug: null, confidence: 0.9, needsClarification: false,
    clarification: null, missingFields: [], available: false, ...o,
  });
  const r = reconcile(base(routeLocal('oriental', '帮我合盘看一下', CATALOG, [])), 'oriental', CATALOG);
  ok('router/hepan-now-routable', r.toolSlug === 'hepan' && r.available,
    `问"合盘"应当路由到 hepan 并给入口（开放之前这条是红的，现在反过来钉：不许悄悄退回"没这个工具"）：${JSON.stringify({ s: r.toolSlug, a: r.available })}`);
  const closedOne = reconcile(base({ toolSlug: 'xingming', available: true }), 'oriental', CATALOG);
  ok('router/name-hepan-still-closed', closedOne.toolSlug === null,
    '同名的「姓名合盘」仍未开放，不许因为 slug 里都含"合盘"就跟着开门（开门是按 slug，不是按名字）');
}

const summary = `hepan acceptance: items=${报告.项目.length} basis=${报告.口径戳} pass=${pass} fail=${fail}`
  + (fails.length ? `  未过：${fails.join(' , ')}` : '');
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
if (fails.length) { console.log(lines.filter(l => l.startsWith('FAIL')).join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
