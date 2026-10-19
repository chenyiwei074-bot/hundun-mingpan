// 随机源验收。裁定 5 给的三条标准逐条落成断言：
//   ① 活文件零 Math.random   ② 跨次不可复现   ③ 三枚各 1 bit（crypto.getRandomValues）
// 另外补两条这次顺手暴露出来的：掷钱与「花数→爻值」以前在页面上有第二份拷贝，
// 以及统计上必须真的均匀（只测「不等于上一次」是挡不住偏置的）。
//
// 2026-10-19 commit-reveal 改了设计，断言跟着改（改测试，不是改产品）：
// 面值不再逐轮现取随机数，而是从一次性铸出的 seed 派生 —— 所以 ②「跨次不可复现」现在归
// seed 管，③的均匀性改测「seed 前 18 bit 的派生路径」，并新增一条最要紧的：
// 起卦页不许存在第二条随机路径（有的话 seed 就只是装饰）。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/random-acceptance/acceptance.ts --out=.random.txt
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { bitsFromSeedHex, newSeedHex, randomToken } from '../../frontend/lib/crypto/random';
import { calcYao, tossesFromSeed } from '../../frontend/lib/liuyao/methods/coinFaces';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.random.txt';
const ROOT = join(__dirname, '../..');
const FRONTEND = join(ROOT, 'frontend');

const lines: string[] = [];
let pass = 0;
let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

/** 活文件 = 会被编译进站点的源码；*_bak* / 备份一律排除（它们是死文件，不是回归）。 */
const DEAD = /(_bak|\.bak|_backup|_old|node_modules|\.next)/;
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (DEAD.test(name)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
/** 只看在代码里的用法：整行注释与块注释先剥掉，否则「为什么不用 Math.random」这类
 *  说明文字会自己咬自己（第一版就被注释绊过一次）。剥完还命中才是真的在用。 */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
}
const liveFiles = ['app', 'lib', 'components', 'types'].flatMap(d => walk(join(FRONTEND, d)));

// ── 1. 活文件零 Math.random ──
{
  const hits = liveFiles.filter(f => /Math\.random/.test(codeOf(f)))
    .map(f => relative(ROOT, f).replace(/\\/g, '/'));
  const inComments = liveFiles.filter(f => !/Math\.random/.test(codeOf(f)) && /Math\.random/.test(readFileSync(f, 'utf8')))
    .map(f => relative(ROOT, f).replace(/\\/g, '/'));
  ok('live/no-math-random', hits.length === 0,
    `扫了 ${liveFiles.length} 个活文件（排除 *_bak* 等死文件，剥掉注释）：仍在用 Math.random 的 ${hits.join(' | ') || '0 个'}`);
  if (inComments.length) say(`MEASURED ${inComments.length} 个文件的注释里提到 Math.random（是在解释为什么改，不是在用）：${inComments.join(' | ')}`);
}

// ── 2. bit 口径：一字节一 bit，且来自 crypto.getRandomValues ──
{
  const src = codeOf(join(FRONTEND, 'lib', 'crypto', 'random.ts'));
  ok('bit/uses-csprng', /crypto\.getRandomValues/.test(src) && /&\s*1\b/.test(src) && !/Math\.random/.test(src),
    'bitFromByte 逐字节取 & 1（一字节一 bit，无取模偏差），seed 由 crypto.getRandomValues 铸，且这一层不出现 Math.random');
  ok('bit/api-present', typeof crypto?.getRandomValues === 'function',
    '本运行时确实有 crypto.getRandomValues —— 验收跑的就是浏览器同一套 API，不是垫片');
  // 2026-10-19 commit-reveal 之后，掷钱的 bit 不再逐轮现取，而是从 seed 派生；
  // 所以均匀性要测在派生路径上（测 seed 的前 18 bit），否则测的是一条已经没人走的路。
  const N = 50000;
  const freq = new Array(18).fill(0);
  for (let i = 0; i < N; i++) {
    const bits = bitsFromSeedHex(newSeedHex(), 18);
    bits.forEach((v, j) => { freq[j] += v; });
  }
  const dev = freq.map(f => Math.abs(f / N - 0.5));
  ok('bit/per-position-fair', dev.every(d => d < 0.012),
    `${N} 个 seed 的前 18 个 bit，每个位置的 1 频率与 0.5 的偏差最大 ${Math.max(...dev).toFixed(5)}（阈值 0.012 ≈ 5σ）`);
  const byRound = [0, 1, 2, 3, 4, 5].map(r => {
    const t = freq.slice(r * 3, r * 3 + 3).reduce((a, b) => a + b, 0);
    return Math.abs(t / (N * 3) - 0.5);
  });
  ok('bit/per-round-fair', byRound.every(d => d < 0.008),
    `按轮合起来看（每轮 ${N * 3} 个 bit）偏差最大 ${Math.max(...byRound).toFixed(5)} —— 轮与轮之间不该有先后偏差，seed 只铸一次`);
}

