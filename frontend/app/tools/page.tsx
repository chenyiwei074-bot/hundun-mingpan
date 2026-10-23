import Link from 'next/link';
import ToolCatalog from '@/components/tools/ToolCatalog';
import { INTENTS, LIUYAO_BASIS_TEXT } from '@/lib/tools/catalog';
import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { statusCounts, statusTally } from '@/lib/tools/status';

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
  { key: 'oriental', label: '东方', groups: INTENTS },
  { key: 'western', label: '西方', groups: WESTERN_INTENTS },
];

export default function ToolsPage() {
  const tallies = BOOKS.map(b => ({ label: b.label, c: statusCounts(b.groups) }));

  return (
    <main className="qn-shell" style={{ minHeight: 'calc(100vh - var(--qn-nav-h, 56px))' }}>
      <header className="qn-rise" style={{ textAlign: 'center', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>玄学百宝箱</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 6px' }}>先说要问什么，再看用哪个工具</h1>
        <p className="qn-meta" style={{ letterSpacing: '0.14em' }}>
          {tallies.map(t => `${t.label} ${statusTally(t.c)}`).join(' · ')} · 每项都写明取数口径与版本
        </p>
      </header>

      <section className="qn-card qn-rise" style={{ marginBottom: 16 }}>
        <p className="qn-axis" style={{ margin: 0 }}>状态怎么标</p>
        <p className="qn-body" style={{ marginTop: 8 }}>
          「可用」= 有实装页面，且盘面按下面记的版本口径出数，可以当场复核；「部分可用」= 主链路在，但某一段缺，缺的那一段在该项的「未做」一栏里逐条写明；「未开放」= 没有实现，因此不给入口、不放按钮。首页与本页都不为未做的功能留假入口。
        </p>
      </section>

      {BOOKS.map(b => (
        <section key={b.key} style={{ marginTop: 28 }}>
          <p className="qn-hero" style={{ margin: '0 0 2px' }}>{b.label}</p>
          <p className="qn-meta" style={{ margin: '0 0 4px' }}>
            目录 {statusTally(statusCounts(b.groups))}
          </p>
          <ToolCatalog groups={b.groups} />
        </section>
      ))}

      <section className="qn-legal" style={{ marginTop: 28 }}>
        <h2>版本记录</h2>
        <p>六爻三式：{LIUYAO_BASIS_TEXT}。三项都是随盘保存的口径戳，规则变更后生成的新盘与历史盘不同，历史盘一律标注「本盘按起卦时口径生成」，不重算覆盖。</p>
        <p>四柱与命盘：年柱以立春为界、月柱以节气为界，日柱夜子时按 23:00 归次日且不提供开关；选城市后按真太阳时与历史夏令时校正，校正量与钟表时刻同时显示，原始输入不被换算结果覆盖。</p>
        <p>黄历与星宿：宜忌与值日宿由站里唯一的八字引擎推算，本站不自建宜忌表、不自建吉凶评分；宿曜的合宿倾向指数是本站自研规则，权重在引擎注释里可读，不宣称还原自任何他站。</p>
        <p>西方：那一套的每一项把口径戳与"做到哪一层"写在它自己那张卡的「计算口径」与「已做 / 未做」两栏里，本页不另抄一份 —— 卡上的戳与清单文字都和引擎导出的常量逐字比对。</p>
        <h2>关于这些说法</h2>
        <p>所有工具都只报规则推演出的盘面与原样转录的断语，不宣称准确率，也不构成医疗、法律、投资或任何行事建议。你填的生辰、问题与报告只用于本次计算与你自己的报告页，不进入任何公开链上数据；结果凭证与公开存证能力仍在建设中，一旦上线，公开侧只会出现摘要与日期，不出现原文。</p>
        <p className="qn-linkrow">
          <Link href="/" className="qn-link">回首页</Link>
          <Link href="/disclaimer" className="qn-link">免责与口径</Link>
        </p>
      </section>
    </main>
  );
}
