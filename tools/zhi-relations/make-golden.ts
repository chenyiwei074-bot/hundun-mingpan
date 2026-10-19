// 生成 zhi-relations 的改前钉值（全枚举 12^4 组四柱地支 + 144 组成对）。
// 用途：把 detectZhiRelations 导出现成对函数这次重构，钉在「现有四柱输出逐字节不变」上 ——
// 抽样比对挡不住只在特定三支组合上才走的分支（拱合/半刑/暗合抑制都是这种）。
// 不入库的那部分是临时探针；这份 golden 要入库（tools/zhi-relations-golden.json）。
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { detectZhiRelations } from '../../frontend/app/lib/core/bazi-enrich/zhi-relations';
import { DIZHI } from '../../frontend/app/lib/core/bazi-enrich/tables';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const OUT = join(__dirname, 'zhi-relations-golden.json');

// 固定顺序：年→月→日→时 各按 DIZHI 序，字典序枚举全部 20736 组合。
function* allQuads() {
  for (const y of DIZHI) for (const m of DIZHI) for (const d of DIZHI) for (const h of DIZHI)
    yield { 年: y, 月: m, 日: d, 时: h };
}

const buckets: Record<string, number> = {};
const parts: string[] = [];
let count = 0;
for (const q of allQuads()) {
  const rel = detectZhiRelations(q as never);
  parts.push(JSON.stringify(rel));
  count++;
  for (const r of rel) buckets[r.type] = (buckets[r.type] || 0) + 1;
}
const joined = parts.join('\n');
// 不引 crypto 之外的东西：digest 用 node:crypto 的 sha256，十六进制裸串。
const digest = createHash('sha256').update(joined).digest('hex');

// 成对表：12×12 全枚举（含同支自刑与 a==b），锁住将来给 K线用的那一条路。
const pairParts: string[] = [];
for (const a of DIZHI) for (const b of DIZHI) pairParts.push(a + b + '=' + JSON.stringify(detectZhiRelations({ 年: a, 月: b, 日: a, 时: b } as never)));
const pairDigest = createHash('sha256').update(pairParts.join('\n')).digest('hex');

const golden = {
  schemaVersion: 'zhi-relations-golden-v1',
  generatedFrom: '改前 HEAD 的 detectZhiRelations（本次重构的基线）',
  combos: count,
  digest,
  typeCounts: buckets,
  pairDigest,
  // 三条可读样例，供人眼复核而不是只信哈希
  samples: {
    '申子辰全(三合水局)': JSON.stringify(detectZhiRelations({ 年: '申', 月: '子', 日: '辰', 时: '午' } as never)),
    '寅巳(半刑+六害同现)': JSON.stringify(detectZhiRelations({ 年: '寅', 月: '巳', 日: '寅', 时: '巳' } as never)),
    '辰辰午午(自刑)': JSON.stringify(detectZhiRelations({ 年: '辰', 月: '辰', 日: '午', 时: '午' } as never)),
  },
};

if (CHECK) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const okDigest = prev.digest === digest;
  const okPair = prev.pairDigest === pairDigest;
  const okTypes = JSON.stringify(prev.typeCounts) === JSON.stringify(buckets);
  console.log(`  ${okDigest ? 'PASS' : 'FAIL'}  golden/digest        四柱全枚举 20736 组的地支关系串接 sha256：${digest.slice(0, 16)} vs ${prev.digest.slice(0, 16)}`);
  console.log(`  ${okTypes ? 'PASS' : 'FAIL'}  golden/type-counts  ${JSON.stringify(buckets)}`);
  console.log(`  ${okPair ? 'PASS' : 'FAIL'}  golden/pair-digest   成对枚举：${pairDigest.slice(0, 16)} vs ${prev.pairDigest.slice(0, 16)}`);
  process.exit(okDigest && okPair && okTypes ? 0 : 1);
}

writeFileSync(OUT, JSON.stringify(golden, null, 1) + '\n', 'utf8');
console.log('写入 ' + OUT);
console.log(JSON.stringify(golden, null, 1).slice(0, 900));
