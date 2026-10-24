import type { BasisTriple } from '@/lib/astro/classics';

// 传统文献出处卡：保留原文、章节与版本信息，页面不展示仓库内部文件名。
export default function BasisQuote({ basis, 标题 }: { basis: BasisTriple; 标题?: string }) {
  return (
    <section className="qn-row" style={{ marginTop: 10, display: 'grid', gap: 6, minWidth: 0 }}>
      <p className="qn-cap" style={{ margin: 0 }}>{标题 ?? '传统文献参考'}</p>

      <p className="qn-meta" style={{ margin: 0 }}>
        <span className="qn-axis">原文</span>
        <span lang="en" style={{ overflowWrap: 'anywhere' }}>{basis.原文}</span>
      </p>
      <p className="qn-note" style={{ margin: 0 }}>
        出处：{basis.位置} · {basis.版本}
      </p>

      <p className="qn-meta" style={{ margin: 0 }}>
        <span className="qn-axis">本站白话</span>
        {basis.白话}
      </p>

      <ul className="qn-note" style={{ margin: 0, paddingLeft: '1.2em' }}>
        {basis.口径.map(c => (
          <li key={c.说法}>{c.说法} —— {c.属于}</li>
        ))}
      </ul>
    </section>
  );
}
