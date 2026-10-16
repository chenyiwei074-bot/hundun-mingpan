// 本命星宿验收：全库循环不变量 + 引擎口径 + 农历输入通路。
//
// 用法（tsx 在 fate-reverse/bazi-engine/node_modules/.bin 下；engine.ts 用的是站里 @/* 别名，
// 外部 tsx 必须显式指认 frontend/tsconfig.json 才解析得到）：
//   cd <repo root> && NODE_PATH="<…>/fate-reverse/reproduce/node_modules" \
//     "<…>/fate-reverse/bazi-engine/node_modules/.bin/tsx" --tsconfig=frontend/tsconfig.json \
//     tools/xiu-acceptance/acceptance.ts --out=.xiu-acceptance.txt
// 完整报告写 --out=<file>（控制台只打 ASCII 摘要，Windows 控制台会把 UTF-8 截断成乱码）。
import { writeFileSync } from 'node:fs';
import { Solar } from 'lunar-typescript';
import {
  XIU_ORDER,
  queryBenMingXiu,
  xiuRelation,
} from '../../frontend/lib/xiu/engine';
import { toCivilInput } from '../../frontend/app/lib/core/yiqi-core/lunar-input';
import { XIU28 } from '../../frontend/app/lib/core/liuyao/constants';

const out = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = out('out') || '.xiu-acceptance.txt';

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}\n      ${detail}`);
};

// tianpan.ts 的 XIU_WUXING 是模块私有的，不改它，这里照抄一份做对照（对照本身就是被测项）。
const TIANPAN_XIU_WX: Record<string, string> = {
  '角': '木', '亢': '金', '氐': '土', '房': '火', '心': '火', '尾': '火', '箕': '水',
  '斗': '木', '牛': '金', '女': '土', '虚': '火', '危': '火', '室': '火', '壁': '水',
  '奎': '木', '娄': '金', '胃': '土', '昴': '火', '毕': '火', '觜': '火', '参': '水',
  '井': '木', '鬼': '金', '柳': '土', '星': '火', '张': '火', '翼': '火', '轸': '水',
};
const TIANPAN_QIN: Record<string, string> = {
  '角': '蛟', '亢': '龙', '氐': '貉', '房': '兔', '心': '狐', '尾': '虎', '箕': '豹',
  '斗': '獬', '牛': '牛', '女': '蝠', '虚': '鼠', '危': '燕', '室': '猪', '壁': '貐',
  '奎': '狼', '娄': '狗', '胃': '雉', '昴': '鸡', '毕': '乌', '觜': '猴', '参': '猿',
  '井': '犴', '鬼': '羊', '柳': '獐', '星': '马', '张': '鹿', '翼': '蛇', '轸': '蚓',
};
const GONG_OF: Record<string, string> = { 0: '东', 1: '北', 2: '西', 3: '南' };

// ── 1. 全库循环不变量：1901-01-01 .. 2099-12-31 ────────────────────────────
// 这三条是「不依赖外部锚点」的全部依据，跑通即可自证相位不失，任何一条破了
// 就说明值日循环不是我们要的那个连续 28 日周期，整个功能的下限就没了。
{
  let days = 0;
  let breaks = 0;
  let yaoMismatch = 0;
  let gongMismatch = 0;
  const seen = new Set<number>();
  // 曜 → 星期，让数据自己长出来，不预设「日曜=周日」。
  const derived = new Map<string, number>();
  const inverted = new Map<number, string>();
  const weekCount = new Set<number>();

  let prevIndex = -1;
  const start = Solar.fromYmd(1901, 1, 1);
  const TOTAL = 72684;
  for (let i = 0; i < TOTAL; i++) {
    const s = start.next(i);
    const l = s.getLunar();
    const zi = l.getXiu();
    const index = XIU_ORDER.findIndex(n => n[0] === zi);
    if (index < 0) { breaks++; days++; continue; }
    days++;
    seen.add(index);

    if (prevIndex >= 0 && index !== (prevIndex + 1) % 28) breaks++;
    prevIndex = index;

    const yao = XIU_ORDER[index][1];
    const week = s.getWeek();
    weekCount.add(week);
    const known = derived.get(yao);
    if (known === undefined) derived.set(yao, week);
    else if (known !== week) yaoMismatch++;
    const owner = inverted.get(week);
    if (owner === undefined) inverted.set(week, yao);
    else if (owner !== yao) yaoMismatch++;

    if (l.getGong() !== GONG_OF[Math.floor(index / 7)]) gongMismatch++;
  }
  ok('sweep/day-count', days === TOTAL && start.next(TOTAL - 1).toYmd() === '2099-12-31',
    `扫描 ${days} 天，第 ${TOTAL} 天为 ${start.next(TOTAL - 1).toYmd()}，期望 2099-12-31`);
  ok('sweep/cycle-plus-one', breaks === 0, `宿序逐日 +1（mod 28）不符 ${breaks} 处`);
  ok('sweep/coverage-28', seen.size === 28, `覆盖宿数 ${seen.size}，期望 28`);
  ok('sweep/yao-week', yaoMismatch === 0,
    `曜↔星期冲突 ${yaoMismatch} 处；推导映射 ${[...derived.entries()].map(([k, v]) => `${k}曜=${v}`).sort().join(' ')}，星期值域 ${weekCount.size} 个`);
  ok('sweep/gong-quadrant', gongMismatch === 0, `四方分组（index/7）与 getGong() 不符 ${gongMismatch} 处`);
}

// ── 2. 宿表复用：不得出现第三份表 ──────────────────────────────────────────
{
  ok('table/same-reference', XIU_ORDER === XIU28, 'XIU_ORDER 就是 constants.XIU28 那个引用，未另抄');
  let wxBad: string[] = [];
  let qinBad: string[] = [];
  for (const full of XIU28) {
    const zi = full[0];
    const yao = full[1];
    const wx = (yao === '日' || yao === '月') ? '火' : yao;
    if (TIANPAN_XIU_WX[zi] !== wx) wxBad.push(`${zi}:${TIANPAN_XIU_WX[zi]}≠${wx}`);
    if (TIANPAN_QIN[zi] !== full[2]) qinBad.push(`${zi}:${TIANPAN_QIN[zi]}≠${full[2]}`);
  }
  ok('table/wuxing-from-yao', wxBad.length === 0, `曜推五行与 tianpan XIU_WUXING 不符 ${wxBad.length}/28：${wxBad.join(' ') || '无'}`);
  ok('table/qin', qinBad.length === 0, `宿名末字与 tianpan QIN_XIANG 不符 ${qinBad.length}/28：${qinBad.join(' ') || '无'}`);
}

// ── 3. 引擎金标准日 ────────────────────────────────────────────────────────
{
  const r = queryBenMingXiu(2026, 10, 16);
  ok('golden/2026-10-16', r.ben.fullName === '亢金龙', `得 ${r.ben.fullName}，期望 亢金龙`);
  ok('golden/index-and-gong', r.ben.index === 1 && r.ben.gong === '东' && r.ben.sixiang === '苍龙',
    `序 ${r.ben.index}、${r.ben.gong}${r.ben.sixiang}`);
  ok('golden/wuxing', r.ben.wuxing === '金', `五行 ${r.ben.wuxing}，期望 金（亢金星）`);
  ok('golden/weekday-yao', r.ben.yao === '金' && r.ben.week === '五',
    `曜 ${r.ben.yao}、星期${r.ben.week} —— 金曜应落星期五`);
  ok('golden/28-day-period', queryBenMingXiu(2026, 11, 13).ben.fullName === r.ben.fullName,
    `28 日后的 2026-11-13 仍为 ${queryBenMingXiu(2026, 11, 13).ben.fullName}`);

  const textKeys = ['fullName', 'xiu', 'yao', 'qin', 'wuxing', 'gong', 'sixiang', 'luck', 'song', 'nature'] as const;
  const empty = textKeys.filter(k => !String(r.ben[k]).trim());
  ok('golden/no-empty-field', empty.length === 0, `空字段 ${empty.length}：${empty.join(' ') || '无'}`);
  ok('golden/steps-basis', r.steps.length >= 5 && r.basis.length >= 5,
    `取数 ${r.steps.length} 条、口径 ${r.basis.length} 条`);
  ok('golden/cycle-and-yao-disclosed',
    r.basis.some(b => b.includes('28 日一周')) && r.steps.every(s => !/undefined|NaN/.test(s)),
    `口径含循环说明 ${r.basis.some(b => b.includes('28 日一周'))}，步骤无 undefined/NaN 泄漏`);
}

// ── 4. 二十八宿逐个过一遍引擎（含值日诗、吉凶、性语）────────────────────────
{
  // 找 28 个连续日子必然把 28 宿各命中一次；顺带检查每宿的文案非空、吉凶二值。
  let start = Solar.fromYmd(2026, 1, 1);
  const idx0 = XIU28.findIndex(n => n[0] === start.getLunar().getXiu());
  start = start.next(((28 - idx0) % 28));
  const hit = new Set<string>();
  const bad: string[] = [];
  for (let i = 0; i < 28; i++) {
    const s = start.next(i);
    const r = queryBenMingXiu(s.getYear(), s.getMonth(), s.getDay());
    const b = r.ben;
    hit.add(b.fullName);
    if (b.index !== i) bad.push(`${b.fullName} 序 ${b.index}`);
    if (!b.song || b.song.length < 20) bad.push(`${b.fullName} 值日诗过短`);
    if (!/^[吉凶]$/.test(b.luck)) bad.push(`${b.fullName} 吉凶=${b.luck}`);
    if (!b.nature) bad.push(`${b.fullName} 缺性语`);
    if (!['木', '火', '土', '金', '水'].includes(b.wuxing)) bad.push(`${b.fullName} 五行=${b.wuxing}`);
  }
  ok('sweep28/all-xiu-once', hit.size === 28 && bad.length === 0,
    `命中 ${hit.size} 宿，异常 ${bad.length}：${bad.slice(0, 5).join('；') || '无'}`);
}

// ── 5. 农历输入通路（运维裁定的那条）───────────────────────────────────────
{
  const c = toCivilInput({ year: 1994, month: 8, day: 15, hour: 0, minute: 0, isLunar: true });
  const back = Solar.fromYmd(c.year, c.month, c.day).getLunar();
  ok('lunar/roundtrip', back.getMonth() === 8 && back.getDay() === 15,
    `农历1994-8-15 → 公历 ${c.year}-${c.month}-${c.day} → 回读 ${back.getMonthInChinese()}月${back.getDayInChinese()}`);
  const viaCivil = queryBenMingXiu(c.year, c.month, c.day);
  const civilStr = `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
  ok('lunar/engine-on-civil', viaCivil.ben.civil === civilStr,
    `命宿取的是换算后的公历日 ${viaCivil.ben.civil}（${viaCivil.ben.fullName}）`);

  const leap = toCivilInput({ year: 2023, month: 2, day: 10, hour: 0, minute: 0, isLunar: true, isLeapMonth: true });
  const leapBack = Solar.fromYmd(leap.year, leap.month, leap.day).getLunar();
  ok('lunar/leap-month', leapBack.getMonth() === -2,
    `2023 闰二月初十 → 公历 ${leap.year}-${leap.month}-${leap.day}，回读月号 ${leapBack.getMonth()}（负数=闰）`);
  const rLeap = queryBenMingXiu(leap.year, leap.month, leap.day, {
    originalInput: '2023年闰二月十日', fromLunar: true,
  });
  ok('lunar/echo-in-result', rLeap.input.fromLunar && rLeap.input.original.includes('闰二月') &&
    rLeap.basis[0].includes('闰二月'), `回显 ${rLeap.input.original} → ${rLeap.input.civil}；口径首条「${rLeap.basis[0]}」`);
}

