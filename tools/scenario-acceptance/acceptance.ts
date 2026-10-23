// 场景矩阵验收（#40）。这一层唯一要守的是「说的每句话都能回指到盘里或底本里」，
// 所以断言全部围绕四件事：行数与命名等于批复、引文是 docs/classics 的连续子串、
// 判词一个都不上页面、输出里没有数值字段（不评分）。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/scenario-acceptance/acceptance.ts --out=.scenario.txt
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// 2026-10-21 裁定：任何拿产品源码文本做判定的闸门先剥注释（共享件 tools/_lib/codesrc.ts）。
import { stripComments } from '../_lib/codesrc';
import { unvettedDeps, unpinned } from '../_lib/vettedDeps';
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import type { BaziChart } from '../../frontend/app/lib/core/yiqi-core/types';
import { buildScenarios, PALACE_SOURCE, PALACE_MAP, SCENARIO_BASIS, CONVENTION_NOTE } from '../../frontend/lib/bazi/scenarios';
import type { ScenarioRow } from '../../frontend/lib/bazi/scenarios';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.scenario.txt';
const ROOT = join(__dirname, '../..');
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

// ── 底本语料：docs/classics **含其子目录**里所有 markdown 拼起来，引文比对只认它 ──
// 批H 起西方底本放在 docs/classics/western/。原来这里用非递归的 readdirSync，多一层目录就会
// 安静地少读一整个域 —— 表现是"引文未命中"，红得很有说服力，而坏的是量具。
// README.md 是规则说明、不是底本，从语料里排掉（它里面确实抄着几句原文当例子）。
const CLASSICS_DIR = join(ROOT, 'docs', 'classics');
/** 期望的**底本**份数：东方三份 + 批H 西方打样一份。加一篇底本就把这个数字一起改。 */
const EXPECT_BASES = 4;
function walkBases(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return walkBases(p);
    return d.name.endsWith('.md') && d.name !== 'README.md' ? [p] : [];
  });
}
const classicsFiles = walkBases(CLASSICS_DIR);
const corpus = classicsFiles.map(f => readFileSync(f, 'utf8')).join('\n');
ok('classics/present', classicsFiles.length === EXPECT_BASES && corpus.length > 3000,
  `docs/classics（含子目录）必须恰好 ${EXPECT_BASES} 份底本且正文够长（比对底本不能是空壳）：实得 ${classicsFiles.length} 份 / ${corpus.length} 字（${classicsFiles.map(f => f.slice(CLASSICS_DIR.length + 1)).join('、')}）`);

// ── 两张真盘：男、女各一张。矩阵里唯一按性别分叉的是婚姻与恋爱行，必须两路都跑到 ──
const birth = (gender: 'male' | 'female') => (createChart({
  year: 1988, month: 3, day: 15, hour: 22, minute: 40,
  isLunar: false, gender, timeZone: 8,
} as never) as never as { bazi: BaziChart }).bazi;
const maleChart = birth('male');
const femaleChart = birth('female');
const male = buildScenarios(maleChart);
const female = buildScenarios(femaleChart);

const WANT = ['自己', '日常', '父母', '兄弟姐妹与朋友', '恋爱', '婚姻', '子女',
  '亲子（我为人子女）', '亲子（我为人父母）', '共事合作', '上下级'];

function siZhuOk(s: Record<string, { gan: string; zhi: string } | undefined>) {
  return ['year', 'month', 'day', 'hour'].every(p => !!s[p]?.gan && !!s[p]?.zhi);
}

// ── 1. 行数与命名 = 批复的 11 项，顺序即页面顺序 ──
{
  const got = male.map(r => r.场景);
  ok('scen/eleven-rows', got.length === WANT.length && JSON.stringify(got) === JSON.stringify(WANT),
    `11 行、名称与顺序必须等于批复清单（顺序就是页面顺序）：实得 ${got.join('、')}`);
  ok('scen/female-same-shape', JSON.stringify(female.map(r => r.场景)) === JSON.stringify(WANT),
    '女命盘同样出满 11 行（性别只改婚姻/恋爱的取用星，不该少行）');
}

