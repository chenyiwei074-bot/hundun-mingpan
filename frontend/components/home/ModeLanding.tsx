import Link from 'next/link';
import QuestionComposer from '@/components/assistant/QuestionComposer';
import type { Mode } from '@/lib/assistant/types';

const COPY: Record<Mode, { eyebrow: string; title: string; lead: string; section: string }> = {
  oriental: {
    eyebrow: '混沌 / 东方',
    title: '东方术数',
    lead: '从命盘、卦象与空间开始，选择你想用的方法。',
    section: '从象与数出发。',
  },
  western: {
    eyebrow: '混沌 / 西方',
    title: '西方神秘学',
    lead: '从星图、牌阵与月相开始，选择你想用的方法。',
    section: '以星与牌为线索。',
  },
};

export default function ModeLanding({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const copy = COPY[mode];
  return (
    <main className={'hd-hub hd-hub--' + mode} data-mode={mode}>
      <div className="hd-hub__inner">
        <header className="hd-hub__hero">
          <div className="hd-hub__hero-art" aria-hidden="true" />
          <div className="hd-hub__hero-shade" aria-hidden="true" />
          <div className="hd-hub__hero-copy">
            <p>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <span>{copy.lead}</span>
          </div>
        </header>
        <section className="hd-hub__question" aria-label="问事入口">
          <QuestionComposer mode={mode} />
        </section>
        <div className="hd-hub__heading">
          <div>
            <p className="hd-kicker">全部工具</p>
            <h2>{copy.section}</h2>
          </div>
          <p>每一种工具按自己的规则计算与解读。进入后可查看输入要求和结果范围。</p>
        </div>
        <div className="hd-hub__catalog">{children}</div>
        <div className="hd-hub__endlinks">
          <Link href="/tools">查看全站工具</Link>
          <Link href={mode === 'oriental' ? '/western' : '/oriental'}>探索{mode === 'oriental' ? '西方' : '东方'}体系</Link>
          <Link href="/">返回首页</Link>
        </div>
      </div>
    </main>
  );
}
