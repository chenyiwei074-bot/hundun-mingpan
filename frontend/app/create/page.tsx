'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createChart, getQuota, trackEvent } from '@/app/lib/api';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('hundun_visitor_id');
  if (!id) {
    id = 'visitor_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('hundun_visitor_id', id);
  }
  return id;
}

export default function CreatePage() {
  const router = useRouter();
  const [visitorId, setVisitorId] = useState('');

  useEffect(() => {
    setVisitorId(getVisitorId());
  }, []);

  const [form, setForm] = useState({
    name: '',
    gender: '男',
    calendar: '农历',
    birthday: '',
    time: '',
    birthPlace: '',
    currentPlace: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState({ used: 0, remaining: 3 });

  useEffect(() => {
    if (!visitorId) return;
    getQuota(visitorId).then(res => {
      if (res.success) setQuota(res.data);
    });
  }, [visitorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const birthday = form.birthday + ' ' + form.time;
      const res = await createChart({
        visitor_id: visitorId,
        name: form.name,
        gender: form.gender,
        calendar: form.calendar,
        birthday,
        birthPlace: form.birthPlace,
        currentPlace: form.currentPlace,
      });

      if (res.success) {
        trackEvent('create_click', visitorId);
        // Store result in sessionStorage for the result page
        sessionStorage.setItem('chart_result_' + res.data.id, JSON.stringify(res.data));
        router.push('/chart/' + res.data.id);
      } else {
        setError(res.error || '生成失败');
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-screen bg-texture">
      <div className="border-b border-[#2a2520] py-6 px-4 text-center">
        <a href="/" className="text-[#c9a84c] text-sm tracking-[4px] no-underline hover:text-[#e0c878] transition-colors">
          混沌阁
        </a>
        <h1 className="text-xl text-[#e8e0d5] tracking-[6px] mt-3 font-normal">生成命盘</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">姓名</label>
            <input type="text" className="input-field" placeholder="请输入姓名"
              value={form.name} onChange={e => update('name', e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">性别</label>
            <div className="flex gap-3">
              {['男', '女'].map(g => (
                <button key={g} type="button" onClick={() => update('gender', g)}
                  className={'flex-1 py-3 rounded text-sm tracking-[3px] transition-all border ' +
                    (form.gender === g
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#e0c878]'
                      : 'border-[#2a2520] bg-[#141110] text-[#a89a85] hover:border-[#3a3530]')}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">历法</label>
            <div className="flex gap-3">
              {['农历', '公历'].map(c => (
                <button key={c} type="button" onClick={() => update('calendar', c)}
                  className={'flex-1 py-3 rounded text-sm tracking-[3px] transition-all border ' +
                    (form.calendar === c
                      ? 'border-[#c9a84c] bg-[#c9a84c]/10 text-[#e0c878]'
                      : 'border-[#2a2520] bg-[#141110] text-[#a89a85] hover:border-[#3a3530]')}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生日期</label>
            <input type="date" className="input-field"
              value={form.birthday} onChange={e => update('birthday', e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生时间</label>
            <input type="time" className="input-field"
              value={form.time} onChange={e => update('time', e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">出生地点</label>
            <input type="text" className="input-field" placeholder="如：北京"
              value={form.birthPlace} onChange={e => update('birthPlace', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-[#a89a85] mb-2 tracking-[2px]">现居地点</label>
            <input type="text" className="input-field" placeholder="如：上海"
              value={form.currentPlace} onChange={e => update('currentPlace', e.target.value)} />
          </div>

          {error && (
            <div className="text-[#e05a45] text-sm text-center py-3 border border-[#e05a45]/30 rounded bg-[#e05a45]/5">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-gold w-full text-base py-4 tracking-[4px] disabled:opacity-50">
            {loading ? '命盘生成中...' : '生成命盘'}
          </button>

          <p className="text-center text-xs text-[#6b5f52] tracking-[2px]">
            今日剩余 {quota.remaining} / {quota.used + quota.remaining} 次免费排盘
          </p>
        </form>
      </div>
    </div>
  );
}
