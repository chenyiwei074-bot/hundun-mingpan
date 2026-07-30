'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ink = '#1d1d1f';
const mute = '#86868b';
const gold = '#b2955d';

const LINKS = [
  { href: '/create', label: '八字 & 紫微' },
  { href: '/liuyao', label: '六爻' },
];

export default function Nav() {
  const pathname = usePathname();

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
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link key={l.href} href={l.href}
                className="nav-link no-underline tracking-[0.03em]"
                style={{ color: active ? gold : ink }}
              >
                {l.label}
              </Link>
            );
          })}
          <span className="tracking-[0.03em]" style={{ color: mute }}>姓名合盘</span>
          <span className="tracking-[0.03em]" style={{ color: mute }}>择日</span>
          <span className="tracking-[0.03em]" style={{ color: mute }}>星座</span>
        </div>
        <div className="flex sm:hidden items-center gap-4 text-xs">
          <Link href="/create" className="nav-link no-underline" style={{ color: ink }}>命盘</Link>
          <Link href="/liuyao" className="nav-link no-underline" style={{ color: ink }}>六爻</Link>
            <Link href="/dashboard" className="nav-link no-underline tracking-[0.03em]" style={{ color: mute }}>我的报告</Link>
        </div>
      </div>
    </nav>
  );
}