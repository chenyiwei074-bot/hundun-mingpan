'use client';

const page: React.CSSProperties = { maxWidth:720,margin:'0 auto',padding:'40px 20px 80px',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",serif',lineHeight:1.8,color:'#1d1d1f',fontSize:14 };
const h1: React.CSSProperties = { fontSize:24,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 8px' };
const h2: React.CSSProperties = { fontSize:16,fontFamily:'serif',color:'#b2955d',margin:'28px 0 10px',fontWeight:600 };
const p: React.CSSProperties = { margin:'6px 0',color:'#333' };
const mute: React.CSSProperties = { fontSize:12,color:'#86868b',marginTop:32,paddingTop:16,borderTop:'1px solid rgba(0,0,0,0.06)' };

export default function ContactPage() {
  return <main style={page}>
    <h1 style={h1}>联系我们</h1>
    <p style={{fontSize:12,color:'#86868b',margin:'4px 0 24px'}}>如有任何问题，欢迎通过以下方式联系</p>
    <div style={{background:'#fff',borderRadius:12,padding:'24px 28px',border:'1px solid #f0f0f0',marginTop:20}}>
      <p style={p}><b>邮箱：</b>369485144@qq.com</p>
      <p style={p}><b>反馈类型：</b>技术支持 · 账号问题 · 数据请求 · 商务合作</p>
      <p style={p}><b>响应时间：</b>1-3个工作日内回复</p>
    </div>
    <div style={{background:'#fff',borderRadius:12,padding:'24px 28px',border:'1px solid #f0f0f0',marginTop:16}}>
      <p style={p}><b>数据请求：</b>如需查看、修改或删除个人数据，请发送邮件至上方邮箱，标题注明"数据请求"，15个工作日内处理。</p>
    </div>
    <p style={mute}>我们会认真对待每一条反馈。</p>
  </main>;
}