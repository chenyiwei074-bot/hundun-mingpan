'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ink = '#1d1d1f';
const mute = '#86868b';
const gold = '#b2955d';

const LINKS = [
  { href: '/create', label: '八字 & 紫微', short: '命盘' },
  { href: '/liuyao', label: '六爻', short: '六爻' },
  { href: '/dashboard', label: '我的报告', short: '我的报告' },
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="fixed top-0 z-50 w-full" style={{
      background: 'rgba(250,250,249,0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
    }}>
      <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-6">
        <Link href="/" className="no-underline text-base font-semibold tracking-[-0.01em]" style={{ color: ink }}>
          混沌
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-xs">
          {LINKS.map(l => {
            const active = isActive(l.href);
            return (
              <Link key={l.href} href={l.href}
                className="nav-link no-underline tracking-[0.03em] transition-colors duration-200"
                style={{ color: active ? gold : ink }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = gold }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = ink }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="flex sm:hidden items-center gap-4 text-xs">
          {LINKS.map(l => {
            const active = isActive(l.href);
            return (
              <Link key={l.href} href={l.href}
                className="nav-link no-underline"
                style={{ color: active ? gold : (l.href === '/dashboard' ? mute : ink) }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = gold }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = l.href === '/dashboard' ? mute : ink }}
              >
                {l.short}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
