// 回执验收：这一层唯一的承诺是「改动一定验不过、隐私一定不出门、没锚定一定不说已上链」，
// 所以断言全部围绕这三件事做，并且每条都配一个反向用例（改坏它必须红）。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/receipt-acceptance/acceptance.ts --out=.receipt.txt
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  PLATE_EXCLUDED, PLATE_FIELDS, RECEIPT_ANCHOR_STATE_UNANCHORED, RECEIPT_VERSION,
  buildPlateReceipt, buildReportReceipt, canonical, receiptFileName, sha256Hex, verifyReceipt,
} from '../../frontend/lib/receipt/receipt';
import { GANZHI_BASIS, NAJIA_BASIS } from '../../frontend/lib/liuyao/core';
import { QISHU_BASIS } from '../../frontend/lib/meihua/engine';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { buildTimeResult } from '../../frontend/lib/liuyao/methods/time';
import { buildNumberResult } from '../../frontend/lib/liuyao/methods/number';
import { TRIGRAM_BITS } from '../liuyao-ganzhi/gold';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.receipt.txt';

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

const GOLD_DATE = new Date(2026, 9, 17, 12, 0);
const QUESTION = '今年能不能签成那单合作';

function coinPlate(dong: number) {
  const bits = TRIGRAM_BITS['兑'] + TRIGRAM_BITS['乾'];  // 下兑上乾 → 天泽履
  const records = bits.split('').map((b, i) => {
    const yang = b === '1';
    const v = i + 1 === dong ? (yang ? 9 : 6) : (yang ? 7 : 8);
    return { position: i + 1, coins: [] as never[], value: v, label: '', isDong: i + 1 === dong };
  });
  return buildCoinResult({ question: QUESTION, questionType: '合作', records: records as never, now: GOLD_DATE });
}