// ── 2. 性质三档与配比：有出处 6 / 体系定义 1 / 本站约定 4 ──
{
  const kinds = male.map(r => r.性质);
  const bad = kinds.filter(k => !['有出处', '体系定义', '本站约定'].includes(k));
  const n = (k: string) => kinds.filter(x => x === k).length;
  ok('scen/source-kinds', bad.length === 0 && n('有出处') === 6 && n('体系定义') === 1 && n('本站约定') === 4,
    `性质只许三档，且配比 = 有出处 6 / 体系定义 1 / 本站约定 4（裁定 3 与 5）：实得 ${n('有出处')}/${n('体系定义')}/${n('本站约定')}${bad.length ? '，非法值 ' + bad.join(',') : ''}`);
  const conv = male.filter(r => r.性质 === '本站约定');
  const missing = conv.filter(r => !r.依据.includes(CONVENTION_NOTE)).map(r => r.场景);
  ok('scen/convention-labelled', conv.length === 4 && missing.length === 0,
    `四条约定行都要自带「${CONVENTION_NOTE}」：缺 ${missing.join('、') || '0 条'}`);
  const leaked = male.filter(r => r.性质 !== '本站约定' && r.依据.includes(CONVENTION_NOTE)).map(r => r.场景);
  ok('scen/convention-not-overclaimed', leaked.length === 0,
    '有出处／体系定义的行不许挂"本站约定"—— 挂了就是把自己挣来的依据让给古籍，或反过来替古籍认账：违规 ' + (leaked.join('、') || '0 条'));
}

// ── 3. 引文逐字：必须是底本的连续子串；判词一律不上页面 ──
{
  const quotes = male.flatMap(r => r.引文.map(q => [r.场景, q] as const));
  const notFound = quotes.filter(([, q]) => !corpus.includes(q)).map(([s, q]) => `${s}：${q}`);
  ok('quote/substring-of-classics', quotes.length >= 6 && notFound.length === 0,
    `页面上每一条「原文：…」都必须是 docs/classics 某份底本的连续子串，差一字即红：共 ${quotes.length} 条，未命中 ${notFound.length} 条${notFound.length ? ' → ' + notFound.join(' | ') : ''}`);
  const srcOk = male.filter(r => r.性质 === '有出处').every(r => r.引文.length > 0 && r.出处.length > 0);
  ok('quote/sourced-rows-carry-both', srcOk,
    '有出处的每一行既要给逐字引文、又要给底本路径（只给结论不给出处，等于让读者无从复核）');

  // 裁定 9：断语不入页面、不入断言文案。这些短语只在底本上下文里存在。
  const VERDICT = ['父母不全', '兄弟不完', '妻妾不完', '子息无传', '子息凶頑', '妻妾不賢',
    '夫貴而吉', '子貴而清', '椿萱並茂', '父命悠長', '母年早喪', '棄子離妻', '妻遲子晚'];
  const rendered = (r: ScenarioRow) => [r.场景, r.宫位, r.性质, r.依据, r.引文.join(''), r.出处.join(''),
    r.命中.join(''), r.不见.join(''), r.宫位关系.join(''), r.岁运.join(''),
    r.并存.map(s => s.说法 + s.引文).join('')].join('\u0000');
  const dirty = male.flatMap(r => VERDICT.filter(v => rendered(r).includes(v)).map(v => `${r.场景} 含「${v}」`));
  ok('quote/no-verdict-words', dirty.length === 0,
    `矩阵渲染的每一个字段都不许出现原典判词（${VERDICT.slice(0, 5).join('、')} 等 ${VERDICT.length} 个）—— 那是别人的吉凶结论：命中 ${dirty.join(' | ') || '0 处'}`);
  const compSrc = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'ScenarioMatrix.tsx'), 'utf8'));
  const compDirty = VERDICT.filter(v => compSrc.includes(v));
  ok('quote/no-verdict-in-component', compDirty.length === 0,
    `组件里写死的说明文字同样不许出现判词：命中 ${compDirty.join('、') || '0 个'}`);
  ok('quote/palace-source-pinned', corpus.includes(PALACE_SOURCE.渊海子平) && corpus.includes(PALACE_SOURCE.三命通会) &&
    !male.some(r => r.引文.includes(PALACE_SOURCE.渊海子平) || r.引文.includes(PALACE_SOURCE.三命通会)),
    '宫分两句必须逐字在底本里（出处凭据），但不得作为引文上页面 —— 它们整句都是判词');
  ok('quote/palace-map-wording', PALACE_MAP.includes('年柱管父母') && PALACE_MAP.includes('月柱管兄弟')
    && PALACE_MAP.includes('日柱管配偶') && PALACE_MAP.includes('时柱管子女') && !/不全|不完|凶頑|不賢/.test(PALACE_MAP),
    `页面用的是自己的话：${PALACE_MAP}`);
}

