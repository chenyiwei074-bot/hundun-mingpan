const fs = require("fs");
let t = fs.readFileSync("app/page.tsx", "utf8");

// 1. Fix heading order  
t = t.replace(
  '<p className="text-[11px] tracking-[0.2em] font-semibold mb-2 text-center" style={{ color: gold }}>选择功能</p>\n            <p className="text-[13px] mb-6 text-center" style={{ color: mute }}>混沌提供四种玄学工具，左右滑动选择</p>\n            <h2 className="font-serif font-bold tracking-[-0.02em] leading-[1.12] mb-6 text-center"',
  '<p className="text-[10px] tracking-[0.25em] font-semibold mb-3 text-center" style={{ color: gold }}>选择功能</p>\n            <h2 className="font-serif font-bold tracking-[-0.03em] leading-[1.2] mb-2 text-center"'
);

// Fix h2 closing + add subtitle after
t = t.replace(
  "style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', color: ink }}>你想探索什么</h2>",
  "style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', color: ink }}>你想探索什么</h2>\n            <p className=\"text-[12px] mb-6 text-center\" style={{ color: mute }}>左右滑动，选择你想使用的玄学工具</p>"
);

// 2. Icon ring
t = t.replace(
  '<span className="text-3xl mb-4 transition-transform duration-400 group-hover:scale-110">{item.icon}</span>',
  '<div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center transition-transform duration-400 group-hover:scale-105" style={{ background: "rgba(178,149,93,0.05)" }}><span className="text-2xl leading-none">{item.icon}</span></div>'
);

// 3. CTA text + arrow
t = t.replace(
  '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3l5 5-5 5"/></svg>',
  '<span className="text-[13px] font-medium tracking-[0.03em]">进入</span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>'
);

// 4. Better descriptions
t = t.replace('desc:"四柱天干地支 + 十二宫排盘，一盘双参"', 'desc:"四柱天干地支 + 十二宫排盘。大运流年、主星四化，一盘双参。"');
t = t.replace('desc:"金钱起卦 · 六爻纳甲 · 即时断卦"', 'desc:"金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。"');
t = t.replace('desc:"五行适配 · 五格剖象 · 缘分深析"', 'desc:"二人姓名，五行适配。天格地格人格外格总格，五格剖象，深析缘分。"');
t = t.replace('desc:"黄道吉日 · 嫁娶开业 · 趋吉避凶"', 'desc:"黄道吉日，天时地利。嫁娶开业搬家出行，择最优时日，趋吉避凶。"');

// 5. Card hover - subtle
t = t.replace("hover:translate-y-[-5px] hover:shadow-lg", "hover:shadow-md");

// 6. Arrows
t = t.replace(/w-10 h-10/g, "w-9 h-9");
t = t.replace(/left: -280/g, "left: -300");
t = t.replace(/left: 280/g, "left: 300");
t = t.replace(/i\*244/g, "i*310");

// 7. Modal shadow
t = t.replace("'0 40px 100px rgba(0,0,0,0.25)'", "'0 40px 100px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(178,149,93,0.06)'");

fs.writeFileSync("app/page.tsx", t, "utf8");
console.log("Done");
