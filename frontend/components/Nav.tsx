'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/create', label: '八字 & 紫微', short: '命盘' },
  { href: '/liuyao', label: '六爻', short: '六爻' },
  { href: '/meihua', label: '梅花易数', short: '梅花' },
  { href: '/dashboard', label: '我的报告', short: '我的报告' },
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
