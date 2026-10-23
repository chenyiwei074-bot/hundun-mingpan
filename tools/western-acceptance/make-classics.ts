// 西方底本生成器（批H-W）。原始 PG 文件 + 本脚本 → docs/classics/western/<book>.txt。
//
// 底本层为什么不能手抄：手抄的"逐字"没人能复核，而这条链要的是"重新取一次同一个 URL、
// 跑同一个脚本，字节对得上"。所以原文一律由脚本按锚串定位切出，一个字都不经过手。
//
// 用法（与其余验收同一条命令形状，但这是生成器不是套件）：
//   重算并核对：QN_PG_TETRABIBLOS=<pg70850.txt 路径> QN_PG_DELACERENCE1916=<pg43548.txt 路径> \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/western-acceptance/make-classics.ts --check
//   重新入仓：同上前缀加 --write
// 两个开关都不带 → 打用法并 exit 1（批F 学过的那条：静默空转与"跑过了"在命令行上同形）。
// 没给原始文件路径时 --check 只打 SKIP，不计 PASS。
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { readDataBytes, readDataText } from '../_lib/classics';
import { join } from 'node:path';
import { PGNORM_VERSION, canon, normalizePg, stripPgWrapper } from '../_lib/pgnorm';

const ROOT = join(__dirname, '../..');
const FETCHED = '2026-10-23';

interface Passage { id: string; 该版位置: string; 起: string; 止: string }
interface Book { 文件: string; pg: number; url: string; 版本: string; 原始env: string; passages: Passage[] }

const BOOKS: Book[] = [
  {
    文件: 'docs/classics/western/tetrabiblos.txt',
    pg: 70850,
    url: 'https://www.gutenberg.org/cache/epub/70850/pg70850.txt',
    版本: 'J. M. Ashmand 英译 · 原出版 W. Foulsham & Co. Ltd, 1900（英国）· PG 发布 2023-05-24 · PGDP 校勘键入',
    原始env: 'QN_PG_TETRABIBLOS',
    // 章节号按该版（Ashmand/Foulsham 1900 排印）：通行今本编号不同，页面不许裸写今本号。
    passages: [
      { id: 'i-xiv-tropical-signs', 该版位置: 'Book I, CHAPTER XIV「TROPICAL, EQUINOCTIAL, FIXED, AND BICORPOREAL SIGNS」（该版目录页 23 ≈ 今本 I.14 一带，编号按本版本记）',
        起: 'Among the twelve signs, some are termed tropical', 止: 'composing the sign of Capricorn.' },
      { id: 'i-xvi-mutual-configurations', 该版位置: 'Book I, CHAPTER XVI「MUTUAL CONFIGURATIONS OF THE SIGNS」（该版目录页 24 ≈ 今本 I.13）',
        起: 'This mutual configuration attaches to all parts', 止: 'or sixty degrees.' },
    ],
  },
  {
    文件: 'docs/classics/western/delaurence-illustrated-key-1916.txt',
    pg: 43548,
    url: 'https://www.gutenberg.org/cache/epub/43548/pg43548.txt',
    版本: 'L. W. De Laurence《The Illustrated Key to the Tarot: The Veil of Divination》1916 · PG 发布 2013-08-18 · PGDP 校勘键入',
    原始env: 'QN_PG_DELACERENCE1916',
    passages: [
      { id: 'celtic-method-opening', 该版位置: '§ 7「An Ancient Celtic Method Of Divination」起始操作句（该书 §7 目录见前matter；"Ancient/Celtic"是作者的自称，本站不背书）',
        起: 'Having selected the Significator, place it on the table', 止: 'the faces of the cards downwards.' },
      { id: 'celtic-method-ten-cards', 该版位置: '§ 7 末段（点名"头十张"那一步）',
        起: 'The pack must be again shuffled and cut three times', 止: 'the first ten cards laid out as before.' },
    ],
  },
];

const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');

