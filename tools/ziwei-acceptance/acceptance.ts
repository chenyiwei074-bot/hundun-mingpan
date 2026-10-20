// 紫微十二宫的消费者契约验收（既有缺陷批 P1-1）。
//
// 这个缺陷的形状不是"算错了"，是"查不到但不报错"：引擎产出的宫名除命宫外都不带"宫"
// （ziwei-standard.ts:22 GONG_NAMES = 命宫/兄弟/夫妻/…），而 yiqi-core/types.ts:154 的
// ZiweiGong 把十二个名字全声明成带"宫"。照声明写死的消费者 find 不到任何东西，页面照常渲染，
// 只是那一张卡再也不出现 —— ZiweiCard 就这么把五个重点宫位渲染成了一个命宫，
// 而"展开其余七宫"下面躺着十一个宫。
//
// 所以这里不测文案，测三件事：名字能不能命中真实盘、分区数对不对、
// 以及所有还在用带"宫"字面量的消费者有没有各自的兜底。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/ziwei-acceptance/acceptance.ts --out=.ziwei.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChart } from '../../frontend/app/lib/core/yiqi-core';
import { describeZiweiCaliber } from '../../frontend/lib/chart/ziwei-caliber';
import { KEY_GONGS } from '../../frontend/components/chart/ZiweiCard';

const ROOT = join(__dirname, '../..');
const FE = join(ROOT, 'frontend');
const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.ziwei.txt';
const lines: string[] = [];
let pass = 0; let fail = 0;
const fails: string[] = [];
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else { fail++; fails.push(id); }
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// 两张真盘：男女各一张，顺逆不同，十二宫的排法也不同。
const plate = (gender: 'male' | 'female') => (createChart({
  year: 1988, month: 7, day: 15, hour: 15, minute: 20,
  isLunar: false, gender, timeZone: 8, longitude: 116.4074, dstOffset: 1,
  enableTrueSolarTime: true,
} as never) as never as { ziwei: { gongs: Array<{ gong: string }> } }).ziwei.gongs;
const GONGS_M = plate('male');
const GONGS_F = plate('female');

// ── 1. KEY_GONGS 每一个名字都必须真的命中一盘上的宫 ──
{
  const missM = KEY_GONGS.filter(n => !GONGS_M.some(g => g.gong === n));
  const missF = KEY_GONGS.filter(n => !GONGS_F.some(g => g.gong === n));
  ok('zw/key-gongs-hit-real-plate', missM.length === 0 && missF.length === 0,
    `KEY_GONGS 里每一个名字都要在两张真实盘上都找得到宫（找不到的那张卡不会报错，它就是不会出现在页面上 —— 这条红过一次，红的方式是页面看着完全正常）：男盘缺 ${missM.join('、') || '无'} / 女盘缺 ${missF.join('、') || '无'}；引擎实产 ${GONGS_M.map(g => g.gong).join('/')}`);
  ok('zw/key-gongs-count', KEY_GONGS.length === 5 && new Set(KEY_GONGS).size === 5,
    `重点宫位固定五张且不许重名：${KEY_GONGS.length} 个 / 去重 ${new Set(KEY_GONGS).size}`);
}

// ── 2. 分区：5 + 7 = 12，不重不漏 ──
{
  for (const [标签, gongs] of [['男盘', GONGS_M], ['女盘', GONGS_F]] as const) {
    const key = KEY_GONGS.map(n => gongs.find(g => g.gong === n)).filter(Boolean);
    const other = gongs.filter(g => !KEY_GONGS.includes(g.gong));
    ok(`zw/partition-12-${标签}`, gongs.length === 12 && key.length === 5 && other.length === 7
      && new Set([...key.map(k => k!.gong), ...other.map(o => o.gong)]).size === 12,
      `${标签}：十二宫切成 5 张重点卡 + 7 个其余，两边不重不漏（"其余七宫"那个数字原本写死在文案里，而底下是十一个 —— 分区数必须由这份代码算出来）：盘 ${gongs.length} / 重点 ${key.length} / 其余 ${other.length}`);
  }
}

