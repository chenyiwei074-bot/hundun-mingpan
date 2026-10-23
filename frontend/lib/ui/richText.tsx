import React from 'react';

/**
 * 极简富文本渲染：**粗体**、# 标题、> 引用、- 列表、空行分段。
 *
 * 为什么自己写：报告与 AI 解读的正文是模型产出的文字，不是 Markdown 文档。
 * 直接把 **文字** 原样上屏就是"乱码"的一种（用户看到的是星号），
 * 引第三方 markdown 库又为一个 ** 引入整包不划算。这里只做需要的四件事。
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let items: string[] = [];

  const flush = () => {
    if (!items.length) return;
    const list = items;
    items = [];
    out.push(
      <ul key={`ul-${out.length}`} style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.85 }}>
        {list.map((t, i) => <li key={i}>{inline(t, `li-${out.length}-${i}`)}</li>)}
      </ul>,
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('### ')) {
      flush();
      out.push(<h4 key={idx} className="qn-body" style={{ fontWeight: 600, margin: '12px 0 4px' }}>{inline(line.slice(4), `h4-${idx}`)}</h4>);
    } else if (line.startsWith('## ')) {
      flush();
      out.push(<h3 key={idx} className="qn-body" style={{ fontWeight: 600, color: 'var(--color-accent-gold-text)', margin: '18px 0 8px', paddingBottom: 6, borderBottom: 'var(--qn-hairline)' }}>{inline(line.slice(3), `h3-${idx}`)}</h3>);
    } else if (line.startsWith('# ')) {
      flush();
      out.push(<h2 key={idx} className="qn-title" style={{ margin: '22px 0 10px', textWrap: 'balance' }}>{inline(line.slice(2), `h2-${idx}`)}</h2>);
    } else if (line.startsWith('> ')) {
      flush();
      out.push(<blockquote key={idx} className="qn-body" style={{ margin: '8px 0', padding: '10px 14px', borderLeft: '2px solid var(--color-accent-gold)', background: 'rgba(178,149,93,0.04)', borderRadius: '0 8px 8px 0' }}>{inline(line.slice(2), `q-${idx}`)}</blockquote>);
    } else if (line.startsWith('- ')) {
      items.push(line.slice(2));
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      out.push(<p key={idx} className={className || 'qn-body'} style={{ margin: '6px 0', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{inline(line, `p-${idx}`)}</p>);
    }
  });
  flush();
  return <div>{out}</div>;
}
