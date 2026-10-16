'use client';

import React, { useState } from 'react';
import { createReportOrder, getReportStatus } from '@/app/lib/api';

const FREE_ITEMS = [
  { label: '基础命盘', desc: '八字四柱 + 紫微十二宫' },
  { label: '双盘分析', desc: '五行旺衰 + 格局 + 官禄财帛' },
  { label: '性格分析', desc: '日主解析 + 命宫特点' },
];

const LOCKED_ITEMS = [
  { label: '十年大运详细走势', desc: '每个大运的干支、十神、行运方向与关键节点' },
  { label: '未来流年分析', desc: '逐年干支、十神、合冲刑害与趋吉避凶建议' },
  { label: '财富阶段', desc: '财运周期、财富上限、赚钱方式与投资建议' },
  { label: '事业突破年份', desc: '事业上升期、转型时机、创业窗口期' },
  { label: '婚姻关系', desc: '配偶特征、结婚时机、婚后相处建议' },
  { label: '人生关键节点', desc: '重大转折年份、健康预警、应对策略' },
];

const NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆'];

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
      <div className='qn-card' style={{ marginBottom: 24 }}>
        <h3 className='qn-title' style={{ marginBottom: 6 }}>你已获得</h3>
        <p className='qn-meta' style={{ marginBottom: 18 }}>以下内容已免费为你展示，可随时查看</p>
        <div className='grid grid-cols-1 md:grid-cols-3' style={{ gap: 14 }}>
          {FREE_ITEMS.map((item) => (
            <div key={item.label} style={{ display: 'flex', gap: 9 }}>
              <span className='qn-body' style={{ color: 'var(--color-ji)', fontWeight: 600, lineHeight: 1.6 }}>✓</span>
              <div>
                <span className='qn-body' style={{ display: 'block', fontWeight: 500, lineHeight: 1.6 }}>{item.label}</span>
                <span className='qn-cap' style={{ display: 'block', marginTop: 3 }}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 完整版解锁 */}
      <div className='qn-ink' style={{ padding: '34px 26px 30px', textAlign: 'center' }}>
        {step === 'preview' && (
          <>
            <p className='qn-eyebrow' style={{ marginBottom: 12 }}>完整档案</p>
            <h3 className='qn-title' style={{ marginBottom: 8 }}>完整双盘命理档案</h3>
            <p className='qn-meta' style={{ marginBottom: 4 }}>由 AI 双盘合参引擎深度分析生成</p>
            <p className='qn-cap' style={{ marginBottom: 24 }}>包含八字 × 紫微双体系交叉验证 · 约3000字专业报告</p>

            <div style={{ maxWidth: 400, margin: '0 auto 26px', textAlign: 'left' }}>
              {LOCKED_ITEMS.map((item, i) => (
                <div key={item.label} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className='qn-cap' style={{ color: 'var(--color-accent-gold-light)', flex: '0 0 auto', letterSpacing: '0.14em' }}>{NUMERALS[i]}</span>
                  <div style={{ flex: '1 1 auto' }}>
                    <div className='qn-body' style={{ lineHeight: 1.6 }}>{item.label}</div>
                    <div className='qn-cap' style={{ marginTop: 3 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className='qn-btn qn-btn--solid' onClick={() => setStep('form')}>获取完整报告</button>
            <div className='qn-title' style={{ color: 'var(--color-accent-gold-light)', marginTop: 18 }}>¥138</div>
            <p className='qn-cap' style={{ marginTop: 6 }}>一次购买，永久查看 · AI 深度分析</p>
          </>
        )}

        {step === 'form' && (
          <>
            <h3 className='qn-title' style={{ marginBottom: 8 }}>确认订单</h3>
            <p className='qn-meta' style={{ marginBottom: 22 }}>报告将发送至你的邮箱，请确保邮箱正确</p>

            <div style={{ maxWidth: 360, margin: '0 auto 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                <span className='qn-meta'>双盘命理档案</span>
                <span className='qn-body' style={{ color: '#fff', fontWeight: 600 }}>¥138.00</span>
              </div>
              <input
                type='email'
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder='请输入接收报告的邮箱'
                className='qn-input'
                style={{ marginTop: 18, textAlign: 'center' }}
              />
              <p className='qn-cap' style={{ marginTop: 10, textAlign: 'center' }}>预计生成时间：1-3 分钟 · 完成后发送至邮箱</p>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className='qn-btn qn-btn--ghost' onClick={() => { setStep('preview'); setError(''); }}>
                返回
              </button>
              <button className='qn-btn qn-btn--solid' onClick={handlePurchase} disabled={loading}>
                {loading ? '提交中...' : '确认支付 ¥138'}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <>
            <div style={{ width: 44, height: 44, margin: '0 auto 22px', borderRadius: '50%', border: '2px solid rgba(178,149,93,0.25)', borderTopColor: 'var(--color-accent-gold-light)', animation: 'qn-spin 0.9s linear infinite' }} />
            <h3 className='qn-title' style={{ marginBottom: 8 }}>正在生成报告</h3>
            <p className='qn-meta' style={{ marginBottom: 18 }}>AI 引擎正在为你撰写双盘命理档案</p>
            <div style={{ maxWidth: 300, margin: '0 auto', textAlign: 'left' }}>
              {['八字四柱深度分析', '紫微十二宫解读', '双盘交叉验证', '生成完整报告'].map((s) => (
                <div key={s} className='qn-cap' style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                  <span style={{ width: 6, height: 6, flex: '0 0 auto', borderRadius: '50%', background: 'var(--color-accent-gold-light)' }} /> {s}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'completed' && (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 20px', borderRadius: '50%', background: 'rgba(178,149,93,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" role="img" style={{ display: 'block' }}>
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </div>
            <h3 className='qn-title' style={{ marginBottom: 8 }}>报告已生成</h3>
            <p className='qn-meta' style={{ marginBottom: 4 }}>完整双盘命理档案已发送至</p>
            <p className='qn-body' style={{ color: 'var(--color-accent-gold-light)', fontWeight: 500, marginBottom: 18, wordBreak: 'break-all' }}>{email}</p>
            <p className='qn-cap'>如未收到请检查垃圾邮件箱 · 订单号：{orderId?.slice(-8)}</p>
          </>
        )}
      </div>

      {error && (
        <div className='qn-alert' role='alert' style={{ marginTop: 16 }}>{error}</div>
      )}
    </section>
  );
}
