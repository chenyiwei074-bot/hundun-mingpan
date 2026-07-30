'use client';
import { calcShenSha, calcZhangSheng } from './shensha';
interface BaziPillar {
  gan: string;
  zhi: string;
  naYin?: string;
  zhangSheng?: string;
  shiShen?: string;
  cangGan?: Array<{ gan: string; shiShen?: string }>;
}

interface BaziPillarsProps {
  siZhu: {
    year: BaziPillar;
    month: BaziPillar;
    day: BaziPillar;
    hour: BaziPillar;
  };
  dayMaster: string;
  dayunStart: string | number;
  cangGan?: Record<string, Array<{ gan: string; shiShen?: string }>>;
  naYin?: Record<string, string>;
  zhangSheng?: Record<string, string>;
  shiShen?: Record<string, string>;
  enrichment?: Record<string, any>;
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
  '木': '#07a830',
  '火': '#d30505',
  '土': '#8b6d03',
  '金': '#ef9104',
  '水': '#2e83f6',
};

const PILLAR_LABELS: Record<string, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const PILLAR_SUB: Record<string, string> = {
  year: '祖先·童年',
  month: '父母·青年',
  day: '自己·配偶',
  hour: '子女·晚年',
};

const DIZHI_WUXING: Record<string, string> = {
    '子':'水','丑':'土','寅':'木','卯':'木',
    '辰':'土','巳':'火','午':'火','未':'土',
    '申':'金','酉':'金','戌':'土','亥':'水',
  };

const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 计算空亡
function getKongWang(gan: string, zhi: string): string {
  const tianGanList = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const gi = tianGanList.indexOf(gan);
  const zi = DIZHI.indexOf(zhi);
  if (gi < 0 || zi < 0) return '';
  const xunStartZhi = (zi - gi + 12) % 12;
  const kong1 = (xunStartZhi - 1 + 12) % 12;
  const kong2 = (xunStartZhi - 2 + 12) % 12;
  return DIZHI[kong1] + DIZHI[kong2];
}

// 五行统计
function calcWuxingStats(
  siZhu: BaziPillarsProps['siZhu'],
  enrichment?: Record<string, any>
): { element: string; count: number; max: number }[] {
  const surface = enrichment?.['五行统计']?.surface as Record<string, number> | undefined;
  if (surface) {
    const values = Object.values(surface);
    const max = Math.max(...values, 1);
    return ['木','火','土','金','水'].map(el => ({ element: el, count: surface[el] || 0, max }));
  }
  const dizhiWuxing: Record<string, string> = {
    '子':'水','丑':'土','寅':'木','卯':'木',
    '辰':'土','巳':'火','午':'火','未':'土',
    '申':'金','酉':'金','戌':'土','亥':'水',
  };
  const counts: Record<string, number> = { '木':0,'火':0,'土':0,'金':0,'水':0 };
  const keys = ['year','month','day','hour'] as const;
  for (const k of keys) {
    const p = siZhu[k];
    const wx = WUXING_MAP[p.gan];
    if (wx) counts[wx] = (counts[wx] || 0) + 1;
    const zhiWx = DIZHI_WUXING[p.zhi];
    if (zhiWx) counts[zhiWx] = (counts[zhiWx] || 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);
  return ['木','火','土','金','水'].map(el => ({ element: el, count: counts[el] || 0, max }));
}

const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const DIZHI_LIST = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];

function calcTaiYuan(mGan: string, mZhi: string): string {
  const gi = GAN.indexOf(mGan); const zi = DIZHI_LIST.indexOf(mZhi);
  if (gi < 0 || zi < 0) return "";
  return GAN[(gi + 1) % 10] + DIZHI_LIST[(zi + 3) % 12];
}

function calcMingGong(yGan: string, mZhi: string, hZhi: string): string {
  const yi = GAN.indexOf(yGan); const mi = DIZHI_LIST.indexOf(mZhi); const hi = DIZHI_LIST.indexOf(hZhi);
  if (yi < 0 || mi < 0 || hi < 0) return "";
  const mzIdx = (14 - mi + hi + 12) % 12;
  const firstStem = (yi % 5 * 2 + 2) % 10;
  const mgStem = (firstStem + (mzIdx - 2 + 12) % 12) % 10;
  return GAN[mgStem] + DIZHI_LIST[mzIdx];
}

function zsColor(zs: string): string {
  if (zs === "长生" || zs === "冠带" || zs === "临官") return "#07a830";
  if (zs === "帝旺") return "#d30505";
  if (zs === "衰" || zs === "病" || zs === "死" || zs === "墓" || zs === "绝") return "rgba(0,0,0,0.35)";
  if (zs === "沐浴" || zs === "胎" || zs === "养") return "#2e83f6";
  return "rgba(0,0,0,0.25)";
}

function getDayMasterWuxing(dayMaster: string): string {
  return WUXING_MAP[dayMaster] || '';
}

