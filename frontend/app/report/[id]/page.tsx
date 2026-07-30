'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { REPORT_TYPE_LABELS, REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '@/lib/report/types';
import { getProductByType } from '@/lib/product/product';
import { checkReportAccess } from '@/lib/report/access';
import type { ReportRecord } from '@/lib/report/types';

const card: React.CSSProperties = {
  background:'#fff',borderRadius:12,padding:'24px 28px',
  boxShadow:'0 1px 3px rgba(0,0,0,0.04)',border:'1px solid #f0f0f0',
};

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then(r => r.json())
      .then(d => { if (d.success) setReport(d.data); else setError(d.error || '报告不存在'); })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main style={{maxWidth:720,margin:'0 auto',padding:'60px 20px'}}><p style={{textAlign:'center',color:'#86868b'}}>加载中...</p></main>;
  if (error || !report) return <main style={{maxWidth:720,margin:'0 auto',padding:'60px 20px'}}><div style={{...card,textAlign:'center'}}><p style={{color:'#d4544a',margin:'0 0 12px'}}>{error || '报告不存在'}</p><Link href="/dashboard" style={{fontSize:13,color:'#b2955d'}}>← 返回报告列表</Link></div></main>;

  const access = checkReportAccess(report.status);
  const displayText = access.canViewFull ? (report.reportText || report.previewText || '') : (report.previewText || '');

  return (
    <main style={{maxWidth:720,margin:'0 auto',padding:'40px 20px 80px'}}>
      <Link href="/dashboard" style={{fontSize:12,color:'#86868b',textDecoration:'none'}}>← 返回报告列表</Link>

      <div style={{...card,marginTop:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <p style={{margin:0,fontSize:11,color:'#86868b'}}>{REPORT_TYPE_LABELS[report.type] || report.type}</p>
            <h1 style={{margin:0,fontSize:20,fontFamily:'serif',color:'#1d1d1f',marginTop:4}}>{report.title}</h1>
            <p style={{margin:0,fontSize:11,color:'#c7c7cc',marginTop:4}}>{new Date(report.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <span style={{fontSize:11,color:REPORT_STATUS_COLORS[report.status]||'#86868b',background:(REPORT_STATUS_COLORS[report.status]||'#86868b')+'12',padding:'2px 10px',borderRadius:99}}>
            {REPORT_STATUS_LABELS[report.status] || report.status}
          </span>
        </div>

        {access.showUnlockPrompt && (() => {
          const product = getProductByType(report.type);
          return (
            <div style={{background:'linear-gradient(135deg,#fafaf8 0%,#f5f3ef 100%)',borderRadius:12,padding:'24px 28px',marginBottom:20,border:'1px solid rgba(178,149,93,0.15)'}}>
              <p style={{margin:0,fontSize:11,color:'#86868b',letterSpacing:'0.1em',textAlign:'center'}}>完整报告需解锁</p>
              {product && (
                <>
                  <p style={{margin:0,fontSize:20,fontFamily:'serif',color:'#1d1d1f',textAlign:'center',marginTop:8}}>{product.name}</p>
                  <p style={{margin:0,fontSize:11,color:'#86868b',textAlign:'center',marginTop:4}}>{product.description}</p>
                  <p style={{textAlign:'center',margin:'16px 0'}}>
                    <span style={{fontSize:14,color:'#86868b'}}>¥</span>
                    <span style={{fontSize:32,fontFamily:'serif',color:'#b2955d',fontWeight:700}}>{product.price}</span>
                  </p>
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
                    {product.features.map((f,i) => (
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                        <span style={{color:'#4a9e6e',fontSize:12}}>✓</span>
                        <span style={{fontSize:12,color:'#1d1d1f'}}>{f}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{textAlign:'center'}}>
                <button style={{background:'#b2955d',color:'#fff',border:'none',borderRadius:999,padding:'12px 40px',fontSize:14,fontWeight:500,cursor:'pointer',letterSpacing:'0.05em',boxShadow:'0 4px 16px rgba(178,149,93,0.2)',transition:'all 0.2s'}}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(178,149,93,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(178,149,93,0.2)'; }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1.02)'}>
                  立即解锁
                </button>
              </div>
            </div>
          );
        })()}

        {displayText ? (
          <div style={{fontSize:14,lineHeight:'1.9',color:'#1d1d1f'}}>
            {displayText.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} style={{fontSize:20,fontFamily:'serif',margin:'0 0 14px',fontWeight:700}}>{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} style={{fontSize:16,fontFamily:'serif',color:'#b2955d',margin:'18px 0 8px',fontWeight:600,paddingBottom:4,borderBottom:'1px solid rgba(0,0,0,0.06)'}}>{line.slice(3)}</h2>;
              if (line.startsWith('> ')) return <blockquote key={i} style={{margin:'6px 0',padding:'6px 12px',borderLeft:'3px solid #b2955d',background:'rgba(178,149,93,0.04)',borderRadius:'0 6px 6px 0',color:'#555',fontSize:13}}>{line.slice(2)}</blockquote>;
              if (line.trim() === '') return <br key={i} />;
              if (line.startsWith('- ')) return <li key={i} style={{margin:'2px 0 2px 16px',color:'#333',listStyle:'disc'}}>{line.slice(2)}</li>;
              return <p key={i} style={{margin:'4px 0',color:'#333'}}>{line}</p>;
            })}
          </div>
        ) : (
          <p style={{textAlign:'center',color:'#c7c7cc',padding:'32px 0'}}>暂无报告内容</p>
        )}
      </div>
    </main>
  );
}