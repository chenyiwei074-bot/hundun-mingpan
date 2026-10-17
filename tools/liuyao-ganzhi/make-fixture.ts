// 生成 harness 用的六爻结果态 fixture（tools/visual-harness/fixtures/liuyao-result*.json）。
//
// 为什么要有这个文件：/liuyao/result/[id] 的盘面只从 sessionStorage 的 liuyao_result 读，
// harness 不给它就会永远停在「未找到卦象数据」的空态，于是四柱行、每爻空亡、口径行、
// 跨日提示这些真正交付的版式从来没被测到过（与首页那次「假绿」同一类缺陷）。
//
// 2026-10-17 #66/#67 收口后加了两条硬规矩：
//  1. fixture 只由本文件产出，不许手改。盘面存的是引擎算出来的纳甲，手改等于把错值焊进绿灯 gate。
//  2. 断言值取自 tools/liuyao-ganzhi/gold.ts 那份手写金标准，不取自 fixture，也不取自被测实现。
//     本文件先把「引擎输出 == 金标准」断住，才把盘面写盘；再把同一份金标准值打成 token 印到
//     coverage 报告里，供 census.mjs 的 LIUYAO_PINS 逐爻抄死。这样 fixture 若哪天又存了错纳甲，
//     打不出来的是本文件（FAIL），而绿灯亮不起来的是 census（token 对不上），两头都有牙齿。
//
// 四种盘：三种起卦方式各一张（摇卦 / 时间 / 报数），再加一张「老盘」——
// 老盘 = 摇卦那张去掉两个口径版本戳，用来测结果页 A4 那句「本盘按起卦时口径生成」。
// 老盘的纳甲内容仍是金标准值：要测的是标注分支，不是把修前的错纳甲再认证一遍。
//
// 全部为合成数据（§七-5）：问题文案是占位符，不含任何真实客户资料；时刻与地点写死，
// 重跑必得同一份盘。五个必需状态不是碰巧出现，而是搜索出来的 —— 缺一个就 FAIL，
// 因为「fixture 覆盖了」这句话必须是断言，不是印象。
//
// 用法（同 acceptance.ts，外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到 @/*）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/liuyao-ganzhi/make-fixture.ts [--check]
// 带 --check 时只验不写：把「现在重跑引擎得到的盘」与 committed fixture 逐字节比对，
// 不同则 STALE + exit 1。这样「fixture 过期」本身是检得出来的状态。
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { buildTimeResult } from '../../frontend/lib/liuyao/methods/time';
import { buildNumberResult } from '../../frontend/lib/liuyao/methods/number';
import { resolveQiguaMoment } from '../../frontend/lib/liuyao/solar-basis';
import { goldPlate, guaNameToTrigrams } from './gold';
import type { CoinFace, GanZhiInfo, LiuyaoResult, QiguaSolarInfo, QuestionType, YaoRecord } from '../../frontend/types/liuyao';

const FIXDIR = 'tools/visual-harness/fixtures';
const OUTS: Record<string, string> = {
  coin: `${FIXDIR}/liuyao-result.json`,          // committed 绿灯 gate，路径不变
  time: `${FIXDIR}/liuyao-result-time.json`,
  number: `${FIXDIR}/liuyao-result-number.json`,
  legacy: `${FIXDIR}/liuyao-result-legacy.json`,
};
const IDS: Record<string, string> = {
  coin: 'fixture_coin_0001', time: 'fixture_time_0001',
  number: 'fixture_number_0001', legacy: 'fixture_legacy_0001',
};

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
// 时间起卦的卦由时刻唯一决定，不能像摇卦那样挑序列，只能把候选时刻摊开扫。
const DAYS = [12, 13, 14, 15, 16, 17, 18].map(d => new Date(2026, 9, d));

interface Hit {
  method: string; result: LiuyaoResult; place: { province: string; city: string };
  now: Date; values: number[]; nums?: number[];
}

