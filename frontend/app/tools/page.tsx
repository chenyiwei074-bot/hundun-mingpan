import Link from 'next/link';
import ToolCatalog from '@/components/tools/ToolCatalog';
import { INTENTS } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';

// 二级目录页：按「问什么」分组，再按术数查找。这一页只描述已经实现的东西，
// 数据全部来自两套 catalog（东方 lib/tools/catalog.ts、西方 lib/tools/western-catalog.ts），
// 由 tools/directory-acceptance 逐条核对（入口是否真存在、口径字符串是否等于引擎导出的常量、
// 未开放条目有没有偷偷给链接、两套目录是不是都在这一页）。
//
// 批F ① 之前这一页只渲染东方那一套，而页脚那条链接写的是「全部工具目录」—— 名不副实：
// 西方五项（含已开放的「本命行星位置」）一个都不在上面。现在两套都在这页上，共用
// components/tools/ToolCatalog 那一份卡片渲染（字段、状态、已做/未做、入口判定都只有一份）。

// 两套目录一起渲染。这一页不许出现任何条目字面量（下面这对只有展示名与来源，
// 条目全部由 catalog 决定）—— dir/tools-page-no-forked-list 就是钉这一条的。
const BOOKS = [
  { key: 'oriental', label: '东方术数与风水', groups: INTENTS },
  { key: 'western', label: '西方神秘学', groups: WESTERN_INTENTS },
];

export default function ToolsPage() {
  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>混沌工具集</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>选择你想了解的方向</h1>
        <p className="qn-meta">东方术数与风水 · 西方神秘学</p>
      </header>

      <section className="qn-card qn-rise" style={{ marginBottom: 16 }}>
        <p className="qn-body" style={{ margin: 0 }}>选择感兴趣的主题查看介绍。已开放的功能可以直接体验，正在整理的内容会标明当前状态。</p>
      </section>

      {BOOKS.map(b => (
        <section key={b.key} style={{ marginTop: 28 }}>
          <h2 className="qn-title" style={{ margin: '0 0 10px' }}>{b.label}</h2>
          <ToolCatalog groups={b.groups} />
        </section>
      ))}

      <section className="qn-legal" style={{ marginTop: 28 }}>
        <h2>使用说明</h2>
        <p>本站内容供传统文化研究与个人参考，不构成医疗、法律、投资或其他专业建议。个人资料处理方式请查看隐私政策。</p>
        <p className="qn-linkrow">
          <Link href="/" className="qn-link">回首页</Link>
          <Link href="/disclaimer" className="qn-link">免责声明</Link>
          <Link href="/privacy" className="qn-link">隐私政策</Link>
        </p>
      </section>
    </main>
  );
}
