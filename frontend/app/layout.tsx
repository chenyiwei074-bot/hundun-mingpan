import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '混沌阁命盘 - AI融合八字×紫微斗数',
  description: 'AI驱动的八字紫微斗数综合命盘分析，生成你的专属命理档案',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-texture">{children}</body>
    </html>
  );
}
