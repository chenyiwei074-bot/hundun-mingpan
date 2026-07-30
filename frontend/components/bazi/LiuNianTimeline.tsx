"use client";

import { useMemo } from "react";
import type { YearEntry } from "./types";
import { useInView } from "./animations";
import { colors, productShadow, type as t } from "./tokens";

interface LiuNianTimelineProps { years: YearEntry[]; }

function Card({ e, on, inView, idx }: { e: YearEntry; on: boolean; inView: boolean; idx: number }) {
  return (
    <div className={"flex-shrink-0 w-[88px] rounded-xl px-2.5 py-3 text-center cursor-default transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"}
      style={{
        background: on ? "rgba(178,149,93,0.06)" : "transparent",
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(12px)",
        transitionDelay: (idx * 70) + "ms",
      }}>
      <p className="font-bold tracking-wider mb-1.5"
         style={{fontSize:t.fine.size, color:colors.ink}}>{e.year}</p>
      <p className="font-serif font-bold tracking-widest mb-1"
         style={{fontSize:"18px", color:colors.ink, lineHeight:1.1}}>
        {e.ganZhi}
      </p>
      <p style={{fontSize:t.micro.size, color:"rgba(0,0,0,0.30)"}}>{e.age}岁</p>
      <p style={{fontSize:t.micro.size, color:"rgba(0,0,0,0.35)", marginTop:2}}>{e.tenGod}</p>
      {on && (
        <div className="mx-auto mt-2 w-1.5 h-1.5 rounded-full"
             style={{background:colors.accent}} />
      )}
    </div>
  );
}

export function LiuNianTimeline({ years }: LiuNianTimelineProps) {
  const { ref, inView } = useInView(0.08);
  const now = new Date().getFullYear().toString();
  const sorted = useMemo(() => [...years].sort((a,b) => parseInt(a.year)-parseInt(b.year)), [years]);

  return (
    <div ref={ref}
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)", transition: "all 700ms ease-out" }}>

      <div className="px-6 sm:px-10 pt-10 pb-1">
        <h3 style={{fontSize:t.caption.size, fontWeight:600, letterSpacing:"0.3em", color:"rgba(0,0,0,0.30)"}}>
          流年
        </h3>
      </div>

      <div className="px-4 sm:px-8 py-6 flex gap-1.5 overflow-x-auto">
        {sorted.map((e, i) => <Card key={i} e={e} on={e.year === now} inView={inView} idx={i} />)}
      </div>
    </div>
  );
}
