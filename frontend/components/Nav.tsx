'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 导航 ≤5 项（裁定 ①）。梅花/星宿/黄历不再各占一格：它们由「百宝箱」这一格统一带进去，
// 首屏的四类意图入口也指向同一份 lib/tools/catalog，不靠导航位数硬撑。
const LINKS = [
  { href: '/create', label: '八字 & 紫微', short: '命盘' },
  { href: '/liuyao', label: '六爻', short: '六爻' },
  { href: '/tools', label: '玄学百宝箱', short: '百宝' },
  // narrow 变体在 375px 放五个词，「我的报告」四字会折行（实测把「命盘」一起挤成两行），
  // 窄屏只留两字，宽屏仍写全称。
  { href: '/dashboard', label: '我的报告', short: '报告' },
];

// 两页工作页的导航只回答三件事：这是哪一系、怎么换一系、我的报告在哪。
// 「当前位置」是纯文字不是链接 —— 它已经在那儿了，做成可点的就是一个点了没反应的按钮，
// 而 census 会把每一个 <a> 当命中区去量。命盘/六爻/百宝那三格在工作页上不出现：
// 那一页自己的意图入口与工具卡就是把人交出去的地方，导航再列一遍就是两个竞争的路径源。
const WORK_HERE: Record<string, { label: string; short: string }> = {
  '/oriental': { label: '东方玄学', short: '东方' },
  '/western': { label: '西方玄学', short: '西方' },
};

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const renderLinks = (field: 'label' | 'short') => LINKS.map(l => {
    const active = isActive(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        className={active ? 'qn-navlink qn-navlink--active' : 'qn-navlink'}
        aria-current={active ? 'page' : undefined}
      >
        {l[field]}
      </Link>
    );
  });

  const here = WORK_HERE[pathname];
  if (here) {
    const work = (field: 'label' | 'short') => (
      <>
        <span className="qn-navlink qn-navlink--active" aria-current="page">{here[field]}</span>
        <Link href="/" className="qn-navlink">{field === 'label' ? '返回选择' : '返回'}</Link>
        <Link href="/dashboard" className={isActive('/dashboard') ? 'qn-navlink qn-navlink--active' : 'qn-navlink'}>
          {field === 'label' ? '我的报告' : '报告'}
        </Link>
      </>
    );
    return (
      <nav className="qn-nav" aria-label="主导航">
        <div className="qn-nav__inner">
          <Link href="/" className="qn-nav__brand">混沌</Link>
          <div className="qn-nav__links">{work('label')}</div>
          <div className="qn-nav__links qn-nav__links--narrow">{work('short')}</div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="qn-nav" aria-label="主导航">
      <div className="qn-nav__inner">
        <Link href="/" className="qn-nav__brand">混沌</Link>
        <div className="qn-nav__links">{renderLinks('label')}</div>
        <div className="qn-nav__links qn-nav__links--narrow">{renderLinks('short')}</div>
      </div>
    </nav>
  );
}
