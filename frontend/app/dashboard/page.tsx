'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { REPORT_TYPE_LABELS, REPORT_TYPE_ICONS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/report/types';
import { getVisitorId } from '@/lib/auth/visitor';
import type { ReportListItem } from '@/lib/report/types';

const card: React.CSSProperties = {
  background:'#fff', borderRadius:12, padding:'24px 28px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.04)', border:'1px solid #f0f0f0',
};



export default function DashboardPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const vid = getVisitorId();
    fetch(`/api/reports?visitorId=${vid}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReports(d.data); })
      .catch(() => setError("????????????"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{maxWidth:660,margin:'0 auto',padding:'40px 20px 80px'}}>
      <h1 style={{fontSize:22,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 8px'}}>我的报告</h1>
      <p style={{fontSize:12,color:'#86868b',margin:'0 0 28px'}}>八字命盘 · 紫微斗数 · 六爻占卜</p>

      {error ? (
        <div style={{...card,textAlign:"center",padding:"48px 28px"}}>
          <p style={{margin:0,fontSize:14,color:"#d4544a",marginBottom:12}}>{error}</p>
          <button onClick={() => window.location.reload()} style={{background:"transparent",color:"#b2955d",border:"1px solid #b2955d",borderRadius:999,padding:"6px 20px",fontSize:12,cursor:"pointer"}}>????</button>
        </div>
      ) : loading ? (
        <p style={{textAlign:'center',color:'#86868b',padding:'40px 0'}}>加载中...</p>
      ) : reports.length === 0 ? (
        <div style={{...card,textAlign:'center',padding:'48px 28px'}}>
          <p style={{fontSize:28,margin:'0 0 12px'}}>📜</p>
          <p style={{margin:0,fontSize:14,color:'#86868b'}}>暂无报告</p>
          <p style={{margin:0,fontSize:12,color:'#c7c7cc',marginTop:4}}>生成命盘或起卦后会自动保存</p>
          <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:20}}>
            <Link href="/create" style={{fontSize:13,color:'#b2955d',textDecoration:'none'}}>八字排盘 →</Link>
            <Link href="/liuyao/create" style={{fontSize:13,color:'#b2955d',textDecoration:'none'}}>六爻起卦 →</Link>
          </div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {reports.map(r => (
            <Link key={r.id} href={`/report/${r.id}`}
              style={{...card,textDecoration:'none',display:'flex',alignItems:'center',gap:16,transition:'all 0.2s',cursor:'pointer'}}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <span style={{fontSize:24}}>{REPORT_TYPE_ICONS[r.type] || '📄'}</span>
              <div style={{flex:1}}>
                <p style={{margin:0,fontSize:14,color:'#1d1d1f',fontWeight:500}}>{r.title}</p>
                <p style={{margin:0,fontSize:11,color:'#86868b',marginTop:2}}>
                  {REPORT_TYPE_LABELS[r.type] || r.type} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                </p>
                <span style={{fontSize:10,color:REPORT_STATUS_COLORS[r.status]||'#86868b',background:(REPORT_STATUS_COLORS[r.status]||'#86868b')+'15',padding:'1px 8px',borderRadius:99}}>{REPORT_STATUS_LABELS[r.status]||r.status}</span>
              </div>
              <span style={{fontSize:12,color:'#c7c7cc'}}>查看 →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}