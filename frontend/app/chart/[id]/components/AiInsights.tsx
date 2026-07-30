'use client';

interface DimItem {
  bazi?: string;
  ziwei?: string;
  verdict?: string;
  verdict_class?: string;
  fused?: string;
}

interface StrengthItem {
  title: string;
  desc: string;
}

interface ConflictItem {
  point?: string;
  bazi?: string;
  ziwei?: string;
  impact?: string;
  impact_class?: string;
  advice?: string;
}

interface FinalNode {
  age?: number;
  year?: number;
  event?: string;
}

interface AiInsightsProps {
  analysisData?: Record<string, any>;
}

const DIM_LABELS: Record<string, string> = {
  career: '事业',
  wealth: '财运',
  marriage: '婚姻',
  children: '子女',
  family: '家庭',
  health: '健康',
};

const VERDICT_CLASS_COLORS: Record<string, string> = {
  '上': 'text-[#07a830]',
  '中': 'text-[#b2955d]',
  '下': 'text-[#d30505]',
  '吉': 'text-[#07a830]',
  '凶': 'text-[#d30505]',
  '平': 'text-text-secondary',
};

export default function AiInsights({ analysisData }: AiInsightsProps) {
  if (!analysisData) return null;

  const dim = analysisData.dim;
  const strengths: StrengthItem[] = analysisData.strengths || [];
  const weaknesses: StrengthItem[] = analysisData.weaknesses || [];
  const conflicts: ConflictItem[] = analysisData.conflicts || [];
  const finalData = analysisData.final;
  const section01 = analysisData.section_01;
  const section02 = analysisData.section_02;

  function verdictColor(vc: string | undefined): string {
    if (!vc) return 'text-text-primary';
    return VERDICT_CLASS_COLORS[vc] || 'text-text-primary';
  }

  return (
    <div className="space-y-4">
      {/* 维度分析 */}
      {dim && (
        <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
            <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
              维度解读
            </h3>
          </div>
          <div className="divide-y divide-black/5">
            {Object.entries(DIM_LABELS).map(([key, label]) => {
              const d: DimItem | undefined = dim[key];
              if (!d) return null;
              return (
                <div key={key} className="p-3 flex items-start gap-3">
                  <span className="text-[11px] text-text-muted tracking-wider w-12 shrink-0 pt-0.5">{label}</span>
                  <div className="flex-1 min-w-0">
                    {d.verdict && (
                      <span className={'text-sm font-bold ' + verdictColor(d.verdict_class)}>{d.verdict}</span>
                    )}
                    {d.bazi && <p className="text-xs text-text-secondary/60 mt-0.5">{d.bazi}</p>}
                    {d.ziwei && <p className="text-xs text-text-muted/50 mt-0.5">{d.ziwei}</p>}
                    {d.fused && <p className="text-xs text-text-secondary/70 mt-1 leading-relaxed">{d.fused}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 优势 & 短板 */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <div className="rounded-xl bg-bg-card shadow-sm border border-[#07a830]/20 overflow-hidden">
              <div className="bg-[#07a830]/5 px-4 py-2.5 border-b border-[#07a830]/10">
                <h4 className="text-xs font-serif font-bold text-[#07a830] text-center tracking-[0.2em]">
                  先天优势
                </h4>
              </div>
              <div className="p-3 space-y-2">
                {strengths.map((s, i) => (
                  <div key={i}>
                    <p className="text-sm font-bold text-[#07a830]">{s.title}</p>
                    <p className="text-xs text-text-secondary/60 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {weaknesses.length > 0 && (
            <div className="rounded-xl bg-bg-card shadow-sm border border-[#d30505]/20 overflow-hidden">
              <div className="bg-[#d30505]/5 px-4 py-2.5 border-b border-[#d30505]/10">
                <h4 className="text-xs font-serif font-bold text-[#d30505] text-center tracking-[0.2em]">
                  潜在短板
                </h4>
              </div>
              <div className="p-3 space-y-2">
                {weaknesses.map((w, i) => (
                  <div key={i}>
                    <p className="text-sm font-bold text-[#d30505]">{w.title}</p>
                    <p className="text-xs text-text-secondary/60 mt-0.5">{w.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 八字紫微冲突 */}
      {conflicts.length > 0 && (
        <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
            <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
              冲突与对策
            </h3>
          </div>
          <div className="divide-y divide-black/5">
            {conflicts.map((c, i) => (
              <div key={i} className="p-3">
                {c.point && <p className="text-sm font-bold text-text-primary mb-1">{c.point}</p>}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-muted/60">八字: </span>
                    <span className="text-text-secondary">{c.bazi || '-'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted/60">紫微: </span>
                    <span className="text-text-secondary">{c.ziwei || '-'}</span>
                  </div>
                </div>
                {c.impact && (
                  <p className={'text-xs mt-1.5 ' + verdictColor(c.impact_class)}>
                    影响: {c.impact}
                  </p>
                )}
                {c.advice && (
                  <p className="text-xs text-text-muted/50 mt-1">建议: {c.advice}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 总结 */}
      {section02?.conclusion && (
        <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
            <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
              总结
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-text-secondary/70 leading-relaxed">{section02.conclusion}</p>
          </div>
        </div>
      )}

      {/* 人生轴线 + 关键节点 */}
      {finalData && (
        <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
            <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
              人生轴线
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {finalData.life_axis && (
              <p className="text-sm text-text-secondary/70 leading-relaxed text-center font-serif">
                「{finalData.life_axis}」
              </p>
            )}

            {finalData.nodes && finalData.nodes.length > 0 && (
              <div>
                <p className="text-xs text-text-muted/50 mb-2 text-center">关键节点</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {finalData.nodes.map((n: FinalNode, i: number) => (
                    <div key={i} className="text-center px-3 py-1.5 rounded-lg border border-black/5 bg-bg-card-hover">
                      <p className="text-[10px] text-text-muted/50">{n.year}年 · {n.age}岁</p>
                      <p className="text-xs text-text-secondary">{n.event || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {finalData.risks && finalData.risks.length > 0 && (
              <div>
                <p className="text-xs text-text-muted/50 mb-1.5">风险提示</p>
                {finalData.risks.map((r: any, i: number) => (
                  <p key={i} className="text-xs text-text-secondary/60">
                    <span className="text-[#d30505]/70">{r.range}</span>: {r.desc}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
