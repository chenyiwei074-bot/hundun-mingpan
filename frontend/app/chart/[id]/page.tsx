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
  '正在解析出生信息',
  '正在计算八字五行',
  '正在排布紫微星曜',
  '正在生成专属报告',
  '正在完成最终整理',
];

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ChartResultData | null>(null);
  
  
  const [error, setError] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [pollCount, setPollCount] = useState(0);

  const POSTER_WIDTH = 780;
  const [scale, setScale] = useState(1);
  const [posterHeight, setPosterHeight] = useState(3000);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Scale poster on mobile (use wrapper actual width, not viewport)
  useEffect(() => {
    const calcScale = () => {
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const available = wrapper.clientWidth;
        setScale(available < POSTER_WIDTH ? available / POSTER_WIDTH : 1);
      }
    };
    calcScale();
    window.addEventListener('resize', calcScale);
    const observer = new ResizeObserver(() => calcScale());
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => {
      window.removeEventListener('resize', calcScale);
      observer.disconnect();
    };
  }, [POSTER_WIDTH]);

  // Track pay card visibility
  useEffect(() => {
    if (!data) return;
    const el = document.getElementById('pay-section');
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        trackEvent('pay_card_view', getVid(), id);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data, id]);

  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        if (h > 100) setPosterHeight(h);
      }
    } catch {}
  };

  // ====== Loading ======
  if (!data && !error) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full border-2 border-hu-po-jin/20 border-t-hu-po-jin animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl text-hu-po-jin">{'\u263F'}</span>
          </div>
        </div>
        <p className="text-hu-po-jin text-lg tracking-[4px] mb-2 font-normal animate-pulse">
          {LOADING_STAGES[stageIndex]}
        </p>
        <p className="text-dai-qing/50 text-xs tracking-[2px] mt-4">
          已等待 {pollCount * 2} 秒 · 通常需要几十秒，请耐心等待
        </p>
        <div className="flex gap-2 mt-6">
          {LOADING_STAGES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i <= stageIndex ? 'bg-hu-po-jin shadow-[0_0_6px_#c9a84c]' : 'bg-dai-qing/15'
              }`}
            />
          ))}
        </div>
        <p className="text-dai-qing/50 text-xs tracking-[2px] mt-8">混沌 · 命理研究</p>
      </div>
    );
  }

  // ====== Error ======
  if (error) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4">{'\u26A0'}</div>
        <p className="text-[#e05a45] text-lg mb-6 text-center tracking-[2px]">{error}</p>
        <div className="flex gap-4">
          <button onClick={() => router.push('/create')} className="bg-hu-po-jin text-xuan-zhi px-8 py-3 rounded tracking-[3px] font-medium hover:bg-hu-po-jin transition-colors">
            重新生成
          </button>
          <button onClick={() => window.location.reload()} className="border border-hu-po-jin/40 text-hu-po-jin px-8 py-3 rounded tracking-[3px] hover:bg-hu-po-jin/10 transition-colors">
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  if (!data?.freeContent) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <p className="text-[#e05a45] text-lg mb-6">命盘数据异常</p>
        <button onClick={() => router.push('/create')} className="bg-hu-po-jin text-xuan-zhi px-8 py-3 rounded">重新生成</button>
      </div>
    );
  }

  const fc: any = data.freeContent;
  const bz: any = fc?.bazi ?? {};
  const zw: any = fc?.ziwei ?? {};
  const keywords: string[] = fc?.keywords ?? [];

  return (
    <div className="min-h-screen bg-xuan-zhi">
      {/* Header */}
      <div className="border-b border-dai-qing/15 py-5 px-4 text-center">
        <a href="/" className="text-hu-po-jin text-sm tracking-[4px] no-underline hover:text-hu-po-jin">
          混沌
        </a>
        <p className="text-dai-qing/70 text-xs tracking-[2px] mt-1">
          {data?.name ?? '-'} · {bz?.dayMaster ?? '-'}日主 · {zw?.mingGong ?? '-'}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* ====== 海报 ====== */}
        <section className="mt-8 animate-fade-up">
          <h2 className="text-center text-hu-po-jin text-sm tracking-[6px] mb-6 font-normal">
            {'\u25C6'} 你的专属命盘海报 {'\u25C6'}
          </h2>
          <div className="rounded-lg overflow-hidden shadow-2xl border border-dai-qing/15">
            {data?.posterHtml ? (
              <div ref={wrapperRef} style={{ width: '100%', overflow: 'hidden', height: scale < 1 ? posterHeight * scale + 'px' : posterHeight + 'px' }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={data.posterHtml}
                  onLoad={handleIframeLoad}
                  style={{
                    width: POSTER_WIDTH + 'px',
                    height: posterHeight + 'px',
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    border: 'none',
                    display: 'block'
                  }}
                  scrolling="no"
                  title="命盘海报"
                />
              </div>
            ) : (
              <div className="p-8 text-center text-dai-qing/70">海报加载中...</div>
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
                className="px-6 py-2.5 border border-hu-po-jin/40 text-hu-po-jin text-sm rounded tracking-[2px] hover:bg-hu-po-jin/10 transition-colors"
              >
                {'\u2193'} 下载海报
              </button>
            </div>
          )}
        </section>

        <div className="my-10 border-t border-dai-qing/15" />

        {/* ====== 免费内容 ====== */}
        <section className="mb-12 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-center text-hu-po-jin text-sm tracking-[6px] mb-8 font-normal">
            {'\u25C6'} 你的命盘关键词 {'\u25C6'}
          </h2>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {keywords.map((kw: string, i: number) => (
              <div key={i} className="bg-xuan-zhi border border-dai-qing/15 rounded-lg text-center py-6">
                <div className="text-hu-po-jin text-xs tracking-[3px] mb-3">
                  {['事业', '财富', '感情'][i] ?? '运势'}
                </div>
                <div className="text-dai-qing text-base tracking-[2px]">{kw}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-xuan-zhi border border-dai-qing/15 rounded-lg p-5">
              <h3 className="text-hu-po-jin text-xs tracking-[4px] mb-4">八字基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">四柱</span>
                  <span className="text-dai-qing">
                    {bz?.siZhu?.year ?? '-'} {bz?.siZhu?.month ?? '-'} {bz?.siZhu?.day ?? '-'} {bz?.siZhu?.hour ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">日主</span>
                  <span className="text-hu-po-jin">{bz?.dayMaster ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">格局</span>
                  <span className="text-dai-qing">{bz?.geju ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">旺衰</span>
                  <span className="text-dai-qing">{bz?.wangshuai ?? '-'}</span>
                </div>
              </div>
            </div>

            <div className="bg-xuan-zhi border border-dai-qing/15 rounded-lg p-5">
              <h3 className="text-hu-po-jin text-xs tracking-[4px] mb-4">紫微基础</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">命宫</span>
                  <span className="text-dai-qing">{zw?.mingGong ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">身宫</span>
                  <span className="text-dai-qing">{zw?.shenGong ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">主星</span>
                  <span className="text-dai-qing">
                    {Array.isArray(zw?.mainStars) ? zw.mainStars.join('、') || '无' : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dai-qing/70">四化</span>
                  <span className="text-dai-qing">
                    {Array.isArray(zw?.sihua) ? zw.sihua.join('、') || '无' : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="my-10 border-t border-dai-qing/15" />

  {/* ====== 付费引导 ====== */}
        <section id="pay-section" className="mb-16 animate-fade-up" style={{ animationDelay: '0.8s' }}>
          <div className="bg-xuan-zhi border border-dai-qing/15 rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="inline-block px-4 py-1 border border-hu-po-jin/30 rounded-full text-xs text-hu-po-jin tracking-[3px] mb-4">
                完整报告
              </div>
              <h3 className="text-dai-qing text-lg tracking-[4px] font-normal">
                你的完整命理报告包含
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {(data?.unlockDescription ?? []).map((item: { title: string; desc: string }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded bg-xuan-zhi/50 border border-dai-qing/15">
                  <span className="text-hu-po-jin mt-0.5 flex-shrink-0">{'\u2713'}</span>
                  <div>
                    <div className="text-sm text-dai-qing tracking-[1px]">{item?.title ?? ''}</div>
                    <div className="text-xs text-dai-qing/50 mt-0.5">{item?.desc ?? ''}</div>
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
                className="bg-hu-po-jin text-xuan-zhi text-lg px-12 py-4 rounded tracking-[4px] font-medium hover:bg-hu-po-jin transition-colors animate-pulse"
              >
                获取完整万字命理报告
              </button>
              <p className="mt-3 text-xs text-dai-qing/50 tracking-[2px]">
                &yen;199 / 份 &nbsp;|&nbsp; 添加客服微信，立即获取深度解析
              </p>
            </div>
          </div>
        </section>

        

        {/* ====== 进一步探索 ====== */}
        <section className="max-w-[750px] mx-auto px-4 mb-10">
          <div className="bg-xuan-zhi border border-dai-qing/15 rounded-xl p-6 text-center">
            <h3 className="text-hu-po-jin text-lg tracking-[4px] mb-4 font-normal">进一步探索</h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/" className="flex-1 bg-xuan-zhi border border-dai-qing/15 rounded-lg p-5 hover:border-hu-po-jin/40 transition-colors no-underline text-left block">
                <p className="text-hu-po-jin text-base mb-1">📜 完整命盘报告</p>
                <p className="text-dai-qing/60 text-sm leading-relaxed">八字 × 紫微双体系互证<br/>了解人生长期趋势 &rarr;</p>
              </a>
              <a href="/liuyao" className="flex-1 bg-xuan-zhi border border-dai-qing/15 rounded-lg p-5 hover:border-hu-po-jin/40 transition-colors no-underline text-left block">
                <p className="text-hu-po-jin text-base mb-1">🔮 混沌问卦</p>
                <p className="text-dai-qing/60 text-sm leading-relaxed">一事一占 · 六爻决策<br/>针对具体问题起卦 &rarr;</p>
              </a>
            </div>
          </div>
        </section>

<div className="text-center pb-10">
          <span className="text-[10px] text-dai-qing/50 tracking-[3px]">混沌 · 命理研究</span>
        </div>
      </div>

      {/* ====== 微信弹窗 ====== */}
      <div
        id="wechat-modal"
        className="fixed inset-0 z-50 hidden items-center justify-center bg-dai-qing-dark/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const modal = document.getElementById('wechat-modal');
            if (modal) modal.style.display = 'none';
          }
        }}
      >
        <div className="bg-xuan-zhi border border-dai-qing/15 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="text-4xl mb-4">{'\uD83D\uDCAC'}</div>
          <h3 className="text-dai-qing text-lg tracking-[4px] mb-2 font-normal">添加混沌客服</h3>
          <p className="text-dai-qing/70 text-sm tracking-[2px] mb-6">
            获取专属万字命理深度解读  &yen;199 / 份
          </p>

          <div className="bg-xuan-zhi rounded-lg p-4 mb-4 border border-dai-qing/15">
            <p className="text-xs text-dai-qing/50 tracking-[2px] mb-2">客服微信</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-hu-po-jin text-xl tracking-[4px] font-mono select-all">
                Hundunge01
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('Hundunge01');
                  alert('已复制客服微信号：Hundunge01');
                }}
                className="px-3 py-1 text-xs border border-hu-po-jin/30 text-hu-po-jin rounded hover:bg-hu-po-jin/10 transition-colors"
              >
                复制
              </button>
            </div>
          </div>

          <p className="text-xs text-dai-qing/50 tracking-[1px] mb-6">
            添加后发送你的报告编号，即可获取完整解读
          </p>

          <button
            onClick={() => {
              const modal = document.getElementById('wechat-modal');
              if (modal) modal.style.display = 'none';
            }}
            className="w-full py-3 border border-hu-po-jin/40 text-hu-po-jin text-sm rounded tracking-[2px] hover:bg-hu-po-jin/10 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

