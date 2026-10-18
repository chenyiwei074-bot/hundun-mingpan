// 同一套 bazi-validation-v1.json 用例，打在【后端引擎副本】上。
// 放在仓库根 tools/bazi-acceptance/ 下（与前端那个同名 runner 并排），
// 从仓库根跑（tsx 在 fate-reverse/bazi-engine/node_modules/.bin 下）：
//   tsx tools/bazi-acceptance/acceptance-server.ts --cases=<bazi-validation-v1.json 路径>
// 已知：后端没有 dayBoundaryMode（那是前端能力），所以
// late-zi-midnight-boundary 这例必然 7/8，其余 7 例应当全过。
import { createBaziChart } from '../../server/src/core/yiqi-core/bazi';
import { resolveZoneInfo } from '../../server/src/lib/true-solar/dst-resolver';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};

const casesPath = arg('cases');
if (!casesPath) {
  console.error('缺少 --cases=<bazi-validation-v1.json 路径>');
  process.exit(2);
}
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
    isLeapMonth: i.isLeapMonth === true,
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
      + (i.isLeapMonth ? ' [闰]' : ''),
  });
}

console.log('编号'.padEnd(32) + ' 结果  期望四柱              实得四柱              备注');
for (const r of rows) {
  console.log((r.ok ? '✔ ' : '✘ ') + r.id.padEnd(30) + ' ' + r.expect.padEnd(22) + r.got.padEnd(22) + r.note);
}
const pass = rows.filter(r => r.ok).length;
console.log('\n合计: ' + pass + ' / ' + rows.length);
process.exit(pass === rows.length ? 0 : 1);
