import type { BasisTriple } from '@/lib/astro/classics';

// 「依据」三层块（批H-W）。形态由业主 2026-10-23 的两条裁定固定：
// 原文（标底本与该版位置）→ 本站白话 → 口径标注，缺任一层就不算有出处，
// astro-acceptance 的 `astro/basis-three-layers` 按这一条判红。
//
// 为什么不在这里直接写文案：那会变成第二份抄本。文案只在 lib/astro/classics.ts 一份，
// 原文只在 docs/classics/western/<book>.txt 一份，这里只渲染。
export default function BasisQuote({ basis, 标题 }: { basis: BasisTriple; 标题?: string }) {
  return (
    <section className="qn-row" style={{ marginTop: 10, display: 'grid', gap: 6, minWidth: 0 }}>
      <p className="qn-cap" style={{ margin: 0 }}>{标题 ?? '依据（原文 · 白话 · 口径）'}</p>

      <p className="qn-meta" style={{ margin: 0 }}>
        <span className="qn-axis">原文</span>
        <span lang="en" style={{ overflowWrap: 'anywhere' }}>{basis.原文}</span>
      </p>
      <p className="qn-note" style={{ margin: 0 }}>
        出处 {basis.版本} · {basis.位置}
      </p>

      <p className="qn-meta" style={{ margin: 0 }}>
        <span className="qn-axis">本站白话</span>
        {basis.白话}（本站自写，非原文、非他人译本）
      </p>

      <ul className="qn-note" style={{ margin: 0, paddingLeft: '1.2em' }}>
        {basis.口径.map(c => (
          <li key={c.说法}>{c.说法} —— {c.属于}</li>
        ))}
      </ul>
    </section>
  );
}