function buildWith(method: string, now: Date, place: { province: string; city: string }, values: number[], nums: number[]): LiuyaoResult {
  const moment = resolveQiguaMoment(now, place);
  const common = {
    question: '示例占问 · 合成数据（仅供版式验收）',
    questionType: QT,
  };
  const result = (method === 'time'
    ? buildTimeResult({ ...common, date: moment.date })
    : method === 'number'
      ? buildNumberResult({ ...common, nums, now: moment.date })
      : buildCoinResult({ ...common, records: mkRecords(values), now: moment.date })) as LiuyaoResult;
  result.solar = moment.info as QiguaSolarInfo;
  result.id = IDS[method === 'legacy' ? 'coin' : method];
  return result;
}

// 键用 ASCII：Windows 控制台会把 UTF-8 摘要截成乱码，中文报告另写文件。
const CHECK_IDS: Record<string, string> = {
  sizhu_xunkong: '四柱+旬空行',
  yao_kongwang: '每爻空亡',
  basis_longitude: '口径与经度行',
  cross_hour: '跨时辰提示',
  cross_day: '跨日提示',
  legacy_no_stamp: '老盘无口径版本戳',
};
function checks(hit: Hit) {
  const { result } = hit;
  const kong = [...result.naJia, ...result.bianNaJia].filter(y => y.xunKong).length;
  return {
    sizhu_xunkong: !!(result.ganZhi?.day && result.xunKong),
    yao_kongwang: kong > 0,
    basis_longitude: result.solar?.mode === 'true-solar' && result.solar.longitude !== null,
    cross_hour: !!result.solar?.crossedHour,
    cross_day: !!result.solar?.crossedDay,
    legacy_no_stamp: !result.ganzhiBasis && !result.najiaBasis,
  };
}
const REQUIRED: Record<string, string[]> = {
  coin: ['sizhu_xunkong', 'yao_kongwang', 'basis_longitude', 'cross_hour', 'cross_day'],
  time: ['sizhu_xunkong', 'yao_kongwang', 'basis_longitude', 'cross_hour', 'cross_day'],
  number: ['sizhu_xunkong', 'yao_kongwang', 'basis_longitude', 'cross_hour', 'cross_day'],
  legacy: ['sizhu_xunkong', 'yao_kongwang', 'basis_longitude', 'cross_day', 'legacy_no_stamp'],
};
// 跨时辰那条老盘不需要：它与摇卦那张同一张盘，只是少了两个戳；要求它反而会把搜索逼回同一个解。
const stampOk = (m: LiuyaoResult) => m === 'legacy' || (!!m.ganzhiBasis && !!m.najiaBasis);

const fails: string[] = [];
const say: string[] = [];
const bad = (s: string) => { fails.push(s); say.push('FAIL  ' + s); };

/**
 * 盘面存的东西必须逐爻等于金标准，否则 harness 的绿灯就是在认证错像素。
 * 六亲 / 世应 / 每爻空亡 一起钉：纳甲错一格，六亲跟着错、空亡跟着错，
 * 而空亡只从「已钉死的干支 + 日辰旬空」推导，不另立第二份真相。
 */
