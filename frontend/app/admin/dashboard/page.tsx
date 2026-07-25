'use client';

import { useEffect, useState } from 'react';

interface StatsData {
  today: Record<string, number>;
  total: Record<string, number>;
  conversion: Record<string, string>;
}

const LABELS: Record<string, string> = {
  page_view: '首页访问',
  create_click: '点击生成',
  chart_complete: '命盘生成',
  wechat_click: '咨询微信',
};

const ICONS: Record<string, string> = {
  page_view: '👁',
  create_click: '✋',
  chart_complete: '✅',
  wechat_click: '💬',
};

const COLORS: Record<string, string> = {
  page_view: '#7b5ea7',
  create_click: '#c9a84c',
  chart_complete: '#4a9e6e',
  wechat_click: '#e05a45',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') + '/admin/stats')
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0806] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0806] flex items-center justify-center text-[#a89a85]">
        数据加载失败
      </div>
    );
  }

  const eventOrder = ['page_view', 'create_click', 'chart_complete', 'wechat_click'];
  const maxVal = Math.max(...eventOrder.map(k => stats.today[k] || 0), 1);

  return (
    <div className="min-h-screen bg-[#0a0806] text-[#e8e0d5] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl tracking-[6px] font-normal text-[#c9a84c] mb-2">
            混沌阁 · 运营面板
          </h1>
          <p className="text-xs text-[#6b5f52] tracking-[2px]">
            {new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>

        {/* 今日数据卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {eventOrder.map(k => (
            <div key={k} className="bg-[#1c1815] border border-[#2a2520] rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">{ICONS[k]}</div>
              <div className="text-2xl font-bold" style={{color: COLORS[k]}}>
                {stats.today[k] || 0}
              </div>
              <div className="text-xs text-[#6b5f52] mt-1 tracking-[1px]">{LABELS[k]}</div>
            </div>
          ))}
        </div>

        {/* 漏斗 */}
        <div className="bg-[#1c1815] border border-[#2a2520] rounded-lg p-6 mb-8">
          <h2 className="text-sm text-[#c9a84c] tracking-[3px] mb-6 text-center font-normal">
            转化漏斗
          </h2>
          <div className="space-y-0">
            {eventOrder.map((k, i) => {
              const val = stats.total[k] || 0;
              const pct = (val / maxVal) * 100;
              const convKey = i > 0
                ? [null, 'visit_to_create', 'create_to_complete', 'complete_to_wechat'][i]
                : null;

              return (
                <div key={k} className="relative">
                  {/* 漏斗条 */}
                  <div className="flex items-center gap-4 py-3">
                    <div className="w-16 text-xs text-[#a89a85] tracking-[1px] flex-shrink-0 text-right">
                      {LABELS[k]}
                    </div>
                    <div className="flex-1">
                      <div className="h-10 rounded" style={{
                        width: Math.max(pct, 2) + '%',
                        background: 'linear-gradient(90deg, ' + COLORS[k] + ', ' + COLORS[k] + '88)',
                        opacity: 0.3 + (0.7 * (1 - i * 0.2)),
                        minWidth: val > 0 ? '40px' : '2px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div className="w-20 text-right flex-shrink-0">
                      <span className="text-lg font-bold" style={{color: COLORS[k]}}>{val}</span>
                      {convKey && (
                        <span className="text-xs text-[#6b5f52] ml-1">
                          ({stats.conversion[convKey]})
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 箭头 */}
                  {i < eventOrder.length - 1 && (
                    <div className="flex justify-center py-1">
                      <span className="text-[#6b5f52] text-xs">↓ {stats.conversion[['visit_to_create','create_to_complete','complete_to_wechat'][i]]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 累计数据表 */}
        <div className="bg-[#1c1815] border border-[#2a2520] rounded-lg p-6">
          <h2 className="text-sm text-[#c9a84c] tracking-[3px] mb-4 text-center font-normal">
            累计数据
          </h2>
          <div className="space-y-2">
            {eventOrder.map(k => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-[#a89a85]">{LABELS[k]}</span>
                <span className="text-[#e8e0d5] font-mono">{stats.total[k] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#6b5f52] mt-8 tracking-[2px]">
          混沌阁 · 本地运营面板 · 无需登录
        </p>
      </div>
    </div>
  );
}
