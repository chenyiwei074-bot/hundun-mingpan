import os

path = r"C:\Users\Kobe\Documents\HDAI\frontend\app\liuyao\create\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.read().split("\n")

# --- New TortoiseShell + Coin SVG components ---
new_components = r"""// ── 刻符龟甲 SVG ──
function TortoiseShell({ shaking = false, size = 220 }: { shaking?: boolean; size?: number }) {
  const w = size, h = size * 0.85;
  return (
    <svg width={w} height={h} viewBox="0 0 220 187" style={{
      animation: shaking ? 'shellShake 0.12s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.3))',
    }}>
      <defs>
        <radialGradient id="sg1" cx="42%" cy="28%"><stop offset="0%" stopColor="#8b6b4a"/><stop offset="30%" stopColor="#5c3d2e"/><stop offset="65%" stopColor="#3e2216"/><stop offset="100%" stopColor="#241008"/></radialGradient>
        <radialGradient id="sg2" cx="38%" cy="22%"><stop offset="0%" stopColor="rgba(255,255,255,0.18)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
        <filter id="stex"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="5" result="n"/><feColorMatrix type="saturate" values="0" in="n" result="gn"/><feBlend in="SourceGraphic" in2="gn" mode="multiply"/></filter>
      </defs>
      <ellipse cx="110" cy="125" rx="100" ry="55" fill="#120802" opacity="0.5"/>
      <path d="M15,115 Q10,50 55,28 Q105,2 165,28 Q210,50 205,115 Q165,158 110,165 Q55,158 15,115Z" fill="url(#sg1)" filter="url(#stex)"/>
      <g stroke="rgba(0,0,0,0.25)" strokeWidth="1" fill="none">
        <path d="M110,12 Q110,60 110,128 Q110,155 110,165"/>
        <path d="M48,60 Q78,48 110,42 Q142,48 172,60"/>
        <path d="M30,92 Q68,76 110,72 Q152,76 190,92"/>
        <path d="M22,118 Q65,105 110,102 Q155,105 198,118"/>
        <path d="M30,140 Q68,132 110,130 Q152,132 190,140"/>
        <path d="M55,28 Q82,58 110,42"/><path d="M165,28 Q138,58 110,42"/>
        <path d="M30,62 Q65,82 110,72"/><path d="M190,62 Q155,82 110,72"/>
      </g>
      <path d="M25,78 Q48,32 110,20 Q158,30 180,62 Q130,55 82,60 Q48,65 25,78Z" fill="url(#sg2)"/>
      <g stroke="#c9a84c" strokeWidth="1.3" fill="none" opacity="0.65">
        <path d="M55,48 L72,48 M63,40 L63,56"/><path d="M55,55 L72,55"/>
        <path d="M148,48 L162,48 M155,40 L155,56"/><path d="M148,55 L155,48 L162,55"/>
        <path d="M65,82 L78,82 L78,95 L65,95Z M71,82 L71,95"/>
        <path d="M142,82 L155,82 L155,95 L142,95Z"/>
        <path d="M85,125 Q110,115 135,125 M90,136 L110,125 L130,136"/>
      </g>
      <path d="M15,115 Q10,50 55,28 Q105,2 165,28 Q210,50 205,115" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
    </svg>
  );
}

// ── 乾隆通宝铜钱 SVG ──
function Coin({ face, sz = 64, flipping = false, style }: { face: CoinFace; sz?: number; flipping?: boolean; style?: React.CSSProperties }) {
  const isZi = face === '\u5b57';
  return (
    <svg width={sz} height={sz} viewBox="0 0 64 64" style={{
      animation: flipping ? 'coinFlip3D 0.6s ease-in-out infinite' : 'none',
      filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.25))',
      ...style,
    }}>
      <defs>
        <radialGradient id={"ccg"+sz} cx="35%" cy="30%"><stop offset="0%" stopColor="#ecd48a"/><stop offset="20%" stopColor="#c9a045"/><stop offset="55%" stopColor="#a07828"/><stop offset="100%" stopColor="#6b4410"/></radialGradient>
        <radialGradient id={"cch"+sz} cx="50%" cy="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.12)"/><stop offset="100%" stopColor="rgba(0,0,0,0.1)"/></radialGradient>
        <filter id={"cpa"+sz}><feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" result="n"/><feColorMatrix type="matrix" values="0 0 0 0 0.3 0 0 0 0 0.42 0 0 0 0 0.22 0 0 0 0.06 0" in="n" result="p"/><feBlend in="SourceGraphic" in2="p" mode="multiply"/></filter>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#5a3010" stroke="#3d1c05" strokeWidth="1.2"/>
      <circle cx="32" cy="32" r="28" fill="url(#ccg)" filter="url(#cpa)"/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(139,105,20,0.4)" strokeWidth="0.6"/>
      {isZi ? (<>
        <rect x="24" y="22" width="16" height="16" rx="1.5" fill="#2a1508" stroke="#5a3010" strokeWidth="0.8"/>
        <rect x="25.5" y="23.5" width="13" height="13" rx="1" fill="#1a0a02"/>
        <text x="32" y="17" textAnchor="middle" fontSize="6.8" fontWeight="bold" fill="#3d1c00" fontFamily="serif">{'\u4e7e'}</text>
        <text x="32" y="50" textAnchor="middle" fontSize="6.8" fontWeight="bold" fill="#3d1c00" fontFamily="serif">{'\u9686'}</text>
        <text x="16" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4a2a05" fontFamily="serif">{'\u901a'}</text>
        <text x="48" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#4a2a05" fontFamily="serif">{'\u5b9d'}</text>
      </>) : (<>
        <rect x="24" y="22" width="16" height="16" rx="1.5" fill="#2a1508" stroke="#5a3010" strokeWidth="0.8"/>
        <rect x="25.5" y="23.5" width="13" height="13" rx="1" fill="#1a0a02"/>
        <text x="32" y="17" textAnchor="middle" fontSize="6.5" fill="#3d1c00" fontFamily="serif" fontWeight="bold">{'\u6ee1'}</text>
        <text x="32" y="50" textAnchor="middle" fontSize="6.5" fill="#3d1c00" fontFamily="serif" fontWeight="bold">{'\u6587'}</text>
        <text x="16" y="34" textAnchor="middle" fontSize="5.5" fill="#4a2a05" fontFamily="serif">{'\u5b9d'}</text>
        <text x="48" y="34" textAnchor="middle" fontSize="5.5" fill="#4a2a05" fontFamily="serif">{'\u6cc9'}</text>
      </>)}
      <circle cx="32" cy="32" r="28" fill="url(#cch)"/>
      <circle cx="32" cy="32" r="29" fill="none" stroke="#4a2a05" strokeWidth="0.4" strokeDasharray="2 6" opacity="0.35"/>
    </svg>
  );
}
"""

