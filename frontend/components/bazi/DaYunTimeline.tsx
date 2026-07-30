"use client";

import { useMemo } from "react";
import type { BaziLuckCycles, LuckCycle } from "./types";
import { useInView } from "./animations";
import { colors, productShadow, type as t } from "./tokens";

interface DaYunTimelineProps { luckCycles: BaziLuckCycles; }

const STEM_WX: Record<string,string> = { "甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水" };
const WX_COLOR: Record<string,string> = { "木":"#2e7d32","火":"#c62828","土":"#6d4c00","金":"#d48806","水":"#1565c0" };
function sColor(s:string) { return WX_COLOR[STEM_WX[s]] || colors.ink; }

function Card({ c, on, idx, inView }: { c: LuckCycle; on: boolean; idx: number; inView: boolean }) {
  return (
    <div
      className={"flex-shrink-0 w-[96px] rounded-xl px-2 py-3 text-center cursor-default transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"}
      style={{
        background: on ? "rgba(178,149,93,0.06)" : "transparent",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(16px)",
        transitionDelay: (idx * 80) + "ms",
      }}
    >
      <p style={{fontSize:t.micro.size, color:"rgba(0,0,0,0.30)", letterSpacing:"0.1em", marginBottom:6}}>{c.ageRange}岁</p>
      <p className="font-serif font-bold tracking-wider mb-1"
         style={{fontSize:"22px", lineHeight:1.15}}>
        <span style={{color:sColor(c.heavenStem)}}>{c.heavenStem}</span>
        <span style={{color:colors.ink}}>{c.earthBranch}</span>
      </p>
      <p style={{fontSize:t.micro.size, color:"rgba(0,0,0,0.35)"}}>{c.tenGod}</p>
      {(c.startYear || c.endYear) && (
        <p style={{fontSize:"9px", color:"rgba(0,0,0,0.22)", marginTop:4}}>
          {c.startYear||"?"}-{c.endYear||"?"}
        </p>
      )}
      {on && (
        <div className="mx-auto mt-2 w-1.5 h-1.5 rounded-full"
             style={{background:colors.accent}} />
      )}
    </div>
  );
}

export function DaYunTimeline({ luckCycles }: DaYunTimelineProps) {
  const { ref, inView } = useInView(0.08);

  const active = useMemo(() => {
    const now = new Date().getFullYear();
    return luckCycles.cycles.findIndex(c => {
      const s = parseInt(c.startYear||"0"), e = parseInt(c.endYear||"0");
      return s>0 && e>0 && now>=s && now<=e;
    });
  }, [luckCycles.cycles]);

  return (
    <div ref={ref}
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)", transition: "all 700ms ease-out" }}>

      <div className="px-6 sm:px-10 pt-10 pb-1">
        <h3 style={{fontSize:t.caption.size, fontWeight:600, letterSpacing:"0.3em", color:"rgba(0,0,0,0.30)"}}>
          大运
        </h3>
      </div>

      <div className="px-4 sm:px-8 py-6 flex gap-1 overflow-x-auto">
        {luckCycles.cycles.map((c: LuckCycle, i: number) => (
          <Card key={i} c={c} on={i === active || (active < 0 && i === 0)} idx={i} inView={inView} />
        ))}
      </div>

      <div className="px-6 sm:px-10 pb-6">
        <p style={{fontSize:t.fine.size, color:"rgba(0,0,0,0.22)", letterSpacing:"0.1em"}}>
          起运 {luckCycles.startAge}岁 · {luckCycles.direction}
        </p>
      </div>
    </div>
  );
}
