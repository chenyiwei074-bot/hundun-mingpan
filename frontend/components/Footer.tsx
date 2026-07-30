'use client';

﻿import Link from 'next/link';

const icpNumber = process.env.NEXT_PUBLIC_ICP_NUMBER || '';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(0,0,0,0.06)',
      background: '#fafaf8',
      padding: '32px 20px 40px',
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#86868b', letterSpacing: '0.03em' }}>
          © 2026 混沌 All Rights Reserved
        </p>

        {icpNumber && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#c7c7cc' }}>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#c7c7cc', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#b2955d'}
                onMouseLeave={e => e.currentTarget.style.color = '#c7c7cc'}
            >
              ICP备案号：{icpNumber}
            </a>
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
          {[
            { href: '/agreement', label: '用户协议' },
            { href: '/privacy', label: '隐私政策' },
            { href: '/disclaimer', label: '免责声明' },
            { href: '/contact', label: '联系我们' },
          ].map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{ fontSize: 12, color: '#86868b', textDecoration: 'none', letterSpacing: '0.03em', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#b2955d'}
                onMouseLeave={e => e.currentTarget.style.color = '#86868b'}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 10, color: '#c7c7cc' }}>
          传统文化研究 · AI辅助解读 · 仅供个人参考
        </p>
      </div>
    </footer>
  );
}