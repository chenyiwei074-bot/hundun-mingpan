"use client";

import type { BaziElements, BaziAnalysis } from "./types";
import { useInView } from "./animations";
import { colors, productShadow, type as t } from "./tokens";

interface PillarDetailsProps { pillars?: any; elements: BaziElements; analysis: BaziAnalysis; }

const E: Record<string,{l:string;c:string}>={wood:{l:"木",c:"#2e7d32"},fire:{l:"火",c:"#c62828"},earth:{l:"土",c:"#6d4c00"},metal:{l:"金",c:"#d48806"},water:{l:"水",c:"#1565c0"}};

export function PillarDetails({ elements, analysis }: PillarDetailsProps) {
  const { ref, inView } = useInView(0.1);
  const eMax = Math.max(...Object.values(elements), 1);

  return (
    <div ref={ref}
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView?1:0, transform: inView?"translateY(0)":"translateY(24px)", transition: "all 700ms ease-out" }}>

      {/* ── 日主三列 ── */}
      <div className="px-6 sm:px-10 py-14 sm:py-16 flex items-center justify-center gap-12 sm:gap-16">
        <Kv label="日主" value={analysis.dayMaster}/>
        <Kv label="强弱" value={analysis.strength} accent/>
        <Kv label="喜用神" value={analysis.useGod}/>
      </div>

      {/* ── 五行条 ── */}
      <div style={{background:colors.parchment}}>
        <div className="px-8 sm:px-12 py-10">
          <div className="max-w-xs mx-auto space-y-3.5">
            {(Object.entries(elements) as [keyof BaziElements,number][]).map(([key,count])=>{
              const m=E[key]; const pct=eMax>0?(count/eMax)*100:0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="font-bold w-5 text-right" style={{fontSize:t.body.size,color:m.c,opacity:.80}}>{m.l}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.06)"}}>
                    <div className="h-full rounded-full" style={{width:(inView?Math.max(pct,3):0)+"%",backgroundColor:m.c,opacity:.50,transition:"width 1.2s cubic-bezier(0.22,0.61,0.36,1)",transitionDelay:"400ms"}}/>
                  </div>
                  <span className="w-4 text-right font-medium" style={{fontSize:t.fine.size,color:"rgba(0,0,0,0.30)"}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kv({label,value,accent}:{label:string;value:string;accent?:boolean}){return(
  <div className="text-center"><p className="font-semibold mb-2" style={{fontSize:t.caption.size,letterSpacing:"0.2em",color:"rgba(0,0,0,0.25)"}}>{label}</p>
  <p className="font-serif font-bold" style={{fontSize:t.display.size,fontWeight:t.display.weight,color:accent?colors.accent:colors.ink}}>{value}</p></div>
);}
