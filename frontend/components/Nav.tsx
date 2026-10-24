'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 全局导航提供东方、西方、全部工具和报告入口；具体功能由体系页与工具目录承接。
const LINKS = [
  { href: '/oriental', label: '东方术数', short: '东方' },
  { href: '/western', label: '西方神秘学', short: '西方' },
  { href: '/tools', label: '全部工具', short: '工具' },
  // 窄屏只显示短标签，宽屏显示完整名称。
  { href: '/dashboard', label: '我的报告', short: '报告' },
];

// 两页工作页的导航只回答三件事：这是哪一系、怎么换一系、我的报告在哪。
// 当前体系以文字标出，另提供返回体系选择与报告的入口。
const WORK_HERE: Record<string, { label: string; short: string }> = {
  '/oriental': { label: '东方术数', short: '东方' },
  '/western': { label: '西方神秘学', short: '西方' },
};

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const belongsTo = (route: string) => pathname === route || pathname.startsWith(route + '/');

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

  const isWestern = ['/western', '/astro', '/tarot'].some(belongsTo);
  const isOriental = ['/oriental', '/create', '/bazi-chart', '/chart', '/liuyao', '/meihua', '/xiu', '/huangli', '/fengshui'].some(belongsTo);
  const here = isWestern ? WORK_HERE['/western'] : isOriental ? WORK_HERE['/oriental'] : undefined;
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
