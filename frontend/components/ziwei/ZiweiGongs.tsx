"use client";

import { useInView } from "@/components/bazi/animations";
import { colors } from "@/components/bazi/tokens";

interface GongData {
  gong: string; tiangan?: string; dizhi?: string;
  mainStars?: string[]; auxStars?: string[];
  sihua?: Array<{ star: string; hua: string }>;
  ziHua?: Array<{ star: string; hua: string; effect?: string }>;
  daXian?: { startAge: number; endAge: number; isCurrent?: boolean; daXianGongName?: string };
}

interface ZiweiGongsProps { gongs: GongData[]; mingGongIndex?: number; shenGongIndex?: number; liuNianAge?: number; }

const GL: Record<string,string>={"命宫":"命","兄弟宫":"兄弟","夫妻宫":"夫妻","子女宫":"子女","财帛宫":"财帛","疾厄宫":"疾厄","迁移宫":"迁移","交友宫":"交友","官禄宫":"官禄","田宅宫":"田宅","福德宫":"福德","父母宫":"父母"};
const SC: Record<string,string>={"紫微":colors.accent,"天府":colors.accent,"七杀":"#d30505","破军":"#d30505","贪狼":"#07a830","天相":"#2e83f6"};
const DZ: Record<string,{r:number;c:number}>={"寅":{r:1,c:1},"卯":{r:1,c:2},"辰":{r:1,c:3},"巳":{r:1,c:4},"丑":{r:2,c:1},"午":{r:2,c:4},"子":{r:3,c:1},"未":{r:3,c:4},"亥":{r:4,c:1},"戌":{r:4,c:2},"酉":{r:4,c:3},"申":{r:4,c:4}};

export function ZiweiGongs({ gongs, mingGongIndex=0, shenGongIndex, liuNianAge=0 }: ZiweiGongsProps) {
  const { ref, inView } = useInView(0.05);
  if(!gongs||gongs.length===0) return null;
  const byDz=new Map<string,GongData>(); gongs.forEach(g=>{if(g.dizhi)byDz.set(g.dizhi,g);});

  return (
    <div ref={ref}>
      {/* 回字形网格 — 1px hairline gap */}
      <div className="px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-4 max-w-lg mx-auto" style={{gap:"1px",background:colors.hairline}}>
          {[1,2,3,4].map(row=>[1,2,3,4].map(col=>{
            // 中心区
            if(row>=2&&row<=3&&col>=2&&col<=3){
              if(row===2&&col===2) return (<div key="center" className="row-span-2 col-span-2 bg-white" />);
              return null;
            }
            const dz=Object.entries(DZ).find(([,p])=>p.r===row&&p.c===col)?.[0];
            if(!dz||!byDz.has(dz)) return <div key={`empty-${row}-${col}`} className="bg-white/60"/>;

            const g=byDz.get(dz)!;
            const idx=gongs.indexOf(g);
            const isM=idx===mingGongIndex;
            const isS=idx===shenGongIndex;

            return (
              <div key={dz}
                className={`p-3 sm:p-4 flex flex-col justify-center transition-all duration-500 ${isM?"bg-accent-gold/[0.05]":isS?"bg-accent-gold/[0.02]":"bg-white"}`}
                style={{opacity:inView?1:0,transform:inView?"translateY(0)":"translateY(8px)",transitionDelay:`${100+row*100+col*50}ms`}}>
                {/* 宫名 + 命/身标签 */}
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="font-serif font-bold tracking-wider text-[13px] text-text-primary">
                    {GL[g.gong]||g.gong.replace("宫","")}
                  </span>
                  {isM&&<span className="text-[11px] px-1 rounded-sm font-bold text-text-primary bg-accent-gold/15">命</span>}
                  {isS&&!isM&&<span className="text-[11px] px-1 rounded-sm text-text-primary bg-black/5">身</span>}
                </div>
                {/* 干支 */}
                <p className="font-serif text-[11px] text-text-secondary mb-2">{g.tiangan||""}{"\u00A0"}{g.dizhi||""}</p>
                {/* 主星 */}
                {g.mainStars&&g.mainStars.length>0&&(
                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mb-1.5">
                    {g.mainStars.map((s,i)=>(
                      <span key={i} className="inline-flex items-center gap-1 font-serif font-bold leading-tight text-[15px] text-text-primary">
                        {SC[s] && <i aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: SC[s] }} />}
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {/* 辅星 */}
                {g.auxStars&&g.auxStars.length>0&&(
                  <p className="text-[11px] leading-tight text-text-secondary mt-auto">
                    {g.auxStars.slice(0,4).join(" · ")}{g.auxStars.length>4&&" ..."}
                  </p>
                )}
                {/* 四化 + 自化 */}
                {(g.sihua&&g.sihua.length>0)||(g.ziHua&&g.ziHua.length>0)?(
                  <p className="inline-flex items-start gap-1 font-serif text-[11px] leading-tight text-text-secondary mt-0.5">
                    <i aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-gold-text" />
                    {[...(g.sihua||[]).map(s=>s.star+s.hua),...(g.ziHua||[]).map(s=>s.star+s.hua)].join(" · ")}
                  </p>
                ):null}
                {/* 大限 */}
                {g.daXian&&(() => {
                  const inRange = liuNianAge > 0 && liuNianAge >= g.daXian.startAge && liuNianAge <= g.daXian.endAge;
                  const highlight = inRange || g.daXian.isCurrent;
                  return (
                    <p className={`mt-1 inline-flex items-center gap-1 text-[11px] ${highlight ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                      {g.daXian.startAge}-{g.daXian.endAge}岁
                      {g.daXian.isCurrent && <i aria-label="当前大限" className="h-1.5 w-1.5 rounded-full bg-accent-gold-text" />}
                      {inRange && !g.daXian.isCurrent && <span className="ml-0.5 text-text-secondary">流年</span>}
                    </p>
                  );
                })()}
              </div>
            );
          }))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex justify-center gap-4 pb-4 text-[11px] text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-sm bg-accent-gold" />命宫
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-gold-text" />当前大限
        </span>
      </div>
    </div>
  );
}

export default ZiweiGongs;
