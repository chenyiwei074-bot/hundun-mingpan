import Link from 'next/link';
import { CLOSED_TOOLS, INTENTS, LIUYAO_BASIS_TEXT } from '@/lib/tools/catalog';
import type { ToolStatus } from '@/lib/tools/catalog';

// 二级目录页：按「问什么」分组，再按术数查找。这一页只描述已经实现的东西，
// 数据全部来自 lib/tools/catalog.ts，由 tools/directory-acceptance 逐条核对
// （入口是否真存在、口径字符串是否等于引擎导出的常量、未开放条目有没有偷偷给链接）。

const STATUS_DOT: Record<ToolStatus, string> = {
  可用: 'var(--color-ji)',
  部分可用: 'var(--color-accent-gold)',
  未开放: 'var(--color-text-muted)',
};

const FIELDS: { key: 'question' | 'method' | 'basis' | 'reading'; label: string }[] = [
  { key: 'question', label: '适用问题' },
  { key: 'method', label: '方法' },
  { key: 'basis', label: '计算口径' },
  { key: 'reading', label: '结果怎么读' },
];

export default function ToolsPage() {
  const live = INTENTS.flatMap(g => g.tools).filter(t => t.status !== '未开放' && t.href);

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>玄学百宝箱</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>先说要问什么，再看用哪个工具</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>
          已开放 {live.length} 项 · 未开放 {CLOSED_TOOLS.length} 项 · 每项都写明取数口径与版本
        </p>
      </header>

      <section className="qn-card qn-rise" style={{ marginBottom: 16 }}>
        <p className="qn-axis" style={{ margin: 0 }}>状态怎么标</p>
        <p className="qn-body" style={{ marginTop: 8 }}>
          「可用」= 有实装页面，且盘面按下面记的版本口径出数，可以当场复核；「部分可用」= 主链路在，但某一段缺，缺的那一段会写明缺什么；「未开放」= 没有实现，因此不给入口、不放按钮。首页与本页都不为未做的功能留假入口。
        </p>
      </section>

      {INTENTS.map((g, gi) => (
        <section key={g.intent} style={{ marginTop: gi === 0 ? 0 : 28 }}>
          <p className="qn-axis">{g.intent}</p>
          <p className="qn-meta" style={{ margin: '6px 0 12px' }}>{g.lead}</p>
          <div style={{ display: 'grid', gap: 12 }}>
            {g.tools.map(t => (
              <article key={t.name} className="qn-card qn-rise">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 className="qn-title" style={{ margin: 0 }}>{t.name}</h2>
                  <span className="qn-badge">
                    <span className="qn-badge__dot" style={{ background: STATUS_DOT[t.status] }} />
                    {t.status}
                  </span>
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {FIELDS.map(f => (
                    <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                      <span className="qn-axis" style={{ flex: '0 0 76px' }}>{f.label}</span>
                      <span className="qn-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t[f.key]}</span>
                    </div>
                  ))}
                </div>
                {t.note && <p className="qn-note" style={{ marginTop: 10 }}>{t.note}</p>}
                {t.status !== '未开放' && t.href ? (
                  <Link href={t.href} className="qn-btn qn-btn--ghost qn-btn--block" style={{ marginTop: 14 }}>进入 · {t.name}</Link>
                ) : (
                  <p className="qn-cap" style={{ marginTop: 14 }}>未开放，因此没有入口。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="qn-legal" style={{ marginTop: 28 }}>
        <h2>版本记录</h2>
        <p>六爻三式：{LIUYAO_BASIS_TEXT}。三项都是随盘保存的口径戳，规则变更后生成的新盘与历史盘不同，历史盘一律标注「本盘按起卦时口径生成」，不重算覆盖。</p>
        <p>四柱与命盘：年柱以立春为界、月柱以节气为界，日柱夜子时按 23:00 归次日且不提供开关；选城市后按真太阳时与历史夏令时校正，校正量与钟表时刻同时显示，原始输入不被换算结果覆盖。</p>
        <p>黄历与星宿：宜忌与值日宿由站里唯一的八字引擎推算，本站不自建宜忌表、不自建吉凶评分；宿曜的合宿倾向指数是本站自研规则，权重在引擎注释里可读，不宣称还原自任何他站。</p>
        <h2>关于这些说法</h2>
        <p>所有工具都只报规则推演出的盘面与原样转录的断语，不宣称准确率，也不构成医疗、法律、投资或任何行事建议。你填的生辰、问题与报告只用于本次计算与你自己的报告页，不进入任何公开链上数据；结果凭证与公开存证能力仍在建设中，一旦上线，公开侧只会出现摘要与日期，不出现原文。</p>
        <p>
          <Link href="/" className="qn-link">回首页</Link>
          {' · '}
          <Link href="/disclaimer" className="qn-link">免责与口径</Link>
        </p>
      </section>
    </main>
  );
}
