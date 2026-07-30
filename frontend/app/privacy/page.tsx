'use client';

const page: React.CSSProperties = { maxWidth:720,margin:'0 auto',padding:'40px 20px 80px',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",serif',lineHeight:1.8,color:'#1d1d1f',fontSize:14 };
const h1: React.CSSProperties = { fontSize:24,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 8px' };
const h2: React.CSSProperties = { fontSize:16,fontFamily:'serif',color:'#b2955d',margin:'28px 0 10px',fontWeight:600 };
const p: React.CSSProperties = { margin:'6px 0',color:'#333' };
const mute: React.CSSProperties = { fontSize:12,color:'#86868b',marginTop:32,paddingTop:16,borderTop:'1px solid rgba(0,0,0,0.06)' };

export default function PrivacyPage() {
  return <main style={page}>
    <h1 style={h1}>隐私政策</h1>
    <p style={{fontSize:12,color:'#86868b',margin:'4px 0 24px'}}>最后更新：2026年7月</p>
    <h2 style={h2}>一、信息收集范围</h2>
    <p style={p}>本平台收集姓名/昵称、出生日期/时间/地点、用户输入的占问事项、设备信息（浏览器类型、访问时间）等匿名统计数据。</p>
    <h2 style={h2}>二、数据用途</h2>
    <p style={p}>收集的信息仅用于生成命盘和卦象分析、生成AI辅助解读报告、优化服务体验和算法精度。</p>
    <h2 style={h2}>三、数据保护</h2>
    <p style={p}>我们采用行业标准的安全措施保护用户数据，包括传输加密、访问控制和定期安全审查。数据存储于阿里云服务器，遵循中国数据安全相关法规。</p>
    <h2 style={h2}>四、数据共享</h2>
    <p style={p}>未经用户明确同意，我们不会向第三方出售或共享个人身份信息。法律法规要求或保护平台合法权益的情况除外。</p>
    <h2 style={h2}>五、用户权利</h2>
    <p style={p}>用户有权请求查看、更正或删除其个人数据。请通过联系我们页面提交请求，我们将在15个工作日内处理。</p>
    <p style={mute}>本隐私政策可能不定期更新，更新后将在本页面公布。</p>
  </main>;
}