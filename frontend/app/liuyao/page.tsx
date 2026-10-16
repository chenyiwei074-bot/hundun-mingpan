'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiuyaoPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/liuyao/create'); }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p className="qn-meta">跳转中...</p>
    </div>
  );
}
