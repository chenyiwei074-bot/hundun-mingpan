// PG 底本规范化 —— 唯一实现，生成器与引文闸门共用。
//
// 为什么必须共用：底本与引文若走两套折叠规则，比对失败时读的人看到的是"引文与原文不一致"，
// 而真相是"两边折叠方式不同" —— 那种红会把人引去查一个不存在的口径改动。
//
// 版本戳进元数据：改这里的任何一条规则，底本必须重新生成并升戳，否则老底本的 sha256
// 与新规则的产物对不上，而"对不上"看起来像原文变了。
export const PGNORM_VERSION = 'pgnorm-v1';

/** 剥掉 PG 的头尾：许可块 + `*** START/END OF (THIS|THE) PROJECT GUTENBERG EBOOK … ***` 两行标记。
 *  找不到起始标记就抛错 —— 静默返回整份文件会把许可块当正文收进底本。 */
export function stripPgWrapper(text: string): string {
  const start = text.match(/^\*\*\*\s*START OF TH[IE]S? PROJECT GUTENBERG EBOOK.*?\*\*\*\s*$/m);
  const end = text.match(/^\*\*\*\s*END OF TH[IE]S? PROJECT GUTENBERG EBOOK.*?\*\*\*\s*$/m);
  if (!start || start.index === undefined) throw new Error('没找到 PG 起始标记（*** START OF … ***）—— 这不是 PG 全文，或取文只取到壳');
  if (!end || end.index === undefined) throw new Error('没找到 PG 结束标记 —— 截断的下载不许当原始文件用');
  if (end.index <= start.index) throw new Error('结束标记在起始标记之前，文件顺序不对');
  return text.slice(start.index + start[0].length, end.index);
}

/** CR 去掉 → 段落摊平（段内单换行并入同一行）→ 空白归一 → 段落之间留一个空行。
 *  不做连字符合并（`hyphen-` + 换行不拼接）：那是"修原文"，本层的纪律是只动排版不动字符。
 *  所以引文不许跨一个被断开的词 —— 闸门按"原句连续片段"判，跨断开词自然判红。 */
export function normalizePg(text: string): string {
  const lf = text.replace(/\r\n?/g, '\n');
  return lf
    .split(/\n{2,}/)                      // 段落
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0)
    .join('\n\n');
}

/** 比对用的规范化：底本与引文都过这一个函数（空白全塌成单空格），除此之外逐字 */
export function canon(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** PG 注号（`[44]` 之属）是注者锚点，不是古籍正文。引文里出现即判红。 */
export const PG_NOTE_ANCHOR = /\[\d{1,3}\]/;
