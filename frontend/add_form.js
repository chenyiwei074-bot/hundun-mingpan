const fs = require("fs");
const f = "app/bazi-chart/page.tsx";
let t = fs.readFileSync(f, "utf8");

// Add useState import
t = t.replace(
  'import { BaziChart } from "@/components/bazi/BaziChart";',
  'import { useState } from "react";\nimport { BaziChart } from "@/components/bazi/BaziChart";'
);

// Replace the entire export function
const oldFunc = /export default function BaziChartDemoPage\(\) \{[\s\S]*$/;
const newFunc = `export default function BaziChartDemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name:"", gender:"男", year:"", month:"", day:"", hour:"12", birthplace:"" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!submitted) {
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

        {/* FORM */}
        <div className="max-w-lg mx-auto px-6 pt-16 pb-20">
          <div className="text-center mb-10">
            <p className="text-[10px] tracking-[0.25em] font-semibold mb-3" style={{ color:"#b2955d" }}>八字排盘</p>
            <h1 className="font-serif font-bold tracking-[-0.03em] leading-[1.2] mb-2"
              style={{ fontSize:'clamp(1.6rem, 5vw, 2rem)', color:"#1d1d1f" }}>输入你的出生信息</h1>
            <p className="text-[14px]" style={{ color:"#86868b" }}>混沌将为你排出八字命盘与紫微斗数</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 姓名 */}
            <div>
              <label className="block text-[12px] font-medium tracking-[0.05em] mb-1.5" style={{ color:"#1d1d1f" }}>姓名</label>
              <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required
                placeholder="请输入姓名"
                className="w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-all duration-300 focus:ring-2"
                style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }} />
            </div>

            {/* 性别 */}
            <div>
              <label className="block text-[12px] font-medium tracking-[0.05em] mb-1.5" style={{ color:"#1d1d1f" }}>性别</label>
              <div className="flex gap-3">
                {["男","女"].map(g=>(
                  <button key={g} type="button" onClick={()=>setForm({...form,gender:g})}
                    className="flex-1 rounded-xl px-4 py-3 text-[15px] font-medium transition-all duration-300"
                    style={{
                      background: form.gender===g ? "rgba(178,149,93,0.08)" : "white",
                      border: form.gender===g ? '1px solid rgba(178,149,93,0.3)' : '0.5px solid rgba(0,0,0,0.08)',
                      color: form.gender===g ? "#b2955d" : "#1d1d1f"
                    }}>{g}</button>
                ))}
              </div>
            </div>

            {/* 出生日期 */}
            <div>
              <label className="block text-[12px] font-medium tracking-[0.05em] mb-1.5" style={{ color:"#1d1d1f" }}>出生日期（阳历）</label>
              <div className="grid grid-cols-3 gap-3">
                <input type="text" value={form.year} onChange={e=>setForm({...form,year:e.target.value})} required
                  placeholder="1990" maxLength={4}
                  className="rounded-xl px-4 py-3 text-[15px] text-center outline-none transition-all duration-300 focus:ring-2"
                  style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }} />
                <input type="text" value={form.month} onChange={e=>setForm({...form,month:e.target.value})} required
                  placeholder="05" maxLength={2}
                  className="rounded-xl px-4 py-3 text-[15px] text-center outline-none transition-all duration-300 focus:ring-2"
                  style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }} />
                <input type="text" value={form.day} onChange={e=>setForm({...form,day:e.target.value})} required
                  placeholder="20" maxLength={2}
                  className="rounded-xl px-4 py-3 text-[15px] text-center outline-none transition-all duration-300 focus:ring-2"
                  style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }} />
              </div>
            </div>

            {/* 出生时辰 */}
            <div>
              <label className="block text-[12px] font-medium tracking-[0.05em] mb-1.5" style={{ color:"#1d1d1f" }}>出生时辰</label>
              <select value={form.hour} onChange={e=>setForm({...form,hour:e.target.value})}
                className="w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-all duration-300 focus:ring-2 appearance-none"
                style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }}>
                {["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"].map(h=>(
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>

            {/* 出生地 */}
            <div>
              <label className="block text-[12px] font-medium tracking-[0.05em] mb-1.5" style={{ color:"#1d1d1f" }}>出生地</label>
              <input type="text" value={form.birthplace} onChange={e=>setForm({...form,birthplace:e.target.value})}
                placeholder="例如：北京"
                className="w-full rounded-xl px-4 py-3 text-[15px] outline-none transition-all duration-300 focus:ring-2"
                style={{ background:"white", border:'0.5px solid rgba(0,0,0,0.08)', color:"#1d1d1f", '--tw-ring-color':'rgba(178,149,93,0.3)' }} />
            </div>

            {/* Submit */}
            <button type="submit"
              className="w-full rounded-xl py-3.5 text-[15px] font-medium tracking-[0.05em] transition-all duration-500 hover:scale-[1.01] active:scale-[0.99] mt-8"
              style={{ background:"#b2955d", color:"white", boxShadow:'0 4px 20px rgba(178,149,93,0.25)' }}>
              开始排盘
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ════════════ RESULT VIEW ════════════
  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f7" }}>
      {/* NAV */}
      <nav className="sticky top-0 z-50 w-full"
        style={{ background:'rgba(250,250,249,0.85)', backdropFilter:'blur(20px) saturate(180%)', WebkitBackdropFilter:'blur(20px) saturate(180%)', borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
        <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between px-6">
          <a href="/" className="no-underline text-base font-semibold tracking-[-0.01em]" style={{ color:"#1d1d1f" }}>混沌</a>
          <span className="text-xs tracking-[0.1em] font-serif" style={{ color:"#b2955d" }}>八字 & 紫微</span>
          <button onClick={() => setSubmitted(false)}
            className="text-[12px] tracking-[0.05em] px-3 py-1 rounded-full transition-all duration-300"
            style={{ color:"#86868b", background:'rgba(0,0,0,0.03)' }}>重新输入</button>
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

t = t.replace(oldFunc, newFunc);
fs.writeFileSync(f, t, "utf8");
console.log("Page redesigned with form + result states");
