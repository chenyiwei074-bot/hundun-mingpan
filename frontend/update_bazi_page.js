const fs = require("fs");
const f = "app/bazi-chart/page.tsx";
let t = fs.readFileSync(f, "utf8");

// Replace the default export function
const oldExport = `export default function BaziChartDemoPage() {
  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f7" }}>
      <BaziChart data={SAMPLE_BAZI} />
      <div className="max-w-2xl mx-auto px-4 pb-10 space-y-4">
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(178,149,93,0.20),transparent)"}}/>
          <span style={{fontSize:"12px",color:"rgba(0,0,0,0.25)",letterSpacing:"0.2em"}}>紫微斗数</span>
          <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(178,149,93,0.20),transparent)"}}/>
        </div>
        <ZiweiGongs gongs={SAMPLE_ZIWEI.gongs} mingGongIndex={0} shenGongIndex={6} />
      </div>
    </div>
  );
}`;

const newExport = `export default function BaziChartDemoPage() {
  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f7" }}>
      {/* NAV */}
      <nav className="sticky top-0 z-50 w-full"
        style={{ background:'rgba(250,250,249,0.85)', backdropFilter:'blur(20px) saturate(180%)', WebkitBackdropFilter:'blur(20px) saturate(180%)', borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
        <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-6">
          <a href="/" className="no-underline text-base font-semibold tracking-[-0.01em]" style={{ color:"#1d1d1f" }}>混沌</a>
          <span className="text-xs tracking-[0.1em] font-serif" style={{ color:"#b2955d" }}>八字 & 紫微</span>
          <div className="w-[44px]" />
        </div>
      </nav>

      <BaziChart data={SAMPLE_BAZI} />

      {/* 紫微斗数分隔 */}
      <div className="max-w-3xl mx-auto px-4 pb-4">
        <div className="flex items-center gap-3 py-4">
          <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(178,149,93,0.18),transparent)"}}/>
          <span style={{fontSize:"11px",color:"rgba(0,0,0,0.25)",letterSpacing:"0.2em"}}>紫微斗数</span>
          <div className="flex-1 h-px" style={{background:"linear-gradient(90deg,transparent,rgba(178,149,93,0.18),transparent)"}}/>
        </div>
        <ZiweiGongs gongs={SAMPLE_ZIWEI.gongs} mingGongIndex={0} shenGongIndex={6} />
      </div>

      {/* Footer */}
      <div className="py-10 text-center">
        <p style={{fontSize:"11px",color:"rgba(0,0,0,0.20)",letterSpacing:"0.2em"}}>
          混沌 · 古籍数字化 · AI 参详 · 仅供参考
        </p>
      </div>
    </div>
  );
}`;

t = t.replace(oldExport, newExport);
fs.writeFileSync(f, t, "utf8");
console.log("Page updated");
