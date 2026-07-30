'use client';

import React, { useState } from 'react';
import { createReportOrder, getReportStatus } from '@/app/lib/api';

const FREE_ITEMS = [
  { label: '基础命盘', desc: '八字四柱 + 紫微十二宫' },
  { label: '双盘分析', desc: '五行旺衰 + 格局 + 官禄财帛' },
  { label: '性格分析', desc: '日主解析 + 命宫特点' },
];

const LOCKED_ITEMS = [
  { icon: '📈', label: '十年大运详细走势', desc: '每个大运的干支、十神、行运方向与关键节点' },
  { icon: '🔢', label: '未来流年分析', desc: '逐年干支、十神、合冲刑害与趋吉避凶建议' },
  { icon: '💵', label: '财富阶段', desc: '财运周期、财富上限、赚钱方式与投资建议' },
  { icon: '🚀', label: '事业突破年份', desc: '事业上升期、转型时机、创业窗口期' },
  { icon: '💍', label: '婚姻关系', desc: '配偶特征、结婚时机、婚后相处建议' },
  { icon: '🔑', label: '人生关键节点', desc: '重大转折年份、健康预警、应对策略' },
];

type Step = 'preview' | 'form' | 'processing' | 'completed';

interface Props { chartId?: string; }

export default function ReportUnlock({ chartId }: Props) {
  const [step, setStep] = useState<Step>('preview');
  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!email.trim()) { setError('请输入邮箱地址'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError('邮箱格式不正确'); return; }
    if (!chartId) { setError('命盘信息丢失，请刷新页面后重试'); return; }
    
    setError('');
    setLoading(true);
    try {
      const res = await createReportOrder(chartId, email);
      if (res.success) {
        setOrderId(res.data.id);
        if (res.data.status === 'already_paid') {
          setStep('completed');
        } else {
          setStep('processing');
          // 模拟支付确认（实际应跳转支付页面）
          await new Promise(r => setTimeout(r, 800));
          setStep('completed');
        }
      } else {
        setError(res.error || '创建订单失败，请重试');
      }
    } catch {
      setError('网络异常，请检查连接后重试');
    }
    setLoading(false);
  };

  return (
    <section className='w-full'>
      {/* 已获得 */}
      <div className='rounded-xl border border-black/5 bg-white p-5 md:p-6 mb-6 shadow-sm'>
        <h3 className='font-serif text-lg font-bold mb-2 tracking-wider' style={{color:'#1d1d1f'}}>你已获得</h3>
        <p className='text-xs mb-4' style={{color:'#86868b'}}>以下内容已免费为你展示，可随时查看</p>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          {FREE_ITEMS.map((item, i) => (
            <div key={i} className='flex items-start gap-2 text-sm'>
              <span style={{color:'#07a830'}}>✓</span>
              <div>
                <span className='font-medium' style={{color:'#1d1d1f'}}>{item.label}</span>
                <span className='block text-xs mt-0.5' style={{color:'#86868b'}}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 完整版解锁 */}
      <div className='rounded-2xl p-6 md:p-8 text-center relative overflow-hidden' style={{background:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'}}>
        <div className='absolute top-0 right-0 w-48 h-48 rounded-full opacity-5' style={{background:'radial-gradient(circle, #b2955d 0%, transparent 70%)',transform:'translate(30%, -30%)'}} />
        <div className='relative z-10'>
          {step === 'preview' && (
            <>
              <h3 className='text-xl font-serif font-bold mb-3 tracking-wider' style={{color:'#ffffff'}}>完整双盘命理档案</h3>
              <p className='text-sm mb-2' style={{color:'rgba(255,255,255,0.6)'}}>由 AI 双盘合参引擎深度分析生成</p>
              <p className='text-xs mb-6' style={{color:'rgba(255,255,255,0.35)'}}>包含八字 × 紫微双体系交叉验证 · 约3000字专业报告</p>
              
              <div className='space-y-3 mb-8 max-w-[340px] mx-auto'>
                {LOCKED_ITEMS.map((item, i) => (
                  <div key={i} className='flex items-center gap-3 rounded-lg px-4 py-3 text-left' style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>
                    <span className='text-lg flex-shrink-0'>{item.icon}</span>
                    <div>
                      <div className='text-sm font-medium' style={{color:'#ffffff'}}>{item.label}</div>
                      <div className='text-xs' style={{color:'rgba(255,255,255,0.4)'}}>{item.desc}</div>
                    </div>
                    <span className='ml-auto text-xs' style={{color:'rgba(255,255,255,0.3)'}}>🔒</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setStep('form')} className='rounded-full px-8 py-3.5 font-medium text-sm tracking-[0.05em] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]' style={{background:'#b2955d',color:'#ffffff',boxShadow:'0 4px 20px rgba(178,149,93,0.35)'}}>
                获取完整报告
              </button>
              <p className='mt-4 text-lg font-bold' style={{color:'#d4b87a'}}>¥138</p>
            </>
          )}

          {step === 'form' && (
            <>
              <h3 className='text-xl font-serif font-bold mb-3 tracking-wider' style={{color:'#ffffff'}}>确认订单</h3>
              <p className='text-sm mb-6' style={{color:'rgba(255,255,255,0.6)'}}>报告将发送至你的邮箱，请确保邮箱正确</p>
              
              <div className='max-w-[320px] mx-auto space-y-4 mb-6'>
                <div className='flex items-center justify-between rounded-lg px-4 py-3' style={{background:'rgba(255,255,255,0.05)'}}>
                  <span className='text-sm' style={{color:'rgba(255,255,255,0.6)'}}>双盘命理档案</span>
                  <span className='text-sm font-bold' style={{color:'#ffffff'}}>¥138.00</span>
                </div>
                <div>
                  <input
                    type='email'
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder='请输入接收报告的邮箱'
                    className='w-full rounded-lg px-4 py-3 text-sm text-center outline-none border'
                    style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',color:'#ffffff'}}
                  />
                  {error && <p className='text-xs mt-2' style={{color:'#ff6b6b'}}>{error}</p>}
                </div>
                <p className='text-[10px]' style={{color:'rgba(255,255,255,0.3)'}}>预计生成时间：1-3 分钟 · 完成后发送至邮箱</p>
              </div>

              <div className='flex gap-3 justify-center'>
                <button onClick={() => { setStep('preview'); setError(''); }} className='rounded-full px-6 py-3 text-sm' style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.6)'}}>
                  返回
                </button>
                <button onClick={handlePurchase} disabled={loading} className='rounded-full px-8 py-3 font-medium text-sm tracking-[0.05em] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50' style={{background:'#b2955d',color:'#ffffff',boxShadow:'0 4px 20px rgba(178,149,93,0.35)'}}>
                  {loading ? '提交中...' : '确认支付 ¥138'}
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <>
              <div className='w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-6' style={{borderColor:'rgba(178,149,93,0.2)',borderTopColor:'#b2955d'}} />
              <h3 className='text-xl font-serif font-bold mb-3 tracking-wider' style={{color:'#ffffff'}}>正在生成报告</h3>
              <p className='text-sm mb-2' style={{color:'rgba(255,255,255,0.6)'}}>AI 引擎正在为你撰写双盘命理档案</p>
              <div className='max-w-[280px] mx-auto space-y-2 mt-4'>
                {['八字四柱深度分析', '紫微十二宫解读', '双盘交叉验证', '生成完整报告'].map((s,i) => (
                  <div key={i} className='flex items-center gap-2 text-xs' style={{color:'rgba(255,255,255,0.4)'}}>
                    <span style={{color:'#b2955d'}}>●</span> {s}
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'completed' && (
            <>
              <div className='w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6' style={{background:'rgba(7,168,48,0.15)'}}>
                <span className='text-2xl'>✓</span>
              </div>
              <h3 className='text-xl font-serif font-bold mb-3 tracking-wider' style={{color:'#ffffff'}}>报告已生成</h3>
              <p className='text-sm mb-2' style={{color:'rgba(255,255,255,0.6)'}}>完整双盘命理档案已发送至</p>
              <p className='text-sm font-medium mb-6' style={{color:'#d4b87a'}}>{email}</p>
              <p className='text-xs' style={{color:'rgba(255,255,255,0.35)'}}>如未收到请检查垃圾邮件箱 · 订单号：{orderId?.slice(-8)}</p>
            </>
          )}

          {step === 'preview' && (
            <p className='text-xs mt-1' style={{color:'rgba(255,255,255,0.35)'}}>一次购买，永久查看 · AI 深度分析</p>
          )}
        </div>
      </div>
    </section>
  );
}