# --- New tossing animation JSX ---
new_tossing = r"""      {/* ── STEP 3: TOSSING ── */}
      {step==='tossing'&&(<div className="pt-6">
        <div className="flex items-center justify-between mb-2"><div/><p className="text-xs tracking-[0.1em]" style={{color:'#86868b'}}>第 {Math.min(round,6)} / 6 爻</p><div style={{width:40}}/></div>
        <div className="mb-8 mx-auto max-w-[280px]" style={{height:2,background:'rgba(0,0,0,0.06)',borderRadius:99,overflow:'hidden'}}><div style={{height:'100%',background:'#b2955d',borderRadius:99,width:(Math.min(round,6)/6*100)+'%',transition:'width 0.5s ease'}}/></div>

        <div className="relative flex flex-col items-center justify-center mb-8" style={{minHeight:320}}>
          {/* 龟壳 + 内部铜钱 */}
          {showShell&&anim!=='dropping'&&(
            <div style={{position:'relative',width:220,height:200}}>
              <TortoiseShell shaking={anim==='shaking'} size={220}/>
              {/* 铜钱在龟壳内 */}
              <div style={{position:'absolute',top:'45%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',gap:6,opacity:anim==='shaking'?0.9:0.6,transition:'opacity 0.3s'}}>
                {flipping ? (
                  [0,1,2].map(i=>(<div key={i} style={{animation:'coinRattle '+(0.15+i*0.05)+'s ease-in-out infinite',animationDelay:(i*0.08)+'s'}}><Coin face="字" sz={36} flipping={true}/></div>))
                ) : (
                  [0,1,2].map(i=>(<div key={i} style={{animation:anim==='entering'?'coinEnter 0.4s ease-out '+(i*0.1)+'s both':anim==='shaking'?'coinRattle 0.15s ease-in-out infinite':''}}><Coin face="字" sz={36}/></div>))
                )}
              </div>
              {anim==='shaking'&&<div style={{position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',whiteSpace:'nowrap'}}><span className="text-xs tracking-[0.15em]" style={{color:'#b2955d'}}>摇动中...</span></div>}
            </div>
          )}

          {/* 铜钱飞出落地 */}
          {coins.length===3&&anim==='dropping'&&(
            <div className="flex gap-6 justify-center mt-4">
              {coins.map((face,i)=>(<div key={i} style={{animation:'coinDrop '+(0.5+i*0.08)+'s ease-out both'}}><Coin face={face} sz={64} flipping={false}/></div>))}
            </div>
          )}

          {/* 结果 */}
          {anim==='result'&&records.length>0&&(()=>{const last=records[records.length-1];return(<div className="mt-6 text-center animate-ink-in"><p className="text-xs tracking-[0.1em]" style={{color:'#86868b'}}>{YAO_NAMES[last.position-1]}</p><p className="text-xl font-serif mt-1" style={{color:last.isDong?'#b2955d':'#1d1d1f'}}>{last.label}{last.isDong&&<span className="text-xs ml-1.5 tracking-[0.1em]" style={{color:'#b2955d'}}>动爻</span>}</p><div className="mt-2 flex justify-center">{line(last.value,70)}</div><p className="text-[10px] mt-1.5" style={{color:'#c7c7cc'}}>{coinSummary(last.coins)}</p></div>);})()}

          {/* 排盘中 */}
          {anim==='arranging'&&(<div className="text-center animate-ink-in"><div className="relative mx-auto" style={{width:80,height:80}}><div className="absolute inset-0 rounded-full border border-[#b2955d]/20 animate-spin" style={{animationDuration:'3s'}}/><div className="absolute inset-[8px] rounded-full border border-[#b2955d]/10 animate-spin" style={{animationDuration:'2s',animationDirection:'reverse',borderStyle:'dashed'}}/><div className="absolute inset-0 flex items-center justify-center text-3xl opacity-60">☯</div></div><p className="text-xs tracking-[0.15em] mt-4" style={{color:'#b2955d'}}>排盘中...</p><p className="text-[10px] mt-1" style={{color:'#c7c7cc'}}>正在计算纳甲、世应、六亲</p></div>)}

          {/* 准备中 */}
          {anim==='idle'&&round===0&&autoRunning&&(<div className="text-center"><div className="relative mx-auto" style={{width:60,height:60}}><div className="absolute inset-0 rounded-full border border-[#b2955d]/20 animate-spin"/></div><p className="text-xs mt-3 tracking-[0.1em]" style={{color:'#86868b'}}>准备起卦...</p></div>)}
        </div>

        {/* 卦象记录 */}
        {records.length>0&&(<div style={card}><p className="text-[10px] tracking-[0.15em] mb-3 text-center" style={{color:'#c7c7cc'}}>卦象记录（从下往上）</p><div className="space-y-1">{[...records].reverse().map((r,i)=>(<div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg" style={{background:i===0?'rgba(178,149,93,0.06)':'transparent'}}><span className="text-xs w-8" style={{color:'#86868b'}}>{YAO_NAMES[r.position-1]}</span><span className="flex-1 text-sm font-serif" style={{color:r.isDong?'#b2955d':'#1d1d1f'}}>{r.label}</span><span className="text-[10px]" style={{color:r.isDong?'#b2955d':'#c7c7cc'}}>{coinSummary(r.coins)}</span></div>))}</div></div>)}
      </div>)}"""

