'use client';


export default function ContactPage() {
  return <main className="qn-shell qn-legal">
    <h1 className="qn-hero" style={{ margin: '0 0 6px' }}>联系我们</h1>
    <p className="qn-meta" style={{ marginBottom: 28 }}>如有任何问题，欢迎通过以下方式联系</p>
    <div className="qn-card" style={{ marginTop: 20 }}>
      <p><b>邮箱：</b>369485144@qq.com</p>
      <p><b>反馈类型：</b>技术支持 · 账号问题 · 数据请求 · 商务合作</p>
      <p><b>响应时间：</b>1-3个工作日内回复</p>
    </div>
    <div className="qn-card" style={{ marginTop: 16 }}>
      <p><b>数据请求：</b>如需查看、修改或删除个人数据，请发送邮件至上方邮箱，标题注明"数据请求"，15个工作日内处理。</p>
    </div>
    <p className="qn-legal__foot">我们会认真对待每一条反馈。</p>
  </main>;
}