// ── 4. 不评分：整棵树里不许有数值字段（年份是日历事实，必须待在字符串里） ──
{
  const numHits: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === 'number') numHits.push(`${path}.${k}=${x}`);
        else walk(x, `${path}.${k}`);
      }
    }
  };
  male.forEach((r, i) => walk(r, `行${i}(${r.场景})`));
  ok('scen/no-numeric-fields', numHits.length === 0,
    `输出对象任何一层都不得有数值字段（评分、权重、计数都不行；岁运年份要嵌在字符串里）：命中 ${numHits.slice(0, 6).join(' | ') || '0 处'}`);
  const luckRows = male.filter(r => r.岁运.length > 0);
  ok('scen/years-live-in-strings', luckRows.length > 0 && luckRows.every(r => r.岁运.every(s => /\d{4}–\d{4}/.test(s))),
    `岁运是日历事实、允许出现，但只能在字符串里（${luckRows.length} 行有岁运）：样例 ${luckRows[0]?.岁运[0] || '（无）'}`);
}

// ── 5. 每行回指盘内证据；盘中无此星就明说 ──
{
  const hits = male.filter(r => r.取用星.length > 0);
  const empty = hits.filter(r => r.命中.length === 0);
  ok('scen/rows-point-at-plate', hits.every(r => r.命中.length > 0 || r.不见.length > 0),
    `凡取星的行都必须给出"命中"或"不见"其一（什么都不说就是漏报）：${hits.length} 行取星，其中 ${empty.length} 行盘中无命中`);
  // 独立复算：命中条目里的星必须真在四柱天干或藏干里，不能是模块自己声称的。
  const siZhu = maleChart.siZhu;
  const cangGan = maleChart.cangGan;
  // 藏干十神的真字段名是 shiShen（yiqi-core/bazi.ts:74 产出，types.ts 已随裁定 ① 改对）。
  // 复算这一侧仍两种键名都收：断言必须比被测对象宽一档，否则产品读错键的同时断言也瞎，
  // 两条一起绿就等于没测。收紧的那一条是下面的 cangGan-declaration-honest（读声明原文）。
  const godOf = (c: any) => c?.shiShen ?? c?.tenGod;
  const present = new Set<string>();
  const 藏干应在盘里的 = new Map<string, number>();
  for (const p of ['year', 'month', 'day', 'hour']) {
    for (const c of cangGan?.[p] ?? []) {
      const g = godOf(c);
      if (!g) continue;
      present.add(g);
      藏干应在盘里的.set(g, (藏干应在盘里的.get(g) || 0) + 1);
    }
  }
  const shiShen = maleChart.shiShen;
  Object.values(shiShen).forEach(s => s && present.add(s as string));
  const bogus = male.flatMap(r => r.命中.filter(h => !present.has(h.split('·')[0])));
  ok('scen/hits-recompute', bogus.length === 0,
    `每条"命中"的十神都要能在盘里独立复算到（天干或藏干），不能模块说有几颗就有几颗：可疑 ${bogus.join(' | ') || '0 条'}；盘内实际出现的十神 ${[...present].join('、')}`);
  // 牙齿断言 ①：字段名读错时"天干命中"照样正常，只有藏干这一路静默归零 —— 上面那条抓不到，
  // 因为归零后的命中条目仍然条条属实。所以这里直接数渲染出的"藏干"条目，与盘里独立复算出来的
  // 应有条目数对齐（同一颗星在几柱藏干里出现，就该报几次）。
  const renderedCang = male.flatMap(r => r.命中).filter(h => h.includes('藏干'));
  // 按行累加：同一颗星被两行各取一次，就该各报一次，所以不能全局去重后再数。
  const 应报 = male.reduce((n, r) =>
    n + (r.取用星 as string[]).reduce((m, g) => m + (藏干应在盘里的.get(g) || 0), 0), 0);
  ok('scen/cangGan-hits-render', renderedCang.length === 应报 && 应报 > 0,
    `藏干这一路必须真报出来：盘内属于取用集的藏干 ${应报} 处，页面渲染 ${renderedCang.length} 条${renderedCang.length === 0 ? '（0 条通常是字段名读错：引擎给 shiShen，types 里写的 tenGod 并不存在）' : ''}`);
  // 牙齿断言 ②：确认引擎对象里根本没有 tenGod 这个键 —— 这条一红就说明有人在用假字段名糊断言。
  const anyTenGodKey = ['year', 'month', 'day', 'hour'].some(p =>
    (cangGan?.[p] ?? []).some((c: any) => 'tenGod' in c));
  ok('scen/cangGan-field-is-shiShen', !anyTenGodKey,
    `引擎藏干的十神键名实测为 shiShen（有 tenGod 的盘 = ${anyTenGodKey}）：断言只看运行时对象，不看声明`);
  // 声明侧也钉住：裁定 ① 要求「把声明改对，不许只在 consumer 绕」。这里直接读那份 types.ts，
  // 藏干那一行若再出现 tenGod 就红 —— 否则下一个 consumer 照旧会被假字段引进同一个坑。
  const decl = readFileSync(join(ROOT, 'frontend', 'app', 'lib', 'core', 'yiqi-core', 'types.ts'), 'utf8');
  // 先剥注释再扫字样：types.ts 里正当写着「原声明写作 tenGod?」这段历史，不剥就会
  // 被自己的说明文字咬住（这条坑本项目已经踩过四次，扫描类断言一律先 codeOf）。
  const declCode = stripComments(decl);
  // cgLine 也一律从剥过注释的这份里抠：注释里抄的那一行声明不能替"声明还在"作证。
  const cgLine = (declCode.match(/cangGan\?:[^\n]*/) || [''])[0];
  ok('scen/cangGan-declaration-honest',
    /tenGod/.test(declCode) === false && /CangGanItem/.test(cgLine),
    `types.ts 里藏干的声明必须与产出方一致：实得「${cgLine.slice(0, 84)}」，代码里不再出现 tenGod=${!/tenGod/.test(declCode)}`);
  // 前提断言：真盘上矩阵必须真的报出东西。命中/岁运全为 0 时其余断言会空过 ——
  // 上一批「空结果静默通过」的老坑，这次先堵在这里。
  const totalHits = male.reduce((n, r) => n + r.命中.length, 0);
  const withLuck = male.filter(r => r.岁运.length > 0);
  ok('scen/matrix-is-populated', totalHits > 0 && withLuck.length > 0 && siZhuOk(siZhu),
    `前提：真盘上命中数与岁运行数都不能是 0（是 0 多半喂错了对象，ChartResult 与 BaziChart 差一层 bazi）：命中 ${totalHits} 条 / 有岁运 ${withLuck.length} 行`);
  ok('scen/plate-is-real', siZhuOk(siZhu) && siZhuOk(femaleChart.siZhu),
    `两张盘都是引擎真算出来的（四柱齐备）：男盘 ${['year', 'month', 'day', 'hour'].map(p => siZhu[p].gan + siZhu[p].zhi).join(' ')} / 女盘 ${['year', 'month', 'day', 'hour'].map(p => femaleChart.siZhu[p].gan + femaleChart.siZhu[p].zhi).join(' ')}`);
  const noPalace = male.filter(r => !r.宫位);
  ok('scen/every-row-has-palace', noPalace.length === 0, `每行都要指明看哪一宫：缺 ${noPalace.length} 行`);
}

