// 生成 harness 用的六爻结果态 fixture（tools/visual-harness/fixtures/liuyao-result.json）。
//
// 为什么要有这个文件：/liuyao/result/[id] 的盘面只从 sessionStorage 的 liuyao_result 读，
// harness 不给它就会永远停在「未找到卦象数据」的空态，于是四柱行、每爻空亡、口径行、
// 跨日提示这些真正交付的版式从来没被测到过（与首页那次「假绿」同一类缺陷）。
//
// 全部为合成数据（§七-5）：问题文案是占位符，不含任何真实客户资料；时刻与地点写死，
// 重跑必得同一份盘。四个必需状态不是碰巧出现，而是搜索出来的 —— 缺一个就 FAIL，
// 因为「fixture 覆盖了」这句话必须是断言，不是印象。
//
// 用法（同 acceptance.ts，外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到 @/*）：
//   cd <repo root> && NODE_PATH="<…>/fate-reverse/reproduce/node_modules" \
//     "<…>/fate-reverse/bazi-engine/node_modules/.bin/tsx" --tsconfig=frontend/tsconfig.json \
//     tools/liuyao-ganzhi/make-fixture.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { resolveQiguaMoment } from '../../frontend/lib/liuyao/solar-basis';
import type { CoinFace, LiuyaoResult, QuestionType, YaoRecord } from '../../frontend/types/liuyao';

const OUT = 'tools/visual-harness/fixtures/liuyao-result.json';

// 三枚铜钱的老阴/老阳组合决定变卦；这里用固定序列而不是随机，保证 fixture 可复现。
const FACES: Record<number, CoinFace[]> = {
  6: ['花', '花', '花'], 7: ['字', '花', '花'], 8: ['花', '字', '字'], 9: ['字', '字', '字'],
};
const LABEL: Record<number, string> = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };
function mkRecords(values: number[]): YaoRecord[] {
  return values.map((v, i) => ({
    position: i + 1, coins: FACES[v], value: v, label: LABEL[v], isDong: v === 6 || v === 9,
  }));
}

// 候选摇卦序列：至少一个动爻才有变卦列，两种老阴/老阳都试过，避免某条序列撞上没有空亡的旬。
const SEQUENCES = [
  [7, 8, 9, 7, 6, 8],
  [9, 7, 8, 6, 7, 9],
  [8, 9, 7, 6, 8, 7],
  [7, 6, 9, 8, 7, 8],
  [6, 8, 7, 9, 8, 7],
];
// 乌鲁木齐（约 87.6°E）：经度时差约 −130 分钟，足以让钟表时刻跨时辰甚至跨日。
// 名字必须与 region-data 的省/市全称一致，否则 lookupGeo 拿不到经纬度、口径会退成「不校正」。
const PLACES = [
  { province: '新疆维吾尔自治区', city: '乌鲁木齐市' },
  { province: '西藏自治区', city: '拉萨市' },
];
const QT: QuestionType = '其他';

interface Hit { result: LiuyaoResult; place: { province: string; city: string } }

function build(now: Date, values: number[], place: { province: string; city: string }) {
  const moment = resolveQiguaMoment(now, place);
  const result = buildCoinResult({
    question: '示例占问 · 合成数据（仅供版式验收）',
    questionType: QT,
    records: mkRecords(values),
    now: moment.date,
  }) as LiuyaoResult;
  result.id = 'fixture_synth_0001';
  return { result, moment };
}

// 键用 ASCII：Windows 控制台会把 UTF-8 摘要截成乱码，中文报告另写文件。
const CHECK_IDS: Record<string, string> = {
  sizhu_xunkong: '四柱+旬空行',
  yao_kongwang: '每爻空亡',
  basis_longitude: '口径与经度行',
  cross_hour: '跨时辰提示',
  cross_day: '跨日提示',
};
const checks = (hit: Hit) => {
  const { result } = hit;
  const kong = [...result.naJia, ...result.bianNaJia].filter(y => y.xunKong).length;
  return {
    sizhu_xunkong: !!(result.ganZhi?.day && result.xunKong && result.ganzhiBasis),
    yao_kongwang: kong > 0,
    basis_longitude: result.solar?.mode === 'true-solar' && result.solar.longitude !== null,
    cross_hour: !!result.solar?.crossedHour,
    cross_day: !!result.solar?.crossedDay,
  };
};

// 2026-10-16 那天钟表 22:30 前后正好是戊/癸日交界附近，围绕它扫一遍整点与半点。
const days = [new Date(2026, 9, 16), new Date(2026, 9, 17), new Date(2026, 9, 15)];
let best: { hit: Hit; checks: ReturnType<typeof checks> } | null = null;
scan:
for (const day of days) {
  for (let h = 0; h < 24; h++) {
    for (const mi of [0, 30]) {
      for (const seq of SEQUENCES) {
        for (const place of PLACES) {
          const now = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0);
          const { result, moment } = build(now, seq, place);
          const hit: Hit = { result: { ...result, solar: moment.info }, place };
          const c = checks(hit);
          if (Object.values(c).every(Boolean)) { best = { hit, checks: c }; break scan; }
        }
      }
    }
  }
}

if (!best) {
  console.log('FAIL  no candidate moment yields all four required states');
  process.exit(1);
}

const { hit } = best;
const body = JSON.stringify(hit.result, null, 1);
mkdirSync('tools/visual-harness/fixtures', { recursive: true });
writeFileSync(OUT, body + '\n', 'utf8');

const r = hit.result;
const report = [
  '六爻 harness fixture 覆盖报告（合成数据，§七-5）',
  '',
  ...Object.entries(best.checks).map(([k, v]) => `${v ? 'PASS' : 'FAIL'}  ${k}  ${CHECK_IDS[k]}`),
  `       地点     ${hit.place.province} ${hit.place.city}`,
  `       四柱     ${r.ganZhi.year}年 ${r.ganZhi.month}月 ${r.ganZhi.day}日 ${r.ganZhi.hour}时 · ${r.xunKong}旬空（口径 ${r.ganzhiBasis}）`,
  `       每爻空亡 ${[...r.naJia, ...r.bianNaJia].filter(y => y.xunKong).length} 爻`,
  `       口径     ${r.solar!.label}：钟表 ${r.solar!.clockText} → 真太阳时 ${r.solar!.solarText}` +
    `（${r.solar!.correctionMinutes > 0 ? '+' : ''}${r.solar!.correctionMinutes} 分钟，经度 ${r.solar!.longitude}°E，` +
    `经度项 ${r.solar!.longitudeCorrectionMinutes} / 均时差 ${r.solar!.equationOfTimeMinutes}）`,
  `       跨界     crossedHour=${r.solar!.crossedHour} crossedDay=${r.solar!.crossedDay}`,
  `       写入     ${OUT}`,
].join('\n');
writeFileSync('tools/visual-harness/fixtures/liuyao-coverage.txt', report + '\n', 'utf8');
for (const [k, v] of Object.entries(best.checks)) console.log(`${v ? 'PASS' : 'FAIL'}  cover  ${k}`);
console.log('written ' + OUT + '  (report: tools/visual-harness/fixtures/liuyao-coverage.txt)');
