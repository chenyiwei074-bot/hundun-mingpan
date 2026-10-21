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
  COIN_COMMIT_SCHEMA, PLATE_EXCLUDED, PLATE_FIELDS, RECEIPT_ANCHOR_STATE_UNANCHORED,
  RECEIPT_VERSION, RECEIPT_VERSION_V1, RECEIPT_VERSION_V2, RECEIPT_VERSIONS,
  buildPlateReceipt, buildReportReceipt, canonical, receiptFileName, sealSeed, sha256Hex, shortHash, verifyReceipt,
} from '../../frontend/lib/receipt/receipt';
import { GANZHI_BASIS, NAJIA_BASIS } from '../../frontend/lib/liuyao/core';
import { QISHU_BASIS } from '../../frontend/lib/meihua/engine';
import { buildCoinResult } from '../../frontend/lib/liuyao/methods/coin';
import { COIN_COMMIT_BITS, calcYao, tossesFromSeed } from '../../frontend/lib/liuyao/methods/coinFaces';
import { bitsFromSeedHex, newSeedHex } from '../../frontend/lib/crypto/random';
import { buildTimeResult } from '../../frontend/lib/liuyao/methods/time';
import { buildNumberResult } from '../../frontend/lib/liuyao/methods/number';
import { TRIGRAM_BITS } from '../liuyao-ganzhi/gold';
import { CATALOG_STAMPS } from '../../frontend/lib/tools/catalog';
import { ANCHOR_LABEL, RECEIPT_ENVELOPE_SCHEMA, anchorViewOf, receiptSubmissionBody, receiptSubmissionPayload } from '../../frontend/lib/receipt/anchor';

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

/** 只看在代码里的字样：注释先剥掉。否则「本模块不许出现已上链」这类自我约束的说明
 *  会自己咬自己 —— 随机源验收扫 Math.random 时踩过同一个坑（两次）。 */
const codeOf = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

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

/** 手算向量 seed：第 i 字节 = i，所以 bit[i] = i & 1 → 0101…01，六轮爻值 7/8/7/8/7/8。
 *  金标准故意选这种一眼能算出来的串，不选一串随机 hex —— 否则"钉住"的只是当时的实现。 */
const IDX_SEED = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');

/** 走 commit-reveal 那条路造一盘：面值来自 seed，承诺在首掷之前就已封好。 */
async function committedCoinPlate(seedHex: string, now = GOLD_DATE) {
  const records = tossesFromSeed(seedHex).map((coins, i) => {
    const y = calcYao(coins);
    return { position: i + 1, coins, value: y.value, label: y.label, isDong: y.isDong };
  });
  return buildCoinResult({ question: QUESTION, questionType: '合作', records, now, randomness: await sealSeed(seedHex, now) });
}

const plate = coinPlate(3);
const FIXED_NOW = '2026-10-18T00:00:00.000Z';
const FIXED_SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

/** v1 冻结金标准：2026-10-19 用 main(4bf95d1) 那份实现原样跑出这四个值后钉在这里。
 *  动 canonical 顺序、动字段语义、动摘要范围 —— 任何一处碰到 v1，这条就红。
 *  已发出去的回执与已入台账的 leaf 全靠它兜住，所以它是"不许改"的，不是"暂时这样"。
 *  注意盘 id 必须钉死：plateHash 覆盖 PLATE_FIELDS 里的 id，而 id 是客户端现铸的
 *  'coin_' + Date.now().toString(36) —— 不钉住的话这条断言每次跑都是新值，等于没有断言。 */
const FROZEN_PLATE_ID = 'coin_frozen_v1';
const V1_FROZEN = {
  plateHash: 'sha256:3ff1685e9dbb721dc0a3acd5bffe052a03b936d98756d191afa726eadc53f077',
  subjectHash: 'sha256:70eaae08b4532d53a2ae166d0bd39835cbeac525e6319fc9cae017c2af84eb65',
  recordHash: 'sha256:b29199fa811c9187df962763eddc49e7fdc5b128662d9e1ade18f1f71f9ab189',
  core: '{"basis":{"ganzhi":"jieqi-lichun-v1","najia":"jingfang-neiwai-v2","qishu":"不适用"},'
    + '"castAtLocal":"2026-10-17 12:00","castAtUTC":"2026-10-17T04:00:00.000Z","kind":"liuyao-plate",'
    + '"method":"coin","plateHash":"sha256:3ff1685e9dbb721dc0a3acd5bffe052a03b936d98756d191afa726eadc53f077",'
    + '"subjectHash":"sha256:70eaae08b4532d53a2ae166d0bd39835cbeac525e6319fc9cae017c2af84eb65",'
    + '"subjectSalt":"a1b2c3d4e5f60718293a4b5c6d7e8f90","tzOffsetMinutes":480,"version":"hundun-receipt-v1"}',
};

