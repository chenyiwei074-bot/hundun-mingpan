import { GUA_MAP, S64 } from './constants';

export function getGua(values: number[]): {
  ben: string; bian: string | null; dong: number[]; shangGua: string; xiaGua: string;
} {
  const bBits = values.map(v => v===7||v===9?'1':'0');
  const vBits = values.map(v => v===9?'0':v===6?'1':(v===7||v===9?'1':'0'));
  const dong = values.map((v,i) => (v===6||v===9)?i+1:-1).filter(i=>i>0);
  const s3 = bBits[5]+bBits[4]+bBits[3], x3 = bBits[2]+bBits[1]+bBits[0];
  const s = GUA_MAP[s3]||'?', x = GUA_MAP[x3]||'?';
  const benGua = S64[s+x]||s+x;
  let bianGua: string|null = null;
  if(dong.length>0){
    const bs3=vBits[5]+vBits[4]+vBits[3],bx3=vBits[2]+vBits[1]+vBits[0];
    const bs=GUA_MAP[bs3]||'?',bx=GUA_MAP[bx3]||'?';
    bianGua=S64[bs+bx]||bs+bx;
  }
  return {ben:benGua,bian:bianGua,dong,shangGua:s,xiaGua:x};
}
