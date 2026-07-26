'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult, trackEvent } from '@/app/lib/api';

function getVid() { return typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon'; }

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [posterHtml, setPosterHtml] = useState<string | null>(null);
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollStage, setPollStage] = useState(0);
  const [posterHeight, setPosterHeight] = useState(600);
  const posterWrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 轮询后端
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let count = 0;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res: any = await getChartResult(id);
        if (cancelled) return;
        count++;
        setPollStage(count);
        if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (count < 120) setTimeout(poll, 1500);
          else { setError('生成超时，请刷新重试'); setLoading(false); }
        } else if (res.success && res.data) {
          setChartName(res.data.name || '');
          if (res.data.posterHtml) setPosterHtml(res.data.posterHtml);
          setLoading(false);
          trackEvent('chart_complete', getVid(), id);
        } else if (res.data?.status === 'failed') {
          setError('生成失败，请重试');
          setLoading(false);
        }
      } catch {
        if (!cancelled && count < 120) setTimeout(poll, 1500);
        else if (!cancelled) { setError('网络错误'); setLoading(false); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  // 海报缩放
  const rescalePoster = useCallback(() => {
    const wrap = posterWrapRef.current;
    const iframe = iframeRef.current;
    if (!wrap || !iframe) return;
    const w = wrap.clientWidth;
    const h = iframe.getBoundingClientRect().height; // post-load height
    const scale = Math.min(w, 750) / 750;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
    wrap.style.height = (h * scale) + 'px';
  }, []);

  // iframe 加载完成后：记录原始高度 + 缩放
  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const body = iframe.contentDocument?.body;
      if (body) {
        const h = body.scrollHeight;
        iframe.style.height = h + 'px';
        setPosterHeight(h);
      }
    } catch {}
    setTimeout(rescalePoster, 100);
  }, [rescalePoster]);

  // posterHtml 变化或窗口大小变化时重新缩放
  useEffect(() => {
    if (!posterHtml) return;
    const t = setTimeout(rescalePoster, 800); // 等 iframe onLoad
    window.addEventListener('resize', rescalePoster);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', rescalePoster);
    };
  }, [posterHtml, rescalePoster]);

  if (loading) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin" />
        <p className="text-dai-qing/60 text-sm mt-6 tracking-[2px]">
          {pollStage < 5 ? '正在解析出生信息...' : pollStage < 15 ? '正在排盘分析...' : pollStage < 30 ? '正在生成命理报告...' : '正在完成最终整理...'}
        </p>
        <p className="text-dai-qing/30 text-xs mt-3">通常需要几十秒，请耐心等待</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <p className="text-dai-qing text-lg mb-6">{error}</p>
        <button onClick={() => router.push('/create')} className="qn-btn qn-btn--primary qn-btn--sm">重新生成</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-xuan-zhi">
      <div className="border-b border-dai-qing/10 py-5 px-4 text-center">
        <a href="/" className="text-hu-po-jin text-sm tracking-[4px] no-underline">混沌</a>
        <p className="text-xs text-dai-qing/50 mt-1 tracking-[2px]">{chartName || '-'}</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* 海报 */}
        <div className="rounded-2xl border border-hu-po-jin/20 overflow-hidden">
          <p className="bg-dai-qing text-xuan-zhi text-xs text-center py-2.5 tracking-[0.3em]">命 · 盘 · 海 · 报</p>
          <div ref={posterWrapRef} style={{ overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              srcDoc={posterHtml || ''}
              style={{ width: '750px', border: 'none', display: 'block' }}
              onLoad={onIframeLoad}
              title="命盘海报"
            />
          </div>
        </div>

        {/* 付费 */}
        <div className="rounded-2xl border border-hu-po-jin/20 bg-gradient-to-br from-dai-qing to-dai-qing-dark p-8 text-center">
          <div className="text-3xl mb-4">🔀</div>
          <h3 className="font-serif text-xl text-xuan-zhi mb-2">解锁完整命理报告</h3>
          <p className="text-sm text-xuan-zhi/60 mb-2">包含：八字深度分析 · 紫微十二宫详解 · 十年大运 · 专属命盘海报</p>
          <p className="text-2xl text-hu-po-jin font-bold mb-6">¥199</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="qn-btn qn-btn--primary qn-btn--sm !bg-hu-po-jin !text-dai-qing-dark !shadow-none" style={{padding:'0 24px',height:'40px',fontSize:'14px'}}>
              获取完整报告
            </button>
            <button className="qn-btn qn-btn--sm border-dai-qing/15 !text-xuan-zhi/60" style={{padding:'0 24px',height:'40px',fontSize:'14px'}}>
              添加微信 Hundunge01
            </button>
          </div>
          
        </div>

        <p className="text-center text-[10px] text-dai-qing/25 tracking-[2px] pb-8">
          混沌 · 命理研究 — 古籍数字化 · 仅供参考
        </p>
      </div>
    </div>
  );
}
