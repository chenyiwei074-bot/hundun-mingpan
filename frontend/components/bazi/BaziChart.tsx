"use client";

import type { BaziChartData } from "./types";
import { BaziHeader } from "./BaziHeader";
import { FourPillars } from "./FourPillars";
import { PillarDetails } from "./PillarDetails";
import { PatternSection } from "./PatternSection";
import { DaYunTimeline } from "./DaYunTimeline";
import { LiuNianTimeline } from "./LiuNianTimeline";
import { useInView } from "./animations";
import { motion as mo } from "./tokens";

interface BaziChartProps { data: BaziChartData; className?: string; }

function Block({ children, delay=0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className={mo.fadeUp}
      style={{ opacity: inView?1:0, transform: inView?"translateY(0)":"translateY(24px)", transitionDelay:`${delay}ms` }}>
      {children}
    </div>
  );
}

export function BaziChart({ data, className="" }: BaziChartProps) {
  return (
    <div className={className}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* 1 · 个人信息 */}
        <Block delay={0}><BaziHeader basic={data.basic} /></Block>

        {/* 2 · 八字排盘 — 四柱大字 + 纳音/空亡/长生/藏干/神煞 全在一起 */}
        <Block delay={100}>
          <FourPillars pillars={data.pillars} dayMaster={data.analysis.dayMaster} />
        </Block>

        {/* 3 · 日主 + 五行 */}
        <Block delay={150}>
          <PillarDetails pillars={data.pillars} elements={data.elements} analysis={data.analysis} />
        </Block>

        {/* 4 · 格局合化 */}
        {data.enrichment && (
          <Block delay={200}><PatternSection enrichment={data.enrichment} /></Block>
        )}

        {/* 5 · 大运 */}
        <Block delay={250}>
          <DaYunTimeline luckCycles={data.luckCycles} />
        </Block>

        {/* 6 · 流年 */}
        {data.years.length > 0 && (
          <Block delay={300}><LiuNianTimeline years={data.years} /></Block>
        )}

        <Block delay={350}>
          <p className="text-center pb-10" style={{ fontSize: "12px", color: "rgba(0,0,0,0.12)", letterSpacing: "0.3em" }}>
            
          </p>
        </Block>
      </div>
    </div>
  );
}

export default BaziChart;
