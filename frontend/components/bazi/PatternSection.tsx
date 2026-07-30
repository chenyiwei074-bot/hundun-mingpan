"use client";

import type { Enrichment } from "./types";
import { useInView } from "./animations";
import { colors, productShadow, type as t } from "./tokens";

interface PatternSectionProps { enrichment?: Enrichment; }

const LABELS: Record<string,string>={year:"年柱",month:"月柱",day:"日柱",hour:"时柱"};

export function PatternSection({ enrichment }: PatternSectionProps) {
  const { ref, inView } = useInView(0.1);
  if (!enrichment) return null;
  const hasGJ = enrichment['格局']?.primary;
  const hasWS = enrichment['旺衰']?.verdict;
  const hasTH = (enrichment['调候用神']||[]).length>0;
  const hasTG = (enrichment['天干关系']||[]).length>0;
  const hasDZ = (enrichment['地支关系']||[]).length>0;
  if (!hasGJ&&!hasWS&&!hasTH&&!hasTG&&!hasDZ) return null;

  return (
    <div ref={ref}
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView?1:0, transform: inView?"translateY(0)":"translateY(24px)", transition: "all 700ms ease-out" }}>

      <div className="px-6 sm:px-10 py-12 sm:py-16 space-y-10">
        {/* ── 格局 + 旺衰 ── */}
        {(hasGJ||hasWS)&&(
          <div>
            <p className="font-semibold mb-4" style={{fontSize:t.caption.size,letterSpacing:"0.3em",color:"rgba(0,0,0,0.30)"}}>格局分析</p>
            <div className="space-y-3">
              {hasGJ&&(
                <div className="flex items-start gap-3">
                  <span style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.30)",letterSpacing:"0.2em",minWidth:"3em"}}>格局</span>
                  <div><span className="font-serif font-bold" style={{fontSize:t.body.size,color:colors.ink}}>{enrichment['格局']!.primary}</span>
                  {enrichment['格局']!.basis&&<p className="mt-1" style={{fontSize:t.fine.size,color:"rgba(0,0,0,0.35)"}}>{enrichment['格局']!.basis}</p>}</div>
                </div>
              )}
              {hasWS&&(
                <div className="flex items-center gap-3">
                  <span style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.30)",letterSpacing:"0.2em",minWidth:"3em"}}>旺衰</span>
                  <span className="font-serif font-bold" style={{fontSize:t.body.size,color:colors.ink}}>{enrichment['旺衰']!.verdict}</span>
                </div>
              )}
              {hasTH&&(
                <div className="flex items-center gap-3">
                  <span style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.30)",letterSpacing:"0.2em",minWidth:"3em"}}>调候</span>
                  <div className="flex flex-wrap gap-1.5">
                    {enrichment['调候用神']!.map((s,i)=><span key={i} className="px-2.5 py-0.5 rounded-full" style={{fontSize:t.fine.size,background:"rgba(178,149,93,0.10)",color:"rgba(178,149,93,0.70)"}}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 天干合化 ── */}
        {hasTG&&(
          <div>
            <p className="font-semibold mb-3" style={{fontSize:t.caption.size,letterSpacing:"0.3em",color:"rgba(0,0,0,0.30)"}}>天干合化</p>
            <div className="space-y-2">
              {enrichment['天干关系']!.map((r,i)=>(
                <div key={i} className="flex items-center gap-2" style={{fontSize:t.body.size}}>
                  <span className="font-bold" style={{color:colors.accent,fontSize:t.fine.size,minWidth:"2.5em"}}>{r.type}</span>
                  <span className="font-serif" style={{color:colors.ink}}>{r.gan?.join("·")||""}</span>
                  <span style={{fontSize:t.fine.size,color:"rgba(0,0,0,0.35)"}}>{r.result||r.detail}</span>
                  {r.pillars&&<span className="ml-auto" style={{fontSize:t.micro.size,color:"rgba(0,0,0,0.20)"}}>{r.pillars.map((p:string)=>LABELS[p]||p).join("·")}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 地支合会 ── */}
        {hasDZ&&(
          <div>
            <p className="font-semibold mb-3" style={{fontSize:t.caption.size,letterSpacing:"0.3em",color:"rgba(0,0,0,0.30)"}}>地支合会</p>
            <div className="space-y-2">
              {enrichment['地支关系']!.map((r,i)=>(
                <div key={i} className="flex items-center gap-2" style={{fontSize:t.body.size}}>
                  <span className="font-bold" style={{color:colors.accent,fontSize:t.fine.size,minWidth:"2.5em"}}>{r.type}</span>
                  <span className="font-serif" style={{color:colors.ink}}>{r.zhi?.join("·")||""}</span>
                  <span style={{fontSize:t.fine.size,color:"rgba(0,0,0,0.35)"}}>{r.detail}</span>
                  {r.pillars&&<span className="ml-auto" style={{fontSize:t.micro.size,color:"rgba(0,0,0,0.20)"}}>{r.pillars.map((p:string)=>LABELS[p]||p).join("·")}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
