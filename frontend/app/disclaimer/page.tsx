'use client';

const page: React.CSSProperties = { maxWidth:720,margin:'0 auto',padding:'40px 20px 80px',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",serif',lineHeight:1.8,color:'#1d1d1f',fontSize:14 };
const h1: React.CSSProperties = { fontSize:24,fontFamily:'serif',color:'#1d1d1f',margin:'0 0 8px' };
const h2: React.CSSProperties = { fontSize:16,fontFamily:'serif',color:'#b2955d',margin:'28px 0 10px',fontWeight:600 };
const p: React.CSSProperties = { margin:'6px 0',color:'#333' };
const mute: React.CSSProperties = { fontSize:12,color:'#86868b',marginTop:32,paddingTop:16,borderTop:'1px solid rgba(0,0,0,0.06)' };

export default function DisclaimerPage() {
  return <main style={page}>
    <h1 style={h1}>免责声明</h1>
    <p style={{fontSize:12,color:'#86868b',margin:'4px 0 24px'}}>请在使用前仔细阅读</p>
    <h2 style={h2}>一、服务性质</h2>
    <p style={p}>混沌平台提供八字命盘、紫微斗数、六爻占卜等传统文化研究服务，所有分析结果由AI模型辅助生成。本平台不提供任何形式的预测保证，所有内容仅供文化交流和个人参考。</p>
    <h2 style={h2}>二、不构成专业建议</h2>
    <p style={p}>平台生成内容不构成医疗建议、投资建议、法律意见或心理咨询。如需上述专业服务，请咨询持证专业人士。</p>
    <h2 style={h2}>三、AI生成内容声明</h2>
    <p style={p}>本平台的命盘分析和卦象解读由AI模型自动生成，基于算法和训练数据，可能存在偏差或不准确。不同时间、不同模型生成的报告可能存在差异。</p>
    <h2 style={h2}>四、用户责任</h2>
    <p style={p}>用户应基于独立判断使用平台内容。因依赖平台内容而产生的任何直接或间接损失，本平台不承担责任。</p>
    <h2 style={h2}>五、版权声明</h2>
    <p style={p}>平台所有原创内容的知识产权归平台所有。未经授权不得转载、复制或用于商业用途。</p>
    <p style={mute}>使用本平台即表示您已阅读并同意本免责声明。</p>
  </main>;
}