'use client';

interface DayunItem {
  ganZhi: { gan: string; zhi: string };
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  ganShiShen?: string;
  zhiShiShen?: string;
}

interface DayunSectionProps {
  dayun: DayunItem[];
  dayunStart: string;
}

// 五行 → 颜色
const WUXING_MAP: Record<string, string> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
};

const WUXING_COLORS: Record<string, string> = {
  '木': 'text-[#07a830]',
  '火': 'text-[#d30505]',
  '土': 'text-[#8b6d03]',
  '金': 'text-[#ef9104]',
  '水': 'text-[#2e83f6]',
};

export default function DayunSection({ dayun, dayunStart }: DayunSectionProps) {
  if (!dayun || dayun.length === 0) return null;

  return (
    <div className="rounded-xl bg-bg-card shadow-sm border border-black/5 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-accent-gold/10 to-accent-gold/5 px-4 py-3 border-b border-black/5">
        <h3 className="text-sm font-serif font-bold text-text-primary tracking-[0.3em] text-center">
          大运流年
        </h3>
      </div>

      <div className="p-4">
        <p className="text-xs text-text-muted mb-4 text-center">
          起运 <span className="font-bold text-accent-gold">{dayunStart}</span> 岁，每十年一运
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {dayun.slice(0, 8).map((dy, idx) => {
            const wx = WUXING_MAP[dy.ganZhi.gan] || '';
            const colorClass = WUXING_COLORS[wx] || 'text-text-primary';

            return (
              <div
                key={idx}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  idx === 0
                    ? 'border-accent-gold/30 bg-accent-gold/[0.04]'
                    : 'border-black/5 bg-white hover:bg-bg-card-hover'
                }`}
              >
                <p className="text-[10px] text-text-muted mb-1">
                  {dy.startAge}-{dy.endAge}岁
                </p>
                <p className="text-lg font-serif font-bold">
                  <span className={colorClass}>{dy.ganZhi.gan}</span>
                  <span className="text-text-primary/70">{dy.ganZhi.zhi}</span>
                </p>
                {(dy.ganShiShen || dy.zhiShiShen) && (
                  <p className="text-[9px] text-text-muted/50 mt-1">
                    {dy.ganShiShen || dy.zhiShiShen}
                  </p>
                )}
                <p className="text-[9px] text-text-muted/40 mt-0.5">
                  {dy.startYear}-{dy.endYear}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
