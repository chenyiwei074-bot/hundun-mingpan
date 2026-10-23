// 生成/核对「本命行星位置」与 JPL Horizons 的对拍夹具。
//
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/astro-acceptance/make-reference.ts          # 重算并写夹具
//   ... make-reference.ts --check                       # 只核对，不写（验收用这一支）
//
// 原始星历输出（horizons/body-*.txt）随仓库提交：对拍的权威那一侧必须能被别人重看，
// 不然"我算的等于我信的那个来源"只是一句自证。每份文件里都带着 Horizons 自己回写的
// 元数据（Target body name / Center body name / source: DE441 / 时间列含义），
// 所以这里的解析是"照着图例认列"，不是"按第几列猜"。
//
// 与验收套件的关系：套件读 cases/astro-ephemeris-reference.json（离线、可重复），
// 这一支只在有人重新抓星历或改了口径时跑一次。
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computePlanets, PLANETS, ASTRO_BASIS } from '../../frontend/lib/astro/planets';

const HERE = import.meta.dirname;
const CASES = join(HERE, 'cases');
const RAW = join(HERE, 'horizons');
const OUT = join(CASES, 'astro-ephemeris-reference.json');

/** 引擎侧的 Body 名 ↔ Horizons 小天体编号。地球不算（它是观测中心）。 */
const BODY_ID: Record<string, string> = {
  '10': 'sun', '301': 'moon', '199': 'mercury', '299': 'venus', '499': 'mars',
  '599': 'jupiter', '699': 'saturn', '799': 'uranus', '899': 'neptune', '999': 'pluto',
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Horizons 的数据行：` 2000-Jan-01 12:00:00  ...  25.2530685  -1.2621868` */
function parseRaw(file: string) {
  const text = readFileSync(file, 'utf8');
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < soe) throw new Error(`${file.split(/[\\/]/).pop()} 里没有 \$\$SOE..\$\$EOE 数据段 —— 抓回来的不是星历表`);
  // 列义必须由图例确认，不能按位置猜：第一次读这份输出时我把"月度照度百分比"
  // 当成过黄经，差一位就是一次假对拍。
  const legend = text.slice(eoe);
  if (!/ObsEcLon\s+ObsEcLat/.test(legend)) {
    throw new Error(`${file.split(/[\\/]/).pop()} 的列义里没有 'ObsEcLon ObsEcLat' —— 请求参数变了（QUANTITIES/REF_PLANE），这份输出不能用来对拍`);
  }
  const rows: { iso: string; utcMs: number; lon: number; lat: number }[] = [];
  for (const line of text.slice(soe, eoe).split(/\r?\n/)) {
    const m = /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(.+?)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/.exec(line);
    if (!m) continue;
    const mon = MON.indexOf(m[2]);
    if (mon < 0) throw new Error(`认不出的月份缩写 ${m[2]}（${file}）`);
    const utcMs = Date.UTC(+m[1], mon, +m[3], +m[4], +m[5], +m[6]);
    rows.push({ iso: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]} UT`, utcMs, lon: +m[8], lat: +m[9] });
  }
  if (!rows.length) throw new Error(`${file} 数据段里一行都没有`);
  const target = (/Target body name:\s*(.+?)\s*\((\d+)\)/.exec(text) || [])[1] || '';
  const center = (/Center body name:\s*(.+?)\s*\((\d+)\)/.exec(text) || [])[1] || '';
  const source = (/source:\s*(DE\d+)/.exec(text) || [])[1] || '';
  return { rows, target, center, source };
}

export function build() {
  const samples: {
    body: string; 名称: string; iso: string; refLon: number; refLat: number;
    ourLon: number; ourLat: number; dLon: number; dLat: number;
  }[] = [];
  const maxByBody: Record<string, number> = {};
  let de = '';
  for (const f of readdirSync(RAW).filter(n => /^body-\d+\.txt$/.test(n)).sort()) {
    const id = /(\d+)/.exec(f)![1];
    const key = BODY_ID[id];
    if (!key) throw new Error(`${f} 的编号 ${id} 不在映射表里 —— 加了新天体就要在这里登记，不然它会安静地不参与对拍`);
    const meta = parseRaw(join(RAW, f));
    de = meta.source || de;
    const planet = PLANETS.find(p => p.key === key)!;
    for (const r of meta.rows) {
      const res = computePlanets(r.utcMs);
      if (!res.ok) throw new Error(`${key} @ ${r.iso} 引擎算不出来：${res.detail}`);
      const ours = res.positions.find(p => p.key === key)!;
      // 经度差要按圆周算：359.99° 与 0.01° 之间是 0.02°，不是 359.98°。
      let d = ours.lon - r.lon;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      const dLat = ours.lat - r.lat;
      samples.push({
        body: key, 名称: planet.名称, iso: r.iso,
        refLon: r.lon, refLat: r.lat, ourLon: ours.lon, ourLat: ours.lat,
        dLon: Math.round(d * 1e6) / 1e6, dLat: Math.round(dLat * 1e6) / 1e6,
      });
      maxByBody[key] = Math.max(maxByBody[key] || 0, Math.abs(d));
    }
  }
  if (!samples.length) throw new Error('一行样本都没有 —— 这份对拍等于没跑');
  const missing = Object.keys(BODY_ID).filter(k => !samples.some(s => s.body === BODY_ID[k]));
  if (missing.length) throw new Error(`有 ${missing.length} 颗星没进对拍集：${missing.join('、')} —— 少一颗就是那一颗没人核过`);
  return {
    basis: ASTRO_BASIS,
    source: {
      authority: 'NASA JPL Horizons On-Line Ephemeris System（API，' + (de || 'DE441') + '）',
      geometry: '观测中心 = Earth (399) 的地心；REF_PLANE=ECLIPTIC；EPHEM_TYPE=OBSERVER（含光行差的视位置）',
      quantities: 'ObsEcLon / ObsEcLat（列义取自每份原始输出的 Column meaning 段）',
      note: '地心、回归黄道、无 ayanamsa —— 与 lib/astro/planets.ts 的口径同一条。'
        + '本站不排宫位也不做相位，所以对拍只核到"那一颗在黄道上哪儿"。',
      capturedFrom: 'tools/astro-acceptance/horizons/body-*.txt（原始输出随仓库提交）',
    },
    // 公差 0.02° = 1.2 角分。为什么是这个数：
    //   · 判"哪一宫/哪一宿"至少差 1°，判"换历时算错年"差 0.5° 以上，都远大于它；
    //   · "漏了光行差""用了 J2000 平黄道而不是当日真黄道""章动没算"这三类错的量级
    //     分别是 0.006° / 1.4° / 0.004° —— 前两类必须被这条咬住，第三类与引擎本身同量级，
    //     所以线的价值在于"变了就红"，不在宣称"精确到角分"。
    //   · 实测最大 0.00478°（海王星，DE441 积分与引擎截断级数之差），离 0.02 还有 4 倍余量 ——
    //     贴着最大值定线会让下次抓一批新历元时无缘无故红。
    // 月亮每 2 分钟走 0.02°，所以它同时也是"时刻有没有算错两分钟"的探针。
    toleranceDeg: 0.02,
    maxAbsDLon: Object.fromEntries(Object.entries(maxByBody).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])),
    count: samples.length,
    samples,
  };
}

const check = process.argv.includes('--check');
// 只有被**直接执行**时才写夹具。acceptance.ts 会 import 这个模块拿 build()，
// 而上一版这里无条件 writeFileSync —— 于是每跑一次验收，它先把权威侧那份对照文件重写一遍，
// 再拿"自己刚写的"去比"文件里的"，永远相等：astro/reference-reproducible 是一条自我实现的
// 断言（假绿）。证伪的方式就是把 toleranceDeg 改一下再跑：改前它照绿，改后才红。
const runDirect = /make-reference\.[tm]js$/.test(process.argv[1] || '');
const next = JSON.stringify(build(), null, 1) + '\n';
if (check) {
  if (!existsSync(OUT)) { console.log('FAIL  astro/reference-exists  没有对拍夹具 —— 先跑一次 make-reference.ts'); process.exit(1); }
  const cur = readFileSync(OUT, 'utf8');
  // 不比行尾：数据文件已标 -text，但 autocrlf=true 的机器上一次 checkout 就能把 CRLF 换回来，
  // 那条红会指向行尾而不是口径（本批 rebase 后真撞上过一次）。
  const eolFree = (s: string) => s.replace(/\r\n/g, '\n');
  if (eolFree(cur) !== eolFree(next)) {
    console.log('FAIL  astro/reference-reproducible  重算的对拍夹具与仓库里那份不一致 —— 要么星历源/口径变了，要么引擎升了版');
    console.log('      确认过之后重跑 make-reference.ts（不带 --check）把新的钉住');
    process.exit(1);
  }
  console.log('PASS  astro/reference-reproducible  从仓库里的原始星历输出重算，夹具逐字一致');
} else if (runDirect) {
  writeFileSync(OUT, next);
  const j = JSON.parse(next);
  console.log(`写了 ${j.count} 个对拍点；各星最大 |Δ黄经|（度）：`);
  for (const [k, v] of Object.entries(j.maxAbsDLon)) console.log(`  ${k.padEnd(8)} ${v}`);
}