// ── 6. 两说并存：子女行不裁决、活法句不当规则 ──
{
  const kid = male.find(r => r.场景 === '子女')!;
  const back = male.find(r => r.场景 === '亲子（我为人父母）')!;
  ok('scen/two-sayings', kid.并存.length === 2 && kid.并存.every(s => !!s.引文 && corpus.includes(s.引文)) &&
    kid.依据.includes('不裁决'),
    `子女行必须两说并列、各有逐字引文、并明写不裁决：实得 ${kid.并存.map(s => s.说法).join(' ／ ')}`);
  const biased = ['应以', '当以', '正确的是', '为准', '更合理', '男命看', '女命看'];
  const hitsBias = [kid, back].flatMap(r => biased.filter(w => (r.依据 + r.并存.map(s => s.说法).join('')).includes(w)).map(w => `${r.场景}：「${w}」`));
  ok('scen/no-bias-words', hitsBias.length === 0,
    `并存处不许有倾向措辞，也不许替两说分派性别（原文没这么分）：命中 ${hitsBias.join(' | ') || '0 处'}`);
  ok('scen/huofa-not-rule', kid.依据.includes('活法') && kid.依据.includes('不把它当规则'),
    '原注里的"活法"要明说是变通说法、本站不用作规则：' + (kid.依据.includes('活法') ? '已写明' : '未写明'));
  const marriage = male.find(r => r.场景 === '婚姻')!;
  const marriageF = female.find(r => r.场景 === '婚姻')!;
  ok('scen/gender-only-marriage', JSON.stringify(marriage.取用星) !== JSON.stringify(marriageF.取用星) &&
    JSON.stringify(male.filter(r => r.场景 !== '婚姻' && r.场景 !== '恋爱').map(r => r.取用星)) ===
    JSON.stringify(female.filter(r => r.场景 !== '婚姻' && r.场景 !== '恋爱').map(r => r.取用星)),
    `性别只能改婚姻与恋爱两行：男 婚姻=${marriage.取用星.join('/')}，女 婚姻=${marriageF.取用星.join('/')}`);
  ok('scen/no-shishen-for-self', (male.find(r => r.场景 === '自己')!.取用星.length === 0) &&
    !male.some(r => r.依据.includes('喜神') && r.性质 !== '体系定义' && !r.依据.includes('尚未裁决')),
    '「自己」行不取星（裁定 3：喜神／用神体系尚未裁决，不得暗引）');
}

