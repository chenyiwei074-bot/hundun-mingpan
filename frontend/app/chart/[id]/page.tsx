'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChartResult, trackEvent } from '@/app/lib/api';
import type { FreeContent } from '@/app/lib/api';

function getVid() { return typeof window !== 'undefined' ? localStorage.getItem('hundun_visitor_id') || 'visitor_anon' : 'visitor_anon'; }

const DIZHI_ORDER = ['巳','午','未','申','辰','酉','卯','戌','寅','丑','子','亥'];

export default function ChartPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<FreeContent | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posterHtml, setPosterHtml] = useState<string | null>(null);
  const [pollStage, setPollStage] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let pollCount = 0;

    // Try sessionStorage first (instant display from create page)
    const cached = sessionStorage.getItem('chart_free_' + id);
    const cachedName = sessionStorage.getItem('chart_name_' + id);
    if (cached) {
      try {
        setData(JSON.parse(cached));
        setName(cachedName || '');
        setLoading(false);
      } catch {}
    }

    // Get the real backend ID if available
    const realId = sessionStorage.getItem('chart_real_id_' + id) || id;

    // Poll backend for complete results (poster + full content)
    const poll = async () => {
      if (cancelled) return;
      try {
        const res: any = await getChartResult(realId);
        if (cancelled) return;
        pollCount++;
        setPollStage(pollCount);

        if (res.httpStatus === 202 || res.data?.status === 'processing') {
          if (pollCount < 60) { setTimeout(poll, 2000); }
          else { if (!data) { setError('生成时间较长，请稍后刷新查看'); setLoading(false); } }
        } else if (res.success && res.data) {
          const fc = res.data.freeContent || res.data;
          if (fc && !data) {
            setData(fc);
            setName(res.data.name || '');
            setLoading(false);
          }
          // Show poster when available
          if (res.data.posterHtml) {
            setPosterHtml(res.data.posterHtml);
          }
          if (res.data.posterHtml || (res.data.freeContent && data)) {
            trackEvent('chart_complete', getVid(), realId);
          }
        } else if (!data) {
          setError('命盘数据获取失败');
          setLoading(false);
        }
      } catch {
        if (!cancelled && !data) { setError('网络错误'); setLoading(false); }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin" />
        <p className="text-dai-qing/60 text-sm mt-4 tracking-[2px]">
          {pollStage > 0 ? `正在解析命盘...` : '加载命盘...'}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-xuan-zhi flex flex-col items-center justify-center px-4">
        <p className="text-dai-qing text-lg mb-6">{error || '数据异常'}</p>
        <button onClick={() => router.push('/create')} className="qn-btn qn-btn--primary qn-btn--sm">重新生成</button>
      </div>
    );
  }

  const bz: any = data.bazi || {};
  const zw: any = data.ziwei || {};
  const keywords: string[] = data.keywords || [];
  const pillars = ['year','month','day','hour'] as const;
  const pillarLabels = ['年柱','月柱','日柱','时柱'];

  return (
    <div className="min-h-screen bg-xuan-zhi">
      {/* Header */}
      <div className="border-b border-dai-qing/10 py-5 px-4 text-center">
        <a href="/" className="text-hu-po-jin text-sm tracking-[4px] no-underline">混沌</a>
        <p className="text-xs text-dai-qing/50 mt-1 tracking-[2px]">
          {name || '-'} · {bz.dayMaster || '-'}日主
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* 八字四柱表 */}
        <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6">
          <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-5 text-center">八 · 字 · 四 · 柱</p>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="border-y border-dai-qing/8 text-dai-qing/50 text-xs">
                  {pillarLabels.map(l => <th key={l} className="py-2.5 font-normal">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dai-qing/5">
                  {pillars.map(p => {
                    const pData = bz.siZhu?.[p] || {};
                    return (
                      <td key={p} className="py-3">
                        <span className="text-lg font-bold text-dai-qing">{pData.gan || '-'}</span>
                        <span className="text-dai-qing/70 ml-1">{pData.zhi || '-'}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-dai-qing/5">
                  {pillars.map(p => {
                    const cg = bz.cangGan?.[p];
                    const val = Array.isArray(cg) ? cg.filter(Boolean).join(' ') : '-';
                    return <td key={p} className="py-2 text-xs text-dai-qing/50">{val}</td>;
                  })}
                </tr>
                <tr className="border-b border-dai-qing/5">
                  {pillars.map(p => (
                    <td key={'na'+p} className="py-1.5 text-xs text-dai-qing/40">{bz.naYin?.[p] || '-'}</td>
                  ))}
                </tr>
                <tr>
                  {pillars.map(p => (
                    <td key={'ss'+p} className="py-1.5 text-xs text-hu-po-jin/80">{bz.shiShen?.[p]?.gan || '-'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {/* 日主信息 */}
          <div className="grid grid-cols-4 gap-3 mt-5 text-center text-xs">
            <div className="rounded-xl border border-dai-qing/8 bg-dai-qing/3 px-3 py-2">
              <p className="text-dai-qing/40">日主</p>
              <p className="text-hu-po-jin text-lg font-bold mt-0.5">{bz.dayMaster || '-'}</p>
            </div>
            <div className="rounded-xl border border-dai-qing/8 bg-dai-qing/3 px-3 py-2">
              <p className="text-dai-qing/40">格局</p>
              <p className="text-dai-qing text-sm mt-0.5">{bz.geju || '付费查看'}</p>
            </div>
            <div className="rounded-xl border border-dai-qing/8 bg-dai-qing/3 px-3 py-2">
              <p className="text-dai-qing/40">旺衰</p>
              <p className="text-dai-qing text-sm mt-0.5">{bz.wangshuai || '付费查看'}</p>
            </div>
            <div className="rounded-xl border border-dai-qing/8 bg-dai-qing/3 px-3 py-2">
              <p className="text-dai-qing/40">喜用</p>
              <p className="text-dai-qing text-sm mt-0.5">{bz.xiyong || '-'}</p>
            </div>
          </div>
        </div>

        {/* 大运流年 */}
        {bz.dayun && bz.dayun.length > 0 && (
          <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6">
            <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-5 text-center">大 · 运 · 流 · 年</p>
            <div className="space-y-3">
              {bz.dayun.slice(0, 8).map((dy: any, i: number) => (
                <div key={i} className="border border-dai-qing/8 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-hu-po-jin text-sm font-bold">{dy.startAge}-{dy.endAge}岁</span>
                    <span className="text-dai-qing font-bold">{dy.ganZhi}</span>
                    <span className="text-xs text-dai-qing/50">{dy.startYear}-{dy.endYear}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dy.liuNian?.slice(0, 5).map((ln: any, j: number) => (
                      <span key={j} className="text-xs bg-dai-qing/3 px-2 py-1 rounded">
                        {ln.year} {ln.ganZhi}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 紫微十二宫 */}
        <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6">
          <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-5 text-center">紫 · 微 · 十 · 二 · 宫</p>
          {(zw.gongs && Object.keys(zw.gongs).length > 0) ? (
            <div className="grid grid-cols-4 gap-1.5">
              {DIZHI_ORDER.map(pos => {
                const g = zw.gongs?.[pos] || {};
                return (
                  <div key={pos} className="rounded-lg border border-dai-qing/8 bg-dai-qing/3 p-1.5 text-center min-h-[60px] flex flex-col justify-center">
                    <p className="text-[9px] text-dai-qing/40">{pos} · {g.name || pos}</p>
                    <p className="text-[10px] text-hu-po-jin mt-0.5 leading-tight">{g.mainStars || ''}</p>
                    <p className="text-[9px] text-dai-qing/50 leading-tight">{g.auxStars || ''}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-dai-qing/40 text-sm py-4">紫微十二宫为付费内容，请解锁完整报告查看</p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <div className="rounded-lg border border-dai-qing/8 bg-dai-qing/3 px-2 py-1.5">
              <span className="text-dai-qing/40">命宫 </span>
              <span className="text-hu-po-jin">{zw.mingGong || '-'}</span>
            </div>
            <div className="rounded-lg border border-dai-qing/8 bg-dai-qing/3 px-2 py-1.5">
              <span className="text-dai-qing/40">身宫 </span>
              <span className="text-hu-po-jin">{zw.shenGong || '-'}</span>
            </div>
            <div className="rounded-lg border border-dai-qing/8 bg-dai-qing/3 px-2 py-1.5">
              <span className="text-dai-qing/40">五行局 </span>
              <span className="text-hu-po-jin">{zw.wuXingJu?.name || '-'}</span>
            </div>
          </div>
        </div>

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
          <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6 text-center">
            <div className="animate-pulse">
              <div className="w-8 h-8 mx-auto border-2 border-hu-po-jin/30 border-t-hu-po-jin rounded-full animate-spin mb-3" />
              <p className="text-dai-qing/50 text-sm tracking-[2px]">
                {pollStage < 10 ? '正在生成命盘海报...' : '海报生成中，请耐心等待...'}
              </p>
            </div>
          </div>
        )}

        {/* 关键词 */}
        {keywords.length > 0 && (
          <div className="rounded-2xl border border-dai-qing/10 bg-xuan-zhi-dark p-6 text-center">
            <p className="text-[10.5px] tracking-[0.4em] text-hu-po-jin-dark mb-4">命 · 盘 · 关 · 键 · 词</p>
            <div className="grid grid-cols-3 gap-3">
              {keywords.map((kw: string, i: number) => (
                <div key={i} className="rounded-xl border border-dai-qing/8 bg-dai-qing/3 px-3 py-3">
                  <p className="text-[10px] text-dai-qing/40 mb-1">{['事业','财富','感情'][i] || '运势'}</p>
                  <p className="text-sm text-dai-qing">{kw}</p>
                </div>
              ))}
            </div>
          </div>
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
