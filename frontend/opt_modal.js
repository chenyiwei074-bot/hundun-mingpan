const fs = require('fs');
let t = fs.readFileSync('app/page.tsx', 'utf8');

// Header
t = t.replace('开始探索你的命理', '你想探索什么');
t = t.replace('选择功能</p>', '选择功能</p>\n            <p className=\"text-[13px] mb-6 text-center\" style={{ color: mute }}>混沌提供四种玄学工具，左右滑动选择</p>');

// Card icons
t = t.replace('{ href:"/bazi-chart", title:"八字 & 紫微", desc:"四柱 + 十二宫，一盘双参", tag:"" }',
  '{ href:"/bazi-chart", icon:"☯", title:"八字 & 紫微", desc:"四柱天干地支 + 十二宫排盘，一盘双参", tag:"" }');
t = t.replace('{ href:"/liuyao", title:"六爻问卦", desc:"金钱起卦，一事一问", tag:"" }',
  '{ href:"/liuyao", icon:"🪙", title:"六爻问卦", desc:"金钱起卦 · 六爻纳甲 · 即时断卦", tag:"" }');
t = t.replace('{ href:"#", title:"姓名合盘", desc:"五行适配 · 五格剖象", tag:"即将上线" }',
  '{ href:"#", icon:"💞", title:"姓名合盘", desc:"五行适配 · 五格剖象 · 缘分深析", tag:"即将上线" }');
t = t.replace('{ href:"#", title:"择日", desc:"黄道吉日 · 趋吉避凶", tag:"即将上线" }',
  '{ href:"#", icon:"📅", title:"择日", desc:"黄道吉日 · 嫁娶开业 · 趋吉避凶", tag:"即将上线" }');

// Icon in card
t = t.replace('<h3 className=\"font-serif font-bold text-lg tracking-[-0.01em] mb-2\" style={{ color: ink }}>{item.title}</h3>',
  '<span className=\"text-3xl mb-4 transition-transform duration-400 group-hover:scale-110\">{item.icon}</span>\n                      <h3 className=\"font-serif font-bold text-lg tracking-[-0.02em] mb-1.5\" style={{ color: ink }}>{item.title}</h3>');

// Tag -> conditional with divider for non-tag items
t = t.replace('{item.tag && <span className=\"text-[10px] font-medium tracking-[0.05em] px-2 py-0.5 rounded-full mb-2\" style={{ background: \'rgba(178,149,93,0.10)\', color: gold }}>{item.tag}</span>}',
  '{item.tag ? (\n                        <span className=\"text-[10px] font-medium tracking-[0.08em] px-2.5 py-0.5 rounded-full mb-2.5\" style={{ background: \"rgba(178,149,93,0.08)\", color: gold }}>{item.tag}</span>\n                      ) : (\n                        <div className=\"w-12 h-px mb-2.5\" style={{ background: \"rgba(178,149,93,0.25)\" }} />\n                      )}');

// CTA hint
t = t.replace('<div className=\"mt-auto transition-transform duration-300 group-hover:translate-y-1\" style={{ color: gold }}>\n                        <svg width=\"18\" height=\"18\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.5\"><path d=\"M6 3l5 5-5 5\"/></svg>\n                      </div>',
  '<div className=\"flex items-center gap-1 transition-all duration-300 group-hover:gap-2\" style={{ color: item.tag ? \"rgba(0,0,0,0.15)\" : gold }}>\n                        <span className=\"text-[12px] font-medium tracking-[0.05em]\">{item.tag ? \"敬请期待\" : \"开始探索\"}</span>\n                        <svg width=\"13\" height=\"13\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.5\"><path d=\"M6 3l5 5-5 5\"/></svg>\n                      </div>');

// Card bg white
t = t.replace('background: paper, border:', 'background: white, border:');
t = t.replace("'0 2px 16px rgba(0,0,0,0.03)'", '"0 2px 20px rgba(0,0,0,0.03)"');

// Card hover
t = t.replace('hover:translate-y-[-4px]', 'hover:translate-y-[-5px] hover:shadow-lg');

// Text size
t = t.replace("text-[13px] leading-relaxed mb-5", "text-[12px] leading-relaxed mb-4 flex-1");

// Blur
t = t.replace(/blur\(8px\)/g, 'blur(12px)');

// Arrow buttons
t = t.replace('className=\"absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all\"',
  'className=\"absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95\"');
t = t.replace('className=\"absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all\"',
  'className=\"absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95\"');

// Dots clickable
t = t.replace(/<div className=\"flex justify-center gap-1\.5 mt-5\">\n\s*\{\[0,1,2,3\]\.map\(i => \(\n\s*<div[^>]*>\n\s*<div[^>]*><\/div>\n\s*<\/div>\n\s*\)\)\}\n\s*<\/div>/m,
  '<div className=\"flex justify-center gap-2 mt-5\">\n              {[0,1,2,3].map(i => (\n                <button key={i} onClick={() => { const el = document.getElementById(\"launcher-scroll\"); if(el) el.scrollTo({left: i*244, behavior:\"smooth\"}) }}\n                  className=\"w-2 h-2 rounded-full transition-all duration-300 hover:scale-125\"\n                  style={{ background: gold, opacity: 0.3 }} />\n              ))}\n            </div>');

// Arrow border
t = t.replace(/border: '0\.5px solid ' \+ hair, boxShadow: '0 2px 8px rgba\(0,0,0,0\.06\)'/g,
  "border: '1px solid rgba(178,149,93,0.15)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)'");

// Arrow SVG stroke width  
t = t.replace(/stroke=\{gold\} strokeWidth=\"1.5\"><path d=\"M6 3l5 5-5 5\"/g,
  'stroke={gold} strokeWidth=\"2\"><path d=\"M6 3l5 5-5 5\"');
t = t.replace(/stroke=\{gold\} strokeWidth=\"1.5\"><path d=\"M10 3l-5 5 5 5\"/g,
  'stroke={gold} strokeWidth=\"2\"><path d=\"M10 3l-5 5 5 5\"');

// Close button  
t = t.replace('className=\"absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-colors\"',
  'className=\"absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:bg-[rgba(0,0,0,0.04)]\"');

fs.writeFileSync('app/page.tsx', t, 'utf8');
console.log('Optimization done');