# --- Enhanced keyframes ---
new_keyframes = """    <style jsx global>{`@keyframes shellShake{0%,100%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-8px) rotate(-5deg)}30%{transform:translateX(10px) rotate(4deg)}45%{transform:translateX(-6px) rotate(-2deg)}60%{transform:translateX(8px) rotate(5deg)}75%{transform:translateX(-3px) rotate(-1deg)}}@keyframes coinFlip3D{0%{transform:rotateY(0deg)}25%{transform:rotateY(90deg)}50%{transform:rotateY(180deg)}75%{transform:rotateY(270deg)}100%{transform:rotateY(360deg)}}@keyframes coinRattle{0%,100%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(4px,-2px) rotate(15deg)}50%{transform:translate(-3px,1px) rotate(-10deg)}75%{transform:translate(2px,3px) rotate(8deg)}}@keyframes coinEnter{0%{transform:translateY(-30px) scale(0.3);opacity:0}60%{transform:translateY(3px) scale(1.05);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}@keyframes coinDrop{0%{transform:translateY(-120px) scale(.5) rotate(0deg);opacity:0}40%{transform:translateY(-60px) scale(.6) rotate(180deg);opacity:1}70%{transform:translateY(8px) scale(1.04) rotate(350deg)}85%{transform:translateY(-3px) scale(.97) rotate(360deg)}100%{transform:translateY(0) scale(1) rotate(360deg)}}@keyframes coinBounce{0%{transform:translateY(0)}30%{transform:translateY(-15px)}50%{transform:translateY(0)}70%{transform:translateY(-6px)}100%{transform:translateY(0)}}`}</style>"""

# --- Apply replacements ---

# 1. Replace old Coin component (lines 154-181, 0-based: 153-180) with new components
old_coin = "\n".join(lines[153:181])
# Verify it contains Coin
assert "function Coin" in old_coin, "Old coin section not found!"

new_lines = lines[:153] + [new_components] + lines[181:]
print(f"After coin replacement: {len(new_lines)} lines")

# 2. Replace tossing JSX (lines 389-414, 0-based: 388-413)
old_tossing = "\n".join(lines[388:414])
assert "TOSSING" in old_tossing or "tossing" in old_tossing, "Old tossing section not found!"

new_lines = new_lines[:388] + [new_tossing] + new_lines[414:]
print(f"After tossing replacement: {len(new_lines)} lines")

# 3. Replace keyframes (line 475, 0-based: 474)
old_kf = new_lines[474]
assert "shellShake" in old_kf, "Old keyframes not found!"
new_lines[474] = new_keyframes
print(f"After keyframes replacement: {len(new_lines)} lines")

# Write the file
result = "\n".join(new_lines)
with open(path, "w", encoding="utf-8") as f:
    f.write(result)

print("File written successfully!")
print(f"Total lines: {len(new_lines)}")
