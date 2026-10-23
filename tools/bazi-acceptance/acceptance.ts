// 四柱验收：拿 bazi-validation-v1.json 的期望四柱逐条比对站点引擎。
// 用例已入仓（tools/bazi-acceptance/cases/，MIT，来自 github.com/openfate-ai/bazi-engine v1.1.1，
// 合成用例、无真人出生数据），默认直接读旁边那份，不再依赖仓库外的路径；
// 要换一份仍可用 --cases=<路径> 覆盖。
//   NODE_PATH="$PWD/frontend/node_modules" node server/node_modules/tsx/dist/cli.mjs \
//     --tsconfig=frontend/tsconfig.json tools/bazi-acceptance/acceptance.ts
// 交接 §四 要求的验收就是这一条：lunar-leap-month-conversion 必须过。
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
// 2026-10-21 裁定：任何拿产品源码文本做判定的闸门先剥注释（共享件 tools/_lib/codesrc.ts）。
import { stripComments } from '../_lib/codesrc';
import { createBaziChart } from '../../frontend/app/lib/core/yiqi-core/bazi';
import { getNaYin } from '../../frontend/app/lib/core/yiqi-core/nayin';
import { resolveZoneInfo } from '../../frontend/app/lib/true-solar/dst-resolver';
import type { Dizhi, Tiangan } from '../../frontend/app/lib/core/yiqi-core/types';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};

// __dirname 而不是仓库根相对路径：这份 fixture 就躺在 runner 旁边，从哪个 cwd 跑都不该找错。
const casesPath = arg('cases') || join(__dirname, 'cases', 'bazi-validation-v1.json');
const cases = require(casesPath).cases;

interface Row { id: string; expect: string; got: string; ok: boolean; note: string }
const rows: Row[] = [];

for (const c of cases) {
  const i = c.input;
  const e = c.pillarsExpected || c.expected.pillars;
  const civil = { year: i.year, month: i.month, day: i.day, hour: i.hour, minute: i.minute };

  let standardOffsetHours: number;
  let dstOffsetHours = 0;
  if (typeof i.timeZoneOffset === 'number') {
    standardOffsetHours = i.timeZoneOffset;
  } else {
    const z = resolveZoneInfo(civil, i.timezoneId);
    standardOffsetHours = z.standardOffsetHours;
    dstOffsetHours = z.dstOffsetHours;
  }

  const chart = createBaziChart({
    year: i.year, month: i.month, day: i.day, hour: i.hour, minute: i.minute,
    isLunar: i.calendarType === 'lunar',
    // 农历闰月：负月号是 lunar-typescript 的内部表达，表单层只给布尔位。
    isLeapMonth: i.isLeapMonth === true,
    // 夜子时口径：缺省即 ZI_HOUR_23，与线上历史盘一致。
    dayBoundaryMode: i.dayBoundaryMode,
    gender: i.gender === 'female' ? 'female' : 'male',
    timeZone: standardOffsetHours,
    longitude: i.longitude,
    dstOffset: dstOffsetHours,
    enableTrueSolarTime: i.enableTrueSolarTime !== false,
  } as any);

  const g = (p: any) => (p && p.gan && p.zhi) ? p.gan + p.zhi : '??';
  const got = [g(chart.siZhu.year), g(chart.siZhu.month), g(chart.siZhu.day), g(chart.siZhu.hour)].join(' ');
  const exp = [e.year, e.month, e.day, e.hour].join(' ');
  const conv: any = (chart as any).calendarConversion;
  const tst: any = (chart as any).trueSolarTime;
  rows.push({
    id: c.id, expect: exp, got, ok: got === exp,
    note: (conv ? '换算 ' + conv.civilSolar : '公历直排')
      + ' ' + (tst ? '真太阳时 ' + tst.trueSolarTime : '未校正')
      + ' [' + (i.dayBoundaryMode || '-') + (i.isLeapMonth ? '+闰' : '') + ']',
  });
}

// ── 批F⑥：纳音只许有一份表 ──────────────────────────────────────────────
// BaziPillars.tsx 里原来手抄了一份 10 干 × 12 支 = 120 格的表，而真实存在的干支对只有 60 个
// （天干地支同奇偶才成对）。删表这一步要能被别人重跑，所以那 120 格存成了旁边的夹具
// cases/nayin-handwritten-v1.json，这里逐对拿单源去对：
//   · 60 个真实对 —— 必须与抄本一字不差（这才叫"正常盘的输出没变"）；
//   · 60 个不存在的对 —— 抄本当年每格都编了个值，单源那一边是抛错。这一条红就代表
//     "把编造改回抛错"这件事被人悄悄退回去了（那是 2026-10-21 裁定③ 的同一形状）。
{
  const hand = require(join(__dirname, 'cases', 'nayin-handwritten-v1.json'));
  const cells: Record<string, string> = hand.cells;
  const pairs: string[] = hand.sixtyPairs;
  const handDiff = pairs.filter(k => getNaYin(k[0] as Tiangan, k[1] as Dizhi) !== cells[k]);
  rows.push({
    id: 'nayin/60-equal-to-deleted-copy', expect: '60 对全等', got: `${60 - handDiff.length} 等 / ${handDiff.length} 不等`,
    ok: pairs.length === 60 && handDiff.length === 0,
    note: handDiff.length ? `不等：${handDiff.slice(0, 4).map(k => `${k}→${getNaYin(k[0] as Tiangan, k[1] as Dizhi)}/${cells[k]}`).join(' ')}` : '夹具来自删表前的 git HEAD',
  });
  const fake = Object.keys(cells).filter(k => !pairs.includes(k));
  let threw = 0;
  for (const k of fake) { try { getNaYin(k[0] as Tiangan, k[1] as Dizhi); } catch { threw++; } }
  rows.push({
    id: 'nayin/nonexistent-pair-throws', expect: '60 个不存在的对全部抛错', got: `${threw} 抛 / ${fake.length - threw} 静默`,
    ok: fake.length === 60 && threw === 60,
    note: `抄本给不存在的对编了 ${fake.length} 个值（如 ${fake.slice(0, 2).join('、')}），单源不编`,
  });
  const pillars = stripComments(readFileSync(join(__dirname, '../../frontend/components/bazi/BaziPillars.tsx'), 'utf8'));
  rows.push({
    id: 'nayin/pillar-reads-single-source', expect: '组件吃 yiqi-core/nayin', got: /coreNaYin\(/.test(pillars) && !/nayinTable/.test(pillars) && /yiqi-core\/nayin/.test(pillars) ? '吃单源、无抄本' : '还有抄本或没吃单源',
    ok: /coreNaYin\(/.test(pillars) && !/nayinTable/.test(pillars) && /yiqi-core\/nayin/.test(pillars),
    note: '组件里那份表一删，判据钉"这一页只许吃单源"；空输入仍走 nayinOf 的空串分支，不当成查不到',
  });
}

console.log('编号'.padEnd(32) + ' 结果  期望                    实得                    备注');
for (const r of rows) {
  console.log((r.ok ? '✔ ' : '✘ ') + r.id.padEnd(30) + ' ' + r.expect.padEnd(22) + r.got.padEnd(22) + r.note);
}
const pass = rows.filter(r => r.ok).length;
console.log('\n合计: ' + pass + ' / ' + rows.length);
process.exit(pass === rows.length ? 0 : 1);
