'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult, trackEvent } from '@/app/lib/api';

function getVid() { return typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon'; }

const DIZHI_ORDER = ['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [posterHtml, setPosterHtml] = useState<string | null>(null);
  const [freeContent, setFreeContent] = useState<any>(null);
  const [chartName, setChartName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollStage, setPollStage] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let pollCount = 0;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res: any = await getChartResult(id);
        if (cancelled) return;
        pollCount++;
        setPollStage(pollCount);

        if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (pollCount < 120) { setTimeout(poll, 1500); }
          else { setError('生成时间较长，请稍后刷新查看'); setLoading(false); }
        } else if (res.success && res.data) {
          if (res.data.freeContent) {
            setFreeContent(res.data.freeContent);
          }
          setChartName(res.data.name || '');
          if (res.data.posterHtml) {
            setPosterHtml(res.data.posterHtml);
          }
          setLoading(false);
          trackEvent('chart_complete', getVid(), id);
        } else if (res.data?.status === 'failed') {
          setError('命盘生成失败，请重试');
          setLoading(false);
        } else if (!res.success) {
          if (pollCount < 120) { setTimeout(poll, 1500); }
          else { setError('命盘数据获取失败'); setLoading(false); }
        }
      } catch {
        if (!cancelled && pollCount < 120) { setTimeout(poll, 1500); }
        else if (!cancelled) { setError('网络错误'); setLoading(false); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <div className="w-12 h-12 border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin" />
        <p className="text-dai-qing/60 text-sm mt-6 tracking-[2px]">
          {pollStage < 5 ? '正在解析出生信息...' :
           pollStage < 10 ? '正在计算八字五行...' :
           pollStage < 20 ? '正在排布紫微星曜...' :
           pollStage < 40 ? '正在生成专属报告...' :
           '正在完成最终整理...'}
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

  // Display poster first, then free content below
  return (
    <div className="min-h-screen bg-xuan-zhi">
      <div className="border-b border-dai-qing/10 py-5 px-4 text-center">
        <a href="/" className="text-hu-po-jin text-sm tracking-[4px] no-underline">混沌</a>
        <p className="text-xs text-dai-qing/50 mt-1 tracking-[2px]">
          {chartName || '-'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* 命盘海报 */}
        {posterHtml ? (
          <div className="rounded-2xl border border-hu-po-jin/20 overflow-hidden">
            <p className="bg-dai-qing text-xuan-zhi text-xs text-center py-2.5 tracking-[0.3em]">命 · 盘 · 海 · 报</p>
            <div className="poster-wrapper w-full overflow-hidden">
              <div
                className="poster-content w-[750px] origin-top-left"
                ref={el => {
                  if (el && typeof window !== 'undefined') {
                    const scale = Math.min(window.innerWidth, 750) / 750;
                    el.style.transform = `scale(${scale})`;
                    el.style.height = 'auto';
                  }
                }}
                dangerouslySetInnerHTML={{ __html: posterHtml }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-8 text-center">
            <div className="animate-pulse">
              <div className="w-8 h-8 mx-auto border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin mb-3" />
              <p className="text-dai-qing/50 text-sm tracking-[2px]">海报生成中...</p>
            </div>
          </div>
        )}

        {/* 免费摘要 */}
        {freeContent && (
          <>
            {/* 八字四柱 */}
            {freeContent.bazi && (
              <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6">
                <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-5 text-center">八 · 字 · 四 · 柱</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-sm">
                    <thead>
                      <tr className="border-y border-dai-qing/8 text-dai-qing/50 text-xs">
                        {['年柱','月柱','日柱','时柱'].map(l => <th key={l} className="py-2.5 font-normal">{l}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-dai-qing/5">
                        {(['year','month','day','hour'] as const).map(p => {
                          const pd = freeContent.bazi?.siZhu?.[p] || {};
                          return <td key={p} className="py-3"><span className="text-lg font-bold text-dai-qing">{pd.gan || '-'}</span><span className="text-dai-qing/70 ml-1">{pd.zhi || '-'}</span></td>;
                        })}
                      </tr>
                      <tr className="border-b border-dai-qing/5">
                        {(['year','month','day','hour'] as const).map(p => {
                          const cg = freeContent.bazi?.cangGan?.[p];
                          return <td key={p} className="py-2 text-xs text-dai-qing/50">{Array.isArray(cg) ? cg.filter(Boolean).join(' ') : '-'}</td>;
                        })}
                      </tr>
                      <tr className="border-b border-dai-qing/5">
                        {(['year','month','day','hour'] as const).map(p => (
                          <td key={'na'+p} className="py-1.5 text-xs text-dai-qing/40">{freeContent.bazi?.naYin?.[p] || '-'}</td>
                        ))}
                      </tr>
                      <tr>
                        {(['year','month','day','hour'] as const).map(p => (
                          <td key={'ss'+p} className="py-1.5 text-xs text-hu-po-jin/80">{freeContent.bazi?.shiShen?.[p]?.gan || '-'}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 紫微十二宫 */}
            {freeContent.ziwei && freeContent.ziwei.gongs && Object.keys(freeContent.ziwei.gongs).length > 0 && (
              <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6">
                <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-5 text-center">紫 · 微 · 十 · 二 · 宫</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {DIZHI_ORDER.map(pos => {
                    const g = freeContent.ziwei.gongs[pos] || {};
                    return (
                      <div key={pos} className="rounded-lg border border-dai-qing/8 bg-dai-qing/3 p-1.5 text-center min-h-[60px] flex flex-col justify-center">
                        <p className="text-[9px] text-dai-qing/40">{pos} · {g.name || pos}</p>
                        <p className="text-[10px] text-hu-po-jin mt-0.5 leading-tight">{g.mainStars || ''}</p>
                        <p className="text-[9px] text-dai-qing/50 leading-tight">{g.auxStars || ''}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* 付费墙 */}
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
          <p className="text-[10px] text-xuan-zhi/30 mt-4">付费后自动生成 · 不满意可退款</p>
        </div>

        <p className="text-center text-[10px] text-dai-qing/25 tracking-[2px] pb-8">
          混沌 · 命理研究 — 古籍数字化 · 仅供参考
        </p>
      </div>
    </div>
  );
}
