'use client';

import { useEffect, useRef, useState } from 'react';
import type { NaJiaYao } from '@/types/liuyao';

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
  const boxRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // 窄屏放不下五行列时不静默裁切：测出来就给出可滑动的明示（也是 harness 的断言锚点）
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // minWidth:0 是这条链上真正的开关：外层是 display:flex + justify-content:center，
    // flex item 默认 min-width:auto，不肯缩到内容宽以下，于是整个盘被撑到 min-content
    // 再向两侧溢出卡片（375px 实测六神列溢出到屏幕边缘）。给它宽度与 0 下限之后，
    // 溢出发生在 .liuyao-plate 自己身上 —— 那才是可以被滚动、也可以被断言的地方。
    <div style={{ maxWidth:560, margin:'0 auto', width:'100%', minWidth:0, position:'relative' }}>
    <div ref={boxRef} className="liuyao-plate" data-ly-overflow={overflowing?'1':'0'} style={{
      display:'grid',
      gridTemplateColumns:'44px 1fr 80px 80px 1fr',
      width:'100%',
      alignItems:'center',
      overflowX:'auto',
      fontFamily:'"PingFang SC","Microsoft YaHei",sans-serif',
    }}>
      {/* ===== Header: 本卦 / 变卦 titles ===== */}
      <div />
      <div style={{ padding:'16px 6px 10px 0',display:'grid',gridTemplateColumns:'minmax(34px,1fr) 24px 24px 24px 16px',gap:2,alignItems:'end',borderBottom:`1px solid ${sepColor}`,fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>
        <span>六亲</span><span>天干</span><span>地支</span><span>五行</span><span />
      </div>
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
      <div style={{ padding:'16px 0 10px 6px',display:'grid',gridTemplateColumns:'minmax(34px,1fr) 24px 24px 24px 16px',gap:2,alignItems:'end',borderBottom:`1px solid ${sepColor}`,fontSize:10,fontWeight:600,color:'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>
        <span>六亲</span><span>天干</span><span>地支</span><span>五行</span><span />
      </div>

      {/* ===== Six Yao rows ===== */}
      {naJiaResult.length===6 && [...naJiaResult].reverse().map((nj,i)=>{
        const pos = nj.position-1;
        const isDong = nj.isDong;
        const bn = bianNaJiaResult.length===6 ? [...bianNaJiaResult].reverse()[i] : null;
        const naGan = nj.naGan || nj.ganZhi.slice(0, 1);
        const naZhi = nj.naZhi || nj.ganZhi.slice(1, 2);
        const bianGan = bn ? (bn.naGan || bn.ganZhi.slice(0, 1)) : '';
        const bianZhi = bn ? (bn.naZhi || bn.ganZhi.slice(1, 2)) : '';
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
            <div aria-label={`本卦：六亲${nj.liuQin}，天干${naGan}，地支${naZhi}，五行${WX[naZhi] || '未标注'}`} style={{
              padding:'0 6px 0 0',height:rowH,display:'grid',gridTemplateColumns:'minmax(34px,1fr) 24px 24px 24px 16px',gap:2,alignItems:'center',
              borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:11,color:dongColor,whiteSpace:'nowrap',textAlign:'center' }}>{nj.liuQin}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:dongColor,whiteSpace:'nowrap',textAlign:'center' }}>{naGan}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:dongColor,whiteSpace:'nowrap',textAlign:'center' }}>{naZhi}</span>
              <span style={{ fontSize:11,color:'var(--color-text-secondary)',textAlign:'center' }}>{WX[naZhi]}</span>
              {nj.xunKong && <span data-ly-kong style={{ fontSize:11,color:'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>空</span>}
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
            <div aria-label={bn ? `变卦：六亲${bn.liuQin}，天干${bianGan}，地支${bianZhi}，五行${WX[bianZhi] || '未标注'}` : '无变卦纳甲信息'} style={{
              padding:'0 0 0 6px',height:rowH,display:'grid',gridTemplateColumns:'minmax(34px,1fr) 24px 24px 24px 16px',gap:2,alignItems:'center',
              borderBottom:bb,background:bg,
            }}>
              <span style={{ fontSize:11,color:bn?'var(--color-text-primary)':'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>{bn?bn.liuQin:'—'}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:bn?'var(--color-text-primary)':'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>{bn?bianGan:'—'}</span>
              <span style={{ fontSize:11,fontFamily:'"Noto Serif SC",serif',color:bn?'var(--color-text-primary)':'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>{bn?bianZhi:'—'}</span>
              <span style={{ fontSize:11,color:'var(--color-text-secondary)',textAlign:'center' }}>{bn?WX[bianZhi]:'—'}</span>
              {bn?.xunKong && <span data-ly-kong style={{ fontSize:11,color:'var(--color-text-secondary)',whiteSpace:'nowrap',textAlign:'center' }}>空</span>}
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
      {overflowing && (
        <p className="qn-cap" data-ly-overflow-hint style={{ textAlign:'center', margin:'6px 0 0' }}>盘面较宽，可左右滑动查看全部</p>
      )}
    </div>
  );
}
