'use client';

const page: React.CSSProperties = { maxWidth:720,margin:'0 auto',padding:'40px 20px 80px',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",serif',lineHeight:1.8,color:'#1d1d1f',fontSize:14 };
const h1: React.CSSProperties = { fontSize:24,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 8px' };
const h2: React.CSSProperties = { fontSize:16,fontFamily:'serif',color:'#b2955d',margin:'28px 0 10px',fontWeight:600 };
const p: React.CSSProperties = { margin:'6px 0',color:'#333' };
const mute: React.CSSProperties = { fontSize:12,color:'#86868b',marginTop:32,paddingTop:16,borderTop:'1px solid rgba(0,0,0,0.06)' };

export default function AgreementPage() {
  return <main style={page}>
    <h1 style={h1}>用户协议</h1>
    <p style={{fontSize:12,color:'#86868b',margin:'4px 0 24px'}}>最后更新：2026年7月</p>
    <h2 style={h2}>一、服务说明</h2>
    <p style={p}>混沌平台提供基于AI技术的传统文化研究服务，包括八字命盘分析、紫微斗数排盘、六爻占卜解读等功能。所有内容均为AI辅助生成，仅供传统文化交流与个人参考。</p>
    <h2 style={h2}>二、用户使用规则</h2>
    <p style={p}>1. 用户须年满18周岁或已获得监护人同意。2. 用户应保证所提供信息的真实性。3. 禁止利用本平台从事任何违法活动。4. 禁止对平台进行反向工程或数据爬取。</p>
    <h2 style={h2}>三、AI生成内容说明</h2>
    <p style={p}>本平台的分析报告由AI模型自动生成，具有随机性，不同时间生成的报告可能存在差异。用户应理性看待AI生成内容，不构成任何形式的专业建议。</p>
    <h2 style={h2}>四、付费服务说明</h2>
    <p style={p}>部分高级功能可能需要付费使用。虚拟商品一经交付不支持退款，法律法规另有规定的除外。</p>
    <h2 style={h2}>五、账号责任</h2>
    <p style={p}>用户应对其账号下的所有操作负责。如发现账号异常，请及时联系平台处理。</p>
    <p style={mute}>如有疑问，请通过联系我们页面与我们取得联系。</p>
  </main>;
}