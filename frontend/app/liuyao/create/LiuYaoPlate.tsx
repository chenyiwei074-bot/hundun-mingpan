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

// 六神配色是数据编码（青龙/朱雀/勾陈/螣蛇/白虎/玄武），与五行色同等冻结，不随重设计改动。
// 走 --color-shen-* 专用 token：只作圆点，不作文字色（11px/600 的彩度字过不了 AA）。
const SHEN: Record<string,string> = { '青龙':'龙','朱雀':'雀','勾陈':'勾','螣蛇':'蛇','白虎':'虎','玄武':'玄' };
const SHEN_C: Record<string,string> = { '青龙':'var(--color-shen-qinglong)','朱雀':'var(--color-shen-zhuque)','勾陈':'var(--color-shen-gouchen)','螣蛇':'var(--color-shen-tengshe)','白虎':'var(--color-shen-baihu)','玄武':'var(--color-shen-xuanwu)' };
const YAO_POS = ['初','二','三','四','五','上'];

function YaoLine({ v, dong, sy }: { v: number; dong: boolean; sy?: string }) {
  const isYang = v === 7 || v === 9;
  const lineColor = dong ? 'var(--color-accent-gold-dark)' : 'var(--color-text-primary)';
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
      {sy && <span style={{ fontSize:11,fontWeight:600,color:'var(--color-accent-gold-text)',minWidth:14,textAlign:'center' }}>{sy}</span>}
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
        <div style={{ fontSize:11,color:'var(--color-text-secondary)',letterSpacing:'0.12em',marginBottom:4 }}>本卦</div>
        <div style={{ fontSize:18,fontFamily:'"Noto Serif SC","STSong",serif',color:'var(--color-text-primary)',lineHeight:1.3 }}>{benName}</div>
        <div style={{ fontSize:11,color:'var(--color-text-secondary)',marginTop:3 }}>{gong}宫 · {gongWx}</div>
      </div>
      <div style={{ padding:'16px 0 10px',textAlign:'center',borderBottom:`1px solid ${sepColor}` }}>
        <div style={{ fontSize:11,color:'var(--color-text-secondary)',letterSpacing:'0.12em',marginBottom:4 }}>变卦</div>
        <div style={{ fontSize:18,fontFamily:'"Noto Serif SC","STSong",serif',color:bianName?'var(--color-text-primary)':'var(--color-text-secondary)',lineHeight:1.3 }}>{bianName||'—'}</div>
        {bianGong ? (
          <div style={{ fontSize:11,color:'var(--color-text-secondary)',marginTop:3 }}>{bianGong.gong}宫 · {WX[bianGong.gong]||''}</div>
        ) : (
          <div style={{ fontSize:11,color:'var(--color-text-secondary)',marginTop:3 }}>—</div>
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
        const dongColor = isDong ? 'var(--color-accent-gold-dark)' : 'var(--color-text-primary)';

        return (
          <div key={i} style={{ display:'contents' }}>
            {/* Col 1: 六神 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
              color:'var(--color-text-primary)',
              borderBottom:bb,background:bg,
            }}>
              <span style={{ width:6,height:6,borderRadius:'50%',flex:'0 0 auto',background:SHEN_C[ls]||'var(--color-hairline)' }} />
              <span style={{ fontSize:11,fontWeight:600,lineHeight:1 }}>{SHEN[ls]||'?'}</span>
            </div>

            {/* Col 2: 本卦 六亲+干支+五行 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',alignItems:'center',justifyContent:'flex-end',
              gap:6,paddingRight:10,borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:11,color:dongColor,whiteSpace:'nowrap' }}>{nj.liuQin}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:dongColor,whiteSpace:'nowrap' }}>{nj.ganZhi}</span>
              <span style={{ fontSize:11,color:'var(--color-text-secondary)' }}>{WX[nj.naZhi]}</span>
              {nj.xunKong && <span style={{ fontSize:11,color:'var(--color-text-secondary)',whiteSpace:'nowrap' }}>空</span>}
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
              {bn ? <YaoLine v={bn.value} dong={false} /> : <span style={{color:'var(--color-text-secondary)',fontSize:15}}>—</span>}
            </div>

            {/* Col 5: 变卦 六亲+干支+五行 */}
            <div style={{
              padding:'0',height:rowH,display:'flex',alignItems:'center',
              gap:6,paddingLeft:10,borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:11,color:bn?'var(--color-text-primary)':'var(--color-text-secondary)',whiteSpace:'nowrap' }}>{bn?bn.liuQin:'—'}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:bn?'var(--color-text-primary)':'var(--color-text-secondary)',whiteSpace:'nowrap' }}>{bn?bn.ganZhi:'—'}</span>
              <span style={{ fontSize:11,color:'var(--color-text-secondary)' }}>{bn?WX[bn.naZhi]:'—'}</span>
              {bn?.xunKong && <span style={{ fontSize:11,color:'var(--color-text-secondary)',whiteSpace:'nowrap' }}>空</span>}
            </div>
          </div>
        );
      })}

      {/* ===== Footer labels ===== */}
      <div />
      <div />
      <div style={{ padding:'6px 0',textAlign:'center',fontSize:11,color:'var(--color-text-secondary)',letterSpacing:'0.08em',borderTop:`1px solid ${sepColor}` }}>本卦</div>
      <div style={{ padding:'6px 0',textAlign:'center',fontSize:11,color:'var(--color-text-secondary)',letterSpacing:'0.08em',borderTop:`1px solid ${sepColor}` }}>变卦</div>
      <div />
    </div>
  );
}