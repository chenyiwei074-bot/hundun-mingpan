import Link from 'next/link';
import QuestionComposer from '@/components/assistant/QuestionComposer';

// 两套体系共用的工作页框架。
//
// 分工要说清楚：框架负责"这一系是哪一系、怎么回去、页脚那几句话"，
// 以及主题作用域（data-mode）；具体的工具内容各系自己给。
// 东方那一页目前不用这个框架 —— 它的首屏是改版前就上线的那张主视觉，
// 四类意图入口必须在首屏内（harness 有这条硬断言），把框架的页头插到它上面
// 就会把意图区挤出首屏。等设计稿定了两套首屏的版式再统一收进来。

// Mode 只有一个出处：lib/assistant/types。这里再写一遍字面量联合，
// 将来加第三套体系时就会有两份要同时改的东西 —— 而那正是本站最擅长漏掉的那种。
import type { Mode } from '@/lib/assistant/types';

const COPY: Record<Mode, { eyebrow: string; title: string; lead: string }> = {
  oriental: {
    eyebrow: '东方体系',
    title: '东方工作页',
    lead: '八字紫微、六爻、梅花、星宿、黄历与户型相关的一套。',
  },
  western: {
    eyebrow: '西方体系',
    title: '西方工作页',
    lead: '占星、塔罗、月相与数字命理的一套。每一项都按自己的算法口径独立成立，不借东方的表。',
  },
};

export default function ModeLanding({ mode, children }: {
  mode: Mode;
  children: React.ReactNode;
}) {
  const c = COPY[mode];
  return (
    <main className="qn-shell qn-shell--wide" data-mode={mode}>
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/" className="domain-back">← 返回选择体系</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>{c.eyebrow}</p>
        <h1 className="qn-hero">{c.title}</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>{c.lead}</p>
      </header>
      <section className="qn-card qn-rise" style={{ marginTop: 16 }}>
        <QuestionComposer mode={mode} />
      </section>
      {children}
      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          这一页只列{mode === 'western' ? '西方' : '东方'}体系里的工具；
          换体系请回
          <Link className="qn-link" href="/" style={{ margin: '0 4px' }}>选择体系</Link>
          那页重选。排盘与抽取由各自的规则引擎执行，模型只做解释与引导。
        </p>
      </section>
    </main>
  );
}
