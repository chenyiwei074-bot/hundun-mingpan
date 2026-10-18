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