// ── 6. 输入护栏 ────────────────────────────────────────────────────────────
{
  const guard = (id: string, fn: () => unknown, want: string) => {
    let msg = '(没有抛错)';
    try { fn(); } catch (e) { msg = e instanceof Error ? e.message : String(e); }
    ok(id, msg.includes(want), `抛错「${msg}」，期望含「${want}」`);
  };
  guard('guard/year-low', () => queryBenMingXiu(1900, 1, 1), '1901 至 2099');
  guard('guard/year-high', () => queryBenMingXiu(2100, 1, 1), '1901 至 2099');
  guard('guard/fake-day', () => queryBenMingXiu(2026, 2, 30), '日期不存在');
  guard('guard/fake-month', () => queryBenMingXiu(2026, 13, 1), '日期不存在');
  // 库本身不拦 2 月 30（Solar.fromYmd 直接造出 2026-02-30 并照常给宿），所以这层必须自己拦。
  guard('guard/other-validated', () => queryBenMingXiu(2026, 10, 16, { other: { y: 2026, m: 2, d: 30 } }), '对方');
  guard('guard/other-year', () => queryBenMingXiu(2026, 10, 16, { other: { y: 1899, m: 5, d: 5 } }), '1901 至 2099');
}

// ── 7. 五行生克与相配刻度 ──────────────────────────────────────────────────
{
  const WX = ['木', '火', '土', '金', '水'];
  const rels = new Set<string>();
  let asym = 0;
  for (const a of WX) for (const b of WX) {
    const ab = xiuRelation(a, b);
    rels.add(ab);
    const ba = xiuRelation(b, a);
    const want: Record<string, string> = { 生我: '我生', 我生: '生我', 克我: '我克', 我克: '克我', 比和: '比和' };
    if (want[ab] !== ba) asym++;
  }
  ok('pair/relation-closed', rels.size === 5 && asym === 0,
    `五关系闭合（得 ${rels.size} 个：${[...rels].join('/')}），方向互反不符 ${asym} 处`);

  const same = queryBenMingXiu(2026, 10, 16, { other: { y: 2026, m: 10, d: 16 } });
  ok('pair/same-day', !!same.pair && same.pair.sameXiu && same.pair.a === '比和' && same.pair.b === '比和',
    `同生日 → ${same.pair?.level} ${same.pair?.score}，关系 ${same.pair?.a}/${same.pair?.b}`);

  // 分数刻意站在「我」这一侧，所以换输入次序它会变，关系方向必须镜像。
  const p1r = queryBenMingXiu(2026, 10, 16, { other: { y: 2026, m: 10, d: 20 } });
  const p2r = queryBenMingXiu(2026, 10, 20, { other: { y: 2026, m: 10, d: 16 } });
  const p1 = p1r.pair!;
  const p2 = p2r.pair!;
  ok('pair/relations-mirror', p1.a === p2.b && p1.b === p2.a,
    `方向 ${p1.a}/${p1.b} 对调后 ${p2.b}/${p2.a}`);

  // 把自研刻度钉成可复算的式子：任何权重改动都要在这里同步，否则分数就成了黑箱。
  const BASE: Record<string, number> = { 生我: 22, 比和: 14, 我克: 6, 我生: -6, 克我: -20 };
  const LUCK: Record<string, number> = { 吉: 4, 凶: -4 };
  const recompute = (r: ReturnType<typeof queryBenMingXiu>) => {
    const p = r.pair!;
    return Math.max(4, Math.min(96,
      50 + BASE[p.a] + LUCK[r.ben.luck] + LUCK[p.other.luck] + (p.sameXiu ? 4 : 0)));
  };
  let scoreBad: string[] = [];
  const seenLevel = new Set<string>();
  const seenScore: number[] = [];
  // 只复算不等于算对：上一版这里照抄了代码取的 relB，于是代码把刻度弄反时测试跟着一起绿。
  // 所以再加一条「意向序」：把吉凶与同宿的加成剥掉，剩下的必须严格按
  // 生我 > 比和 > 我克 > 我生 > 克我 分离 —— 站在「我被怎样对待」这一侧。
  const relBase = new Map<string, Set<number>>();
  for (let i = 0; i < 28; i++) {
    for (let j = 0; j < 28; j++) {
      const a = Solar.fromYmd(2026, 1, 1).next(i);
      const b = Solar.fromYmd(2026, 1, 1).next(j);
      const r = queryBenMingXiu(a.getYear(), a.getMonth(), a.getDay(),
        { other: { y: b.getYear(), m: b.getMonth(), d: b.getDay() } });
      if (!r.pair) continue;
      seenLevel.add(r.pair.level);
      seenScore.push(r.pair.score);
      if (r.pair.score !== recompute(r)) scoreBad.push(`${r.pair.score}≠${recompute(r)}`);
      if (r.pair.score < 4 || r.pair.score > 96) seenLevel.add('越界!');
      if (!r.pair.myText) seenLevel.add('缺文案!');
      const stripped = r.pair.score - LUCK[r.ben.luck] - LUCK[r.pair.other.luck]
        - (r.pair.sameXiu ? 4 : 0);
      const key = r.pair.a;
      if (!relBase.has(key)) relBase.set(key, new Set());
      relBase.get(key)!.add(stripped);
    }
  }
  ok('pair/score-recomputable', scoreBad.length === 0,
    `按公开权重复算不符 ${scoreBad.length} 处：${scoreBad.slice(0, 4).join(' ') || '无'}`);
  const order = ['生我', '比和', '我克', '我生', '克我'];
  const one = order.map(k => (relBase.get(k) || new Set<number>()));
  const single = one.every(s => s.size === 1);
  const vals = one.map(s => [...s][0]);
  const strict = vals.every((v, i) => i === 0 || v < vals[i - 1]);
  ok('pair/intent-ordering', single && strict && one.every(s => s.size === 1),
    `剥离吉凶后的底分 ${order.map((k, i) => `${k}=${single ? vals[i] : '?'}`).join(' > ')}，` +
    `五档各只有一个值 ${single}，严格递减 ${strict}`);
  ok('pair/score-in-range', !seenLevel.has('越界!') && !seenLevel.has('缺文案!') &&
    Math.min(...seenScore) >= 4 && Math.max(...seenScore) <= 96,
    `28 组样本分数 ${Math.min(...seenScore)}..${Math.max(...seenScore)}，档位 ${[...seenLevel].join('/')}`);
}