export default function BaziPillars({ siZhu, dayMaster, dayunStart, cangGan, naYin, zhangSheng, shiShen, enrichment }: BaziPillarsProps) {
  const keys = ['year', 'month', 'day', 'hour'] as const;
  const wuxingStats = calcWuxingStats(siZhu, enrichment);
  const dayMasterWx = getDayMasterWuxing(dayMaster);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black/5">
              <td className="py-2 px-0 w-12 text-center">
                <span className="text-[10px] text-text-muted tracking-wider">时间</span>
              </td>
              {keys.map((key) => {
                const isDay = key === 'day';
                return (
                  <td key={key} className={`py-2 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <p className="text-xs font-serif font-bold text-text-primary">{PILLAR_LABELS[key]}</p>
                    <p className="text-[9px] text-text-muted/50 mt-0.5">{PILLAR_SUB[key]}</p>
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* 天干 */}
            <tr className="border-b border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">天干</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const wx = WUXING_MAP[p.gan] || '';
                const color = WUXING_COLORS[wx] || '#101010';
                const isDay = key === 'day';
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{ color }}>{p.gan}</span>
                  </td>
                );
              })}
            </tr>

            {/* 地支 */}
            <tr className="border-b border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">地支</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{ color: WUXING_COLORS[DIZHI_WUXING[p.zhi]] || "#1d1d1f" }}>{p.zhi}</span>
                  </td>
                );
              })}
            </tr>

            {/* 藏干 */}
            <tr className="border-b border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">藏干</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                const cgArr = cangGan?.[key] || p.cangGan || [];
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    {cgArr.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                        {cgArr.map((cg: any, i: number) => {
                          const wx = WUXING_MAP[cg.gan] || '';
                          const color = WUXING_COLORS[wx] || '#666';
                          return (
                            <span key={i} className="text-[11px] font-serif" style={{ color }}>{cg.gan}</span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[9px] text-text-muted/25">-</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 空亡 */}
            <tr className="border-b border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">空亡</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                const kw = getKongWang(p.gan, p.zhi);
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <span className="text-[11px] text-text-muted/50 font-serif">{kw}</span>
                  </td>
                );
              })}
            </tr>

            {/* 纳音 */}
            <tr className="border-b border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">纳音</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                const ny = naYin?.[key] || p.naYin || '';
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <span className="text-[10px] text-text-muted/50">{ny}</span>
                  </td>
                );
              })}
            </tr>

            {/* 十神 */}
            <tr className="border-t border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">十神</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                const ss = shiShen?.[key] || p.shiShen || '';
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <span className="text-[11px] text-text-secondary/70">{ss}</span>
                  </td>
                );
              })}
            </tr>
            {/* 神煞 */}
            <tr className="border-t border-black/[0.03]">
              <td className="py-1.5 px-0 text-center">
                <span className="text-[10px] text-text-muted/60">神煞</span>
              </td>
              {keys.map((key) => {
                const p = siZhu[key];
                const isDay = key === 'day';
                const ss = calcShenSha(dayMaster, siZhu.year.zhi, siZhu.month.zhi, p.zhi, p.gan, key);
                return (
                  <td key={key} className={`py-1.5 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <div className="flex flex-wrap justify-center gap-1">
                      {ss.length > 0 ? ss.map((s, i) => (
                        <span key={i} className="text-[10px] text-text-muted/50 leading-relaxed">{s}</span>
                      )) : (
                        <span className="text-[9px] text-text-muted/25">-</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 五行能量条 */}
      <div className="px-4 py-3 border-t border-black/5 space-y-1.5">
        <p className="text-[10px] text-text-muted/60 text-center mb-2 tracking-wider">五行能量</p>
        {wuxingStats.map(({ element, count, max }) => {
          const pct = max > 0 ? (count / max) * 100 : 0;
          const color = WUXING_COLORS[element] || '#888';
          const isDayMaster = element === dayMasterWx;
          return (
            <div key={element} className="flex items-center gap-2">
              <span className={`text-[11px] w-4 text-right font-bold ${isDayMaster ? 'opacity-100' : 'opacity-60'}`} style={{ color }}>
                {element}
              </span>
              <div className="flex-1 h-3 bg-black/[0.04] rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    backgroundColor: color,
                    opacity: isDayMaster ? 1 : 0.55,
                    ...(isDayMaster ? { boxShadow: `0 0 6px ${color}40` } : {}),
                  }}
                />
              </div>
              <span className="text-[10px] w-3 text-right font-bold" style={{ color, opacity: isDayMaster ? 1 : 0.5 }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* 日主 + 起运 */}
      <div className="flex justify-center gap-8 py-3 border-t border-black/5 bg-black/[0.01]">
        <div className="text-center">
          <span className="text-[10px] text-text-muted">日主</span>
          <span className="text-lg font-serif font-bold ml-1.5" style={{ color: WUXING_COLORS[dayMasterWx] || '#101010' }}>
            {dayMaster}
          </span>
          <span className="text-[9px] text-text-muted/40 ml-1">({dayMasterWx})</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-text-muted">起运</span>
          <span className="text-lg font-bold text-accent-gold ml-1.5">{dayunStart}岁</span>
        </div>
      </div>

      
      {/* Apple风格：命理推导卡片 */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl p-5" style={{ background: '#f5f5f7' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] mb-3" style={{ color: '#1d1d1f' }}>十二长生</p>
              <div className="flex gap-3">
                {keys.map((key) => {
                  const p = siZhu[key];
                  const zs = zhangSheng?.[key] || p.zhangSheng || calcZhangSheng(dayMaster, p.zhi);
                  return (
                    <div key={key} className="flex-1 text-center">
                      <p className="text-[10px] tracking-wider mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
                        {PILLAR_LABELS[key]}
                      </p>
                      <span className="text-xs font-serif font-bold" style={{ color: zsColor(zs) }}>
                        {zs || '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.1em] mb-3" style={{ color: '#1d1d1f' }}>胎元 · 命宫</p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-wider" style={{ color: 'rgba(0,0,0,0.3)' }}>胎元</span>
                  <span className="text-sm font-serif font-bold" style={{ color: '#1d1d1f' }}>
                    {calcTaiYuan(siZhu.month.gan, siZhu.month.zhi)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-wider" style={{ color: 'rgba(0,0,0,0.3)' }}>命宫</span>
                  <span className="text-sm font-serif font-bold" style={{ color: '#1d1d1f' }}>
                    {calcMingGong(siZhu.year.gan, siZhu.month.zhi, siZhu.hour.zhi)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
