'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/oriental', label: '东方术数', short: '东方' },
  { href: '/western', label: '西方神秘学', short: '西方' },
  { href: '/tools', label: '全部工具', short: '工具' },
  { href: '/dashboard', label: '我的报告', short: '报告' },
] as const;

const EASTERN_ROUTES = ['/create', '/bazi-chart', '/chart', '/liuyao', '/meihua', '/xiu', '/huangli', '/fengshui', '/hepan', '/dayun', '/face-reading', '/palm-reading', '/name-compat'];
const WESTERN_ROUTES = ['/astro', '/tarot', '/synastry', '/moon', '/numerology'];

export default function Nav() {
  const pathname = usePathname();
  const inRoute = (route: string) => pathname === route || pathname.startsWith(route + '/');
  const active = inRoute('/oriental') || EASTERN_ROUTES.some(inRoute) ? '/oriental'
    : inRoute('/western') || WESTERN_ROUTES.some(inRoute) ? '/western'
    : LINKS.find(link => inRoute(link.href))?.href;

  return (
    <nav className="qn-nav hd-nav" aria-label="主导航">
      <div className="qn-nav__inner">
        <Link href="/" className="qn-nav__brand" aria-label="混沌首页">混沌</Link>
        <div className="qn-nav__links">
          {LINKS.map(link => <Link key={link.href} href={link.href}
            className={active === link.href ? 'qn-navlink qn-navlink--active' : 'qn-navlink'}
            aria-current={active === link.href ? 'page' : undefined}>{link.label}</Link>)}
        </div>
        <div className="qn-nav__links qn-nav__links--narrow">
          {LINKS.map(link => <Link key={link.href} href={link.href}
            className={active === link.href ? 'qn-navlink qn-navlink--active' : 'qn-navlink'}
            aria-current={active === link.href ? 'page' : undefined}>{link.short}</Link>)}
        </div>
      </div>
    </nav>
  );
}
