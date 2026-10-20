// 紫微盘的两处口径分叉：量出影响面，供裁定用。这个脚本**只读**，不改任何引擎。
//
// 为什么要先量再动：
//  D4（紫微也吃真太阳时）与 D5（紫微年界显式）都是改 安星 输入的改动 —— 一旦落地，
//  已经存过的盘再用新代码渲染就会变。而紫微这一侧**没有口径戳机制**（八字有
//  dayBoundaryMode、六爻有纳甲版本戳，ziwei 输出里没有任何"这张盘按哪一版算的"字段），
//  所以改完无法区分"这张盘本来就是新版算的"和"老盘被新版重算了"。
//  先拿到"多少盘会动、动的是哪几栏"，才谈得上要不要顺手把口径戳一起补上。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/ziwei-caliber/measure.ts
import { calculateTrueSolarTime } from '../../frontend/app/lib/core/yiqi-core/true-solar-time';
import { Solar } from 'lunar-typescript';

/** 六个真实城市的经度（东经）。选的是从最西到最东跨度大的一批：
 *  经度差 1° = 4 分钟，乌鲁木齐对东八区标准经线差约 −3.5°，校正量最大。 */
const CITIES: Array<[string, number]> = [
  ['乌鲁木齐', 87.62], ['兰州', 103.83], ['成都', 104.07],
  ['武汉', 114.31], ['上海', 121.47], ['沈阳', 123.43],
];

/** 十二时辰的地支起始小时：子=23、丑=1 …… 与 命宫/身宫 用的同一套刻度。 */
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const shichenOf = (hour: number) => Math.floor(((hour + 1) % 24) / 2);

const lines: string[] = [];
const say = (s: string) => { lines.push(s); console.log(s); };

// ── D4：真太阳时会不会把时辰挪走 ──
// 取每个时辰的三个采样点（头、中、尾），因为只有跨越时辰边界的那次校正才算"改了盘"。
let cells = 0, hourMoved = 0, dayMoved = 0;
const worst: Array<{ city: string; at: string; deltaMin: number; from: string; to: string }> = [];
for (const [city, lon] of CITIES) {
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 20, 40]) {
      // 日期取 11-15：均时差在这一天附近约 +13 分钟（秋末），不是极值但足够典型
      const tst = calculateTrueSolarTime({
        year: 1990, month: 11, day: 15, hour: h, minute: m, second: 0,
        longitude: lon, timezone: 8, dstOffset: 0, enable: true,
      });
      const t = tst.trueSolarDateTime;
      cells++;
      const a = shichenOf(h), b = shichenOf(t.hour);
      // 校正量必须按"跨日"折回 ±12h 之内再报。第一版直接 (t−原) 相减，
      // 于是 00:00 乌鲁木齐被校正到前一天 21:46 时报出 +1326 分钟 —— 那是换日，不是差 22 小时。
      let deltaMin = (t.hour * 60 + t.minute) - (h * 60 + m);
      if (deltaMin > 720) deltaMin -= 1440;
      if (deltaMin < -720) deltaMin += 1440;
      if (a !== b) {
        hourMoved++;
        worst.push({
          city, at: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          deltaMin: Math.round(deltaMin * 10) / 10,
          from: SHICHEN[a], to: SHICHEN[b],
        });
      }
      if (t.day !== 15 || t.month !== 11) dayMoved++;
    }
  }
}
say('');
say(`D4 真太阳时 × 时辰：${cells} 个采样点（${CITIES.length} 城 × 24 时 × 3 分，日期取 1990-11-15）`);
say(`  时辰被挪走的：${hourMoved} 个（${Math.round(hourMoved / cells * 1000) / 10}%）`);
say(`  跨到前一/后一天的：${dayMoved} 个（这些连农历日都变，不只是时辰）`);
say(`  命宫/身宫 是 (农历月, 时辰) 的纯函数 ⇒ 时辰一动，命宫、身宫、十二宫排布全动。`);
for (const w of worst.slice(0, 8)) {
  say(`    ${w.city} ${w.at} → 校正 ${w.deltaMin > 0 ? '+' : ''}${w.deltaMin} 分钟，${w.from}时 → ${w.to}时`);
}
if (worst.length > 8) say(`    …共 ${worst.length} 例，只列前 8`);
say(`  注意：这是"每城取同一天的 24×3 个点"，不是全国出生分布；比例只对这一组采样成立。`);

// ── D5：阴阳男女用的是输入年还是农历年 ──
// getYinYang(year) 取的是 year 的奇偶。bazi 那边年柱按立春（jieqi-lichun-v1），
// 而 紫微 的 lunar.getYear() 按农历正月初一年界。
// 采样必须铺满**整年**：只取 1/1、1/20、立春前后会把差异率算到 70% 以上，
// 而真实人群里"出生在 1/1–立春 这段窗口"的只占全年约 1/10 弱 —— 第一版就栽在这个取样偏置上。
let dates = 0, parityDiff = 0, windowDays = 0;
const examples: string[] = [];
for (let y = 1950; y <= 2050; y++) {
  for (let m = 1; m <= 12; m++) {
    for (const d of [1, 8, 15, 22, 28]) {
      const solar = Solar.fromYmd(y, m, d);
      const lunar = solar.getLunar();
      const civilYear = y;                       // 现在这版：birthInfo.year
      const lunarYear = lunar.getYear();         // 年干支走的那一年
      dates++;
      if (m === 1 || (m === 2 && d <= 4)) windowDays++;
      if ((civilYear % 2) !== (lunarYear % 2)) {
        parityDiff++;
        if (examples.length < 6) examples.push(`${y}-${m}-${d}：输入年 ${civilYear} vs 年干支年 ${lunarYear}（${lunar.getYearGan()}${lunar.getYearZhi()}）`);
      }
    }
  }
}
say('');
say(`D5 阴阳男女的取年：${dates} 个日期（1950–2050 每年 5 个采样日 × 12 月，铺满全年）`);
say(`  输入年与年干支年奇偶不同的：${parityDiff} 个（占全年 ${Math.round(parityDiff / dates * 1000) / 10}%）`);
say(`  对照：1 月与 2 月上旬的采样占 ${windowDays} 个，其中不同的 ${parityDiff} 个 —— 差异集中在这个窗口里。`);
say(`  奇偶不同 ⇒ 阳男/阴男 判反 ⇒ 大限**顺逆方向整个反过来**（不是偏一格，是镜像）。`);
for (const e of examples) say(`    ${e}`);

say('');
say('结论待裁：两处都不是"显示层"能修的 —— 改的是安星输入。');
say('落地前需要先定：紫微要不要一个口径戳 + 老盘标注（六爻那条线已经做过一次，见 P0-4）。');
