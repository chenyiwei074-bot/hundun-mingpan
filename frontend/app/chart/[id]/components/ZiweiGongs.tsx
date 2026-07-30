'use client';

interface GongData {
  gong: string;
  tiangan?: string;
  dizhi?: string;
  mainStars?: string[];
  auxStars?: string[];
  sihua?: Array<{ star: string; hua: string }>;
  ziHua?: Array<{ star: string; hua: string; effect?: string }>;
  daXian?: { startAge: number; endAge: number; isCurrent?: boolean; daXianGongName?: string };
}

interface ZiweiGongsProps {
  gongs: GongData[];
  mingGongIndex?: number;
  shenGongIndex?: number;
}

const GONG_LABELS: Record<string, string> = {
  '命宫': '命',
  '兄弟宫': '兄弟',
  '夫妻宫': '夫妻',
  '子女宫': '子女',
  '财帛宫': '财帛',
  '疾厄宫': '疾厄',
  '迁移宫': '迁移',
  '交友宫': '交友',
  '官禄宫': '官禄',
  '田宅宫': '田宅',
  '福德宫': '福德',
  '父母宫': '父母',
};

// 主星高亮色
const STAR_HIGHLIGHT: Record<string, string> = {
  '紫微': 'text-[#b2955d] font-bold',
  '天府': 'text-[#b2955d] font-bold',
  '七杀': 'text-[#d30505]',
  '破军': 'text-[#d30505]',
  '贪狼': 'text-[#07a830]',
  '天相': 'text-[#2e83f6]',
};

export default function ZiweiGongs({ gongs, mingGongIndex = 0, shenGongIndex }: ZiweiGongsProps) {
  if (!gongs || gongs.length === 0) return null;

  return (
    <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
        <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
          紫微十二宫
        </h3>
      </div>

      {/* 十二宫网格 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {gongs.map((g, idx) => {
          const isMing = idx === mingGongIndex;
          const isShen = idx === shenGongIndex;
          const gongLabel = GONG_LABELS[g.gong] || g.gong.replace('宫', '');

          return (
            <div
              key={idx}
              className={`p-3 border-r border-b border-black/5 min-h-[110px] flex flex-col ${
                isMing
                  ? 'bg-accent-gold/[0.06] border-l-2 border-l-accent-gold'
                  : 'bg-white'
              } ${isShen && !isMing ? 'bg-accent-gold/[0.03]' : ''}`}
            >
              {/* 宫名 */}
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-[11px] font-bold font-serif ${
                  isMing ? 'text-accent-gold' : 'text-text-secondary/80'
                }`}>
                  {gongLabel}
                </span>
                {isMing && (
                  <span className="text-[8px] bg-accent-gold text-white px-1 rounded-sm font-bold">命</span>
                )}
                {isShen && (
                  <span className="text-[8px] bg-text-muted/30 text-text-secondary px-1 rounded-sm">身</span>
                )}
              </div>

              {/* 天干地支 */}
              <p className="text-[11px] text-text-secondary/60 font-serif mb-1.5">
                {(g.tiangan || '')}{'\u00A0'}{(g.dizhi || '')}
              </p>

              {/* 主星 */}
              {g.mainStars && g.mainStars.length > 0 && (
                <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mb-1">
                  {g.mainStars.map((star, i) => (
                    <span key={i} className={`text-[12px] font-serif leading-tight ${
                      STAR_HIGHLIGHT[star] || 'text-text-primary/80'
                    }`}>
                      {star}
                    </span>
                  ))}
                </div>
              )}

              {/* 辅星 */}
              {g.auxStars && g.auxStars.length > 0 && (
                <p className="text-[10px] text-text-muted/50 leading-tight mt-auto">
                  {g.auxStars.slice(0, 4).join(' · ')}
                  {g.auxStars.length > 4 && ' ...'}
                </p>
              )}

              {/* 四化 + 自化 */}
              {(g.sihua && g.sihua.length > 0) || (g.ziHua && g.ziHua.length > 0) ? (
                <p className="text-[10px] text-accent-gold/80 font-serif leading-tight mt-0.5">
                  {[
                    ...(g.sihua || []).map((s) => s.star + s.hua),
                    ...(g.ziHua || []).map((s) => s.star + s.hua),
                  ].join(' · ')}
                </p>
              ) : null}

              {/* 大限 */}
              {g.daXian && (
                <p className="text-[9px] text-text-muted/40 mt-0.5">
                  {g.daXian.startAge}-{g.daXian.endAge}岁
                  {g.daXian.isCurrent && (
                    <span className="text-accent-gold font-bold ml-1">★</span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="px-4 py-2 border-t border-black/5 flex flex-wrap gap-3 text-[10px] text-text-muted/50 justify-center">
        <span><span className="inline-block w-2 h-2 bg-accent-gold rounded-sm mr-1" />命宫</span>
        <span>★ 当前大限</span>
      </div>
    </div>
  );
}