// ── 7. 依赖与边界：只 import 引擎、不新增路由/入口、不碰 server、无盘降级 ──
{
  const mod = stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'bazi', 'scenarios.ts'), 'utf8'));
  const imports = [...mod.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]);
  const outside = imports.filter(i => !i.startsWith('@/app/lib/core') && !i.startsWith('./') && !i.startsWith('../'));
  ok('dep/engine-only', outside.length === 0,
    `矩阵模块只许 import 引擎与 enrichBazi（@/app/lib/core/*）：多出 ${outside.join('、') || '无'}`);
  ok('dep/no-network', !/fetch\(|XMLHttpRequest|axios|api\//.test(mod),
    '这一层完全不联网（盘从页面传进来）');
  const comp = stripComments(readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'ScenarioMatrix.tsx'), 'utf8'));
  ok('dep/component-lean', !/fetch\(|api\//.test(comp) && /buildScenarios/.test(comp),
    '组件只渲染，不取数、不算命');
  const pkg = JSON.parse(readFileSync(join(ROOT, 'frontend', 'package.json'), 'utf8'));
  const basePkg = JSON.parse(execSync('git show origin/main:frontend/package.json',
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }));
  const keysOf = (o: { dependencies?: object; devDependencies?: object }) =>
    Object.keys({ ...o.dependencies, ...o.devDependencies }).sort();
  // 2026-10-20：three/@types/three 经批准引入（户型 WebGL 舞台）。
  // 2026-10-23 裁定①（E2）：批准 astronomy-engine 的最小面，进**钉版本**那一类 ——
  // 名字放行之外还要当场验精确版本，因为西方那条对拍的可复现性挂在这行版本号上
  // （飘一个补丁版就可能飘过 0.02° 的公差）。两份名单都在 tools/_lib/vettedDeps.ts，
  // 不在这里各写一遍（三处各抄一份迟早有一份漏改）。
  const added = unvettedDeps(keysOf(pkg), keysOf(basePkg));
  ok('dep/no-new-package', added.length === 0,
    `本批零新依赖：与 origin/main 的 package.json 键集逐字比，新增项必须为 0（比关键词靠谱 —— lunar-typescript 本来就在）：实得新增 ${added.join('、') || '无'}`);
  const pinnedWrong = unpinned(pkg.dependencies);
  ok('dep/vetted-deps-stay-pinned', pinnedWrong.length === 0,
    `裁定过的依赖必须按精确版本钉着（不许 ^ ~ 或改版）：不符 ${pinnedWrong.join('、') || '无'}`);
  const routes = existsSync(join(ROOT, 'frontend', 'app', 'scenarios')) || existsSync(join(ROOT, 'frontend', 'app', 'bazi'));
  ok('route/no-new-page', !routes, '不新增路由：矩阵是结果页里的一节，不是新页面');
  const mounted = stripComments(readFileSync(join(ROOT, 'frontend', 'app', 'chart', 'result', '[id]', 'page.tsx'), 'utf8'));
  ok('route/mounted-on-result', /<ScenarioMatrix chart=\{enrichedChartData\.bazi\} \/>/.test(mounted),
    '矩阵挂在命盘结果页，且是无条件挂载 —— 降级话术由组件自己给，不在页面里条件渲染（整节消失＝用户以为没这功能）');
  // 裁定 6：无盘降级 = 说明 + /create 入口，不预置示例盘。这条钉三件事：
  // 有降级分支、分支里给了去排盘的路、分支在 buildScenarios 之前 return（拿不到盘就不许造一行）。
  const compFull = readFileSync(join(ROOT, 'frontend', 'components', 'bazi', 'ScenarioMatrix.tsx'), 'utf8');
  const codeOnly = stripComments(compFull);
  const guardAt = codeOnly.search(/if\s*\(\s*!chart\?\.siZhu/);
  const buildAt = codeOnly.search(/buildScenarios\(/);
  ok('degrade/branch-exists', guardAt >= 0 && buildAt >= 0 && guardAt < buildAt,
    `组件必须在读盘之前分支出去：守卫@${guardAt} 生成@${buildAt}（守卫缺失或排在后面 = 拿着半张盘照样出 11 行）`);
  ok('degrade/points-at-create', guardAt >= 0 && /href="\/create"/.test(codeOnly.slice(guardAt, buildAt)),
    '降级分支里必须有 /create 入口（只说"没有盘"不给路，等于把用户关在门外）');
  ok('degrade/no-sample-plate', guardAt >= 0 && /不预置示例盘/.test(codeOnly.slice(guardAt, buildAt)),
    '降级分支必须明写不预置示例盘 —— 拿别人的盘当"你的矩阵"是编数据');
  const home = stripComments(readFileSync(join(ROOT, 'frontend', 'app', 'page.tsx'), 'utf8'));
  ok('route/no-new-entry', !/场景矩阵/.test(home), '首页不新增入口（裁定 ③：不新增路由/入口）');
  const catalog = stripComments(readFileSync(join(ROOT, 'frontend', 'lib', 'tools', 'catalog.ts'), 'utf8'));
  ok('route/catalog-untouched', !/场景矩阵/.test(catalog),
    '目录页也未把它列成独立工具 —— 它是命盘的一个读法，不是一件新工具（等 (b) 上线后再议是否入目录）');
  ok('basis/stamp', SCENARIO_BASIS === 'liuqin-scenario-v1',
    `矩阵口径戳 ${SCENARIO_BASIS}：改取用表必须升它，否则老盘的截图无法区分`);
}

const summary = `scenario acceptance: rows=${male.length} quotes=${male.flatMap(r => r.引文).length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
