'use client';

interface WuxingData {
  surface?: Record<string, number>;
  missing?: string[];
  strongest?: string[];
}

interface BaziEnrichProps {
  enrichment?: Record<string, any>;
  dayMaster?: string;
}

const WUXING_COLORS: Record<string, string> = {
  '金': 'bg-[#fff3e0] text-[#ef9104]',
  '木': 'bg-[#e8f5e9] text-[#07a830]',
  '水': 'bg-[#e3f2fd] text-[#2e83f6]',
  '火': 'bg-[#ffebee] text-[#d30505]',
  '土': 'bg-[#fff8e1] text-[#8b6d03]',
};

function safeStr(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const PILLAR_MAP: Record<string, string> = { '年': '年柱', '月': '月柱', '日': '日柱', '时': '时柱' };

export default function BaziEnrich({ enrichment }: BaziEnrichProps) {
  if (!enrichment) return null;

  const geju = enrichment['格局'];
  const wangshuai = enrichment['旺衰'];
  const tiaohou: string[] = enrichment['调候用神'] || [];
  const wuxing: WuxingData = enrichment['五行统计'];
  const yueling = enrichment['月令'];
  const tianGanRel: any[] = enrichment['天干关系'] || [];
  const diZhiRel: any[] = enrichment['地支关系'] || [];
  const zhengZhu: any[] = enrichment['整柱'] || [];

  return (
    <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
      <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
        <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">格局分析</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* 格局 */}
        {geju?.primary && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">格局</span>
            <div>
              <span className="text-sm font-bold text-text-primary">{safeStr(geju.primary)}</span>
              {geju.confidence && (
                <span className="text-[10px] text-text-muted/60 ml-2">(置信度 {safeStr(geju.confidence)})</span>
              )}
              {geju.basis && <p className="text-xs text-text-secondary/60 mt-0.5">{safeStr(geju.basis)}</p>}
            </div>
          </div>
        )}

        {/* 旺衰 */}
        {wangshuai?.verdict && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">旺衰</span>
            <div>
              <span className="text-sm font-bold text-text-primary">{safeStr(wangshuai.verdict)}</span>
              {wangshuai.score !== undefined && (
                <span className="text-[10px] text-text-muted/60 ml-2">(score: {safeStr(wangshuai.score)})</span>
              )}
            </div>
          </div>
        )}

        {/* 调候用神 */}
        {tiaohou.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">调候</span>
            <div className="flex flex-wrap gap-1.5">
              {tiaohou.map((s, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold-dark/80">{safeStr(s)}</span>
              ))}
            </div>
          </div>
        )}

        {/* 月令 */}
        {yueling?.month && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">月令</span>
            <span className="text-sm text-text-secondary">{safeStr(yueling.month)}</span>
          </div>
        )}

        {/* 五行统计 */}
        {wuxing?.surface && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">五行</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(wuxing.surface) as [string, number][]).map(([wx, count]) => (
                <span key={wx} className={'text-[10px] px-2.5 py-0.5 rounded-full font-medium ' + (WUXING_COLORS[wx] || 'bg-gray-100')}>
                  {wx} {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 缺失五行 */}
        {wuxing?.missing && wuxing.missing.length > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-[11px] text-text-muted tracking-wider w-14 shrink-0 pt-0.5">缺失</span>
            <span className="text-xs text-[#d30505]/70">{wuxing.missing.join('、')}</span>
          </div>
        )}
      </div>

      {/* 天干合化 */}
      {tianGanRel.length > 0 && (
        <div className="border-t border-black/5">
          <div className="bg-gradient-to-r from-accent-gold/[0.06] to-accent-gold/[0.02] px-4 py-2 border-b border-black/[0.03]">
            <h4 className="text-[11px] font-serif font-bold text-text-primary tracking-[0.2em]">天干合化</h4>
          </div>
          <div className="p-4 space-y-2">
            {tianGanRel.map((rel, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-accent-gold font-bold text-xs min-w-[3em]">{safeStr(rel.type)}</span>
                <span className="font-serif text-text-primary">
                  {rel.gan?.join('·') || ''}
                </span>
                <span className="text-[10px] text-text-muted/60">{safeStr(rel.result || rel.detail)}</span>
                {rel.pillars && (
                  <span className="text-[10px] text-text-muted/40 ml-auto">{rel.pillars.map((p: string) => PILLAR_MAP[p] || p).join('·')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 地支合会 */}
      {diZhiRel.length > 0 && (
        <div className="border-t border-black/5">
          <div className="bg-gradient-to-r from-accent-gold/[0.06] to-accent-gold/[0.02] px-4 py-2 border-b border-black/[0.03]">
            <h4 className="text-[11px] font-serif font-bold text-text-primary tracking-[0.2em]">地支合会</h4>
          </div>
          <div className="p-4 space-y-2">
            {diZhiRel.map((rel, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-accent-gold font-bold text-xs min-w-[3em]">{safeStr(rel.type)}</span>
                <span className="font-serif text-text-primary">
                  {rel.zhi?.join('·') || ''}
                </span>
                <span className="text-[10px] text-text-muted/60">{safeStr(rel.detail)}</span>
                {rel.pillars && (
                  <span className="text-[10px] text-text-muted/40 ml-auto">{rel.pillars.map((p: string) => PILLAR_MAP[p] || p).join('·')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
