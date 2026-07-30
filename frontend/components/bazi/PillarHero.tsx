"use client";

import type { BaziPillars } from "./types";
import { useInView, staggerDelay } from "./animations";
import { colors, productShadow, type as t } from "./tokens";

interface PillarHeroProps { pillars: BaziPillars; }

const STEM_WX: Record<string,string>={"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水"};
const BR_WX: Record<string,string>={"子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"};
const WX: Record<string,string>={"木":"#07a830","火":"#d30505","土":"#8b6d03","金":"#ef9104","水":"#2e83f6"};
const gc=(g:string)=>WX[STEM_WX[g]]||colors.ink;
const bc=(z:string)=>WX[BR_WX[z]]||WX[STEM_WX[z]]||colors.ink;
const LABELS={year:"年柱",month:"月柱",day:"日柱",hour:"时柱"} as const;
const KEYS=["year","month","day","hour"] as const;

export function PillarHero({ pillars }: PillarHeroProps) {
  const { ref, inView } = useInView(0.10);
  return (
    <div ref={ref}
      className="rounded-[18px] bg-white py-16 sm:py-24 text-center overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView?1:0, transform: inView?"translateY(0)":"translateY(24px)", transition: "all 700ms ease-out" }}>
      {/* 标签 */}
      <p className="mb-12" style={{fontSize:t.fine.size,letterSpacing:"0.4em",color:"rgba(0,0,0,0.30)"}}>八字排盘</p>
      {/* 四柱 */}
      <div className="flex justify-center gap-8 sm:gap-14">
        {KEYS.map((key,i)=>{
          const p=pillars[key];
          return (
            <div key={key} className="flex flex-col items-center"
              style={{ opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(16px)", transition: `all 500ms ease-out ${200+i*80}ms` }}>
              <p className="mb-3 h-4" style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.20)"}}>{p.tenGodStem||"\u00A0"}</p>
              <p className="font-serif font-semibold leading-none mb-1 hover:scale-105 transition-transform duration-300 cursor-default"
                style={{fontSize:t.hero.size,fontWeight:t.hero.weight,color:gc(p.stem),letterSpacing:t.hero.tracking}}>{p.stem}</p>
              <p className="font-serif font-semibold leading-none mb-2 hover:scale-105 transition-transform duration-300 cursor-default"
                style={{fontSize:t.hero.size,fontWeight:t.hero.weight,color:bc(p.branch),letterSpacing:t.hero.tracking}}>{p.branch}</p>
              <p className="mb-2 h-4" style={{fontSize:t.fine.size,color:"rgba(0,0,0,0.18)"}}>{p.tenGodBranch||"\u00A0"}</p>
              <p className="font-semibold" style={{fontSize:t.caption.size,letterSpacing:"0.3em",color:"rgba(0,0,0,0.25)"}}>{LABELS[key]}</p>
              {p.hiddenStems.length>0&&(
                <div className="flex gap-1.5 mt-3">
                  {p.hiddenStems.map((hs,j)=><span key={j} className="px-1.5 py-0.5 rounded-sm" style={{fontSize:t.micro.size,color:gc(hs),background:"rgba(0,0,0,0.02)"}}>{hs}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
