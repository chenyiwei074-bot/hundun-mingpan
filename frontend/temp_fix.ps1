$f = "C:\Users\Kobe\Documents\HDAI\frontend\app\page.tsx"
$enc = [System.Text.UTF8Encoding]::new($false)
$lines = [System.Collections.ArrayList]::new([System.IO.File]::ReadAllLines($f, $enc))

# 1. Header + subtitle
$lines[732] = '            <p className="text-[10px] tracking-[0.25em] font-semibold mb-3 text-center" style={{ color: gold }}>选择功能</p>'
$lines[733] = '            <h2 className="font-serif font-bold tracking-[-0.03em] leading-[1.15] mb-2 text-center"'
$lines[734] = "              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', color: ink }}>你想探索什么</h2>"
$lines.Insert(735, '            <p className="text-[13px] mb-6 text-center" style={{ color: mute }}>混沌提供四种玄学工具，左右滑动选择</p>')

# 2. Card data - icons
$lines[749] = '                  { href:"/bazi-chart", icon:"☯", title:"八字 & 紫微", desc:"四柱天干地支 + 十二宫排盘，一盘双参", tag:"" },'
$lines[750] = '                  { href:"/liuyao", icon:"🪙", title:"六爻问卦", desc:"金钱起卦 · 六爻纳甲 · 即时断卦", tag:"" },'
$lines[751] = '                  { href:"#", icon:"💞", title:"姓名合盘", desc:"五行适配 · 五格剖象 · 缘分深析", tag:"即将上线" },'
$lines[752] = '                  { href:"#", icon:"📅", title:"择日", desc:"黄道吉日 · 嫁娶开业 · 趋吉避凶", tag:"即将上线" },'

# 3. Card content
$lines[758] = '                    <div className="snap-center shrink-0 w-[180px] sm:w-[200px] rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-400 hover:translate-y-[-5px] hover:shadow-lg cursor-pointer"'
$lines[759] = '                      style={{ background: white, border: "0.5px solid '' + hair + ''", boxShadow: "0 2px 20px rgba(0,0,0,0.03)" }}>'
$lines[760] = '                      <span className="text-3xl mb-4 transition-transform duration-400 group-hover:scale-110">{item.icon}</span>'
$lines[761] = '                      <h3 className="font-serif font-bold text-lg tracking-[-0.02em] mb-1.5" style={{ color: ink }}>{item.title}</h3>'
$lines[762] = '                      {item.tag ? ('
$lines[763] = '                        <span className="text-[10px] font-medium tracking-[0.08em] px-2.5 py-0.5 rounded-full mb-2.5" style={{ background: "rgba(178,149,93,0.08)", color: gold }}>{item.tag}</span>'
$lines[764] = '                      ) : ('
$lines[765] = '                        <div className="w-12 h-px mb-2.5" style={{ background: "rgba(178,149,93,0.25)" }} />'
$lines[766] = '                      )}'
$lines[767] = '                      <p className="text-[12px] leading-relaxed mb-4 flex-1" style={{ color: mute }}>{item.desc}</p>'
$lines[768] = '                      <div className="flex items-center gap-1 transition-all duration-300 group-hover:gap-2" style={{ color: item.tag ? "rgba(0,0,0,0.15)" : gold }}>'
$lines[769] = '                        <span className="text-[12px] font-medium tracking-[0.05em]">{item.tag ? "敬请期待" : "开始探索"}</span>'
$lines[770] = '                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l5 5-5 5"/></svg>'
$lines[771] = '                      </div>'

# 4. Arrow buttons
$lines[741] = '                className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"'
$lines[742] = "                style={{ background: white, border: '1px solid rgba(178,149,93,0.15)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>"
$lines[743] = '                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M10 3l-5 5 5 5"/></svg>'

# Right arrow - find it
for ($i = 772; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "Right arrow") { $ra = $i+1; break } }
$lines[$ra] = '                className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"'
$lines[$ra+1] = "                style={{ background: white, border: '1px solid rgba(178,149,93,0.15)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>"
$lines[$ra+2] = '                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={gold} strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>'

# 5. Close button
$lines[730] = '              className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-[rgba(0,0,0,0.04)]"'

# 6. Blur
$lines[722] = "          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}"

# 7. Interactive dots
for ($i = 772; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "Dots indicator") { $ds = $i+1; break } }
for ($j = 0; $j -lt 5; $j++) { $lines.RemoveAt($ds) }
$lines.Insert($ds, '              {[0,1,2,3].map(i => (')
$lines.Insert($ds+1, '                <button key={i} onClick={() => { const el = document.getElementById("launcher-scroll"); if(el) el.scrollTo({left: i*244, behavior:"smooth"}) }}')
$lines.Insert($ds+2, '                  className="w-2 h-2 rounded-full transition-all duration-300 hover:scale-125"')
$lines.Insert($ds+3, '                  style={{ background: gold, opacity: 0.3 }} />')
$lines.Insert($ds+4, '              ))}')

[System.IO.File]::WriteAllLines($f, $lines, $enc)
Write-Output "Done"
