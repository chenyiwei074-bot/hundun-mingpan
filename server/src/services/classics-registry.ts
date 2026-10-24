import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * 已入仓底本的只读登记表（2026-10-24）。
 *
 * 原则：
 *  - 只读 docs/classics 下已经入仓的文件，不访问网络、不读数据库；
 *  - quote 必须是 depositedFile 的连续片段（由测试逐条校验）；
 *  - 不把模型生成的书名/篇章混进来：id 只能来自这里；
 *  - 白名单字段固定，前端按 SourceRef 渲染，不自己拼来源。
 */
export interface SourceRef {
  sourceId: string;
  book: string;
  chapter: string;
  edition: string;
  language: 'zh' | 'en';
  quote: string;
  depositedFile: string;
  sha256: string;
  locator: { kind: 'file' } | { kind: 'offset'; start: number; end: number };
  notes: string;
}

const DOCS_ROOT = path.resolve(__dirname, '..', '..', '..', 'docs');
const CLASSICS_ROOT = path.join(DOCS_ROOT, 'classics');

let cache: SourceRef[] | null = null;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function rel(file: string): string {
  return path.relative(path.resolve(DOCS_ROOT, '..'), file).replace(/\\/g, '/');
}

function headerField(text: string, label: string): string {
  const m = new RegExp('^>\\s*' + label + '[：:]\\s*(.+)$', 'm').exec(text);
  return m ? m[1].trim() : '';
}

function stripHashLines(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^#/.test(line.trim()))
    .join('\n')
    .trim();
}

/** 中文单篇：`docs/classics/*.md`（9 字段头 + 正文）。 */
function parseChinese(file: string): SourceRef | null {
  const text = readFileSync(file, 'utf-8');
  const id = path.basename(file, '.md');
  // quote 必须是 depositedFile 的**连续子串**：中文单篇有多个 ## 小节，
  // 若把标题行剔掉再接起来就断了。这里从第一个小节标题起原样截到文件尾，
  // 前端展示时再按小节渲染；不追求"只给正文"而破坏可机检性。
  const bodyStart = text.search(/^##\s/m);
  const body = (bodyStart >= 0 ? text.slice(bodyStart) : text).trim();
  if (!body) return null;
  return {
    sourceId: id,
    book: headerField(text, '书名') || id,
    chapter: headerField(text, '卷／篇') || headerField(text, '卷/篇') || '',
    edition: headerField(text, '版本') || headerField(text, '取文方式') || '未注明',
    language: 'zh',
    quote: body,
    depositedFile: rel(file),
    sha256: sha256(text.trim()),
    locator: { kind: 'file' },
    notes: headerField(text, '比对规则') || '',
  };
}

/** 西文规范化底本：`docs/classics/western/*.txt`（头部 + PASSAGE 段）。 */
function parseWestern(file: string): SourceRef[] {
  const text = readFileSync(file, 'utf-8');
  const carrier = headerField(text, '# 载体') || /^#\s*载体[:：]\s*(.+)$/m.exec(text)?.[1]?.trim() || path.basename(file);
  const edition = text.split('\n').find(l => l.startsWith('# 版本与译者'))?.replace(/^#\s*版本与译者[:：]\s*/, '').trim()
    || '未注明';
  const originalSha = text.split('\n').find(l => l.startsWith('# 原始文件 sha256'))?.replace(/^#\s*原始文件 sha256[:：]\s*/, '').trim()
    || sha256(text.trim());
  const note = text.split('\n').find(l => l.startsWith('# 注:'))?.replace(/^#\s*注[:：]\s*/, '').trim() || '';

  const blocks = text.split(/^# PASSAGE /m).slice(1);
  const out: SourceRef[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const id = lines[0].trim();
    if (!id) continue;
    const loc = lines.find(l => l.startsWith('# 该版位置'))?.replace(/^#\s*该版位置[:：]\s*/, '').trim() || '';
    const offsetLine = lines.find(l => l.startsWith('# 规范化整档字符偏移'))?.replace(/^#\s*规范化整档字符偏移[:：]\s*/, '').trim() || '';
    const passageSha = lines.find(l => l.startsWith('# 规范化段 sha256'))?.replace(/^#\s*规范化段 sha256[:：]\s*/, '').trim() || '';
    const body = stripHashLines(lines.slice(1).join('\n'));
    if (!body) continue;
    const m = /^(\d+)\D+(\d+)$/.exec(offsetLine);
    out.push({
      sourceId: id,
      book: carrier,
      chapter: loc,
      edition,
      language: 'en',
      quote: body,
      depositedFile: rel(file),
      sha256: passageSha || originalSha,
      locator: m ? { kind: 'offset', start: Number(m[1]), end: Number(m[2]) } : { kind: 'file' },
      notes: note,
    });
  }
  return out;
}

/** 登记表：首次调用时扫描，之后走内存缓存（文件变了要重启，不做热更新）。 */
export function allSources(): SourceRef[] {
  if (cache) return cache;
  const out: SourceRef[] = [];
  if (!statSync(CLASSICS_ROOT, { throwIfNoEntry: false })) {
    cache = out;
    return out;
  }
  for (const name of readdirSync(CLASSICS_ROOT)) {
    const full = path.join(CLASSICS_ROOT, name);
    if (!statSync(full).isFile() || !name.endsWith('.md') || name === 'README.md') continue;
    const one = parseChinese(full);
    if (one) out.push(one);
  }
  const westernDir = path.join(CLASSICS_ROOT, 'western');
  if (statSync(westernDir, { throwIfNoEntry: false })) {
    for (const name of readdirSync(westernDir)) {
      if (!name.endsWith('.txt')) continue;
      out.push(...parseWestern(path.join(westernDir, name)));
    }
  }
  cache = out.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  return cache;
}

export function findSources(ids: string[]): { found: SourceRef[]; missing: string[] } {
  const byId = new Map(allSources().map(s => [s.sourceId, s]));
  const found: SourceRef[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (s) found.push(s); else missing.push(id);
  }
  return { found, missing };
}
