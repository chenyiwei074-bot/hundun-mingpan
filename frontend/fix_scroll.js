const fs = require('fs');
let t = fs.readFileSync('app/page.tsx', 'utf8');
t = t.replace(
  'onClick={() => setShowLauncher(true)} className=\"cta-btn inline-flex',
  'onClick={() => { window.scrollTo({top:0,behavior:\"smooth\"}); setTimeout(() => setShowLauncher(true), 600) }} className=\"cta-btn inline-flex'
);
fs.writeFileSync('app/page.tsx', t, 'utf8');
console.log('Done');
