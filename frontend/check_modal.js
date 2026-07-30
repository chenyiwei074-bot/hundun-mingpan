const fs = require('fs');
const nm = fs.readFileSync('modal_new.txt', 'utf8');
const lines = nm.split('\n');
console.log('Total lines:', lines.length);
console.log('Line 1:', lines[0].substring(0, 60));
// Check for issues
const hasDoubleEsc = nm.includes('''''''');
const hasBackslash = nm.includes('\\\"');
console.log('Double-escaped:', hasDoubleEsc);
console.log('Backslash-quotes:', hasBackslash);
