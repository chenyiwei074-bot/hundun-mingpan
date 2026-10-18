// 真太阳时上线前对拍：同一个出生输入，三条链路各算一次四柱。
//   A) 前端表单实际链路：buildTrueSolarWiring -> frontend createChart（带经度/夏令时）
//   B) 仓库后端实际链路：generateChart -> chart.service.ts parseBirthInfo -> server createChart
//      （走 service 导出的那个函数，不自己拼 BirthInfo —— 接线就在 parseBirthInfo 里，
//       手拼等于绕过被测对象。0b94f5d 之前它 timeZone 写死 8、无经度，那是当时的真实后端。）
//   C) 把 A 算出的真太阳时时刻喂给后端引擎（「后端只要接上同一份时刻就能对上吗」）
// A==C 是引擎层一致性；A==B 是接线一致性。05/08 后端补丁已随 ops/backend-tst-lunar-liuyao
// 并入 git（0b94f5d），所以 A==B 从「只报不判」改成默认硬判 —— 加 --no-require-backend 才降级。
// B 红而 C 绿 = 后端引擎没问题、是接线/传输层不一致，这两列就是为了分这两种情况而存在。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/tst-acceptance/check.ts
// 控制台只打 ASCII 摘要（Windows 会把 UTF-8 截成乱码），四柱等中文明细看 --out=<file>。
import { writeFileSync } from 'node:fs';
import { createChart as feCreateChart, BirthInfo } from '../../frontend/app/lib/core/yiqi-core';
import { buildTrueSolarWiring } from '../../frontend/app/lib/true-solar/birth-wiring';
import { toCivilInput } from '../../frontend/app/lib/core/yiqi-core/lunar-input';
import { createChart as beCreateChart } from '../../server/src/core/yiqi-core';
import { generateChart as beGenerateChart } from '../../server/src/services/chart.service';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const REQUIRE_BACKEND = !process.argv.includes('--no-require-backend');

const CASES: { label: string; y: number; mo: number; d: number; h: number; mi: number; province: string; city: string; control?: boolean }[] = [
  // 运维给的验收案例：乌鲁木齐，1988 年（中国夏令时 1986–1991 内）
  { label: '1988-07-15 15:20 / Urumqi', y: 1988, mo: 7, d: 15, h: 15, mi: 20, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 同一时刻换到北京：经度只差 13 分，但夏令时仍要减 1 小时 -> 也跨时辰
  { label: '1988-07-15 15:20 / Beijing', y: 1988, mo: 7, d: 15, h: 15, mi: 20, province: '北京市', city: '北京市' },
  // 真太阳时跨日：钟表已是次日凌晨，校正后回到前一天 -> 日柱也跟着变
  { label: '2000-01-01 00:25 / Urumqi', y: 2000, mo: 1, d: 1, h: 0, mi: 25, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 夏令时之外（1992 起中国不再调夏令时）：经度时差照样能把时辰挪一格
  { label: '1993-03-08 09:40 / Urumqi', y: 1993, mo: 3, d: 8, h: 9, mi: 40, province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  // 正对照：近标准经线 + 无夏令时 + 不压时辰边界，A 必须与 B 逐字相同
  // （没有这条，A==B 全红也可能是我的对拍脚本自己写错了）
  { label: '1995-06-10 10:00 / Beijing', y: 1995, mo: 6, d: 10, h: 10, mi: 0, province: '北京市', city: '北京市', control: true },
];

const sig = (c: any) => ['year', 'month', 'day', 'hour'].map(k => `${c.bazi.siZhu[k].gan}${c.bazi.siZhu[k].zhi}`).join(' ');
const lines: string[] = [];
const say = (s: string) => { lines.push(s); console.log(s); };

let engineBad = 0, backendBad = 0, controlBad = 0;
for (const cs of CASES) {
  const civil = toCivilInput({ year: cs.y, month: cs.mo, day: cs.d, hour: cs.h, minute: cs.mi, isLunar: false, isLeapMonth: false });
  const wiring = buildTrueSolarWiring(
    { province: cs.province, city: cs.city, district: '' },
    { year: civil.year, month: civil.month, day: civil.day, hour: civil.hour, minute: civil.minute },
  );
  const fe = feCreateChart({
    year: cs.y, month: cs.mo, day: cs.d, hour: cs.h, minute: cs.mi,
    isLunar: false, gender: 'male',
    timeZone: wiring.timeZone, longitude: wiring.longitude, dstOffset: wiring.dstOffset, enableTrueSolarTime: true,
  } as BirthInfo);
  const tst = (fe.bazi as any).trueSolarTime;

  // 后端 transport 层的真实入参：走 service 导出的 generateChart，让 parseBirthInfo 自己
  // 做「农历换算 + 按 birthPlace 解析经度 + 补历史夏令时」。birthPlace 的「省 市 区」空格
  // 分隔就是 API 契约里的形状，不是对拍脚本的发明。
  const pad = (n: number) => String(n).padStart(2, '0');
  const be = beGenerateChart({
    visitor_id: 'tst-check', name: '对拍', gender: '男' as const, calendar: '公历' as const,
    birthday: `${cs.y}-${pad(cs.mo)}-${pad(cs.d)} ${pad(cs.h)}:${pad(cs.mi)}`,
    isLeapMonth: false, birthPlace: `${cs.province} ${cs.city}`, currentPlace: '',
    persona: 'standard' as const, depth: 'brief' as const,
  });

  const t = tst?.trueSolarDateTime;
  const beGivenClock = t ? beCreateChart({ year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, isLunar: false, gender: 'male', timeZone: 8 } as any) : null;

  const a = sig(fe), b = sig(be), c = beGivenClock ? sig(beGivenClock) : a;
  if (a !== c) engineBad++;
  if (a !== b) backendBad++;
  // 正对照必须 A==B：它不成立说明对拍脚本本身错了，而不是后端缺 TST
  if (cs.control && a !== b) controlBad++;

  say('==== ' + cs.label);
  say(`  geo      : lng=${wiring.longitude ?? '-'} tzStd=${wiring.timeZone} dst=${wiring.dstOffset} ambiguous=${wiring.ambiguousDst}`);
  say(`  trueSolar: ${tst?.civilTime ?? '-'} -> ${tst?.trueSolarTime ?? '-'} (${tst?.totalCorrectionMinutes ?? 0} min) crossed=${JSON.stringify(tst?.crossed ?? null)}`);
  say(`  A frontend        : ${a}`);
  say(`  B repo backend    : ${b}`);
  say(`  C backend@TSTtime : ${c}   (fed ${t ? `${t.year}-${t.month}-${t.day} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}` : '-'})`);
  say(`  A==C(engine parity) ${a === c ? 'YES' : 'NO'}   A==B(backend wiring) ${a === b ? 'YES' : 'NO'}`);
}

say('');
say(`ENGINE PARITY A==C : ${CASES.length - engineBad}/${CASES.length} ${engineBad ? 'FAIL' : 'PASS'}`);
say(`CONTROL A==B       : ${controlBad ? 'FAIL (the comparison itself is wrong)' : 'PASS'}`);
say(`BACKEND WIRING A==B: ${CASES.length - backendBad}/${CASES.length} measured` +
  (REQUIRE_BACKEND ? (backendBad ? ' FAIL' : ' PASS') : ' (informational; --no-require-backend to relax)'));

if (arg('out')) writeFileSync(arg('out')!, lines.join('\n') + '\n', 'utf8');
process.exit(engineBad || controlBad || (REQUIRE_BACKEND && backendBad) ? 1 : 0);