// ── 3. seed：长度、唯一性、以及 bit→轮→枚 的映射（手算金标准） ──
{
  const s1 = newSeedHex(), s2 = newSeedHex();
  ok('seed/shape', /^[0-9a-f]{64}$/.test(s1), `seed 是 32 字节小写十六进制（64 字符）：实得长度 ${s1.length}、字符集 ${/[0-9a-f]/.test(s1) ? 'hex' : '非 hex'}`);
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i++) seen.add(newSeedHex());
  ok('seed/unique', seen.size === 5000, `5000 次铸 seed 全不重复：去重后 ${seen.size}`);
  let badHex = 0;
  for (const bad of ['', 'zz', 'abc', 'AA', '0'.repeat(63), '0'.repeat(66)]) {
    try { bitsFromSeedHex(bad, 18); badHex++; } catch { /* 期望它抛 */ }
  }
  ok('seed/rejects-malformed', badHex === 0,
    `非法 seed（空、奇数位、非 hex、过短、超长）必须抛，不能静默少取 bit：放过了 ${badHex}/${6} 种`);

  // 手算向量：第 i 字节 = i ⇒ bit[i] = i & 1 ⇒ 前 18 bit 是 0101…01，
  // 轮 0 用 bit 0..2 = 字花字（1 花→7 少阳），轮 1 用 bit 3..5 = 花字花（2 花→8 少阴），交替。
  const idxSeed = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join('');
  const idxBits = bitsFromSeedHex(idxSeed, 18).join('');
  const idxRounds = tossesFromSeed(idxSeed);
  const idxValues = idxRounds.map(calcYao).map(y => y.value).join('');
  ok('seed/golden-vector', idxBits === '010101010101010101'
    && idxRounds.map(r => r.join('')).join(' ') === '字花字 花字花 字花字 花字花 字花字 花字花'
    && idxValues === '787878',
    `bit→轮→枚→爻值 的映射按手算向量钉死（第 r 轮取第 3r..3r+2 个 bit）：bit ${idxBits} / 面值 ${idxRounds.map(r => r.join('')).join(' ')} / 爻值 ${idxValues}`);
  ok('seed/replay-deterministic', JSON.stringify(tossesFromSeed(idxSeed)) === JSON.stringify(idxRounds),
    '同一个 seed 重放两次得到同一卦 —— 验真方就是靠这一条把盘上的六个爻值对回承诺');
  const a = newSeedHex(), b = newSeedHex();
  ok('seed/cross-run-differs', JSON.stringify(tossesFromSeed(a)) !== JSON.stringify(tossesFromSeed(b)),
    '两次起卦的卦不相同（同 seed 才会同卦；跨次不可复现这条现在归 seed 管）');
}