const plate = coinPlate(3);
const FIXED_NOW = '2026-10-18T00:00:00.000Z';
const FIXED_SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const run = async () => {
  // ── 1. 摘要实现 ──
  const abc = await sha256Hex('abc');
  ok('hash/known-vector', abc === 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    `SHA-256("abc") 对上公开测试向量：${abc.slice(0, 24)}…`);
  const samples = ['abc', canonical({ b: 1, a: [2, { d: '丁', c: null }] }), canonical(plate), '', '混沌阁', 'x'.repeat(5000)];
  let mismatch = 0;
  for (const s of samples) {
    const web = await sha256Hex(s);
    const node = 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');
    if (web !== node) mismatch++;
  }
  ok('hash/two-implementations', mismatch === 0,
    `Web Crypto 与 node:crypto 对 ${samples.length} 个输入逐字节相同（含 5KB 与中文）：不符 ${mismatch}`);

  // ── 2. 规范化 ──
  ok('canonical/key-order-insensitive',
    canonical({ a: 1, b: { c: 2, d: 3 } }) === canonical({ b: { d: 3, c: 2 }, a: 1 }),
    '对象按键排序，写法顺序不影响摘要');
  ok('canonical/array-order-matters', canonical([1, 2, 3]) !== canonical([3, 2, 1]),
    '数组保持顺序 —— 爻序变了必须变摘要，否则改一爻验不出来');
  ok('canonical/drops-undefined-and-nan',
    canonical({ x: undefined, y: 1 }) === '{"y":1}' && canonical({ n: NaN }) === '{"n":null}',
    'undefined 丢弃、NaN/Infinity 归 null（否则 JSON 里出现非法数字，两次实现会分叉）');

  // ── 3. 出回执 + 自验 ──
  const rc = await buildPlateReceipt(plate, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const v0 = await verifyReceipt(rc, { question: QUESTION });
  ok('receipt/verifies-clean', v0.ok, `新建卦盘回执自验通过：${v0.checks.map(c => `${c.field}=${c.ok ? 'T' : 'F'}`).join(' ')}`);
  const rc2 = await buildPlateReceipt(plate, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  ok('receipt/deterministic', canonical(rc) === canonical(rc2), '同盘同盐同时刻 → 回执逐字节相同（可复现，不掺时间戳噪声）');
  ok('receipt/id-is-record-hash', rc.receiptId === rc.recordHash && rc.recordHash.startsWith('sha256:'),
    `回执编号即内核摘要：${rc.recordHash.slice(0, 26)}…`);
  ok('receipt/filename-carries-digest', /^hundun-liuyao-plate-[0-9a-f]{12}\.json$/.test(receiptFileName(rc)),
    `下载文件名自带前 12 位摘要，用户存一堆文件也能对上：${receiptFileName(rc)}`);

  // ── 4. 篡改必须验不过（交付点的硬指标）──
  // 先确认改动真的改变了盘：上一版把第四爻写成它本来的干支，测试静默空过，这类
  // 「假红/假绿」只能靠断言前置条件挡住。
  const tamperedPlate = structuredClone(plate);
  const origGZ = tamperedPlate.naJia[3].ganZhi;
  tamperedPlate.naJia[3] = { ...tamperedPlate.naJia[3], ganZhi: origGZ === '甲子' ? '乙丑' : '甲子' };
  ok('tamper/payload-really-changed', tamperedPlate.naJia[3].ganZhi !== origGZ && canonical(tamperedPlate) !== canonical(plate),
    `篡改用例的前提成立：第四爻 ${origGZ} → ${tamperedPlate.naJia[3].ganZhi}，盘体序列化确有差异`);
  const rcT = await buildPlateReceipt(tamperedPlate, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const crossV = await verifyReceipt({ ...rc, plate: rcT.plate });
  ok('tamper/yao-edit-detected', !crossV.ok && crossV.checks.find(c => c.field === 'plateHash')?.ok === false,
    `改第四爻干支后 plateHash 必须红：抓到 ${crossV.checks.filter(c => !c.ok).map(c => c.field).join(',') || '（没抓到，假绿）'}`);
  const coreEdit = await verifyReceipt({ ...rc, core: { ...rc.core, castAtLocal: '2026-10-17 12:01' } });
  ok('tamper/time-edit-detected', !coreEdit.ok && coreEdit.checks.find(c => c.field === 'recordHash')?.ok === false,
    '改起卦时间后 recordHash 必须红（时间在承诺内核里，不在外面）');
  const wrongQ = await verifyReceipt(rc, { question: QUESTION + '？' });
  ok('tamper/wrong-question-detected', !wrongQ.ok && wrongQ.checks.find(c => c.field === 'subjectHash')?.ok === false,
    '换一个问题的 subjectHash 复核必须红 —— 带盐摘要真的在承诺这个问题');
  const report = await buildReportReceipt(rc, '此卦世应相克，宜缓。');
  const reportEdit = await verifyReceipt({ ...report, reportText: '此卦世应相克，宜急。' });
  ok('tamper/report-edit-detected', !reportEdit.ok,
    `解读正文改一个字，报告回执必须红：${reportEdit.checks.filter(c => !c.ok).map(c => c.field).join(',') || '（没抓到）'}`);
  ok('receipt/parent-hash-links-plate', report.core.parentHash === rc.recordHash && report.core.kind === 'liuyao-report',
    '解读回执用 parentHash 指回卦盘回执，两份分开封存、不混成一个时间点');

  // ── 5. 隐私：原文与盘外字段不得出门 ──
  const dump = JSON.stringify(rc);
  ok('privacy/no-raw-question', !dump.includes(QUESTION) && !dump.includes('"question"'),
    '回执全文不含问题原文，也不留 question 键（只留带盐摘要）');
  const plateKeys = Object.keys(plate as unknown as Record<string, unknown>);
  const unhandled = plateKeys.filter(k => !(PLATE_FIELDS as readonly string[]).includes(k) && !PLATE_EXCLUDED.includes(k));
  ok('privacy/allowlist-exhaustive', unhandled.length === 0,
    `盘上每个字段都必须被白名单或显式排除表处理过，新增字段不许静默进/出回执：未覆盖 ${unhandled.join(',') || '0 个'}（白名单 ${PLATE_FIELDS.length} 项、排除 ${PLATE_EXCLUDED.join(',')}）`);
  ok('privacy/excluded-is-question', PLATE_EXCLUDED.includes('question') && !('question' in rc.plate),
    `排除表就是问题原文，且投影后盘里确实没有它：plate 键 ${Object.keys(rc.plate).length} 个`);

  // ── 6. 锚定诚实性 ──
  ok('anchor/never-claimed', rc.anchor === null && rc.anchorState === RECEIPT_ANCHOR_STATE_UNANCHORED &&
    !/已上链|已锚定|bitcoin|BTC/.test(dump),
    '未接台账前 anchor 恒为 null、状态恒为「未锚定」，回执文本里不许出现任何上链字样');
  const withAnchor = await verifyReceipt({ ...rc, anchor: { date: '2026-10-18', root: 'deadbeef', prevRoot: 'cafe', manifestPath: '/srv/chaos/output/anchors/2026-10-18.json', otsPath: '/srv/chaos/output/anchors/2026-10-18.ots' } }, { question: QUESTION });
  ok('anchor/outside-record-hash', withAnchor.checks.find(c => c.field === 'recordHash')?.ok === true,
    '台账后来补写 anchor 不能把已发出的回执验成失败 —— 所以 anchor 在承诺内核之外');
  ok('anchor/flagged-not-passed', withAnchor.checks.find(c => c.field === 'anchor')?.ok === true &&
    (await verifyReceipt(rc)).checks.find(c => c.field === 'anchor')?.ok === false,
    '未锚定时 anchor 这一项是 false（提示态），但它不参与 ok 判定：自验与链验是两件事，不混');

  // ── 7. 三式都能出回执，且口径戳随盘带出 ──
  const three = [
    ['摇卦', plate],
    ['时间', buildTimeResult({ question: QUESTION, questionType: '合作', date: GOLD_DATE })],
    ['报数', buildNumberResult({ question: QUESTION, questionType: '合作', nums: [3, 8], now: GOLD_DATE })],
  ] as const;
  let bad = 0; const detail: string[] = [];
  for (const [tag, p] of three) {
    const r = await buildPlateReceipt(p, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
    const v = await verifyReceipt(r, { question: QUESTION });
    const basisOk = r.core.basis.ganzhi === GANZHI_BASIS && r.core.basis.najia === NAJIA_BASIS &&
      (tag === '报数' ? r.core.basis.qishu === QISHU_BASIS : true);
    if (!v.ok || !basisOk) { bad++; detail.push(`${tag}=${v.ok ? '验真过' : '验真失败'}/${basisOk ? '戳齐' : '戳缺'}`); }
  }
  ok('methods/three-ways-receipt', bad === 0,
    `摇卦 / 时间 / 报数三式都能出自验通过的回执，且口径戳随盘带出（报数还须带取数戳）：问题 ${detail.join(' | ') || '0 个'}`);
  ok('basis/stamp-values-live', rc.core.basis.ganzhi === GANZHI_BASIS && rc.core.basis.najia === NAJIA_BASIS,
    `回执里的戳等于引擎当前导出值，不是抄的：${rc.core.basis.ganzhi} / ${rc.core.basis.najia}`);
  ok('version/envelope-version', rc.core.version === RECEIPT_VERSION,
    `回执带版本戳 ${RECEIPT_VERSION}，将来改字段有新旧可分`);

  // ── 8. 这一层不许联网：验真页一旦按 id 拉报告，就把隐私门重新打开了 ──
  const read = async (p: string) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    try { return readFileSync(join(__dirname, '../..', p), 'utf8'); } catch { return ''; }
  };
  const verifyPage = await read('frontend/app/verify/page.tsx');
  const panel = await read('frontend/app/liuyao/result/[id]/ReceiptPanel.tsx');
  const lib = await read('frontend/lib/receipt/receipt.ts');
  ok('net/no-fetch-in-verify-layer', verifyPage.length > 0 && panel.length > 0 &&
    !/fetch\(|XMLHttpRequest|axios/.test(verifyPage + panel),
    `验真页与回执面板不得发任何请求（GET /reports/:id 那种按 id 取原文的路子一律不走）：命中 ${/fetch\(|XMLHttpRequest|axios/.test(verifyPage + panel) ? '有' : '无'}`);
  const imports = (src: string) => Array.from(src.matchAll(/from\s+'([^']+)'/g)).map(m => m[1]);
  const libImports = imports(lib);
  ok('net/lib-is-pure', lib.length > 0 && libImports.every(i => i === '@/types/liuyao'),
    `回执层只 import 类型，不依赖任何引擎/后端代码（换术数时整块搬得走）：实得 ${JSON.stringify(libImports)}`);
  ok('net/salt-from-csprng', /crypto\.getRandomValues/.test(lib) && !/Math\.random/.test(lib),
    '盐走 crypto.getRandomValues，不用 Math.random（否则摘要承诺可被预测）');
};

run().then(() => {
  const summary = `receipt acceptance: pass=${pass} fail=${fail}`;
  try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
  console.log(summary);
  const fails = lines.filter(l => l.startsWith('FAIL'));
  for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
  console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
  if (fails.length) process.exitCode = 1;
});