/** 从**规范化后的整档**里切出登记段。
 *  为什么不按原始文件的偏移切：PG 的 TXT 是约 70 字符硬换行，锚串里那句
 *  `keeping the faces\nof the cards downwards.` 在原始档里跨换行 —— 按原文偏移定位会直接找不到，
 *  而"找不到"很容易被误当成"这段话不在这本书里"。所以偏移口径记的是规范化整档，
 *  原始档由 sha256 钉住：重取同一 URL → 跑同一脚本 → 规范化整档必然一致。 */
function cut(norm: string, p: Passage) {
  const 起 = canon(p.起), 止 = canon(p.止);
  const a = norm.indexOf(起);
  if (a < 0) throw new Error(`锚串找不到（起）：${p.id} —— 源文件版本变了，或锚串抄错`);
  if (norm.indexOf(起, a + 1) >= 0) throw new Error(`起始锚不唯一：${p.id}`);
  const b = norm.indexOf(止, a);
  if (b < 0) throw new Error(`锚串找不到（止）：${p.id}`);
  const end = b + 止.length;
  return { 起: a, 止: end, raw: norm.slice(a, end) };
}

function build(book: Book, rawPath: string) {
  const raw = readDataBytes(rawPath);
  const norm = normalizePg(stripPgWrapper(raw.toString('utf8')));
  const 头 = [
    `# 西方底本（规范化后的 PG 文本）—— 只由脚本生成，手改即视为坏`,
    `# 规范化脚本: tools/western-acceptance/make-classics.ts · 规则 tools/_lib/pgnorm.ts · 版本 ${PGNORM_VERSION}`,
    `# 载体: Project Gutenberg #${book.pg} · ${book.url}`,
    `# 版本与译者: ${book.版本}`,
    `# 抓取日期: ${FETCHED}`,
    `# 原始文件 sha256: ${sha(raw)}`,
    `# 规范化整档 sha256: ${sha(norm)}`,
    `# 偏移口径: 规范化整档（PG 头尾已剥、段落摊平、空白归一）的字符序号，含首不含尾`,
    `# 注: 段内可能保留原排版的断词连字符；引文必须是原句连续片段，跨断词的引用会判红`,
    '',
  ].join('\n');
  const blocks = book.passages.map(p => {
    const c = cut(norm, p);
    const text = normalizePg(c.raw);
    return [`# PASSAGE ${p.id}`, `# 该版位置: ${p.该版位置}`, `# 规范化整档字符偏移: ${c.起}…${c.止}`,
      `# 规范化段 sha256: ${sha(text)}`, text, ''].join('\n');
  }).join('\n');
  return 头 + blocks + '\n';
}

const check = process.argv.includes('--check');
const write = process.argv.includes('--write');
const isEntry = /[\\/]make-classics\.[cm]?[tj]sx?$/.test(process.argv[1] || '');

if (isEntry) {
  if (!check && !write) {
    console.log('既没带 --check 也没带 --write —— 什么都不做并 exit 1（静默空转与"跑过了"在命令行上同形，批F 踩过）。');
    process.exit(1);
  }
  let skipped = 0;
  for (const book of BOOKS) {
    const rawPath = process.env[book.原始env] || '';
    if (!rawPath || !existsSync(rawPath)) {
      console.log(`SKIP ${book.文件}：没给 ${book.原始env}（原始 PG 文件路径）。没有原始文件就无从复现，不写、也不声称核过。`);
      skipped++;
      continue;
    }
    const next = build(book, rawPath);
    const cur = existsSync(join(ROOT, book.文件)) ? readDataText(join(ROOT, book.文件)) : null;
    if (check) {
      const same = cur !== null && canon(next) === canon(cur);
      console.log(`${same ? 'PASS' : 'FAIL'}  west/reference-reproducible  ${book.文件} 重算与原入仓${same ? '逐字一致' : '不一致 —— 要么源文件变了，要么规范化规则变了（那要升 PGNORM_VERSION 并整档重生）'}`);
      if (!same) process.exit(1);
    } else {
      writeFileSync(join(ROOT, book.文件), next, 'utf8');
      console.log(`WROTE ${book.文件} ${Buffer.byteLength(next, 'utf8')} 字节`);
    }
  }
  if (check && skipped) console.log(`（其中 ${skipped} 档 SKIP：未提供原始文件）`);
  process.exit(0);
}
