import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import MotionEnhancer from '@/components/MotionEnhancer';

export const metadata: Metadata = {
  title: '混沌｜东方术数与风水 · 西方神秘学',
  description: '以东方术数与风水、西方神秘学为入口，体验命盘、占卜、星象与居家空间解读。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <Nav />
        <MotionEnhancer />
        {children}
        <Footer />
      </body>
    </html>
  );
}
