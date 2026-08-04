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
const YAO_POS = ['初','二','三','四','五','上'];

function YaoLine({ v, dong, sy }: { v: number; dong: boolean; sy?: string }) {
  const isYang = v === 7 || v === 9;
  const lineColor = dong ? '#b2955d' : '#1d1d1f';
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:4,minWidth:56,justifyContent:'center' }}>
      {isYang ? (
        <span style={{ display:'inline-block',width:40,height:3,background:lineColor,borderRadius:99 }} />
      ) : (
        <span style={{ display:'inline-flex',gap:8,alignItems:'center' }}>
          <span style={{ display:'inline-block',width:16,height:3,background:lineColor,borderRadius:99 }} />
          <span style={{ display:'inline-block',width:16,height:3,background:lineColor,borderRadius:99 }} />
        </span>
      )}
      {sy && <span style={{ fontSize:10,fontWeight:600,color:'#b2955d',minWidth:14,textAlign:'center' }}>{sy}</span>}
    </span>
  );
}

export default function LiuYaoPlate(p: Props) {
  const { benName, bianName, gong, gongWx, bianGong, naJiaResult, bianNaJiaResult, liuShenList, WX } = p;
  const sepColor = 'rgba(0,0,0,0.05)';
  const rowH = 44; // fixed row height in px

  return (
    <div className="liuyao-plate" style={{
      display:'grid',
      gridTemplateColumns:'44px 1fr 80px 80px 1fr',
      maxWidth:560,
      margin:'0 auto',
      alignItems:'center',
      overflowX:'auto',
      fontFamily:'"PingFang SC","Microsoft YaHei",sans-serif',
    }}>
      {/* ===== Header: 本卦 / 变卦 titles ===== */}
      <div />
      <div />
      <div style={{ padding:'16px 0 10px',textAlign:'center',borderBottom:`1px solid ${sepColor}` }}>
        <div style={{ fontSize:10,color:'#86868b',letterSpacing:'0.12em',marginBottom:4 }}>本卦</div>
        <div style={{ fontSize:18,fontFamily:'"Noto Serif SC","STSong",serif',color:'#1d1d1f',lineHeight:1.3 }}>{benName}</div>
        <div style={{ fontSize:10,color:'#86868b',marginTop:3 }}>{gong}宫 · {gongWx}</div>
      </div>
      <div style={{ padding:'16px 0 10px',textAlign:'center',borderBottom:`1px solid ${sepColor}` }}>
        <div style={{ fontSize:10,color:'#86868b',letterSpacing:'0.12em',marginBottom:4 }}>变卦</div>
        <div style={{ fontSize:18,fontFamily:'"Noto Serif SC","STSong",serif',color:bianName?'#1d1d1f':'#c7c7cc',lineHeight:1.3 }}>{bianName||'—'}</div>
        {bianGong ? (
          <div style={{ fontSize:10,color:'#86868b',marginTop:3 }}>{bianGong.gong}宫 · {WX[bianGong.gong]||''}</div>
        ) : (
          <div style={{ fontSize:10,color:'#c7c7cc',marginTop:3 }}>—</div>
        )}
      </div>
      <div />

      {/* ===== Six Yao rows ===== */}
      {naJiaResult.length===6 && [...naJiaResult].reverse().map((nj,i)=>{
        const pos = nj.position-1;
        const isDong = nj.isDong;
        const bn = bianNaJiaResult.length===6 ? [...bianNaJiaResult].reverse()[i] : null;
        const ls = liuShenList[pos];
        const isLast = i===5;
        const bb = isLast?'none':`1px solid ${sepColor}`;
        const bg = isDong?'rgba(178,149,93,0.03)':'transparent';
        const dongColor = isDong ? '#b2955d' : '#1d1d1f';

        return (
          <div key={i} style={{ display:'contents' }}>
            {/* Col 1: 六神 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:12,fontWeight:600,color:SHEN_C[ls]||'#86868b',
              borderBottom:bb,background:bg,
            }}>
              {SHEN[ls]||'?'}
            </div>

            {/* Col 2: 本卦 六亲+干支+五行 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',alignItems:'center',justifyContent:'flex-end',
              gap:6,paddingRight:10,borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:12,color:dongColor,whiteSpace:'nowrap' }}>{nj.liuQin}</span>
              <span style={{ fontSize:12,fontFamily:'"Noto Serif SC",serif',color:dongColor,whiteSpace:'nowrap' }}>{nj.ganZhi}</span>
              <span style={{ fontSize:10,color:'#86868b' }}>{WX[nj.naZhi]}</span>
            </div>

            {/* Col 3: 本卦爻象 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',justifyContent:'center',alignItems:'center',
              borderBottom:bb,background:bg,
            }}>
              <YaoLine v={nj.value} dong={isDong} sy={nj.shiYing} />
            </div>

            {/* Col 4: 变卦爻象 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',justifyContent:'center',alignItems:'center',
              borderBottom:bb,background:bg,
            }}>
              {bn ? <YaoLine v={bn.value} dong={false} /> : <span style={{color:'#c7c7cc',fontSize:16}}>—</span>}
            </div>

            {/* Col 5: 变卦 六亲+干支+五行 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',alignItems:'center',
              gap:6,paddingLeft:10,borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:12,color:bn?'#1d1d1f':'#c7c7cc',whiteSpace:'nowrap' }}>{bn?bn.liuQin:'—'}</span>
              <span style={{ fontSize:12,fontFamily:'"Noto Serif SC",serif',color:bn?'#1d1d1f':'#c7c7cc',whiteSpace:'nowrap' }}>{bn?bn.ganZhi:'—'}</span>
              <span style={{ fontSize:10,color:'#86868b' }}>{bn?WX[bn.naZhi]:'—'}</span>
            </div>
          </div>
        );
      })}

      {/* ===== Footer labels ===== */}
      <div />
      <div />
      <div style={{ padding:'6px 0',textAlign:'center',fontSize:10,color:'#2e8b57',letterSpacing:'0.08em',borderTop:`1px solid ${sepColor}` }}>本卦</div>
      <div style={{ padding:'6px 0',textAlign:'center',fontSize:10,color:'#2e8b57',letterSpacing:'0.08em',borderTop:`1px solid ${sepColor}` }}>变卦</div>
      <div />
    </div>
  );
}