function assertGold(hit: Hit) {
  const r = hit.result;
  const tag = hit.method;
  if (!stampOk(r)) bad(`${tag}: 缺口径版本戳 ganzhiBasis=${r.ganzhiBasis} najiaBasis=${r.najiaBasis}`);
  const cols: Array<'ben' | 'bian'> = ['ben', 'bian'];
  for (const col of cols) {
    const name = col === 'ben' ? r.benGua.name : r.bianGua.name;
    if (!name) continue;
    const rows = col === 'ben' ? r.naJia : r.bianNaJia;
    const t = guaNameToTrigrams(name);                    // 由卦名反推上下卦（手写象名表，见 gold.ts）
    if (col === 'ben') {
      // 本卦存了上下卦两个字段，卦名与它必须同源；变卦只存 名/宫/五行，没有可对照的上下卦字段。
      const st = r.benGua;
      if (t.shang !== st.shangGua || t.xia !== st.xiaGua) {
        bad(`${tag}/${col} ${name}: 盘面存的上下卦 上${st.shangGua}/下${st.xiaGua} ≠ 卦名读出的 上${t.shang}/下${t.xia}`);
        continue;
      }
    }
    const gp = goldPlate(t.shang, t.xia);
    const storedGong = col === 'ben' ? r.benGua.gong : r.bianGua.gong;
    if (storedGong !== gp.gong) bad(`${tag}/${col} ${name}: 宫 ${storedGong} ≠ 金标准 ${gp.gong}（八宫变爻规则现算）`);
    for (let i = 0; i < 6; i++) {
      const y = rows[i];
      const mark = i + 1 === gp.shi ? '世' : i + 1 === gp.ying ? '应' : '';
      const kongWant = r.xunKong.includes(gp.ganZhi[i][1]);
      if (y.ganZhi !== gp.ganZhi[i]) bad(`${tag}/${col} ${name}第${i + 1}爻 干支 ${y.ganZhi} ≠ 金标准 ${gp.ganZhi[i]}`);
      if (y.liuQin !== gp.liuQin[i]) bad(`${tag}/${col} ${name}第${i + 1}爻 六亲 ${y.liuQin} ≠ 金标准 ${gp.liuQin[i]}`);
      if ((y.shiYing || '') !== mark) bad(`${tag}/${col} ${name}第${i + 1}爻 世应 ${y.shiYing || '-'} ≠ 金标准 ${mark || '-'}`);
      if (!!y.xunKong !== kongWant) bad(`${tag}/${col} ${name}第${i + 1}爻 空亡 ${!!y.xunKong} ≠ 干支+旬空推导 ${kongWant}`);
    }
    // #66 的覆盖面：修前那种「外卦按内三爻取支」必须与金标准不同，否则断言是恒真的。
    if (gp.old.slice(3).join('') === gp.ganZhi.slice(3).join('')) {
      bad(`${tag}/${col} ${name}: 修前复算的四五六爻 [${gp.old.slice(3).join(' ')}] 与金标准相同，断言没有牙齿`);
    }
  }
}

function pin(hit: Hit) {
  const r = hit.result;
  const gp = (name: string) => { const t = guaNameToTrigrams(name); return goldPlate(t.shang, t.xia); };
  const ben = gp(r.benGua.name);
  const lines: string[] = [`PINS ${hit.method}  本卦「${r.benGua.name}」${ben.gong}宫${r.bianGua.name ? ` / 变卦「${r.bianGua.name}」` : ' / 无变卦'}`];
  const add = (base: number, gz: string[], qin: string[], wx: string[], label: string) => {
    gz.forEach((z, i) => lines.push(`  n${String(base + i).padStart(2, '0')}  ${label} 第${i + 1}爻  ${qin[i]}${z}${wx[i]}`));
  };
  add(1, ben.ganZhi, ben.liuQin, ben.wx, '本卦');
  if (r.bianGua.name) {
    const bp = gp(r.bianGua.name);
    add(7, bp.ganZhi, bp.liuQin, bp.wx, '变卦');
    lines.push(`  （本卦 n01–n06、变卦 n07–n12，位序一律 初→上；census 里按 method 分组抄死）`);
  }
  const kongRows = [...r.naJia, ...r.bianNaJia].filter(y => y.xunKong).length;
  lines.push(`  kong  ${kongRows}   // [data-ly-kong] 精确数，从已钉干支 + ${r.xunKong} 旬空推导`);
  lines.push(`  day   ${r.ganZhi.day}`);
  lines.push(`  head  ${r.benGua.name}｜${ben.gong}宫｜${r.solar?.crossedDay ? '校正后跨日' : ''}`);
  return lines;
}

// ── 搜索：摇卦 ──
let coinHit: Hit | null = null;
scanCoin:
for (const day of DAYS) for (let h = 0; h < 24; h++) for (const mi of [0, 30]) for (const seq of SEQUENCES) for (const place of PLACES) {
  const now = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0);
  const result = buildWith('coin', now, place, seq, [1, 1, 1]);
  const hit: Hit = { method: 'coin', result, place, now, values: seq };
  const c = checks(hit);
  if (REQUIRED.coin.every(k => c[k])) { coinHit = hit; break scanCoin; }
}
if (!coinHit) { console.log('FAIL  no coin candidate moment yields all required states'); process.exit(1); }
assertGold(coinHit);