// ── 4. 花数→爻值：手写表逐条对，且页面不再自己拷一份、不留第二条随机路 ──
{
  const table: Record<string, [number, string, boolean]> = {
    字字字: [6, '老阴', true], 花字字: [7, '少阳', false], 字花字: [7, '少阳', false], 字字花: [7, '少阳', false],
    花花字: [8, '少阴', false], 花字花: [8, '少阴', false], 字花花: [8, '少阴', false], 花花花: [9, '老阳', true],
  };
  let bad = 0; const detail: string[] = [];
  for (const [faces, [value, label, isDong]] of Object.entries(table)) {
    const got = calcYao(faces.split('') as ('字' | '花')[]);
    if (got.value !== value || got.label !== label || got.isDong !== isDong) {
      bad++; detail.push(`${faces} 得 ${got.value}/${got.label}/${got.isDong} 应 ${value}/${label}/${isDong}`);
    }
  }
  ok('yao/table-8', bad === 0, `八种面序的爻值对手写表（0 花老阴动…3 花老阳动）：不符 ${bad}${detail.length ? ' 例:' + detail.join(' | ') : ''}`);
  const page = codeOf(join(FRONTEND, 'app', 'liuyao', 'create', 'page.tsx'));
  const importsShared = /import\s*\{[^}]*tossesFromSeed[^}]*calcYao[^}]*\}\s*from\s*'@\/lib\/liuyao\/methods\/coinFaces'/.test(page) ||
    (/tossesFromSeed/.test(page) && /import\s*\{[^}]*calcYao[^}]*\}\s*from\s*'@\/lib\/liuyao\/methods\/coinFaces'/.test(page));
  const noLocalCopy = !/function calcYao/.test(page) && !/'字'\s*:\s*'花'/.test(page);
  ok('single-source/toss-and-yao', importsShared && noLocalCopy,
    `页面必须 import coinFaces 那一份口径，且不得再留本地 calcYao 或手拼面序：import ${Number(importsShared)}、无拷贝 ${Number(noLocalCopy)}`);
  // 承诺的命门：页面里不能有第二条取随机的路。一旦有，seed 就只是装饰。
  const secondPath = /getRandomValues|randomBits|coinToss|Math\.random/.test(page);
  ok('single-source/no-second-path', !secondPath,
    `起卦页不得出现第二条随机路径（getRandomValues / randomBits / coinToss / Math.random 一律不许有）—— 面值只能来自承诺过的 seed：命中 ${secondPath ? '有' : '无'}`);
  const facesMod = codeOf(join(FRONTEND, 'lib', 'liuyao', 'methods', 'coinFaces.ts'));
  const coinMod = codeOf(join(FRONTEND, 'lib', 'liuyao', 'methods', 'coin.ts'));
  ok('single-source/one-toss-impl', /bitFromByte|bitsFromSeedHex/.test(facesMod) && !/&\s*1\b/.test(facesMod) &&
    !/bitsFromSeedHex|getRandomValues/.test(coinMod),
    '取 bit 的口径只有 random.ts 一处（& 1 不在别处重写），coinFaces 只调 bitsFromSeedHex，coin.ts 不再碰随机源');
  const noEngineInFaces = !/from '\.\.\/core'/.test(facesMod);
  ok('layering/faces-pure', noEngineInFaces,
    'coinFaces 不 import 排盘内核：验真层要用同一份口径重放，又不能把内核拖进 /verify 的包（拆文件而不是复制函数）');
}

// ── 5. 身份 token ──
{
  const N = 50000;
  const set = new Set<string>();
  for (let i = 0; i < N; i++) set.add(randomToken(8));
  ok('token/unique', set.size === N, `${N} 个 8 字符 token 全不重复：去重后 ${set.size}`);
  ok('token/alphabet', /^[0-9a-z]{8}$/.test(randomToken(8)) && randomToken(0) === '',
    '字符集固定 base36 小写、长度精确，拒绝采样不改变长度');
  const chars = new Set(); for (const c of randomToken(400)) chars.add(c);
  ok('token/uses-full-alphabet', chars.size >= 30, `400 字符里出现 ${chars.size} 种字符（36 种里接近全用，说明不是低熵截断）`);
  const v = readFileSync(join(FRONTEND, 'lib', 'auth', 'visitor.ts'), 'utf8');
  const cr = readFileSync(join(FRONTEND, 'app', 'create', 'page.tsx'), 'utf8');
  // 2026-10-18 ① 起：游客 id 只有一处生成（lib/auth/visitor）。create 页不再自己生成 visitor_ 前缀的 id，
  // 而是 import getVisitorId —— 断言随之改成「单源」，而不是「两处都用同一 helper」。
  ok('token/single-id-source', /randomToken\(8\)/.test(v) && /from '@\/lib\/crypto\/random'/.test(v) &&
    /getVisitorId/.test(cr) && !/randomToken\(/.test(cr) && !/'visitor_/.test(cr),
    '游客 id 只在 lib/auth/visitor 生成（randomToken 单源）；create 页只 import getVisitorId，不再自己生成 visitor_ 前缀 id');
  say('MEASURED 游客 id 现在同时是报告归属凭据（main 的 ab16eab 用它校验 GET /api/reports/:id），所以这一处的 Math.random 与摇卦同等重要');
}

const summary = `random acceptance: liveFiles=${liveFiles.length} pass=${pass} fail=${fail}`;
try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
console.log(summary);
const fails = lines.filter(l => l.startsWith('FAIL'));
for (const f of fails) console.log('  ' + f.replace(/[^\x00-\x7F]/g, '?'));
console.log(fails.length ? `${fails.length} FAILURE(S) — see ${OUT}` : `0 failures — see ${OUT}`);
if (fails.length) process.exitCode = 1;
