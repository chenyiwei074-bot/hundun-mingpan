'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult, trackEvent } from '@/app/lib/api';
import type { ChartResultData } from '@/app/lib/api';

function getVid() {
  if (typeof window === 'undefined') return 'visitor_anon';
  return localStorage.getItem('hundun_visitor_id') || 'visitor_anon';
}

const POLL_INTERVAL = 2000;
const TIMEOUT_MS = 60000;

const LOADING_STAGES = [
  '正在分析出生信息...',
  '正在生成八字排盘...',
  '正在计算紫微星曜...',
  '正在生成专属报告...',
  '正在渲染命盘海报...',
];

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ChartResultData | null>(null);
  
  
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timedOutRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const startTime = Date.now();

    const poll = async () => {
      if (cancelled || timedOutRef.current) return;

      try {
        const res = await getChartResult(id) as any;
        console.log("[DEBUG chart] Poll #" + (pollCount + 1) + " httpStatus=" + res.httpStatus + " success=" + res.success + " hasData=" + !!(res.data) + " keys=" + (res.data ? Object.keys(res.data).join(",") : "none"));
        if (cancelled || timedOutRef.current) return;

        // 成功获取完整数据
        if (res.success && res.data && (res.data.posterHtml || res.data.freeContent)) {
          setData(res.data as ChartResultData);
          trackEvent('chart_complete', getVid(), id);
          return;
        }

        // HTTP 202 或 processing 状态 = 继续轮询
        if (res.httpStatus === 202 || res.data?.status === 'processing' || res.data?.status === 'pending') {
          setPollCount(c => c + 1);
          return;
        }

        // 明确失败
        if (res.data?.status === 'failed') {
          setError('命盘生成失败，请返回重试');
          return;
        }

        // 其他情况继续轮询
        setPollCount(c => c + 1);
      } catch (err: any) {
        if (!cancelled) {
          console.error('Poll error:', err);
          setPollCount(c => c + 1);
        }
      }

      // 超时检查
      if (Date.now() - startTime > TIMEOUT_MS) {
        timedOutRef.current = true;
        if (!cancelled) {
          setError('生成时间较长，请稍后刷新页面查看');
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    if (data || error) return;
    const stageTimer = setInterval(() => {
      setStageIndex(prev => (prev + 1) % LOADING_STAGES.length);
    }, 3000);
    return () => clearInterval(stageTimer);
  }, [data, error]);

  // ====== Loading ======
  if (!data && !error) {
    return (
      <div className="min-h-screen bg-[#0d0b09] flex flex-col items-center justify-center px-4">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full border-2 border-[#c9a84c]/20 border-t-[#c9a84c] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl text-[#c9a84c]">{'\u263F'}</span>
          </div>
        </div>
        <p className="text-[#e0c878] text-lg tracking-[4px] mb-2 font-normal animate-pulse">
          {LOADING_STAGES[stageIndex]}
        </p>
        <p className="text-[#6b5f52] text-xs tracking-[2px] mt-4">
          已等待 {pollCount * 2} 秒
        </p>
        <div className="flex gap-2 mt-6">
          {LOADING_STAGES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i <= stageIndex ? 'bg-[#c9a84c] shadow-[0_0_6px_#c9a84c]' : 'bg-[#2a2520]'
              }`}
            />
          ))}
        </div>
        <p className="text-[#6b5f52] text-xs tracking-[2px] mt-8">混沌阁 · 命理研究</p>
      </div>
    );
  }

  // ====== Error ======
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0b09] flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4">{'\u26A0'}</div>
        <p className="text-[#e05a45] text-lg mb-6 text-center tracking-[2px]">{error}</p>
        <div className="flex gap-4">
          <button onClick={() => router.push('/create')} className="bg-[#c9a84c] text-[#0d0b09] px-8 py-3 rounded tracking-[3px] font-medium hover:bg-[#e0c878] transition-colors">
            重新生成
          </button>
          <button onClick={() => window.location.reload()} className="border border-[#c9a84c]/40 text-[#c9a84c] px-8 py-3 rounded tracking-[3px] hover:bg-[#c9a84c]/10 transition-colors">
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  if (!data?.freeContent) {
    return (
      <div className="min-h-screen bg-[#0d0b09] flex flex-col items-center justify-center px-4">
        <p className="text-[#e05a45] text-lg mb-6">命盘数据异常</p>
        <button onClick={() => router.push('/create')} className="bg-[#c9a84c] text-[#0d0b09] px-8 py-3 rounded">重新生成</button>
      </div>
    );
  }

  const fc: any = data.freeContent;
  const bz: any = fc?.bazi ?? {};
  const zw: any = fc?.ziwei ?? {};
  const keywords: string[] = fc?.keywords ?? [];

  return (
    <div className="min-h-screen bg-[#0d0b09]">
      {/* Header */}
      <div className="border-b border-[#2a2520] py-5 px-4 text-center">
        <a href="/" className="text-[#c9a84c] text-sm tracking-[4px] no-underline hover:text-[#e0c878]">
          混沌阁
        </a>
        <p className="text-[#a89a85] text-xs tracking-[2px] mt-1">
          {data?.name ?? '-'} · {bz?.dayMaster ?? '-'}日主 · {zw?.mingGong ?? '-'}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* ====== 海报 ====== */}
        <section className="mt-8 animate-fade-up">
          <h2 className="text-center text-[#c9a84c] text-sm tracking-[6px] mb-6 font-normal">
            {'\u25C6'} 你的专属命盘海报 {'\u25C6'}
          </h2>
          <div className="bg-white rounded-lg overflow-hidden shadow-2xl border border-[#2a2520]">
            {data?.posterHtml ? (
              <iframe srcDoc={data.posterHtml} className="w-full border-0" style={{ minHeight: "80vh", height: "auto" }} scrolling="auto" sandbox="allow-same-origin allow-scripts" title="????" />
            ) : (
              <div className="p-8 text-center text-[#a89a85]">海报加载中...</div>
            )}
          </div>
          {data?.posterHtml && (
            <div className="flex justify-center mt-4 gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([data.posterHtml], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = (data?.name ?? '命盘') + '_命盘海报.html';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-6 py-2.5 border border-[#c9a84c]/40 text-[#c9a84c] text-sm rounded tracking-[2px] hover:bg-[#c9a84c]/10 transition-colors"
              >
                {'\u2193'} 下载海报
              </button>
            </div>
          )}
        </section>

        <div className="my-10 border-t border-[#2a2520]" />

        {/* ====== 免费内容 ====== */}
        <section className="mb-12 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-center text-[#c9a84c] text-sm tracking-[6px] mb-8 font-normal">
            {'\u25C6'} 你的命盘关键词 {'\u25C6'}
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {keywords.map((kw: string, i: number) => (
              <div key={i} className="bg-[#1a1614] border border-[#2a2520] rounded-lg text-center py-6">
                <div className="text-[#c9a84c] text-xs tracking-[3px] mb-3">
                  {['事业', '财富', '感情'][i] ?? '运势'}
                </div>
                <div className="text-[#e8e0d5] text-base tracking-[2px]">{kw}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1614] border border-[#2a2520] rounded-lg p-5">
              <h3 className="text-[#c9a84c] text-xs tracking-[4px] mb-4">八字基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">四柱</span>
                  <span className="text-[#e8e0d5]">
                    {bz?.siZhu?.year ?? '-'} {bz?.siZhu?.month ?? '-'} {bz?.siZhu?.day ?? '-'} {bz?.siZhu?.hour ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">日主</span>
                  <span className="text-[#e0c878]">{bz?.dayMaster ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">格局</span>
                  <span className="text-[#e8e0d5]">{bz?.geju ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">旺衰</span>
                  <span className="text-[#e8e0d5]">{bz?.wangshuai ?? '-'}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1614] border border-[#2a2520] rounded-lg p-5">
              <h3 className="text-[#c9a84c] text-xs tracking-[4px] mb-4">紫微基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">命宫</span>
                  <span className="text-[#e8e0d5]">{zw?.mingGong ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">身宫</span>
                  <span className="text-[#e8e0d5]">{zw?.shenGong ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">主星</span>
                  <span className="text-[#e8e0d5]">
                    {Array.isArray(zw?.mainStars) ? zw.mainStars.join('、') || '无' : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a89a85]">四化</span>
                  <span className="text-[#e8e0d5]">
                    {Array.isArray(zw?.sihua) ? zw.sihua.join('、') || '无' : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="my-10 border-t border-[#2a2520]" />

        {/* ====== 付费引导 ====== */}
        <section className="mb-16 animate-fade-up" style={{ animationDelay: '0.8s' }}>
          <div className="bg-[#1a1614] border border-[#2a2520] rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="inline-block px-4 py-1 border border-[#c9a84c]/30 rounded-full text-xs text-[#c9a84c] tracking-[3px] mb-4">
                完整报告
              </div>
              <h3 className="text-[#e8e0d5] text-lg tracking-[4px] font-normal">
                你的完整命理报告包含
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {(data?.unlockDescription ?? []).map((item: { title: string; desc: string }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded bg-[#0a0806]/50 border border-[#2a2520]">
                  <span className="text-[#c9a84c] mt-0.5 flex-shrink-0">{'\u2713'}</span>
                  <div>
                    <div className="text-sm text-[#e8e0d5] tracking-[1px]">{item?.title ?? ''}</div>
                    <div className="text-xs text-[#6b5f52] mt-0.5">{item?.desc ?? ''}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  trackEvent('wechat_click', getVid(), id);
                  const modal = document.getElementById('wechat-modal');
                  if (modal) modal.style.display = 'flex';
                }}
                className="bg-[#c9a84c] text-[#0d0b09] text-lg px-12 py-4 rounded tracking-[4px] font-medium hover:bg-[#e0c878] transition-colors animate-pulse"
              >
                获取完整万字命理报告
              </button>
              <p className="mt-3 text-xs text-[#6b5f52] tracking-[2px]">
                &yen;199 / 份 &nbsp;|&nbsp; 添加客服微信，立即获取深度解析
              </p>
            </div>
          </div>
        </section>

        <div className="text-center pb-10">
          <span className="text-[10px] text-[#6b5f52] tracking-[3px]">混沌阁 · 命理研究</span>
        </div>
      </div>

      {/* ====== 微信弹窗 ====== */}
      <div
        id="wechat-modal"
        className="fixed inset-0 z-50 hidden items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const modal = document.getElementById('wechat-modal');
            if (modal) modal.style.display = 'none';
          }
        }}
      >
        <div className="bg-[#1a1614] border border-[#2a2520] rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-4xl mb-4">{'\uD83D\uDCAC'}</div>
          <h3 className="text-[#e8e0d5] text-lg tracking-[4px] mb-2 font-normal">添加混沌阁客服</h3>
          <p className="text-[#a89a85] text-sm tracking-[2px] mb-6">
            获取专属万字命理深度解读  &yen;199 / 份
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
            onClick={() => {
              const modal = document.getElementById('wechat-modal');
              if (modal) modal.style.display = 'none';
            }}
            className="w-full py-3 border border-[#c9a84c]/40 text-[#c9a84c] text-sm rounded tracking-[2px] hover:bg-[#c9a84c]/10 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