/** IDX_SEED 的 seedHash：SHA-256 取的是这串 hex 字符本身（不是解码后的字节），
 *  这样第三方用 `printf %s <seed> | sha256sum` 就能自己复算。 */
const IDX_SEED_HASH = 'sha256:6c86c6aac5fb24bcf5d9939cb7d7d5645ce39418f449e03b262dd4fa14b4b92b';

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
  ok('version/envelope-version', rc.core.version === RECEIPT_VERSION_V1 && RECEIPT_VERSION === RECEIPT_VERSION_V1
    && RECEIPT_VERSIONS.join(' ') === 'hundun-receipt-v1 hundun-receipt-v2',
    `没有承诺的回执仍按 v1 出（同一盘重算得到同一个 hash，不为了"看起来新"把已发出回执的算法换掉）：实得 ${rc.core.version}，认得 ${RECEIPT_VERSIONS.join(' / ')}`);

  // ── 8. 这一层不许联网：验真页一旦按 id 拉报告，就把隐私门重新打开了 ──
  const read = async (p: string) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    try { return readFileSync(join(__dirname, '../..', p), 'utf8'); } catch { return ''; }
  };
  const verifyPage = await read('frontend/app/verify/page.tsx');
  const panel = await read('frontend/app/liuyao/result/[id]/ReceiptPanel.tsx');
  // 下面几条拿这份源码做文本判定（import 白名单、getRandomValues 必须出现、Math.random 不许出现），
  // 所以先剥注释：注释里写一句「盐用 crypto.getRandomValues」不能替那行代码说话。
  const lib = codeOf(await read('frontend/lib/receipt/receipt.ts'));
  // 2026-10-19 P1 上线后这条的范围收窄过一次（改测试）：结果页现在**会**联网 —— 但只打
  // /api/receipts（按回执编号提交摘要 / 查状态），验真页仍然一个请求都不发。
  // 守的从来不是"零网络"，而是"绝不按报告 id 把原文取回来"。
  const anchorMod = codeOf(await read('frontend/lib/receipt/anchor.ts'));
  ok('net/no-fetch-in-verify-layer', verifyPage.length > 0 && panel.length > 0 &&
    !/fetch\(|XMLHttpRequest|axios/.test(codeOf(verifyPage)) &&
    !/api\/reports?\/|getReportById/.test(codeOf(panel) + anchorMod),
    `验真页零请求；结果页与摘要层不得出现任何按报告 id 取原文的调用（GET /api/reports/:id 会返回 inputJson，那是本站最老的隐私洞）`);
  ok('net/panel-only-hits-receipts', /\/api\/receipts/.test(anchorMod) &&
    !/fetch\(/.test(codeOf(panel)),
    '联网只集中在 lib/receipt/anchor 一处，面板不自己拼 fetch（将来换端点只改一个文件）');
  const imports = (src: string) => Array.from(src.matchAll(/from\s+'([^']+)'/g)).map(m => m[1]);
  const libImports = imports(lib);
  // 2026-10-19 commit-reveal：回执层多两个依赖 —— 取 bit 的口径（@/lib/crypto/random）与
  // 面值→爻值（coinFaces）。重放必须与生产用同一份实现，两份实现正是这仓库反复踩的坑，
  // 所以宁可依赖一个纯口径模块，也不把函数抄一遍。守住的是这三条：不联网、不依赖后端、
  // 不拖排盘内核（coinFaces 由 tools/random-acceptance 的 layering/faces-pure 单独钉）。
  const ALLOWED = ['@/types/liuyao', '@/lib/crypto/random', '@/lib/liuyao/methods/coinFaces'];
  const extra = libImports.filter(i => !ALLOWED.includes(i));
  ok('net/lib-is-pure', lib.length > 0 && extra.length === 0 &&
    !libImports.some(i => /liuyao\/core|meihua|server|api/.test(i)),
    `回执层只依赖类型 + 两个纯口径模块，不 import 排盘内核、不依赖后端代码：多出 ${extra.join(',') || '无'}；实得 ${JSON.stringify(libImports)}`);
  ok('net/salt-from-csprng', /crypto\.getRandomValues/.test(lib) && !/Math\.random/.test(lib),
    '盐走 crypto.getRandomValues，不用 Math.random（否则摘要承诺可被预测）');

  // ── 9. commit-reveal：掷钱之前的承诺必须一路咬到盘上爻值 ──
  const committed = await committedCoinPlate(IDX_SEED);
  const rcC = await buildPlateReceipt(committed, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const vC = await verifyReceipt(rcC, { question: QUESTION });
  const cr = rcC.core.randomness;
  const chk = (r: { checks: { field: string; ok: boolean; na?: boolean; detail: string }[] }, f: string) =>
    r.checks.find(c => c.field === f);

  ok('commit/v2-shape', rcC.core.version === RECEIPT_VERSION_V2 && !!cr && cr.schema === COIN_COMMIT_SCHEMA
    && /^[0-9a-f]{64}$/.test(cr.seedHex) && /^[01]{18}$/.test(cr.bits) && cr.seedHash.startsWith('sha256:'),
    `带承诺的回执是 v2 且 randomness 形状钉死（seed 64 位小写 hex、bits 恰好 18 个 0/1、seedHash 带前缀）：版本 ${rcC.core.version} / 口径 ${cr?.schema}`);
  ok('commit/golden-seed-vector', !!cr && cr.seedHash === IDX_SEED_HASH && cr.bits === '010101010101010101'
    && (rcC.plate.yaoRecords as { value: number }[]).map(r => r.value).join('') === '787878',
    `手算向量：seed 第 i 字节 = i ⇒ bit 0101…01 ⇒ 六轮 字花字/花字花 交替 ⇒ 爻值 787878，seedHash 用 sha256sum 也能复算：${cr?.seedHash.slice(0, 22)}…`);
  ok('commit/verifies-clean', vC.ok && ['seedHash', 'commitBits', 'tossReplay'].every(f => chk(vC, f)?.ok && !chk(vC, f)?.na),
    `v2 自验全绿且三项承诺检查都是真检过的：${vC.checks.map(c => `${c.field}=${c.na ? 'NA' : c.ok ? 'T' : 'F'}`).join(' ')}`);
  ok('commit/not-in-plate', !('randomness' in rcC.plate) && PLATE_EXCLUDED.includes('randomness'),
    '承诺不进盘身投影：plateHash 与 core.randomness 各摘要一次同一事实，改一处会让两处互相矛盾而看不出哪处是原件');

  // 裁定 ①：randomness 必须在承诺内核之内 —— 拿掉它 recordHash 必须变。
  const noCommit = await verifyReceipt({ ...rcC, core: { ...rcC.core, randomness: undefined } }, { question: QUESTION });
  ok('commit/inside-record-hash', chk(noCommit, 'recordHash')?.ok === false && chk(noCommit, 'tossReplay')?.ok !== false,
    `把 randomness 从内核里摘掉，recordHash 必须红（放内核外面等于承诺可拆，这是裁定 ①）：recordHash=${chk(noCommit, 'recordHash')?.ok ? '仍绿（可拆）' : '红'}`);

  // 强制项 2：双向校验，三处各改一处都必须单独红，不能只靠 recordHash 一把抓。
  const otherSeed = await sealSeed(newSeedHex(), GOLD_DATE);
  const swapSeed = await verifyReceipt({ ...rcC, core: { ...rcC.core, randomness: { ...otherSeed, seedHash: cr!.seedHash } } }, { question: QUESTION });
  ok('tamper/seed-swapped-detected', chk(swapSeed, 'seedHash')?.ok === false && chk(swapSeed, 'tossReplay')?.ok === false
    && chk(swapSeed, 'commitBits')?.ok === true,
    `整对儿换 seed（seed 与它的 bits 一起换，只留原 seedHash）：seedHash 与重放必须红，commitBits 反而是绿的 —— 它校的是"bit 与 seed 自洽"，不校盘。三项各管一段，合成一张网：${swapSeed.checks.filter(c => !c.ok && !c.na).map(c => c.field).join(',') || '（没抓到，假绿）'}`);
  const flipBits = await verifyReceipt({ ...rcC, core: { ...rcC.core, randomness: { ...cr!, bits: (cr!.bits.slice(0, 5) + (cr!.bits[5] === '1' ? '0' : '1') + cr!.bits.slice(6)) as string } } }, { question: QUESTION });
  ok('tamper/bits-only-detected', chk(flipBits, 'commitBits')?.ok === false && chk(flipBits, 'seedHash')?.ok === true,
    `只改回执里的 bit 串（seed 与 seedHash 不动）：commitBits 必须红，证明 bit 是拿 seed 重算的，不是自说自话：${chk(flipBits, 'commitBits')?.ok ? '绿（假绿）' : '红'}`);
  const fakePlate = structuredClone(committed);
  const fp = fakePlate.yaoRecords[2];
  fp.value = fp.value === 6 ? 7 : 6;
  fp.isDong = fp.value === 6 || fp.value === 9;
  const rcFake = await buildPlateReceipt(fakePlate, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const yaoVsSeed = await verifyReceipt({ ...rcC, plate: rcFake.plate }, { question: QUESTION });
  ok('tamper/yao-vs-seed', chk(yaoVsSeed, 'tossReplay')?.ok === false && chk(yaoVsSeed, 'plateHash')?.ok === false,
    `把盘上第三爻改成 seed 推不出的值：plateHash 与 tossReplay 都要红（只红一个就说明有一环没接上）：${yaoVsSeed.checks.filter(c => !c.ok && !c.na).map(c => c.field).join(',') || '（没抓到，假绿）'}`);
  ok('tamper/yao-vs-seed-premise', canonical(fakePlate) !== canonical(committed) && fakePlate.yaoRecords[2].value !== committed.yaoRecords[2].value,
    '上一条的前提：盘确实被改动了，不是拿同一份自己比自己');

  const badSchema = await verifyReceipt({ ...rcC, core: { ...rcC.core, randomness: { ...cr!, schema: 'coin-commit-v9' } } }, { question: QUESTION });
  ok('commit/unknown-schema-fails', chk(badSchema, 'commitSchema')?.ok === false && !badSchema.ok,
    `不认识的承诺口径必须红，不能"照旧重放一下试试"：${chk(badSchema, 'commitSchema')?.detail.slice(0, 40) || '没这条检查'}`);
  const badSeed = await verifyReceipt({ ...rcC, core: { ...rcC.core, randomness: { ...cr!, seedHex: '00'.repeat(33) } } }, { question: QUESTION });
  ok('commit/seed-shape-pinned', chk(badSeed, 'commitBits')?.ok === false && chk(badSeed, 'tossReplay')?.ok === false,
    `33 字节的"seed"必须红而不是静默取前 18 bit：bits=${chk(badSeed, 'commitBits')?.ok ? '绿（放过了）' : '红'}，且验真没有崩`);

  // 没承诺的两种情形：v1 老盘 =「未承诺」，时间/报数 =「不适用」，都不算通过也不算失败。
  const v1check = chk(await verifyReceipt(rc, { question: QUESTION }), 'randomness');
  ok('commit/v1-says-uncommitted', !!v1check && v1check.na === true && v1check.detail.includes('未承诺'),
    `v1 摇卦回执的 randomness 一项是「未承诺」而不是「通过」：${v1check?.detail.slice(0, 34)}…`);
  const timeRc = await buildPlateReceipt(buildTimeResult({ question: QUESTION, questionType: '合作', date: GOLD_DATE }), { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const timeCheck = chk(await verifyReceipt(timeRc, { question: QUESTION }), 'randomness');
  ok('commit/time-not-applicable', !!timeCheck && timeCheck.na === true && timeCheck.detail.includes('不适用')
    && timeRc.core.version === RECEIPT_VERSION_V1,
    `时间起卦没有承诺也不需要：标「不适用」，且回执仍是 v1（没承诺就不换版本）：${timeCheck?.detail.slice(0, 30)}…`);
  const naNotCounted = (await verifyReceipt(rc, { question: QUESTION })).ok === true;
  ok('commit/na-not-counted', naNotCounted, 'na 项不参与 ok 判定 —— 否则"未承诺"会把老盘验成失败，那是谎报篡改');

  // 跨次不可复现 + 分布：承诺改了取数路径，均匀性必须在整条链上重测一遍。
  const seeds = new Set<string>();
  for (let i = 0; i < 2000; i++) seeds.add(newSeedHex());
  ok('commit/seeds-across-runs-differ', seeds.size === 2000, `2000 次起卦的 seed 全不相同：去重 ${seeds.size}`);
  const N = 10000;
  const cnt: Record<string, number> = { '6': 0, '7': 0, '8': 0, '9': 0 };
  for (let i = 0; i < N; i++) for (const t of tossesFromSeed(newSeedHex())) cnt[String(calcYao(t).value)]++;
  const p = (k: string) => cnt[k] / (N * 6);
  ok('commit/yao-value-distribution', Math.abs(p('6') - 0.125) < 0.008 && Math.abs(p('9') - 0.125) < 0.008
    && Math.abs(p('7') - 0.375) < 0.012 && Math.abs(p('8') - 0.375) < 0.012,
    `${N} 个 seed 重放出 ${N * 6} 个爻值，与理论分布 1/8·3/8·3/8·1/8 的偏差：老阴 ${p('6').toFixed(4)} 少阳 ${p('7').toFixed(4)} 少阴 ${p('8').toFixed(4)} 老阳 ${p('9').toFixed(4)}（承诺改了取数路径，所以这条必须重测，不能沿用上一批的结论）`);

  // 强制项 3：v1 冻结。用钉住 id 的同一份 fixture 走新代码，四个值必须与 main(4bf95d1) 一字不差。
  const rcFrozen = await buildPlateReceipt({ ...plate, id: FROZEN_PLATE_ID }, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  ok('commit/v1-frozen-golden', rcFrozen.core.plateHash === V1_FROZEN.plateHash
    && rcFrozen.core.subjectHash === V1_FROZEN.subjectHash && rcFrozen.recordHash === V1_FROZEN.recordHash
    && canonical(rcFrozen.core) === V1_FROZEN.core,
    `v1 的四个金标准值与改前实现逐字相同（含规范化内核全文）—— 已发回执与已入台账的 leaf 因此仍可复算：recordHash ${rcFrozen.recordHash.slice(0, 22)}…`);
  ok('commit/v1-still-verifies', (await verifyReceipt(rcFrozen, { question: QUESTION })).ok,
    '冻结的不只是摘要值，旧回执在新验真器下仍是「通过 + randomness 标未承诺」');
  say(`MEASURED plateHash 覆盖盘 id，而 id 是客户端现铸的 'coin_' + Date.now().toString(36)：同一盘两次铸 id 会得到两个不同的 plateHash。金标准因此必须钉 id；这不是本批引入的，属已知缺陷（id 可预测、可撞），要改得先定"id 进不进承诺"这条口径`);

  // 强制项 4：诚实边界必须落在页面上，不能只写在代码注释里。
  const readSrc = async (p: string) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    try { return readFileSync(join(__dirname, '../..', p), 'utf8'); } catch { return ''; }
  };
  const createPage = await readSrc('frontend/app/liuyao/create/page.tsx');
  const panelSrc = await readSrc('frontend/app/liuyao/result/[id]/ReceiptPanel.tsx');
  // 验真页与目录这几处判定的都是「这句话/这个戳必须在代码里」，正向断言最容易被注释满足，
  // 所以读进来就剥注释。createPage / panelSrc 另有分段各自剥一次（重摇段、链上措辞段），
  // 那里已是剥过的文本，下面只在使用处包，不重复包。
  const verifySrc = codeOf(await readSrc('frontend/app/verify/page.tsx'));
  const cat = codeOf(await readSrc('frontend/lib/tools/catalog.ts'));
  ok('honesty/commit-visible-before-first-toss', /seedHash \{shortHash\(commit\.seedHash\)\}/.test(codeOf(createPage)) &&
    codeOf(createPage).indexOf('await sealSeed(') < codeOf(createPage).indexOf("setStep('tossing')"),
    '起卦页必须显示 seedHash 前 12 位，且 sealSeed 发生在进入掷钱阶段之前（源码顺序即执行顺序，行为侧另有浏览器实测）');
  ok('honesty/boundary-on-pages', /不证明掷钱这个动作真的发生过/.test(codeOf(createPage)) &&
    /重来就是新 seed、新承诺/.test(codeOf(panelSrc)) && /不能证明：掷钱这个动作真的在物理世界里发生过/.test(verifySrc),
    '边界那句话要出现在用户看得见的三个地方（起卦页、结果页回执面板、验真页），不能只活在注释里');
  ok('honesty/catalog-updated', /commit-reveal/.test(cat) && !/另批做/.test(cat) &&
    CATALOG_STAMPS.commit === COIN_COMMIT_SCHEMA,
    `目录里六爻那条要从「随机源承诺另批做」改成已实现，且目录写死的承诺戳 ${CATALOG_STAMPS.commit} 必须等于引擎导出的 ${COIN_COMMIT_SCHEMA}：残留「另批做」 ${/另批做/.test(cat) ? '有' : '无'}`);
  ok('honesty/no-overclaim', !/无法伪造|绝对可信|已上链/.test(codeOf(createPage) + codeOf(panelSrc) + verifySrc),
    '页面不许出现"无法伪造/绝对可信"这类超出机制上限的说法（它能证明的是盘与事先承诺对得上）');

  // ── 11. 裁定 ②：v2 的盘摘要不含 id，v1 仍含 ──
  const twinA = await committedCoinPlate(IDX_SEED);
  const twinB = { ...twinA, id: 'coin_' + 'z'.repeat(6) };
  const rcA = await buildPlateReceipt(twinA, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  const rcB = await buildPlateReceipt(twinB, { salt: FIXED_SALT, nowUTC: FIXED_NOW });
  ok('platehash/v2-ignores-id', rcA.core.version === RECEIPT_VERSION_V2 && rcA.core.plateHash === rcB.core.plateHash
    && rcA.plate.id !== rcB.plate.id,
    `同一盘内容、两个不同 id → v2 的 plateHash 必须相同（id 是定位符不是内容，重开一次不该"内容变了"）：${rcA.plate.id} vs ${rcB.plate.id}`);
  const idEdited = await verifyReceipt({ ...rcA, plate: { ...rcA.plate, id: 'coin_swapped' } }, { question: QUESTION });
  ok('platehash/v2-id-edit-verifies', idEdited.ok && chk(idEdited, 'plateHash')?.ok === true,
    '改 plate.id 后 v2 回执仍应验过（recordHash 只承诺内核，内核里是去掉 id 的盘摘要）');
  const v1IdEdited = await verifyReceipt({ ...rcFrozen, plate: { ...rcFrozen.plate, id: 'coin_changed' } }, { question: QUESTION });
  ok('platehash/v1-still-covers-id', chk(v1IdEdited, 'plateHash')?.ok === false,
    `v1 仍按含 id 的旧规则算 —— 这条红就说明有人把"排除 id"做成了不分版本的顺手统一，那会让已发出的 v1 回执全部验不过`);
  {
    const ids = Array.from({ length: 200 }, () => coinPlate(3).id);
    const uniq = new Set(ids).size;
    ok('id/csprng-suffix', uniq === ids.length && ids.every(x => /^coin_[0-9a-z]+$/.test(x)),
      `同一毫秒内铸 200 个盘 id 也必须全不相同（Date.now 那段一样，靠的就是 randomToken(6) 后缀）：去重 ${uniq}/${ids.length}，样例 ${ids[0]}`);
    const three = ['coin', 'time', 'num'] as const;
    // 「必须带 randomToken(N) 后缀」是正向断言：注释里解释后缀那句就能把它喂绿，所以先剥注释。
    const srcs = await Promise.all(['coin', 'time', 'number'].map(async m => codeOf(await readSrc(`frontend/lib/liuyao/methods/${m}.ts`))));
    const noSuffix = three.filter((_, i) => !/randomToken\(\d+\)/.test(srcs[i]) || !/\+ randomToken/.test(srcs[i]));
    ok('id/all-methods-suffixed', noSuffix.length === 0 && srcs.every(s => /randomToken/.test(s.split('\n')[0] + s)),
      `三式的 id 都要带 CSPRNG 后缀（时间/报数一样是客户端现铸，撞号问题同源）：缺后缀 ${noSuffix.join(',') || '无'}`);
  }

  // ── 12. 裁定 ①：重新摇只在结果态出现，且是全站唯二的铸 seed 入口 ──
  {
    // 注释里也会写「重新摇一卦」（handler 的 docstring 就写了），所以判"只出现在结果态"
    // 必须先把注释剥掉 —— 否则是在测措辞，不是测渲染。
    const page = createPage.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const doneBlock = page.slice(page.indexOf("{step==='done' &&"), page.indexOf('</section>)}'));
    ok('reroll/only-in-done', doneBlock.includes('重新摇一卦（作废本盘，换新承诺）') &&
      /\(step==='tossing'\|\|step==='done'\)/.test(page) &&
      !/重新摇一卦/.test(page.slice(0, page.indexOf("{step==='done' &&"))),
      '「重新摇一卦」只能出现在结果态那段 JSX 里 —— 摇卦进行中它不在 DOM 上，不是 disabled');
    ok('reroll/confirms-first', /setConfirmReroll\(true\)/.test(doneBlock) &&
      /确认作废并重摇/.test(doneBlock) && /onClick=\{\(\) => void rerollFresh\(\)\}/.test(doneBlock) &&
      doneBlock.indexOf('setConfirmReroll(true)') < doneBlock.indexOf('rerollFresh()'),
      '第一次点只把界面切到二次确认，真正重摇挂在「确认作废并重摇」上（源码顺序即交互顺序）');
    ok('reroll/mints-fresh-seed', /const seedHex = newSeedHex\(\);/.test(page.slice(page.indexOf('const rerollFresh'))) &&
      /await sealSeed\(seedHex\)/.test(page.slice(page.indexOf('const rerollFresh'))),
      '重摇必须走与首次起卦同一套承诺流程：新铸 seed → 先封 hash → 再进掷钱阶段');
    const sealSites = (page.match(/sealSeed\(/g) || []).length;
    ok('reroll/no-other-seed-path', sealSites === 2,
      `整页只有两处封 seed：开始摇卦与确认重摇。第三处就意味着存在中途换 seed 的路径（旧承诺还在回执里，新承诺已经盖上）：实得 ${sealSites} 处`);
    ok('reroll/clears-plate-and-records', /sessionStorage\.removeItem\('liuyao_result'\)/.test(page.slice(page.indexOf('const rerollFresh'))) &&
      /setRecords\(\[\]\)/.test(page.slice(page.indexOf('const rerollFresh'))) &&
      /setRound\(0\)/.test(page.slice(page.indexOf('const rerollFresh'))),
      '作废要落在地上：清掉待查看那一盘的 sessionStorage、六爻记录归零、轮次归零 —— 只换 seed 不清记录是假作废');
    ok('reroll/no-dead-resetall', !/const resetAll =/.test(page) && /const startOver =/.test(page),
      '原来那份没人调用的 resetAll 已删，改由 startOver 承担同一职责（死代码留着会有人以为它在管承诺）');
  }

  // ── 13. P1 台账接入：出门的只有摘要，措辞不超出服务端给的两态 ──
  {
    const payload = receiptSubmissionPayload(rcC);
    const keys = Object.keys(payload).sort().join(',');
    const wantKeys = ['basis', 'castAtUTC', 'kind', 'method', 'plateHash', 'recordHash', 'schemaVersion', 'subjectHash', 'tzOffsetMinutes'].join(',');
    ok('anchor/payload-is-summary-only', keys === wantKeys,
      `提交体是白名单，多一个字段都没有（reportHash/parentHash 只在解读回执里出现）：实得 ${keys}`);
    const blob = JSON.stringify(payload);
    ok('anchor/no-raw-data-leaves', !blob.includes(QUESTION) && !blob.includes(FIXED_SALT) &&
      !/"question"/.test(blob) && !/subjectSalt/.test(blob) && !/yaoRecords/.test(blob) && !/naJia/.test(blob) &&
      !/birthday|birthPlace|gender/.test(blob),
      '问题原文、盐、盘身、生辰一律不出门。盐尤其要紧：摘要抗字典反查靠的就是它不外泄');
    const body = receiptSubmissionBody(rcC);
    const bodyBlob = JSON.stringify(body);
    ok('anchor/record-hash-bare-hex', /^[0-9a-f]{64}$/.test(String(body.recordHash)) &&
      /^[0-9a-f]{64}$/.test(String(body.plateHash)) && /^[0-9a-f]{64}$/.test(String(body.subjectHash)) &&
      !bodyBlob.includes('sha256:'),
      '出门的每一份摘要都是裸 hex（回执 JSON 保留 sha256: 前缀，归一化由提交方做，不靠对端兜）');
    const before = canonical(rcC);
    receiptSubmissionPayload(rcC);
    ok('anchor/receipt-never-mutated', canonical(rcC) === before && rcC.anchor === null && rcC.anchorState === RECEIPT_ANCHOR_STATE_UNANCHORED,
      '提交与查询都不写回回执本体：anchor 恒为 null。否则同一份回执会因查询时点不同而得到不同摘要');
    // 跨边界字面量互校：服务端把信封版本钉死在一个常量上，那边改了这边必须红。
    // 读的是服务端源码，先剥注释 —— 注释里留一份旧的 `const SCHEMA = '…'` 会把这条喂绿。
    const ctrl = codeOf(await read('server/src/controllers/receipt.controller.ts'));
    const serverSchema = (ctrl.match(/const SCHEMA = '([^']+)'/) || [])[1] || '(读不到)';
    ok('anchor/envelope-schema-equals-server', ctrl.length > 0 && serverSchema === RECEIPT_ENVELOPE_SCHEMA,
      `提交信封版本必须逐字等于服务端 SCHEMA（${serverSchema}）：不等就是线上 400，而这条只有跑真端点才发现得了，所以钉成字面量比对`);
    ok('anchor/state-vocabulary', anchorViewOf('unanchored') === 'unanchored' && anchorViewOf('pending') === 'pending' &&
      anchorViewOf('anchored') === 'unknown' && anchorViewOf('') === 'unknown' && anchorViewOf(undefined) === 'unknown',
      '只认服务端现在给得出的两态；anchored 也落「状态未知」—— 本机无 bitcoind，ots 无法独立确认，本站不替运维宣布链上事实');
    ok('anchor/labels', ANCHOR_LABEL.unanchored === '未锚定' && ANCHOR_LABEL.pending === '等待锚定' &&
      ANCHOR_LABEL.unsubmitted === '未提交' && ANCHOR_LABEL.unknown === '状态未知' &&
      !/已锚定|已上链/.test(Object.values(ANCHOR_LABEL).join('')),
      `四态措辞固定，且标签里不许出现"已锚定/已上链"：${Object.values(ANCHOR_LABEL).join(' / ')}`);
    const anchorSrc = codeOf(await read('frontend/lib/receipt/anchor.ts'));
    const panelAll = codeOf(panelSrc) + anchorSrc;
    ok('anchor/no-chain-wording', !/已上链|已写入区块链|比特币已确认|已锚定/.test(panelAll),
      '面板与摘要层不得出现任何链上完成时态（anchored 目前不会下发，措辞先于能力就是撒谎）');
    ok('anchor/query-by-recordhash-only', (anchorSrc.match(/fetch\('\/api\/receipts/g) || []).length === 2 &&
      !/\/api\/reports?/.test(anchorSrc),
      `anchor 层只有两处 fetch，都是 /api/receipts（POST 提交 + GET 按回执编号查）：实得 ${(anchorSrc.match(/fetch\(/g) || []).length} 处 fetch`);
    ok('anchor/panel-wires-it', /from '@\/lib\/receipt\/anchor'/.test(codeOf(panelSrc)) &&
      !/qn-badge__dot[^}]*\/>\s*未锚定/.test(codeOf(panelSrc)) && /未提交 —— 摘要还没送进台账/.test(codeOf(panelSrc)),
      '面板的徽标改成状态驱动，不再写死「未锚定」；未提交时的原话要在页面上');
    const doc = await read('docs/receipt-v1.md');
    ok('anchor/documented', /等待锚定/.test(doc) && /anchored 目前不会返回|不会下发/.test(doc) &&
      /YYYY-MM\/YYYY-MM-DD\.jsonl/.test(doc),
      '两态措辞与实际分片路径要写进契约文档（文档里写的是 receipts/YYYY-MM-DD.jsonl，与端点的月度分片不一致会误导 ops）');
  }
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
