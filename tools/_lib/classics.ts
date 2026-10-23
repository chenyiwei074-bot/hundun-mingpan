import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 读**数据文件**（底本 .txt、原始 PG 档）—— 逐字读，不剥注释。
 *  为什么要有这个名字：`gate/text-comparing-gates-strip-comments` 要求 tools/ 里每一处
 *  `readFileSync` 在拿源码文本做判定前先剥注释，而它只认**写在行上的扩展名**。路径藏在变量里时
 *  它无法判断读的是码还是数据 —— 那种情形按规则该进带理由的豁免清单，但豁免一个文件就等于
 *  给这个文件开永久口子。所以这里用一对专用件把"这是数据读"变成行上看得见的**类别**，
 *  闸门认类别不认文件名；拿它去读源码文本并在文本上做判定，就是当场撒谎。 */
export function readDataText(p: string): string { return readFileSync(p, 'utf8'); }
export function readDataBytes(p: string): Buffer { return readFileSync(p); }

// `docs/classics/western/*.txt` 的解析器 —— 唯一实现。
// 为什么单独成一个文件：底本侧判据分两处（western 核"这层没被手改"，astro 核"页面那句引文
// 真在这段里"），两边各自写一份解析的话，其中一份坏掉就会给出"底本里找不到"这种假红。
export interface BasePassage { id: string; 该版位置: string; 偏移: string; 段sha256: string; text: string }
export interface BaseFile {
  /** 相对仓库根的路径，一律正斜杠 —— 前端的 底本 字段就是这么写的，
   *  Windows 上 join() 给的反斜杠会让"按路径查底本"全部落空（本批真踩过，红成"引文找不到"） */
  文件: string;
  abs: string;
  头: Record<string, string>;
  passages: BasePassage[];
}

export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

/** 读全部西方底本（README.md 是规则说明，不算底本）。 */
export function readWesternBases(root: string): BaseFile[] {
  const dir = join(root, 'docs', 'classics', 'western');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.txt'))
    .map(f => {
      const abs = join(dir, f);
      const b = parseBase(readDataText(abs));
      return { ...b, 文件: ['docs', 'classics', 'western', f].join('/'), abs };
    });
}

export function parseBase(text: string): { 头: Record<string, string>; passages: BasePassage[] } {
  const 头: Record<string, string> = {};
  const passages: BasePassage[] = [];
  let cur: BasePassage | null = null;
  let body: string[] = [];
  const flush = () => {
    if (cur) { cur.text = body.join('\n').trim(); passages.push(cur); }
    body = [];
  };
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const p = /^# PASSAGE (\S+)\s*$/.exec(line);
    if (p) { flush(); cur = { id: p[1], 该版位置: '', 偏移: '', 段sha256: '', text: '' }; continue; }
    const m = /^# (.+?): (.*)$/.exec(line);
    if (m) {
      const [, k, v] = m;
      if (cur) {
        if (k === '该版位置') cur.该版位置 = v;
        else if (k === '规范化整档字符偏移') cur.偏移 = v;
        else if (k === '规范化段 sha256') cur.段sha256 = v;
      } else if (!(k in 头)) 头[k] = v;
      continue;
    }
    if (line.startsWith('# ')) continue;   // 无键值的说明行
    body.push(line);
  }
  flush();
  return { 头, passages };
}
