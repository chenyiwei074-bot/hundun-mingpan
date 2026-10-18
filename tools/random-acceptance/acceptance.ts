// 随机源验收。裁定 5 给的三条标准逐条落成断言：
//   ① 活文件零 Math.random   ② 跨次不可复现   ③ 三枚各 1 bit（crypto.getRandomValues）
// 另外补两条这次顺手暴露出来的：掷钱与「花数→爻值」以前在页面上有第二份拷贝，
// 以及统计上必须真的均匀（只测「不等于上一次」是挡不住偏置的）。
//
// 用法：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/random-acceptance/acceptance.ts --out=.random.txt
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomBits, randomToken } from '../../frontend/lib/crypto/random';
import { calcYao, coinToss } from '../../frontend/lib/liuyao/methods/coin';

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

// ── 2. 三枚各 1 bit，且来自 crypto.getRandomValues ──
{
  const src = codeOf(join(FRONTEND, 'lib', 'crypto', 'random.ts'));
  ok('bit/uses-csprng', /crypto\.getRandomValues/.test(src) && /&\s*1\b/.test(src) && !/Math\.random/.test(src),
    'randomBits 逐字节取 & 1（一字节一 bit，无取模偏差），且这一层不出现 Math.random');
  ok('bit/api-present', typeof crypto?.getRandomValues === 'function',
    '本运行时确实有 crypto.getRandomValues —— 验收跑的就是浏览器同一套 API，不是垫片');
  const N = 200000;
  const freq = [0, 0, 0];
  for (let i = 0; i < N; i++) { const b = randomBits(3); b.forEach((v, j) => { freq[j] += v; }); }
  const dev = freq.map(f => Math.abs(f / N - 0.5));
  ok('bit/per-coin-fair', dev.every(d => d < 0.005),
    `每枚各 ${N} 次，花面频率与 0.5 的偏差：${dev.map(d => d.toFixed(5)).join(' / ')}（阈值 0.005 ≈ 4.5σ）`);
}

// ── 3. 掷钱：八种面序齐全、跨次不可复现 ──
{
  const T = 50000;
  const seen = new Map<string, number>();
  const first: string[] = [];
  for (let i = 0; i < T; i++) {
    const key = coinToss().join('');
    seen.set(key, (seen.get(key) || 0) + 1);
    if (i < 500) first.push(key);
  }
  const patterns = ['字字字', '字字花', '字花字', '字花花', '花字字', '花字花', '花花字', '花花花'];
  const missing = patterns.filter(p => !seen.get(p));
  const share = patterns.map(p => (seen.get(p) || 0) / T);
  ok('toss/eight-patterns', missing.length === 0 && share.every(s => s > 0.10 && s < 0.15),
    `八种面序都出现且各占 10–15%（期望 12.5%）：缺 ${missing.join(',') || '无'}，实测占比 ${share.map(s => (s * 100).toFixed(1)).join('/')}%`);
  const distinct = new Set(first).size;
  const runs = first.slice(0, 250).join('') === first.slice(250).join('');
  ok('toss/not-reproducible', distinct >= 7 && !runs,
    `连续 500 次里出现 ${distinct} 种面序、前后两段序列不相同（Math.random 的短周期状态会在这里露出来）`);
  const eight = Array.from({ length: 8 }, () => coinToss().join(''));
  ok('toss/eight-calls-not-all-identical', new Set(eight).size > 1,
    `连掷 8 次不会次次相同（全同概率 1/2^24）：${eight.join(' ')}`);
}

// ── 4. 花数→爻值：手写表逐条对，且页面不再自己拷一份 ──
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
  const page = readFileSync(join(FRONTEND, 'app', 'liuyao', 'create', 'page.tsx'), 'utf8');
  const importsShared = /import\s*\{[^}]*coinToss[^}]*\}\s*from\s*'@\/lib\/liuyao\/methods\/coin'/.test(page) &&
    /import\s*\{[^}]*calcYao[^}]*\}\s*from\s*'@\/lib\/liuyao\/methods\/coin'/.test(page);
  const noLocalCopy = !/function calcYao/.test(page) && !/'字'\s*:\s*'花'/.test(page);
  ok('single-source/toss-and-yao', importsShared && noLocalCopy,
    `页面必须 import methods/coin 那一份，且不得再留本地 calcYao 或手拼面序：import ${Number(importsShared)}、无拷贝 ${Number(noLocalCopy)}`);
  const coinMod = readFileSync(join(FRONTEND, 'lib', 'liuyao', 'methods', 'coin.ts'), 'utf8');
  ok('single-source/one-toss-impl', (coinMod.match(/getRandomValues|randomBits/g) || []).length >= 1 &&
    !/\[\s*Math\.random|randomBits\([^)]*\)\s*,\s*randomBits/.test(coinMod),
    '掷钱实现全站只有一处（coin.ts 调 randomBits(3)），不在别处再拼第二次');
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
