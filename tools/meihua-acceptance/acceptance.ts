// 梅花易数验收：金标准卦例 + 体互取位 + 结构不变量全量扫描 + 与站点八字引擎的年柱口径对照。
// 用法（tsx 在 fate-reverse/bazi-engine/node_modules/.bin 下；engine.ts 用的是站里 @/* 别名，
// 外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到）：
//   cd <repo root> && NODE_PATH="<…>/fate-reverse/reproduce/node_modules" \
//     "<…>/fate-reverse/bazi-engine/node_modules/.bin/tsx" --tsconfig=frontend/tsconfig.json \
//     tools/meihua-acceptance/acceptance.ts --out=.scratch-mh/meihua-acceptance.txt
// 完整报告写 --out=<file>（控制台只打 ASCII 摘要，Windows 控制台会把 UTF-8 截断成乱码）。
import { writeFileSync } from 'node:fs';
import {
  XIANTIAN,
  qiGuaByLunarNumbers,
  qiGuaByNumbers,
  qiGuaByTime,
  relate,
} from '../../frontend/lib/meihua/engine';
import { S64, ZHI } from '../../frontend/lib/liuyao/core';
import { createBaziChart } from '../../frontend/app/lib/core/yiqi-core/bazi';

const out = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = out('out') || '.meihua-acceptance.txt';

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}\n      ${detail}`);
};

const WUXING = ['木', '火', '土', '金', '水'];
const guaNames = new Set(Object.values(S64));

// ── 1. 金标准：观梅占（辰年十二月十七日申时）──────────────────────────────
{
  const r = qiGuaByLunarNumbers(ZHI.indexOf('辰') + 1, 12, 17, ZHI.indexOf('申') + 1);
  ok('guanmei-zhan/gua', r.ben.name === '泽火革', `本卦 ${r.ben.name}，期望 泽火革`);
  ok('guanmei-zhan/dong', r.dongYao === 1, `动爻 ${r.dongYao}，期望 1`);
  ok('guanmei-zhan/bian', r.bian.name === '泽山咸', `变卦 ${r.bian.name}，期望 泽山咸`);
  ok('guanmei-zhan/hu', r.hu.name === '天风姤', `互卦 ${r.hu.name}，期望 天风姤`);
  ok('guanmei-zhan/tiyong', r.ti.name === '兑' && r.yong.name === '离',
    `体${r.ti.name} 用${r.yong.name}，期望 体兑 用离`);
  ok('guanmei-zhan/relation', r.relation === '用克体',
    `${r.relation}（离火克兑金），期望 用克体`);
  // 体卦在外（上卦兑），故三四五爻之上互乾为体互；乾金与体兑金比和，古籍所谓「乾金助体」。
  ok('guanmei-zhan/hu-ti', r.huTi === '乾' && r.huYong === '巽' && r.huRelation === '体用比和',
    `体互${r.huTi} 用互${r.huYong}，${r.huRelation}；期望 体互乾 用互巽 体用比和`);
}

// ── 1b. 体互方向的另一侧：动爻在上（体卦在内）─────────────────────────────
{
  // 报 7,5,4 → 艮/巽 = 山风蛊，四爻动 → 体为下卦巽（内），故二三四爻之下互兑为体互。
  const r = qiGuaByNumbers([7, 5, 4], 'report');
  ok('hu-ti/inner-side', r.ben.name === '山风蛊' && r.hu.name === '雷泽归妹'
    && r.ti.name === '巽' && r.huTi === '兑' && r.huYong === '震',
    `${r.ben.name} 动${r.dongYao}（互${r.hu.name}）体${r.ti.name} 体互${r.huTi} 用互${r.huYong}，期望 蛊/归妹 体巽 体互兑 用互震`);
  ok('hu-ti/inner-relation', r.huRelation === '用克体',
    `${r.huRelation}（兑金克巽木），期望 用克体`);
}

// ── 2. 整除规则：余 0 作满数（卦 8、爻 6）─────────────────────────────────
{
  const r = qiGuaByNumbers([8, 16], 'number');
  ok('mod-rule/gua-0-as-8', r.ben.shangGua === '坤' && r.ben.xiaGua === '坤',
    `上${r.ben.shangGua} 下${r.ben.xiaGua}，期望 坤/坤（8%8=0→8）`);
  ok('mod-rule/dong-0-as-6', r.dongYao === 6, `动爻 ${r.dongYao}，期望 6（24%6=0→6）`);
  ok('mod-rule/bian-flips-top', r.bian.name === '山地剥' && r.bian.lines[5] === 1,
    `变卦 ${r.bian.name}，期望 山地剥（上爻由阴变阳）`);
  const three = qiGuaByNumbers([7, 9, 12], 'report');
  ok('mod-rule/third-num-dong', three.dongYao === 6,
    `报数 7,9,12 → 动爻 ${three.dongYao}，期望 6（12%6=0→6）`);
  ok('mod-rule/third-num-gua', three.ben.shangGua === '艮' && three.ben.xiaGua === '乾',
    `上${three.ben.shangGua}(${XIANTIAN[6]}) 下${three.ben.xiaGua}，期望 艮/乾`);
}

// ── 3. 结构不变量：全量年月日时组合 ───────────────────────────────────────
{
  let badName = 0, badBian = 0, badHu = 0, badTiYong = 0, badPure = 0, badHuTi = 0, total = 0;
  for (let nZ = 1; nZ <= 12; nZ++) {
    for (let yue = 1; yue <= 12; yue++) {
      for (let ri = 1; ri <= 30; ri++) {
        for (let hZ = 1; hZ <= 12; hZ++) {
          const r = qiGuaByLunarNumbers(nZ, yue, ri, hZ);
          total++;
          if (!guaNames.has(r.ben.name) || !guaNames.has(r.hu.name) || !guaNames.has(r.bian.name)) badName++;
          // 变卦只允许动爻那一条与本卦不同。
          const diff = r.ben.lines.map((v, i) => (v !== r.bian.lines[i] ? i + 1 : 0)).filter(v => v > 0);
          if (diff.length !== 1 || diff[0] !== r.dongYao) badBian++;
          const b = r.ben.lines;
          const wantHu = [b[1], b[2], b[3], b[2], b[3], b[4]];
          if (r.hu.lines.some((v, i) => v !== wantHu[i])) badHu++;
          // 动爻在下卦（1..3）→ 体为上卦、用为下卦；在上卦（4..6）→ 反之。
          const wantTi = r.dongYao <= 3 ? r.ben.shangGua : r.ben.xiaGua;
          const wantYong = r.dongYao <= 3 ? r.ben.xiaGua : r.ben.shangGua;
          if (r.ti.name !== wantTi || r.yong.name !== wantYong) badTiYong++;
          // 体与用同名只允许发生在八纯卦（上下卦本来就同一元卦）。
          if (r.ti.name === r.yong.name && r.ben.shangGua !== r.ben.xiaGua) badPure++;
          // 体互与体卦同位：体在上（动爻 4..6 之外）取上互，体在下取下互，两位恰好铺满互卦。
          const wantHuTi = r.dongYao <= 3 ? r.hu.shangGua : r.hu.xiaGua;
          const wantHuYong = r.dongYao <= 3 ? r.hu.xiaGua : r.hu.shangGua;
          if (r.huTi !== wantHuTi || r.huYong !== wantHuYong) badHuTi++;
        }
      }
    }
  }
  ok(`invariant/sweep-${total}`,
    badName === 0 && badBian === 0 && badHu === 0 && badTiYong === 0 && badPure === 0 && badHuTi === 0,
    `卦名越界 ${badName} ／ 变卦错位 ${badBian} ／ 互卦算法不符 ${badHu} ／ 体用判定不符 ${badTiYong} ／ `
    + `非纯卦体用同名 ${badPure} ／ 体互取位不符 ${badHuTi}`);
}

// ── 4. 生克关系全覆盖 ─────────────────────────────────────────────────────
{
  const seen = new Set<string>();
  let selfBad = 0;
  for (const a of WUXING) {
    for (const b of WUXING) {
      const r = relate(a, b);
      seen.add(r);
      if (a === b && r !== '体用比和') selfBad++;
    }
  }
  ok('relate/5-kinds', seen.size === 5 && selfBad === 0,
    `覆盖 ${[...seen].join('、')}，共 ${seen.size} 种`);
}

// ── 5. 年支口径：与站点八字引擎的年柱地支逐条对齐 ─────────────────────────
{
  const cases: [number, number, number, number, string][] = [
    [2023, 2, 4, 10, '立春前一刻'],
    [2023, 2, 4, 11, '立春后一刻'],
    [2023, 1, 22, 12, '正月初一（立春前，年柱不该跟着正月初一走）'],
    [2023, 2, 5, 0, '立春次日'],
    [2026, 10, 16, 8, '今日'],
  ];
  for (const [y, m, d, hh, label] of cases) {
    const mh = qiGuaByTime(new Date(y, m - 1, d, hh, 0, 0));
    const chart: any = createBaziChart({
      year: y, month: m, day: d, hour: hh, minute: 0,
      isLunar: false, gender: 'male', timeZone: 8, enableTrueSolarTime: false,
    } as any);
    const baziZhi = chart.siZhu?.year?.zhi ?? '?';
    ok(`year-boundary/${y}-${m}-${d}T${hh}`, mh.when?.nianZhi === baziZhi,
      `${label}：梅花取年支${mh.when?.nianZhi}（数${ZHI.indexOf(mh.when!.nianZhi) + 1}），八字年柱${baziZhi}`);
  }
}

// ── 6. 晚子时换日：23 时与次日 00:30 应成同一卦 ───────────────────────────
{
  const a = qiGuaByTime(new Date(2023, 1, 4, 23, 0, 0));
  const b = qiGuaByTime(new Date(2023, 1, 5, 0, 30, 0));
  ok('late-zi/same-gua', a.ben.name === b.ben.name && a.dongYao === b.dongYao,
    `02-04 23:00 ${a.ben.name}动${a.dongYao}（农历${a.when?.lunar}）vs 02-05 00:30 ${b.ben.name}动${b.dongYao}（农历${b.when?.lunar}）`);
  const c = qiGuaByTime(new Date(2023, 1, 4, 22, 30, 0));
  ok('late-zi/2230-stays-put', a.ben.name !== c.ben.name || a.when?.lunar !== c.when?.lunar,
    `22:30 属亥时，${c.ben.name}动${c.dongYao}（农历${c.when?.lunar}）不该与 23:00 同人一卦`);
}

// ── 7. 今日盘抽样，供人工核对 ─────────────────────────────────────────────
{
  const r = qiGuaByTime(new Date(2026, 9, 16, 10, 30, 0));
  say(`SMOKE  2026-10-16 10:30 → ${r.ben.name} 动第${r.dongYao}爻 → ${r.bian.name}（互 ${r.hu.name}）`
    + ` 体${r.ti.name}${r.ti.wuxing} 用${r.yong.name}${r.yong.wuxing} ${r.relation} 指数${r.score}`);
  say('       ' + r.steps.join('\n       '));
}

writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
process.stdout.write(`MEIHUA ACCEPTANCE: ${pass} passed, ${fail} failed (report: ${OUT})\n`);
if (fail) process.stdout.write('SEE REPORT\n');
process.exit(fail ? 1 : 0);
