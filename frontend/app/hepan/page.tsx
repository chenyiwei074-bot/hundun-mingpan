import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '姻缘与关系｜混沌',
  description: '选择八字合盘、二十八宿合宿或姓名五格对照，查看两个人之间可复核的取数关系。',
};

const cardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  minHeight: 280,
};

export default function HepanPage() {
  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ flex: '1 1 280px' }}>
          <p className="qn-eyebrow" style={{ margin: 0 }}>东方 · 看关系</p>
          <h1 className="qn-hero" style={{ margin: '12px 0 8px' }}>把两个人的结构并排看</h1>
          <p className="qn-meta" style={{ margin: 0, maxWidth: 520 }}>
            先看各自的盘面与相互对应，再由你判断关系如何继续。
          </p>
        </div>
        <svg viewBox="0 0 220 150" width="190" height="130" role="img" aria-label="两个人的结构相互映照">
          <circle cx="82" cy="72" r="49" fill="none" stroke="var(--color-accent-gold)" strokeWidth="1.4" opacity=".68" />
          <circle cx="138" cy="72" r="49" fill="none" stroke="var(--color-accent-gold)" strokeWidth="1.4" opacity=".68" />
          <circle cx="110" cy="72" r="25" fill="none" stroke="var(--color-hairline)" strokeWidth="1" />
          <path d="M54 118 Q110 139 166 118" fill="none" stroke="var(--color-hairline)" strokeWidth="1" />
          <text x="82" y="78" textAnchor="middle" fill="var(--color-text-primary)" fontSize="14">我</text>
          <text x="138" y="78" textAnchor="middle" fill="var(--color-text-primary)" fontSize="14">对方</text>
          <circle cx="110" cy="72" r="3" fill="var(--color-accent-gold)" />
        </svg>
      </header>

      <section className="qn-card qn-rise qn-rise--2" style={{ marginBottom: 16 }}>
        <p className="qn-body" style={{ margin: 0 }}>
          目前开放三种关系观察方式。八字合盘展示盘面对应，二十八宿合宿展示双向宿性；姓名五格由你确认笔画后并排对照。都不替双方判断是否合适。
        </p>
      </section>

      <section aria-label="关系工具" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
        <article className="qn-card qn-rise qn-rise--2" style={cardStyle}>
          <p className="qn-cap" style={{ margin: 0 }}>八字 × 紫微 · 双盘对照</p>
          <h2 className="qn-title" style={{ margin: '10px 0 6px' }}>八字合盘</h2>
          <p className="qn-meta" style={{ margin: 0 }}>
            并排观察日主、五行、十神与宫位关系。每条结果给出盘面依据和不确定项，不把关系折算成百分比。
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <p className="qn-note" style={{ margin: '0 0 10px' }}>进入建盘页后选择「双人合盘」。填写对方资料前，请先取得对方同意。</p>
            <Link href="/create?mode=double" className="qn-btn qn-btn--solid qn-btn--block">开始双人合盘</Link>
          </div>
        </article>

        <article className="qn-card qn-rise qn-rise--3" style={cardStyle}>
          <p className="qn-cap" style={{ margin: 0 }}>二十八宿 · 双向观察</p>
          <h2 className="qn-title" style={{ margin: '10px 0 6px' }}>合宿</h2>
          <p className="qn-meta" style={{ margin: 0 }}>
            只需双方的出生日期，不需要时辰。分别查看以自己为本、以对方为本时的宿性关系。
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <p className="qn-note" style={{ margin: '0 0 10px' }}>页面会单独标出本站自研的倾向指数，不将它说成古籍原文。</p>
            <Link href="/xiu" className="qn-btn qn-btn--ghost qn-btn--block">开始二十八宿合宿</Link>
          </div>
        </article>

        <article className="qn-card qn-rise qn-rise--3" style={cardStyle}>
          <p className="qn-cap" style={{ margin: 0 }}>姓名五格 · 手动核笔画</p>
          <h2 className="qn-title" style={{ margin: '10px 0 6px' }}>双人五格对照</h2>
          <p className="qn-meta" style={{ margin: 0 }}>
            双方分别填入姓与名的逐字笔画，查看天、人、地、外、总五格的数字和五行关系。
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <p className="qn-note" style={{ margin: '0 0 10px' }}>五格是近代方法；请用同一笔画口径核对，不自动猜康熙笔画。</p>
            <Link href="/name-compat" className="qn-btn qn-btn--ghost qn-btn--block">开始姓名五格对照</Link>
          </div>
        </article>
      </section>

      <section className="qn-legal qn-rise qn-rise--3" style={{ marginTop: 22 }}>
        <h2>关系由你定义</h2>
        <p>这些工具呈现各自方法下的取数关系，不能代替双方沟通，也不会替你作出关系决定。</p>
        <p className="qn-linkrow">
          <Link href="/tools" className="qn-link">查看全部工具</Link>
          <Link href="/oriental" className="qn-link">回到东方体系</Link>
        </p>
      </section>
    </main>
  );
}
