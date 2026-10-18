// 四柱验收：拿 bazi-validation-v1.json 的期望四柱逐条比对站点引擎。
// 用例已入仓（tools/bazi-acceptance/cases/，MIT，来自 github.com/openfate-ai/bazi-engine v1.1.1，
// 合成用例、无真人出生数据），默认直接读旁边那份，不再依赖仓库外的路径；
// 要换一份仍可用 --cases=<路径> 覆盖。
//   NODE_PATH="$PWD/frontend/node_modules" node server/node_modules/tsx/dist/cli.mjs \
//     --tsconfig=frontend/tsconfig.json tools/bazi-acceptance/acceptance.ts
// 交接 §四 要求的验收就是这一条：lunar-leap-month-conversion 必须过。
import { join } from 'node:path';
import { createBaziChart } from '../../frontend/app/lib/core/yiqi-core/bazi';
import { resolveZoneInfo } from '../../frontend/app/lib/true-solar/dst-resolver';

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

console.log('编号'.padEnd(32) + ' 结果  期望四柱              实得四柱              备注');
for (const r of rows) {
  console.log((r.ok ? '✔ ' : '✘ ') + r.id.padEnd(30) + ' ' + r.expect.padEnd(22) + r.got.padEnd(22) + r.note);
}
const pass = rows.filter(r => r.ok).length;
console.log('\n合计: ' + pass + ' / ' + rows.length);
process.exit(pass === rows.length ? 0 : 1);
