// 生成/核对「本命行星位置」与 JPL Horizons 的对拍夹具。
//
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/astro-acceptance/make-reference.ts --write          # 重算并写夹具
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
import { computePlanets, PLANETS, ASTRO_BASIS, ASTRO_CROSS_CHECK } from '../../frontend/lib/astro/planets';

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
    // 秒是可省的：Horizons 对"2 分钟一步"这种表只打印到分（月亮换座那一份就是这样），
    // 而对旧的"6192000 分钟一步"打印到秒。少了这一档就当没有这行 —— 那不是"没数据"，那是安静地丢掉一半样本。
    const m = /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(.+?)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s*$/.exec(line);
    if (!m) continue;
    const mon = MON.indexOf(m[2]);
    if (mon < 0) throw new Error(`认不出的月份缩写 ${m[2]}（${file}）`);
    const sec = m[6] === undefined ? 0 : +m[6];
    const utcMs = Date.UTC(+m[1], mon, +m[3], +m[4], +m[5], sec);
    rows.push({
      iso: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${String(sec).padStart(2, '0')} UT`,
      utcMs, lon: +m[8], lat: +m[9],
    });
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
  const maxLatByBody: Record<string, number> = {};
  const outMaxByBody: Record<string, number> = {};
  // 对拍窗口：≤2100 的那一段按 0.02° 硬判，>2100 的那一段单独记（见下面 window/outOfWindow）。
  // 这两个数取自 lib/astro/planets.ts 的 ASTRO_CROSS_CHECK —— 页面上写的、夹具里存的、判据核的必须是同一个来源。
  const WINDOW_TO = ASTRO_CROSS_CHECK.to;
  let de = '';
  // 文件名的形状：body-<编号>.txt 与 body-<编号>-<标签>.txt（标签 = ingress / 1860 / 2160）。
  // 批F⑤ 要往对拍集里加"月亮贴换座边界"和"1900 前 + 远未来"两类历元，
  // 而这两类必须与常规那批能被区分开来看 —— 同一颗星分几个文件抓，就靠这段标签分。
  for (const f of readdirSync(RAW).filter(n => /^body-\d{2,3}(?:-[a-z0-9]+)?\.txt$/.test(n)).sort()) {
    const id = /^body-(\d{2,3})/.exec(f)![1];
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
      // 黄纬与黄经走同一条线：两个都是"那一颗星在不在你说的那个位置"，
      // 只钉经度的话，"黄纬整个算错符号/算了别的平面"这一类错就没人管。
      // 逐星最大值按窗口内/窗口外分开累加：混在一起的话，2160 那两行会把月亮顶到 0.042°，
      // 看上去就像"月亮一直贴着线"，而真相是"窗口外那一批才长那么多"。
      if (new Date(r.utcMs).getUTCFullYear() <= WINDOW_TO) {
        maxByBody[key] = Math.max(maxByBody[key] || 0, Math.abs(d));
        maxLatByBody[key] = Math.max(maxLatByBody[key] || 0, Math.abs(dLat));
      } else {
        outMaxByBody[key] = Math.max(outMaxByBody[key] || 0, Math.abs(d), Math.abs(dLat));
      }
    }
  }
  if (!samples.length) throw new Error('一行样本都没有 —— 这份对拍等于没跑');
  const missing = Object.keys(BODY_ID).filter(k => !samples.some(s => s.body === BODY_ID[k]));
  if (missing.length) throw new Error(`有 ${missing.length} 颗星没进对拍集：${missing.join('、')} —— 少一颗就是那一颗没人核过`);
  const years = samples.map(s => +/^(\d{4})/.exec(s.iso)![1]);
  const moon = samples.filter(s => s.body === 'moon');
  // 月亮离"换座那条线"最近的一点：贴边界的那些点才是能咬出 0°/30° 处理错误的样本
  // （差一位就整条线错，而离边界远的点错了也还在同一个星座里）。
  const boundary = moon.map(s => {
    const into = ((s.refLon % 30) + 30) % 30;
    return { iso: s.iso, refLon: s.refLon, degFromBoundary: Math.round(Math.min(into, 30 - into) * 1e6) / 1e6 };
  }).sort((a, b) => a.degFromBoundary - b.degFromBoundary)[0];
  // 对拍窗口画在 1850—2100：这一段里十颗星（含 1860 那两端）全部落在 0.02° 内。
  // 2160 那一批是**实测超线**的：月亮 0.042°（≈它自己 4 分钟的走时），其余 ≤0.0055°。
  // 这不是把线放宽的理由，也不是把 2160 删掉的理由 —— 删掉就等于假装没测过。
  // 所以分成两格记：窗口内按 0.02° 硬判，窗口外单独存档并配一条自己的上限（0.06°），
  // 上限的价值不是"精确到 0.06"，是"远未来又长了一截得有人看见"+"页面上那句有效窗口不是空话"。
  const inWin = samples.filter(s => +/^(\d{4})/.exec(s.iso)![1] <= WINDOW_TO);
  const outWin = samples.filter(s => +/^(\d{4})/.exec(s.iso)![1] > WINDOW_TO);
  return {
    basis: ASTRO_BASIS,
    source: {
      authority: 'NASA JPL Horizons On-Line Ephemeris System（API，' + (de || 'DE441') + '）',
      geometry: '观测中心 = Earth (399) 的地心；REF_PLANE=ECLIPTIC；EPHEM_TYPE=OBSERVER（含光行差的视位置）',
      quantities: 'ObsEcLon / ObsEcLat（列义取自每份原始输出的 Column meaning 段）',
      note: '地心、回归黄道、无 ayanamsa —— 与 lib/astro/planets.ts 的口径同一条。'
        + '本站不排宫位也不做相位，所以对拍只核到"那一颗在黄道上哪儿"。'
        + '1962 年之前的 ΔT/EOP 由 Horizons 用经验式补（原始输出表头里带着 EOP coverage 那一行），'
        + '而 1972 之前打印的时间列是 UT（≈UT1）不是 UTC —— 差值最大约十几秒，'
        + '对月亮是 ≤0.002°、对行星更小，落在下面那条线以内，但它是"1860 那一格为什么比 2000 那一格偏得多"的一部分原因。',
      capturedFrom: 'tools/astro-acceptance/horizons/body-*.txt（原始输出随仓库提交）',
    },
    // 公差 0.02° = 1.2 角分，只管窗口内（1850—2100）。为什么是这个数：
    //   · 判"哪一宫/哪一宿"至少差 1°，判"换历时算错年"差 0.5° 以上，都远大于它；
    //   · "漏了光行差""用了 J2000 平黄道而不是当日真黄道""章动没算"这三类错的量级
    //     分别是 0.006° / 1.4° / 0.004° —— 前两类必须被这条咬住，第三类与引擎本身同量级，
    //     所以线的价值在于"变了就红"，不在宣称"精确到角分"。
    //   · 窗口内实测最大 0.0055°（水星，2160 那批不计；窗口内最大是海王星 0.00478°），
    //     离 0.02 还有 4 倍余量 —— 贴着最大值定线会让下次抓一批新历元时无缘无故红。
    //   · 黄纬与黄经走同一条线：两个都是"那颗星在黄道面上的哪儿"的两半，
    //     只钉经度的话"整个换了参考平面/符号反了"这一类错没人管。实测最大 0.0051°（土星）。
    // 月亮每 2 分钟走 0.02°，所以它同时也是"时刻有没有算错两分钟"的探针。
    toleranceDeg: ASTRO_CROSS_CHECK.toleranceDeg,
    window: {
      from: ASTRO_CROSS_CHECK.from, to: ASTRO_CROSS_CHECK.to,
      note: '这一段是本站敢按 0.02° 硬判的历元范围（含 1860 那批：DE441 积分区间 1855—2200 的前端，'
        + '而 1972 之前表头打印的是 UT≈UT1，差值十几秒，落在月亮上 ≤0.002°，实测通过）。'
        + '页面上"对拍窗口"那一句必须与这两个数一致 —— 由 astro/page-states-window 钉。',
    },
    // 窗口外（>2100）单独记：实测最大 0.042°（月亮，2160），其余 ≤0.0055°。
    // 这条上限不是精度承诺，是"远未来又长一截就得有人看见"；产品侧对 2100 之后不打包票。
    outOfWindowToleranceDeg: 0.06,
    maxAbsDLon: Object.fromEntries(Object.entries(maxByBody).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])),
    maxAbsDLat: Object.fromEntries(Object.entries(maxLatByBody).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])),
    maxAbsOutOfWindow: Object.fromEntries(Object.entries(outMaxByBody).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6])),
    coverage: {
      yearMin: Math.min(...years), yearMax: Math.max(...years),
      pre1900: years.filter(y => y < 1900).length,
      after2100: years.filter(y => y > 2100).length,
      moonClosestToSignBoundary: boundary,
      note: '批F⑤ 加的两类样本：body-*-1860.txt / body-*-2160.txt（DE441 积分区间 1855-2200 的两端内），'
        + 'body-301-ingress.txt（月亮过一次 150° 整数界前后各 15 分钟、2 分钟一步）。'
        + '加这两类的理由不是"覆盖更宽好看"，是引擎的截断级数与 ΔT 处理在中间那一段最像自己，'
        + '而换座整数界与历元两端正是最容易安静出错的两处。',
    },
    count: samples.length,
    countInWindow: inWin.length,
    countOutOfWindow: outWin.length,
    samples,
  };
}

const check = process.argv.includes('--check');
const write = process.argv.includes('--write');
// 只有显式 --write 才动夹具。acceptance.ts 会 import 这个模块拿 build()，
// 而上一版这里无条件 writeFileSync —— 于是每跑一次验收，它先把权威侧那份对照文件重写一遍，
// 再拿"自己刚写的"去比"文件里的"，永远相等：astro/reference-reproducible 是一条自我实现的
// 断言（假绿）。证伪的方式就是把 toleranceDeg 改一下再跑：改前它照绿，改后才红。
//
// 上一版为了区分"被 import"与"被直接执行"写的是 /make-reference\.[tm]js$/，
// 那个正则要的是 `.tjs`/`.mjs` —— 直接跑的是 make-reference**.ts**，永远匹配不上，
// 于是"重算并写夹具"这一支变成一个安静什么都不做的分支（exit 0、无输出、文件没动）。
// 这就是本文件里第二条"零读数有两种成因"的现场：现在判据写成显式开关 + 认不出入口时
// 只走 import 那一条，直跑而不带开关一律报用法并退非零。
const isEntry = /[\\/]make-reference\.[cm]?[jt]sx?$/.test(process.argv[1] || '');
if (isEntry) {
  const next = JSON.stringify(build(), null, 1) + '\n';
  if (check) {
    if (!existsSync(OUT)) { console.log('FAIL  astro/reference-exists  没有对拍夹具 —— 先跑一次 make-reference.ts --write'); process.exit(1); }
    const cur = readFileSync(OUT, 'utf8');
    // 不比行尾：数据文件已标 -text，但 autocrlf=true 的机器上一次 checkout 就能把 CRLF 换回来，
    // 那条红会指向行尾而不是口径（本批 rebase 后真撞上过一次）。
    const eolFree = (s: string) => s.replace(/\r\n/g, '\n');
    if (eolFree(cur) !== eolFree(next)) {
      console.log('FAIL  astro/reference-reproducible  重算的对拍夹具与仓库里那份不一致 —— 要么星历源/口径变了，要么引擎升了版');
      console.log('      确认过之后重跑 make-reference.ts --write 把新的钉住');
      process.exit(1);
    }
    console.log('PASS  astro/reference-reproducible  从仓库里的原始星历输出重算，夹具逐字一致');
  } else if (write) {
    writeFileSync(OUT, next);
    const j = JSON.parse(next);
    console.log(`写了 ${j.count} 个对拍点（${j.coverage.yearMin}—${j.coverage.yearMax}，`
      + `1900 前 ${j.coverage.pre1900} 点 / 2100 后 ${j.coverage.after2100} 点）`);
    console.log(`窗口内 ${j.countInWindow} 点按 ${j.toleranceDeg}° 硬判 / 窗口外 ${j.countOutOfWindow} 点按 ${j.outOfWindowToleranceDeg}° 记上限`);
    console.log(`月亮离换座整数界最近：${j.coverage.moonClosestToSignBoundary.degFromBoundary}° @ ${j.coverage.moonClosestToSignBoundary.iso}`);
    console.log('各星最大偏差（度）｜Δ黄经 ｜ Δ黄纬：');
    for (const k of Object.keys(j.maxAbsDLon)) {
      console.log(`  ${k.padEnd(8)} ${String(j.maxAbsDLon[k]).padEnd(10)} ${j.maxAbsDLat[k]}`);
    }
  } else {
    console.log('既没带 --check 也没带 --write —— 什么都不做容易和"跑了但没写"混起来，所以这里直接判失败。');
    console.log('  核对：make-reference.ts --check    重算并钉住：make-reference.ts --write');
    process.exit(1);
  }
}