// ── 3. 文案里的宫数不许写死 ──
{
  const src = readFileSync(join(FE, 'components/chart/ZiweiCard.tsx'), 'utf8');
  const code = strip(src);
  const hardcoded = (code.match(/其余[一二三四五六七八九十两\d]+宫/g) || []);
  ok('zw/other-count-is-derived', hardcoded.length === 0 && /其余\$\{otherGongs\.length\}宫/.test(code),
    `"其余N宫"那个 N 必须现算，不许写成汉字或数字：写死的那一次正好就是分区变了而文案没变的那一次。残留写死 ${hardcoded.join('、') || '0 处'}`);
}

// ── 4. 其余消费者：用带「宫」的字面量必须有兜底 ──
// 引擎产出与 ZiweiGong 声明不同源这件事，本站现在有三个消费者仍按带"宫"的名字找宫
// （ChartOverview / DoubleVerify / ZiweiGongs），它们各自带了 replace('宫','') 的兜底所以是好的。
// 这条闸门不是要它们改名，是要"下一个消费者"不许既照声明写、又没有兜底。
{
  const files = ['components/chart/ChartOverview.tsx', 'components/chart/DoubleVerify.tsx',
    'components/ziwei/ZiweiGongs.tsx', 'components/chart/ZiweiCard.tsx'];
  const SUFFIXED = /['"](官禄|财帛|夫妻|福德|兄弟|子女|疾厄|迁移|交友|田宅|父母)宫['"]/;
  const bad = files.filter(f => {
    const code = strip(readFileSync(join(FE, f), 'utf8'));
    return SUFFIXED.test(code) && !/replace\(\s*['"]宫['"]\s*,\s*['"]{2}\s*\)/.test(code);
  });
  ok('zw/suffixed-lookups-have-fallback', bad.length === 0,
    `按带"宫"的字面量找宫的消费者，必须在同一文件里有去掉"宫"的兜底（没有兜底的那一个就是这次修掉的 ZiweiCard：卡不报错，只是少渲染四张）：违规 ${bad.join('、') || '0 个'}`);
  // 打出来给人看：这个不同源还在多少人身上靠兜底活着。哪天 types.ts 的声明被改对了，
  // 这几处兜底就该跟着一起清，否则它们是没人读的 dead 分支 —— 但那是另一次改动。
  const tolerant = files.filter(f => /replace\(\s*['"]宫['"]/.test(readFileSync(join(FE, f), 'utf8')));
  say(`MEASURED 声明与产出不 getSource 这件事目前由 ${tolerant.length} 个消费者的兜底扛着（${tolerant.join('、')}）；` +
    `ZiweiGong 的声明本身仍未改（算法层，本批不动），改它必须连这 ${tolerant.length} 处一起过一遍`);
}

// ── 5. 套件不许在自己这边再抄一份宫名表 ──
{
  const self = strip(readFileSync(__filename, 'utf8'));
  const copied = /const\s+(GONG_NAMES|ALL_GONGS)\s*=/.test(self);
  ok('zw/suite-does-not-copy-the-table', !copied,
    '本套件不另立一份十二宫表当"金标准"—— 那份表在这里也变成第二个产出方，引擎改名就测不出来了。所有断言都从真实盘的产出反推。');
}

// ── 6. D4/D5 口径披露（批4：只把差异写到盘上，安星一个输入都不许动）──
{
  const full = createChart({
    year: 1988, month: 7, day: 15, hour: 15, minute: 20,
    isLunar: false, gender: 'male', timeZone: 8, longitude: 116.4074, dstOffset: 1,
    enableTrueSolarTime: true,
  } as never) as never as {
    bazi?: { trueSolarTime?: { applied?: boolean; civilTime?: string; trueSolarTime?: string } };
    ziwei?: { birthInfo?: { year?: number } };
  };
  const real = describeZiweiCaliber(full);

  // 这条是这一节最值钱的一条：它喂的是引擎**真实产出**的那个对象。
  // 手写 fixture 永远过，而字段一旦改名（藏干 tenGod 那次就是），页面会静默少一整块。
  ok('cal/reads-the-real-plate', real.行.length >= 2
    && real.行.some(l => /钟表时刻/.test(l) && l.includes('15:20:00'))
    && real.行.some(l => /年界/.test(l) && l.includes('1988')),
    `直接喂 createChart 的产出：两行都在、钟表时刻与年份是从盘里读出来的（实得 ${real.行.length} 行：${real.行.join(' ⏎ ') || '（空）'}）—— 这条红说明字段名或层级变了，页面会安静地少一块`);

  const applied = describeZiweiCaliber({
    bazi: { trueSolarTime: { applied: true, civilTime: '15:20:00', trueSolarTime: '13:59:42' } },
  }).行[0];
  const notApplied = describeZiweiCaliber({
    bazi: { trueSolarTime: { applied: false, civilTime: '15:20:00', trueSolarTime: '15:20:00' } },
  }).行[0];
  const noTst = describeZiweiCaliber({ bazi: {} });
  ok('cal/two-plates-differ-is-asserted-only-when-it-might',
    /紫微按钟表时刻 15:20:00 安星/.test(applied) && /八字时柱按真太阳时 13:59:42/.test(applied)
    && /未做真太阳时校正/.test(applied),
    `校正过的盘要说清两盘各用哪个时刻：${applied}`);
  ok('cal/no-fork-claimed-when-not-corrected',
    /两盘在这一档上一致/.test(notApplied) && !/不同/.test(notApplied),
    `未校正时两盘用的是同一个时刻，不许照抄"两盘不同"那套措辞制造紧张：${notApplied}`);
  ok('cal/missing-field-degrades-loudly', noTst.行.length === 1
    && /无法核对/.test(noTst.行[0]) && !/15:20/.test(noTst.行[0]),
    `老盘没带 trueSolarTime 时只能承认读不到（实得「${noTst.行[0] || '（空）'}」）—— 不许拿一个看起来像结论的句子糊过去`);

  // 披露不许替用户下"这一盘确实跨了"的判语：那需要时辰边界/立春瞬时，是算法层的活。
  const allLines = [applied, notApplied, noTst.行[0], ...real.行];
  const verdict = /已跨时辰|已经跨|必然不同|一定不同|这一盘已分叉/.test(allLines.join(' '));
  ok('cal/states-rule-not-verdict', !verdict && /若这两个时刻落在不同时辰/.test(applied),
    '只报规则与条件（"若…则…"），不替这一张盘判定它到底跨没跨 —— 判了就等于在显示层重写一份时辰边界表');

  // 量出来的百分比属于那次采样，写进产品就成了过期数字。
  const mod = strip(readFileSync(join(FE, 'lib', 'chart', 'ziwei-caliber.ts'), 'utf8'));
  const card = strip(readFileSync(join(FE, 'components', 'chart', 'ZiweiCard.tsx'), 'utf8'));
  ok('cal/no-stale-sample-rates', !/41\.7|9\.7|590|6060/.test(mod + card),
    '采样比例只活在文档与 measure.ts 里：钉进产品文案就成了永远不再更新却一直在说的话');

  // 句子必须在数据层，组件只负责 map —— 同 #40 落点那条"从数据渲染"的钉法。
  ok('cal/wording-lives-in-the-module',
    /钟表时刻/.test(mod) && !/钟表时刻/.test(card) && /caliber\.行\.map/.test(card),
    '组件里不写死这些句子，只渲染 caliber.行 —— 否则改一句话要同时动两处，套件咬不住');

  // 最关键的反向闸门：这一批**只该**加披露，安星输入一个字都不许变。
  const eng = strip(readFileSync(join(FE, 'app', 'lib', 'core', 'yiqi-core', 'ziwei-standard.ts'), 'utf8'));
  ok('cal/ingest-still-untouched',
    /calculateMingGong\(lunarMonth, birthInfo\.hour\)/.test(eng)
    && /calculateShenGong\(lunarMonth, birthInfo\.hour\)/.test(eng)
    && /getYinYang\(birthInfo\.year/.test(eng),
    '命宫/身宫仍吃 birthInfo.hour、阴阳仍吃 birthInfo.year —— 这条红说明有人借"加披露"把安星输入改了，'
    + '那是要先有口径戳 + 老盘标注的独立一批，不是顺手');
}

const summary = `ziwei acceptance: plates=${GONGS_M.length}+${GONGS_F.length} key=${KEY_GONGS.join('/')} pass=${pass} fail=${fail}`
  + (fails.length ? `  未过：${fails.join(' , ')}` : '');
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
if (fails.length) { console.log(lines.filter(l => l.startsWith('FAIL')).join('\n')); process.exit(1); }
console.log('0 failures — see ' + OUT);
