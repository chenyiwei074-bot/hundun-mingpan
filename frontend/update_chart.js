const fs = require("fs");
const f = "components/bazi/BaziChart.tsx";
let t = fs.readFileSync(f, "utf8");

// Remove the outer min-h-screen and background (page handles it now)
t = t.replace(
  '<div className={`min-h-screen ${className}`} style={{ background: "#f5f5f7" }}>',
  '<div className={className}>'
);

// Change end text
t = t.replace(
  '混沌 · 八字命盘 — 古籍数字化 · 仅供参考',
  ''
);

fs.writeFileSync(f, t, "utf8");
console.log("BaziChart updated");
