"use client";

import type { BaziElements, BaziAnalysis } from "./types";
import { useInView } from "./animations";

interface FiveElementsProps { elements: BaziElements; analysis: BaziAnalysis; }

const META: Record<string, { label: string; color: string }> = {
  wood: { label:"木", color:"#07a830" }, fire: { label:"火", color:"#d30505" },
  earth:{ label:"土", color:"#8b6d03" }, metal:{ label:"金", color:"#ef9104" }, water:{ label:"水", color:"#2e83f6" },
};

export function FiveElements({ elements, analysis }: FiveElementsProps) {
  const { ref, inView } = useInView(0.1);
  const vals = Object.entries(elements) as [keyof BaziElements, number][];
  const max = Math.max(...vals.map(([,v]) => v), 1);

  return (
    <div ref={ref}
      className="rounded-xl bg-bg-card overflow-hidden
                 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

      <div className="px-5 py-4 border-b border-black/[0.04]">
        <h3 className="text-xs font-serif font-semibold text-text-primary/70 tracking-[0.3em] text-center">
          五行分析
        </h3>
      </div>

      <div className="px-6 py-6 space-y-4">
        {vals.map(([key, count]) => {
          const m = META[key];
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs font-bold w-5 text-right opacity-70" style={{ color: m.color }}>
                {m.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: inView ? `${Math.max(pct, 2)}%` : "0%",
                    backgroundColor: m.color,
                    opacity: 0.6,
                    transition: "width 1s cubic-bezier(0.22, 0.61, 0.36, 1)",
                    transitionDelay: "200ms",
                  }}
                />
              </div>
              <span className="text-[10px] text-text-muted/30 w-3 text-right">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-black/[0.03] px-6 py-4 flex items-center justify-center gap-6">
        <Info label="日主" value={analysis.dayMaster} />
        <span className="text-black/[0.06]">|</span>
        <Info label="强弱" value={analysis.strength} highlight />
        <span className="text-black/[0.06]">|</span>
        <Info label="喜用神" value={analysis.useGod} />
      </div>
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted/30">{label}</span>
      <span className={`text-xs font-serif font-bold tracking-wider ${
        highlight ? "text-accent-gold" : "text-text-primary/70"
      }`}>{value || "-"}</span>
    </div>
  );
}
