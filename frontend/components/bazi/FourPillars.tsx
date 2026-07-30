"use client";

import { useMemo } from "react";
import type { BaziPillars, Pillar } from "./types";
import { useInView } from "./animations";
import { colors, productShadow, type as t } from "./tokens";
import { calcShenSha, calcKongWang, calcZhangSheng } from "./shensha";

interface FourPillarsProps { pillars: BaziPillars; dayMaster: string; }

const STEM_WX: Record<string,string>={"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土","己":"土","庚":"金","辛":"金","壬":"水","癸":"水"};
const BR_WX: Record<string,string>={"子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"};
const WX: Record<string,string>={"木":"#2e7d32","火":"#c62828","土":"#6d4c00","金":"#d48806","水":"#1565c0"};
const gc=(g:string)=>WX[STEM_WX[g]]||colors.ink;
const bc=(z:string)=>WX[BR_WX[z]]||WX[STEM_WX[z]]||colors.ink;
const LABELS={year:"年柱",month:"月柱",day:"日柱",hour:"时柱"} as const;
const KEYS=["year","month","day","hour"] as const;
const SS: Record<string,string>={"天乙贵人":"#b2955d","文昌":"#1565c0","驿马":"#d48806","桃花":"#c62828","华盖":"#6d4c00","羊刃":"#c62828","将星":"#b2955d"};

export function FourPillars({ pillars, dayMaster }: FourPillarsProps) {
  const { ref, inView } = useInView(0.05);
  const enriched = useMemo(() => {
    const yb = pillars.year.branch;
    const r: Record<string, Pillar> = {};
    for (const key of KEYS) {
      const p = { ...pillars[key] };
      if (!p.kongWang) p.kongWang = calcKongWang(p.stem, p.branch);
      if (!p.zhangSheng) p.zhangSheng = calcZhangSheng(dayMaster, p.branch);
      if (!p.shenSha || p.shenSha.length === 0) p.shenSha = calcShenSha(dayMaster, yb, pillars.month.branch, p.branch);
      r[key] = p;
    }
    return r;
  }, [pillars, dayMaster]);

  return (
    <div ref={ref}
      className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: inView ? productShadow : "none", opacity: inView?1:0, transform: inView?"translateY(0)":"translateY(24px)", transition: "all 700ms ease-out" }}>

      {/* ── Hero 大字 ── */}
      <div className="px-6 sm:px-10 pt-14 sm:pt-20 pb-8 text-center">
        <p className="mb-10" style={{fontSize:t.fine.size,letterSpacing:"0.4em",color:"rgba(0,0,0,0.30)"}}>八字排盘</p>

        {/* 柱名在顶部一行 */}
        <div className="flex justify-center gap-6 sm:gap-10 mb-3">
          {KEYS.map((key) => (
            <div key={key} className="min-w-[80px] text-center">
              <p className="font-semibold" style={{fontSize:t.caption.size,letterSpacing:"0.2em",color:"rgba(0,0,0,0.25)"}}>{LABELS[key]}</p>
            </div>
          ))}
        </div>

        {/* 十神 行 */}
        <div className="flex justify-center gap-6 sm:gap-10 mb-2">
          {KEYS.map((key,i)=>{
            const p=enriched[key];
            return (
              <div key={key} className="min-w-[80px] text-center"
                style={{ opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(8px)", transition: "all 500ms ease-out " + (200+i*80) + "ms" }}>
                <p className="h-5" style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.45)"}}>{p.tenGodStem||"\u00A0"}</p>
              </div>
            );
          })}
        </div>

        {/* 天干 行 */}
        <div className="flex justify-center gap-6 sm:gap-10 mb-1">
          {KEYS.map((key,i)=>{
            const p=enriched[key];
            return (
              <div key={key} className="min-w-[80px] text-center"
                style={{ opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(12px)", transition: "all 500ms ease-out " + (250+i*80) + "ms" }}>
                <p className="font-serif font-semibold leading-none cursor-default"
                  style={{fontSize:"52px",fontWeight:600,color:gc(p.stem),letterSpacing:"-0.02em"}}>{p.stem}</p>
              </div>
            );
          })}
        </div>

        {/* 地支 行 */}
        <div className="flex justify-center gap-6 sm:gap-10 mb-2">
          {KEYS.map((key,i)=>{
            const p=enriched[key];
            return (
              <div key={key} className="min-w-[80px] text-center"
                style={{ opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(16px)", transition: "all 500ms ease-out " + (300+i*80) + "ms" }}>
                <p className="font-serif font-semibold leading-none cursor-default"
                  style={{fontSize:"52px",fontWeight:600,color:bc(p.branch),letterSpacing:"-0.02em"}}>{p.branch}</p>
              </div>
            );
          })}
        </div>

        {/* 地支十神 行 */}
        <div className="flex justify-center gap-6 sm:gap-10">
          {KEYS.map((key,i)=>{
            const p=enriched[key];
            return (
              <div key={key} className="min-w-[80px] text-center"
                style={{ opacity:inView?1:0, transform:inView?"translateY(0)":"translateY(8px)", transition: "all 500ms ease-out " + (350+i*80) + "ms" }}>
                <p className="h-5" style={{fontSize:t.caption.size,color:"rgba(0,0,0,0.45)"}}>{p.tenGodBranch||"\u00A0"}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 柱详情表 · 左侧行标签 ── */}
      <div style={{background:colors.parchment}}>
        <div className="px-4 sm:px-10 py-6">
          <table className="mx-auto border-separate" style={{borderSpacing:"0"}}>
            <tbody>
              <Tr label="纳音">{KEYS.map(k=><Td key={k}>{enriched[k].naYin||"-"}</Td>)}</Tr>
              <Tr label="空亡">{KEYS.map(k=><Td key={k}>{enriched[k].kongWang||"-"}</Td>)}</Tr>
              <Tr label="长生">{KEYS.map(k=><Td key={k}>{enriched[k].zhangSheng||"-"}</Td>)}</Tr>
              <Tr label="藏干">{KEYS.map(k=><Td key={k}>{enriched[k].hiddenStems.join(" ")}</Td>)}</Tr>
              <Tr label="神煞">
                {KEYS.map(k=>{
                  const ss = enriched[k].shenSha||[];
                  return (
                    <Td key={k}>
                      <div className="flex flex-wrap justify-center gap-1">
                        {ss.length>0
                          ? ss.map((s,j)=>(<span key={j} className="px-1.5 py-0.5 rounded-sm leading-tight"
                              style={{fontSize:"9px",background:SS[s]?SS[s]+"15":"rgba(0,0,0,0.04)",color:SS[s]||"rgba(0,0,0,0.45)"}}>{s}</span>))
                          : <span className="font-serif" style={{fontSize:"11px",color:"rgba(0,0,0,0.30)"}}>-</span>}
                      </div>
                    </Td>
                  );
                })}
              </Tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tr({label,children}:{label:string;children:React.ReactNode}){return(
  <tr className="h-[36px]">
    <td className="pr-3 sm:pr-5 text-right" style={{width:"40px"}}><span style={{fontSize:"9px",color:"rgba(0,0,0,0.18)",letterSpacing:"0.1em"}}>{label}</span></td>
    {children}
  </tr>
);}
function Td({children}:{children:React.ReactNode}){return(
  <td className="text-center px-2 sm:px-4 min-w-[72px]"><span className="font-serif leading-tight" style={{fontSize:"11px",color:"rgba(0,0,0,0.45)"}}>{children}</span></td>
);}
