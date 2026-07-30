const fs = require("fs");
let t = fs.readFileSync("app/page.tsx", "utf8");

const ms = t.indexOf("{/* ════════════ LAUNCHER MODAL");
// Find "      )}\r\n    </div>\r\n  );" - the modal closing
const me = t.indexOf("      )}\r\n    </div>\r\n  );", ms + 700);
console.log("Start:", ms, "End:", me);

const modal = `      {/* ════════════ LAUNCHER MODAL ════════════ */}
      {showLauncher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          onClick={() => setShowLauncher(false)}>
          <div className="relative w-full max-w-[440px] rounded-[24px] px-8 py-10"
            style={{ background: white, boxShadow: '0 40px 100px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(178,149,93,0.06)' }}
            onClick={e => e.stopPropagation()}>

            <button onClick={() => setShowLauncher(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-[rgba(0,0,0,0.04)]"
              style={{ color: mute }} aria-label="关闭">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
            </button>

            <div className="text-center mb-8">
              <p className="text-[10px] tracking-[0.25em] font-semibold mb-3" style={{ color: gold }}>选择功能</p>
              <h2 className="font-serif font-bold tracking-[-0.03em] leading-[1.2]"
                style={{ fontSize: 'clamp(1.4rem, 4vw, 1.7rem)', color: ink }}>探索你的命理</h2>
            </div>

            <div className="relative">
              <button onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollBy({left:-340,behavior:'smooth'}) }}
                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-115 active:scale-95"
                style={{ background: white, border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M10 3l-5 5 5 5"/></svg>
              </button>

              <div id="ls" className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {[
                  { href:"/bazi-chart", zi:"命", title:"八字 & 紫微", desc:"四柱天干地支 + 十二宫排盘。大运流年、主星四化，一盘双参。" },
                  { href:"/liuyao", zi:"爻", title:"六爻问卦", desc:"金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。" },
                  { href:"#", zi:"合", title:"姓名合盘", desc:"二人姓名，五行适配。五格剖象，深析缘分。", tag:"即将上线" },
                  { href:"#", zi:"吉", title:"择日", desc:"黄道吉日，天时地利。嫁娶开业搬家出行，择最优时日，趋吉避凶。", tag:"即将上线" },
                ].map((item, i) => (
                  <Link key={i} href={item.href}
                    onClick={() => item.tag ? null : setShowLauncher(false)}
                    className={item.tag ? 'pointer-events-none group' : 'group'}
                    style={{ textDecoration: 'none', minWidth: '100%' }}>
                    <div className="snap-center w-full rounded-2xl px-6 py-8 flex flex-col items-center text-center transition-all duration-400 hover:bg-[rgba(178,149,93,0.02)] cursor-pointer"
                      style={{ background: 'transparent' }}>
                      <div className="mb-5 transition-transform duration-500 group-hover:scale-105"
                        style={{ width: 72, height: 72, position: 'relative' }}>
                        <svg viewBox="0 0 72 72" style={{ width: 72, height: 72 }}>
                          <rect x="1" y="1" width="70" height="70" rx="8" fill="none" stroke={gold} strokeWidth="1.2" opacity="0.35" />
                          <rect x="5" y="5" width="62" height="62" rx="4" fill="none" stroke={gold} strokeWidth="0.5" opacity="0.18" />
                          <text x="36" y="50" textAnchor="middle" fill={gold} fontSize="32" fontWeight="700" fontFamily="serif">{item.zi}</text>
                        </svg>
                      </div>
                      <h3 className="font-serif font-bold text-xl tracking-[-0.02em] mb-2" style={{ color: ink }}>{item.title}</h3>
                      {item.tag ? (
                        <span className="text-[10px] font-medium tracking-[0.08em] px-2.5 py-0.5 rounded-full mb-4"
                          style={{ background: 'rgba(178,149,93,0.06)', color: gold }}>{item.tag}</span>
                      ) : (
                        <div className="w-10 h-px mb-4" style={{ background: 'rgba(178,149,93,0.18)' }} />
                      )}
                      <p className="text-[14px] leading-relaxed mb-6 max-w-[300px]" style={{ color: mute }}>{item.desc}</p>
                      <div className="flex items-center gap-1.5 transition-all duration-300 group-hover:gap-2.5"
                        style={{ color: item.tag ? 'rgba(0,0,0,0.10)' : gold }}>
                        <span className="text-[13px] font-medium tracking-[0.03em]">{item.tag ? '敬请期待' : '进入'}</span>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <button onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollBy({left:340,behavior:'smooth'}) }}
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-115 active:scale-95"
                style={{ background: white, border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 mt-7">
              {[0,1,2,3].map(i => (
                <button key={i} onClick={() => { const el=document.getElementById('ls'); if(el) el.scrollTo({left:i*350,behavior:'smooth'}) }}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300 hover:scale-125"
                  style={{ background: gold, opacity: 0.22 }} />
              ))}
            </div>
          </div>
        </div>
      )}`;

t = t.substring(0, ms) + modal + "\r\n" + t.substring(me);
fs.writeFileSync("app/page.tsx", t, "utf8");
console.log("Done");
