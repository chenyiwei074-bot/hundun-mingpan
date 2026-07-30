'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiuyaoPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/liuyao/create'); }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f7' }}>
      <p style={{ color: '#86868b', fontSize: 14 }}>跳转中...</p>
    </div>
  );
}
