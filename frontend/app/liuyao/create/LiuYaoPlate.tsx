'use client';

type NaJiaYao = {
  position: number; value: number; label: string; isDong: boolean;
  naGan: string; naZhi: string; ganZhi: string;
  liuQin: string; shiYing: string; xunKong: boolean;
};

interface Props {
  benName: string;
  bianName: string | null;
  gong: string;
  gongWx: string;
  bianGong: { gong: string } | null;
  naJiaResult: NaJiaYao[];
  bianNaJiaResult: NaJiaYao[];
  liuShenList: string[];
  WX: Record<string,string>;
}

const SHEN: Record<string,string> = { '青龙':'龙','朱雀':'雀','勾陈':'勾','螣蛇':'蛇','白虎':'虎','玄武':'玄' };
const SHEN_C: Record<string,string> = { '青龙':'#2e8b57','朱雀':'#d93a3a','勾陈':'#cfa972','螣蛇':'#d4544a','白虎':'#86868b','玄武':'#1d1d1f' };

function YaoLine({ v, dong, sy }: { v: number; dong: boolean; sy?: string }) {
  const c = dong ? '#b2955d' : '#1d1d1f';
  const isYang = v === 7 || v === 9;
  const dongMark = dong ? (v === 9 ? '○' : '×') : null;
  return (
    <span style={{ display:'inline-flex',alignItems:'center',verticalAlign:'middle',gap:3 }}>
      {isYang ? (
        <span style={{ display:'inline-block',width:44,height:4,background:c,borderRadius:99 }} />
      ) : (
        <span style={{ display:'inline-flex',alignItems:'center',gap:10 }}>
          <span style={{ display:'inline-block',width:17,height:4,background:c,borderRadius:99 }} />
          <span style={{ display:'inline-block',width:17,height:4,background:c,borderRadius:99 }} />
        </span>
      )}
      {dongMark && <span style={{ fontSize:11,fontWeight:700,color:'#b2955d' }}>{dongMark}</span>}
      {sy && <span style={{ fontSize:11,marginLeft:4,fontWeight:500,color:'#b2955d' }}>{sy}</span>}
    </span>
  );
}

export default function LiuYaoPlate(p: Props) {
  const { benName, bianName, gong, gongWx, bianGong, naJiaResult, bianNaJiaResult, liuShenList, WX } = p;
  const cellBb = '1px solid rgba(0,0,0,0.04)';

  return (
    <div style={{ display:'grid',gridTemplateColumns:'60px 130px 100px 100px 130px',alignItems:'center' }}>
      {/* === Header row (5 cells, disp:contents) === */}
      <div style={{ display:'contents' }}>
        <div />
        <div />
        <div style={{ padding:'16px 4px 12px',textAlign:'center',borderBottom:'1px solid rgba(0,0,0,0.06)',borderRight:'1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ margin:0,fontSize:10,color:'#86868b',letterSpacing:'0.15em' }}>本卦</p>
          <p style={{ margin:0,fontSize:18,fontFamily:'serif',color:'#1d1d1f',marginTop:3 }}>{benName}</p>
          <p style={{ margin:0,fontSize:10,color:'#86868b',marginTop:2 }}>{gong}宫 · {gongWx}</p>
        </div>
        <div style={{ padding:'16px 4px 12px',textAlign:'center',borderBottom:'1px solid rgba(0,0,0,0.06)',opacity:bianName?1:0.4 }}>
          <p style={{ margin:0,fontSize:10,color:'#86868b',letterSpacing:'0.15em' }}>变卦</p>
          <p style={{ margin:0,fontSize:18,fontFamily:'serif',color:bianName?'#1d1d1f':'#c7c7cc',marginTop:3 }}>{bianName||'—'}</p>
          {bianGong ? (
            <p style={{ margin:0,fontSize:10,color:'#86868b',marginTop:2 }}>{bianGong.gong}宫 · {WX[bianGong.gong]}</p>
          ) : (
            <p style={{ margin:0,fontSize:10,color:'#c7c7cc',marginTop:2 }}>—</p>
          )}
        </div>
        <div />
      </div>

      {/* === Six Yao rows === */}
      {naJiaResult.length===6&&[...naJiaResult].reverse().map((nj,i)=>{
        const pos = nj.position-1;
        const isDong = nj.isDong;
        const bn = bianNaJiaResult.length===6 ? [...bianNaJiaResult].reverse()[i] : null;
        const ls = liuShenList[pos];
        const isLast = i===5;
        const bb = isLast?'none':cellBb;
        const bg = isDong?'rgba(178,149,93,0.02)':'transparent';
        return (
          <div key={i} style={{ display:'contents' }}>
            <div style={{ padding:'10px 0',fontSize:11,color:SHEN_C[ls]||'#86868b',fontWeight:500,textAlign:'center',borderBottom:bb,background:bg }}>
              {SHEN[ls]||'?'}
            </div>
            <div style={{ padding:'10px 0',display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,paddingRight:12,borderBottom:bb,background:bg }}>
              <span style={{ fontSize:12,color:isDong?'#b2955d':'#1d1d1f',whiteSpace:'nowrap' }}>{nj.liuQin}</span>
              <span style={{ fontSize:12,fontFamily:'serif',color:'#1d1d1f',whiteSpace:'nowrap' }}>{nj.ganZhi}</span>
              <span style={{ fontSize:10,color:'#86868b' }}>{WX[nj.naZhi]}</span>
            </div>
            <div style={{ padding:'10px 0',display:'flex',justifyContent:'center',alignItems:'center',borderBottom:bb,background:bg,borderRight:'1px solid rgba(0,0,0,0.06)' }}>
              <YaoLine v={nj.value} dong={isDong} sy={nj.shiYing} />
            </div>
            <div style={{ padding:'10px 0',display:'flex',justifyContent:'center',alignItems:'center',borderBottom:bb,background:bg,opacity:bn?1:0.2 }}>
              {bn ? <YaoLine v={bn.value} dong={false} /> : <span style={{ color:'#c7c7cc',fontSize:16 }}>—</span>}
            </div>
            <div style={{ padding:'10px 0',display:'flex',alignItems:'center',gap:8,paddingLeft:12,borderBottom:bb,background:bg }}>
              <span style={{ fontSize:12,color:bn?'#1d1d1f':'#c7c7cc',whiteSpace:'nowrap' }}>{bn?bn.liuQin:'—'}</span>
              <span style={{ fontSize:12,fontFamily:'serif',color:bn?'#1d1d1f':'#c7c7cc',whiteSpace:'nowrap' }}>{bn?bn.ganZhi:'—'}</span>
              <span style={{ fontSize:10,color:'#86868b' }}>{bn?WX[bn.naZhi]:'—'}</span>
            </div>
          </div>
        );
      })}

      {/* === Footer row === */}
      <div style={{ display:'contents' }}>
        <div />
        <div />
        <div style={{ padding:'6px 0',textAlign:'center',fontSize:10,color:'#2e8b57',letterSpacing:'0.1em',borderTop:'1px solid rgba(0,0,0,0.06)',borderRight:'1px solid rgba(0,0,0,0.06)' }}>本卦</div>
        <div style={{ padding:'6px 0',textAlign:'center',fontSize:10,color:'#2e8b57',letterSpacing:'0.1em',borderTop:'1px solid rgba(0,0,0,0.06)' }}>变卦</div>
        <div />
      </div>
    </div>
  );
}
