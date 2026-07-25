'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trackEvent } from '@/app/lib/api';
import type { ChartResultData } from '@/app/lib/api';

function getVid() {
  if (typeof window === 'undefined') return 'visitor_anon';
  return localStorage.getItem('hundun_visitor_id') || 'visitor_anon';
}

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ChartResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWechat, setShowWechat] = useState(false);

  useEffect(() => {
    // Try to load from sessionStorage (stored by create page)
    const cached = sessionStorage.getItem('chart_result_' + id);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setLoading(false);
        trackEvent('chart_complete', getVid(), id);
        return;
      } catch {}
    }
    
    // If not in cache, redirect to create page
    router.replace('/create');
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-texture flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-[#c9a84c]/20 border-t-[#c9a84c] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-[#c9a84c] tracking-[3px]">命</span>
          </div>
        </div>
        <p className="mt-6 text-[#a89a85] tracking-[4px] text-sm">加载中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-texture flex flex-col items-center justify-center px-4">
        <p className="text-[#e05a45] text-lg mb-6">命盘数据未找到</p>
        <button onClick={() => router.push('/create')} className="btn-primary">重新生成</button>
      </div>
    );
  }

  const fc = data.freeContent;

  return (
    <div className="min-h-screen bg-texture">
      {/* Header */}
      <div className="border-b border-[#2a2520] py-5 px-4 text-center">
        <a href="/" className="text-[#c9a84c] text-sm tracking-[4px] no-underline hover:text-[#e0c878]">
          混沌阁
        </a>
        <p className="text-[#a89a85] text-xs tracking-[2px] mt-1">
          {data.name} · {fc.bazi.dayMaster as string}日主 · {fc.ziwei.mingGong as string}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* ====== 第一部分: 海报 ====== */}
        <section className="mt-8 animate-fade-up">
          <h2 className="text-center text-[#c9a84c] text-sm tracking-[6px] mb-6 font-normal">
            ◆ 你的专属命盘海报 ◆
          </h2>
          <div className="bg-white rounded-lg overflow-hidden shadow-2xl shadow-[#c9a84c]/5 border border-[#2a2520]">
            <div dangerouslySetInnerHTML={{ __html: data.posterHtml }} />
          </div>
          <div className="flex justify-center mt-4 gap-3">
            <button
              onClick={() => {
                const blob = new Blob([data.posterHtml], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = data.name + '_命盘海报.html';
                a.click(); URL.revokeObjectURL(url);
              }}
              className="btn-outline text-sm"
            >
              ⬇ 下载海报
            </button>
          </div>
        </section>

        <div className="divider" />

        {/* ====== 第二部分: 免费内容 ====== */}
        <section className="mb-12 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-center text-[#c9a84c] text-sm tracking-[6px] mb-8 font-normal">
            ◆ 你的命盘关键词 ◆
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {fc.keywords.map((kw, i) => (
              <div key={i} className="card-gold text-center py-6">
                <div className="text-[#c9a84c] text-xs tracking-[3px] mb-3">
                  {['事业', '财富', '感情'][i]}
                </div>
                <div className="text-[#e8e0d5] text-lg tracking-[2px]">{kw}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bazi */}
            <div className="card-gold">
              <h3 className="text-[#c9a84c] text-xs tracking-[4px] mb-4">八字基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">四柱</span>
                  <span className="text-[#e8e0d5] font-mono">
                    {fc.bazi.siZhu && (fc.bazi.siZhu as any).year} {(fc.bazi.siZhu as any).month} {(fc.bazi.siZhu as any).day} {(fc.bazi.siZhu as any).hour}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">日主</span>
                  <span className="text-[#e8e0d5]">{fc.bazi.dayMaster as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">格局</span>
                  <span className="text-[#e8e0d5]">{fc.bazi.geju as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">旺衰</span>
                  <span className="text-[#e8e0d5]">{fc.bazi.wangshuai as string}</span>
                </div>
              </div>
            </div>

            {/* Ziwei */}
            <div className="card-gold">
              <h3 className="text-[#c9a84c] text-xs tracking-[4px] mb-4">紫微基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">命宫</span>
                  <span className="text-[#e8e0d5]">{fc.ziwei.mingGong as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">身宫</span>
                  <span className="text-[#e8e0d5]">{fc.ziwei.shenGong as string}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">主星</span>
                  <span className="text-[#e8e0d5]">{(fc.ziwei.mainStars as string[]).join('、') || '无'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">四化</span>
                  <span className="text-[#e8e0d5]">{(fc.ziwei.sihua as string[]).join('、') || '无'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ====== 第三部分: 付费引导 ====== */}
        <section className="mb-16 animate-fade-up" style={{ animationDelay: '0.8s' }}>
          <div className="card-gold">
            <div className="text-center mb-6">
              <div className="inline-block px-4 py-1 border border-[#c9a84c]/30 rounded-full text-xs text-[#c9a84c] tracking-[3px] mb-4">
                完整报告
              </div>
              <h3 className="text-[#e8e0d5] text-lg tracking-[4px] font-normal">
                你的完整命理报告包含
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {data.unlockDescription.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded bg-[#0a0806]/50 border border-[#2a2520]">
                  <span className="text-[#c9a84c] mt-0.5 flex-shrink-0">✓</span>
                  <div>
                    <div className="text-sm text-[#e8e0d5] tracking-[1px]">{item.title}</div>
                    <div className="text-xs text-[#6b5f52] mt-0.5">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => { trackEvent('wechat_click', getVid(), id); setShowWechat(true); }}
                className="btn-gold text-lg px-12 py-4 tracking-[4px] animate-pulse-gold"
              >
                获取完整万字命理报告
              </button>
              <p className="mt-3 text-xs text-[#6b5f52] tracking-[2px]">
                添加客服微信，立即获取深度解析
              </p>
            </div>
          </div>
        </section>

        <div className="text-center pb-10">
          <span className="text-[10px] text-[#6b5f52] tracking-[3px]">混沌阁 · 命理研究</span>
        </div>
      </div>

      {/* ====== 微信弹窗 ====== */}
      {showWechat && (
        <div className="wechat-modal-overlay" onClick={() => setShowWechat(false)}>
          <div className="wechat-modal" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-[#e8e0d5] text-lg tracking-[4px] mb-2 font-normal">添加混沌阁客服</h3>
            <p className="text-[#a89a85] text-sm tracking-[2px] mb-6">
              获取专属万字命理深度解读
            </p>

            <div className="bg-[#0a0806] rounded-lg p-4 mb-4 border border-[#2a2520]">
              <p className="text-xs text-[#6b5f52] tracking-[2px] mb-2">客服微信</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-[#e0c878] text-xl tracking-[4px] font-mono select-all">
                  Hundunge01
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('Hundunge01');
                    alert('已复制客服微信号：Hundunge01');
                  }}
                  className="px-3 py-1 text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded hover:bg-[#c9a84c]/10 transition-colors"
                >
                  复制
                </button>
              </div>
            </div>

            <p className="text-xs text-[#6b5f52] tracking-[1px] mb-6">
              添加后发送你的报告编号，即可获取完整解读
            </p>

            <button
              onClick={() => setShowWechat(false)}
              className="btn-outline w-full text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