// ── 搜索：时间起卦（卦由时刻唯一决定）──
let timeHit: Hit | null = null;
scanTime:
for (const day of DAYS) for (let h = 0; h < 24; h++) for (const mi of [0, 30]) for (const place of PLACES) {
  const now = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, 0);
  const result = buildWith('time', now, place, [], [1, 1, 1]);
  const hit: Hit = { method: 'time', result, place, now, values: [] };
  const c = checks(hit);
  if (REQUIRED.time.every(k => c[k])) { timeHit = hit; break scanTime; }
}
if (!timeHit) { console.log('FAIL  no time candidate moment yields all required states'); process.exit(1); }
assertGold(timeHit);

// ── 搜索：报数起卦。时刻与地点沿用摇卦那张，五个状态里只有「每爻空亡」随报数变，
//    于是只扫 8×8×6=384 组报数。──
let numberHit: Hit | null = null;
scanNumber:
for (const n1 of [1, 2, 3, 4, 5, 6, 7, 8]) for (const n2 of [1, 2, 3, 4, 5, 6, 7, 8]) for (const n3 of [1, 2, 3, 4, 5, 6]) {
  const nums = [n1, n2, n3];
  const result = buildWith('number', coinHit!.now, coinHit!.place, [], nums);
  const hit: Hit = { method: 'number', result, place: coinHit!.place, now: coinHit!.now, values: [], nums };
  if (REQUIRED.number.every(k => checks(hit)[k])) { numberHit = hit; break scanNumber; }
}
if (!numberHit) { console.log('FAIL  no number triple yields all required states at the coin moment'); process.exit(1); }
assertGold(numberHit);
// 数字起卦那份已知缺陷（待裁，与 D8 同一个根因）：报数取的是「先天数序号的二进制」当卦形，
// 于是盘上画的爻象与卦名读出的上下卦不一致。这里只量化、不改代码 —— 断言值来自金标准，
// 盘面干支/六亲按卦名（上下卦）装，那一部分是对的，爻象那一列才是错的。
{
  const r = numberHit!.result;
  const t = guaNameToTrigrams(r.benGua.name);
  const bits = (t: string) => ({ 乾: '111', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001', 坤: '000' }[t]);
  const want = bits(t.xia) + bits(t.shang);                              // 卦名应有的 初→上 爻形
  const drawn = r.yaoRecords.map(y => (y.value === 7 || y.value === 9 ? '1' : '0')).join('');
  say.push(`MEASURED number ${r.benGua.name} 名对爻象错：按卦名应画[${want}]，盘面实画[${drawn}]（ nums=${numberHit!.nums!.join(',')}，384/384 那条老缺陷，未修，等裁定）`);
}

// ── 老盘：摇卦那张去掉两个口径戳，测结果页 A4 标注分支。纳甲内容仍是金标准值。──
const legacyResult: LiuyaoResult = { ...coinHit!.result, id: IDS.legacy };
delete (legacyResult as Partial<LiuyaoResult>).ganzhiBasis;
delete (legacyResult as Partial<LiuyaoResult>).najiaBasis;
const legacyHit: Hit = { ...coinHit!, method: 'legacy', result: legacyResult };
{
  const c = checks(legacyHit);
  if (!REQUIRED.legacy.every(k => c[k])) bad(`legacy: 状态不齐 ${JSON.stringify(c)}`);
  const t = guaNameToTrigrams(legacyResult.benGua.name), gp = goldPlate(t.shang, t.xia);
  if (legacyResult.naJia.map(y => y.ganZhi).join(' ') !== gp.ganZhi.join(' ')) bad('legacy: 纳甲不等于金标准');
}

// --check：只验不写。committed fixture 与「现在重跑引擎得到的盘」必须逐字节相同 ——
// 这次的事故不是盘面画错，而是引擎改了、盘还留着修前的值，绿灯于是认证了一份过期数据。
// 有这一条，「fixture 过期」本身变成可检状态，不用靠人记得回来重新生成。
const CHECK = process.argv.includes('--check');
if (fails.length) {
  console.log('FAIL ' + fails.length + ' gold mismatches — nothing written');
  for (const f of fails.slice(0, 12)) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
  process.exit(1);
}

const report: string[] = ['六爻 harness fixture 覆盖报告（合成数据，§七-5）', ''];
const stale: string[] = [];
for (const hit of [coinHit!, timeHit!, numberHit!, legacyHit]) {
  const r = hit.result;
  const body = JSON.stringify(r, null, 1) + '\n';
  if (CHECK) {
    let cur = '';
    try { cur = readFileSync(OUTS[hit.method], 'utf8'); } catch { cur = '<missing>'; }
    if (cur !== body) stale.push(hit.method);
  } else {
    mkdirSync(FIXDIR, { recursive: true });
    writeFileSync(OUTS[hit.method], body, 'utf8');
  }
  const c = checks(hit);
  report.push(`── ${hit.method}  ${OUTS[hit.method]}（${Buffer.byteLength(body)} 字节${CHECK ? ' · 只验不写' : ''}）`);
  for (const k of Object.keys(CHECK_IDS)) {
    // legacy_no_stamp 是老盘那一条的状态，其余三张盘都有戳，印成 FAIL 只会让人以为搜索没过。
    const na = (k === 'legacy_no_stamp' && hit.method !== 'legacy') || (k === 'cross_hour' && hit.method === 'legacy');
    if (na) continue;
    report.push(`  ${c[k] ? 'PASS' : 'FAIL'}  ${k}  ${CHECK_IDS[k]}`);
  }
  report.push(`       地点     ${hit.place.province} ${hit.place.city}`);
  report.push(`       四柱     ${r.ganZhi.year}年 ${r.ganZhi.month}月 ${r.ganZhi.day}日 ${r.ganZhi.hour}时 · ${r.xunKong}旬空` +
    `（干支戳 ${r.ganzhiBasis ?? '无'} / 纳甲戳 ${r.najiaBasis ?? '无'}）`);
  report.push(`       每爻空亡 ${[...r.naJia, ...r.bianNaJia].filter(y => y.xunKong).length} 爻`);
  report.push(`       口径     ${r.solar!.label}：钟表 ${r.solar!.clockText} → 真太阳时 ${r.solar!.solarText}` +
    `（${r.solar!.correctionMinutes > 0 ? '+' : ''}${r.solar!.correctionMinutes} 分钟，经度 ${r.solar!.longitude}°E，` +
    `经度项 ${r.solar!.longitudeCorrectionMinutes} / 均时差 ${r.solar!.equationOfTimeMinutes}）`);
  report.push(`       跨界     crossedHour=${r.solar!.crossedHour} crossedDay=${r.solar!.crossedDay}`);
  if (hit.method === 'coin') report.push(`       摇卦     [${hit.values.join(',')}]`);
  if (hit.method === 'number') report.push(`       报数     ${hit.nums!.join(' / ')}`);
  report.push(...pin(hit), '');
}
report.push(...say);

for (const m of ['coin', 'time', 'number', 'legacy']) console.log(`PASS  cover  ${m}`);
if (CHECK) {
  // 只验不写：--check 若顺手改了报告，「检查」本身就成了会改状态的动作。
  // 控制台走 ASCII 转写（同 FAIL 分支），中文全文只在生成模式下落盘。
  for (const s of say) console.log(s.replace(/[^\x00-\x7F]/g, '?'));
  if (stale.length) {
    console.log('STALE  ' + stale.map(m => `${m}=${OUTS[m]}`).join(' | '));
    console.log('       盘面与「现在重跑引擎」不等 —— 跑本文件（不带 --check）重新生成，别手改');
    process.exit(1);
  }
  console.log('OK     4 张 committed fixture 与引擎现算值逐字节相同');
} else {
  writeFileSync(`${FIXDIR}/liuyao-coverage.txt`, report.join('\n') + '\n', 'utf8');
  console.log('written ' + Object.values(OUTS).join(', '));
  console.log('report tools/visual-harness/fixtures/liuyao-coverage.txt  (PINS 段落抄进 census.mjs 的 LIUYAO_PINS)');
}
