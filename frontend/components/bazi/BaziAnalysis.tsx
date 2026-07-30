"use client";

import type { BaziAnalysis, BaziBasic } from "./types";

interface BaziAnalysisProps {
  analysis: BaziAnalysis;
  basic: BaziBasic;
}

function AnalysisRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-black/[0.03] last:border-b-0">
      <span className="text-[11px] text-text-muted/50 tracking-wider flex-shrink-0 w-8 text-right pt-0.5">
        {label}
      </span>
      <span className="text-sm text-text-secondary leading-relaxed">
        {children}
      </span>
    </div>
  );
}

export function BaziAnalysis({ analysis, basic }: BaziAnalysisProps) {
  return (
    <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
      <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
        <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">命盘解读</h3>
      </div>

      <div className="px-5 py-4">
        <AnalysisRow label="命主">{basic.name || "-"} · {basic.gender || "-"}</AnalysisRow>
        <AnalysisRow label="日主">
          <span className="text-accent-gold font-bold">{analysis.dayMaster || "-"}</span>
          <span className="text-text-muted/40 ml-2">（{analysis.strength || "-"}）</span>
        </AnalysisRow>
        <AnalysisRow label="格局">
          {analysis.useGod ? `${analysis.useGod}格` : "待分析"}
        </AnalysisRow>
        <AnalysisRow label="性格">{analysis.summary || "（AI 解读模块接入中...）"}</AnalysisRow>
        <AnalysisRow label="事业">（AI 解读模块接入中...）</AnalysisRow>
        <AnalysisRow label="财运">（AI 解读模块接入中...）</AnalysisRow>
        <AnalysisRow label="感情">（AI 解读模块接入中...）</AnalysisRow>
        <AnalysisRow label="健康">（AI 解读模块接入中...）</AnalysisRow>
      </div>

      <div className="border-t border-black/5 px-5 py-2.5 flex items-center gap-2 bg-black/[0.01]">
        <span className="text-[10px] opacity-30">🤖</span>
        <p className="text-[10px] text-text-muted/35 tracking-wider">后续将接入 AI 深度命理解读模块</p>
      </div>
    </div>
  );
}
