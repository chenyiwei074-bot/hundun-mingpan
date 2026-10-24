import Link from 'next/link';
import QuestionComposer from '@/components/assistant/QuestionComposer';

// 两套体系共用的工作页框架。
//
// 分工要说清楚：框架负责"这一系是哪一系、怎么回去、页脚那几句话"、主题作用域（data-mode），
// 以及**问事框的位置** —— 这一条是批E 收进来的原因：两页的输入框必须落在首屏同一个 y 上，
// 各自排一遍就会漂（东方那一版漂到 y=450，西方在 251，而两条判据本来都该是同一句话）。
// 具体的工具内容各系自己给。
//
// hero 槽是给"自带主视觉的那一系"留的：传了 hero 就不渲染文字页头，h1 因此只有一份。
// shellClass 同理：主视觉与通栏色带要满幅，不能被套进 760px 的阅读壳里 —— 壳是每页的属性，
// 页头/输入框/页脚才是框架的。

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

export default function ModeLanding({ mode, hero, shellClass, children }: {
  mode: Mode;
  hero?: React.ReactNode;
  shellClass?: string;
  children: React.ReactNode;
}) {
  const c = COPY[mode];
  return (
    <main className={shellClass || 'qn-shell qn-shell--wide'} data-mode={mode}>
      {hero ?? (
        <header className="qn-rise" style={{ paddingTop: 24 }}>
          {/* 「← 返回选择体系」这一条搬进了导航（工作页导航里有「返回选择」）。
              同一件事在页面上出现两次，第二次就会与第一次漂移。 */}
          <p className="qn-eyebrow" style={{ marginTop: 0 }}>{c.eyebrow}</p>
          <h1 className="qn-hero">{c.title}</h1>
          <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>{c.lead}</p>
        </header>
      )}
      {/* 输入框永远紧跟在页头之后：两页的 qa.top 是同一个数，这才是"共用一套框架"的含义。
          居中那份约束写在框架里而不是各页 —— 满幅那一系（东方）与 760 阅读壳那一系（西方）
          拿到的输入框宽度必须一致，否则两页的预留格高度又会长成两个值。 */}
      <section className="qn-card qn-rise ml-qa">
        <QuestionComposer mode={mode} />
      </section>
      {children}
      <section className="qn-legal ml-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          这一页只列{mode === 'western' ? '西方' : '东方'}体系里的工具；换体系请回到选体系那一页。
          排盘与抽取由各自的规则引擎执行，模型只做解释与引导。
        </p>
        <p className="qn-linkrow">
          {/* 裁定 ①：/tools 从门廊挪走，挂在两页工作页的页脚。门廊上再留一条聚合入口，
              它就又变成"第三个地方"，两栏选体系这件事也被稀释了。
              批F 起 /tools 真的两套目录都在，链接文字也终于能写「全部」二字。 */}
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
          <Link className="qn-link" href="/">返回选择体系</Link>
        </p>
      </section>
    </main>
  );
}