// ── 8. 边界日：跨年、年末、2 月 29 ─────────────────────────────────────────
{
  const edge = [
    { y: 2024, m: 2, d: 29 },
    { y: 2026, m: 1, d: 1 },
    { y: 2026, m: 12, d: 31 },
    { y: 2027, m: 1, d: 1 },
  ];
  const got = edge.map(e => queryBenMingXiu(e.y, e.m, e.d).ben.fullName);
  ok('edge/leap-day', got[0].length === 3, `2024-02-29 → ${got[0]}`);
  ok('edge/year-rollover', (XIU28.findIndex(n => n[0] === got[2][0]) + 1) % 28 ===
    XIU28.findIndex(n => n[0] === got[3][0]), `12-31 ${got[2]}（序 ${XIU28.findIndex(n => n[0] === got[2][0])}）→ 01-01 ${got[3]}，跨年仍 +1`);
}

const report = `二十八宿验收  ${new Date().toISOString()}\n通过 ${pass} 失败 ${fail}\n\n${lines.join('\n')}\n`;
writeFileSync(OUT, report, 'utf8');
// 控制台只打 ASCII，Windows 控制台会把 UTF-8 截成乱码。
process.stdout.write(`xiu-acceptance: pass=${pass} fail=${fail}\nreport: ${OUT}\n`);
if (fail > 0) process.exitCode = 1;
