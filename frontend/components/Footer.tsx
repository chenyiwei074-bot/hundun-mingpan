'use client';

import Link from 'next/link';

const icpNumber = process.env.NEXT_PUBLIC_ICP_NUMBER || '';

const LINKS = [
  { href: '/agreement', label: '用户协议' },
  { href: '/privacy', label: '隐私政策' },
  { href: '/disclaimer', label: '免责声明' },
  { href: '/contact', label: '联系我们' },
];

export default function Footer() {
  return (
    <footer className="qn-footer">
      <div className="qn-footer__inner">
        <p className="qn-footer__meta">© 2026 混沌 All Rights Reserved</p>

        {icpNumber && (
          <a
            className="qn-footlink"
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ICP备案号：{icpNumber}
          </a>
        )}

        <nav className="qn-footer__links" aria-label="法务与说明">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className="qn-footlink">{l.label}</Link>
          ))}
        </nav>

        <p className="qn-footer__foot">传统文化研究 · AI辅助解读 · 仅供个人参考</p>
      </div>
    </footer>
  );
}
