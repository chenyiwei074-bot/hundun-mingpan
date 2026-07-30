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
  liuNianGan?: string;
  liuNianZhi?: string;
  dayunGan?: string;
  dayunZhi?: string;
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

const DIZHI_WUXING: Record<string, string> = {
    '子':'水','丑':'土','寅':'木','卯':'木',
    '辰':'土','巳':'火','午':'火','未':'土',
    '申':'金','酉':'金','戌':'土','亥':'水',
  };

const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const DIZHI_LIST = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];

const DIZHI_CANGGAN: Record<string, string[]> = {
  "子":["癸"],"丑":["己","癸","辛"],"寅":["甲","丙","戊"],
  "卯":["乙"],"辰":["戊","乙","癸"],"巳":["丙","庚","戊"],
  "午":["丁","己"],"未":["己","丁","乙"],"申":["庚","壬","戊"],
  "酉":["辛"],"戌":["戊","辛","丁"],"亥":["壬","甲"],
};

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

// 纳音
function getNaYin(gan: string, zhi: string): string {
  const nayinTable: Record<string, Record<string,string>> = {
    '甲':{'子':'海中金','丑':'海中金','寅':'大溪水','卯':'大溪水','辰':'覆灯火','巳':'覆灯火','午':'沙中金','未':'沙中金','申':'泉中水','酉':'泉中水','戌':'山头火','亥':'山头火'},
    '乙':{'子':'海中金','丑':'海中金','寅':'大溪水','卯':'大溪水','辰':'覆灯火','巳':'覆灯火','午':'沙中金','未':'沙中金','申':'泉中水','酉':'泉中水','戌':'山头火','亥':'山头火'},
    '丙':{'子':'涧下水','丑':'涧下水','寅':'炉中火','卯':'炉中火','辰':'沙中土','巳':'沙中土','午':'天河水','未':'天河水','申':'山下火','酉':'山下火','戌':'屋上土','亥':'屋上土'},
    '丁':{'子':'涧下水','丑':'涧下水','寅':'炉中火','卯':'炉中火','辰':'沙中土','巳':'沙中土','午':'天河水','未':'天河水','申':'山下火','酉':'山下火','戌':'屋上土','亥':'屋上土'},
    '戊':{'子':'霹雳火','丑':'霹雳火','寅':'城头土','卯':'城头土','辰':'大林木','巳':'大林木','午':'天上火','未':'天上火','申':'大驿土','酉':'大驿土','戌':'平地木','亥':'平地木'},
    '己':{'子':'霹雳火','丑':'霹雳火','寅':'城头土','卯':'城头土','辰':'大林木','巳':'大林木','午':'天上火','未':'天上火','申':'大驿土','酉':'大驿土','戌':'平地木','亥':'平地木'},
    '庚':{'子':'壁上土','丑':'壁上土','寅':'松柏木','卯':'松柏木','辰':'白蜡金','巳':'白蜡金','午':'路旁土','未':'路旁土','申':'石榴木','酉':'石榴木','戌':'钗钏金','亥':'钗钏金'},
    '辛':{'子':'壁上土','丑':'壁上土','寅':'松柏木','卯':'松柏木','辰':'白蜡金','巳':'白蜡金','午':'路旁土','未':'路旁土','申':'石榴木','酉':'石榴木','戌':'钗钏金','亥':'钗钏金'},
    '壬':{'子':'桑柘木','丑':'桑柘木','寅':'金箔金','卯':'金箔金','辰':'长流水','巳':'长流水','午':'杨柳木','未':'杨柳木','申':'剑锋金','酉':'剑锋金','戌':'大海水','亥':'大海水'},
    '癸':{'子':'桑柘木','丑':'桑柘木','寅':'金箔金','卯':'金箔金','辰':'长流水','巳':'长流水','午':'杨柳木','未':'杨柳木','申':'剑锋金','酉':'剑锋金','戌':'大海水','亥':'大海水'},
  };
  return nayinTable[gan]?.[zhi] || '';
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

// 关系计算
const GAN_HE: Record<string,string> = {"甲":"己","己":"甲","乙":"庚","庚":"乙","丙":"辛","辛":"丙","丁":"壬","壬":"丁","戊":"癸","癸":"戊"};
const ZHI_HE: Record<string,string> = {"子":"丑","丑":"子","寅":"亥","亥":"寅","卯":"戌","戌":"卯","辰":"酉","酉":"辰","巳":"申","申":"巳","午":"未","未":"午"};
const ZHI_CHONG: Record<string,string> = {"子":"午","午":"子","丑":"未","未":"丑","寅":"申","申":"寅","卯":"酉","酉":"卯","辰":"戌","戌":"辰","巳":"亥","亥":"巳"};
const ZHI_SANHE: Record<string,string[]> = {"申":["子","辰"],"子":["申","辰"],"辰":["申","子"],"亥":["卯","未"],"卯":["亥","未"],"未":["亥","卯"],"寅":["午","戌"],"午":["寅","戌"],"戌":["寅","午"],"巳":["酉","丑"],"酉":["巳","丑"],"丑":["巳","酉"]};
const ZHI_HAI: Record<string,string[]> = {"子":["未"],"丑":["午"],"寅":["巳"],"卯":["辰"],"辰":["卯"],"巳":["寅"],"午":["丑"],"未":["子"],"申":["亥"],"亥":["申"],"酉":["戌"],"戌":["酉"]};
const ZHI_XING: Record<string,string[]> = {"子":["卯"],"卯":["子"],"寅":["巳","申"],"巳":["申","寅"],"申":["寅","巳"],"丑":["戌","未"],"戌":["未","丑"],"未":["丑","戌"]};

function getRelations(liuNianG: string, liuNianZ: string, pGan: string, pZhi: string): string[] {
  const rels: string[] = [];
  if (liuNianG && GAN_HE[liuNianG] === pGan) rels.push("天合");
  if (liuNianZ && ZHI_HE[liuNianZ] === pZhi) rels.push("地合");
  if (liuNianZ && ZHI_CHONG[liuNianZ] === pZhi) rels.push("冲");
  if (liuNianZ && ZHI_SANHE[liuNianZ]?.includes(pZhi)) rels.push("三合");
  if (liuNianZ && ZHI_HAI[liuNianZ]?.includes(pZhi)) rels.push("害");
  if (liuNianZ && ZHI_XING[liuNianZ]?.includes(pZhi)) rels.push("刑");
  return rels;
}

function relColor(rel: string): string {
  if (rel === "天合" || rel === "地合" || rel === "三合") return "#07a830";
  if (rel === "冲" || rel === "刑") return "#d30505";
  if (rel === "害") return "#ef9104";
  return "#666";
}

export default function BaziPillars({ siZhu, dayMaster, dayunStart, cangGan, naYin, zhangSheng, shiShen, enrichment, liuNianGan, liuNianZhi, dayunGan, dayunZhi }: BaziPillarsProps) {
  const keys = ['year', 'month', 'day', 'hour'] as const;
  const wuxingStats = calcWuxingStats(siZhu, enrichment);
  const dayMasterWx = getDayMasterWuxing(dayMaster);
  const showExtra = !!(liuNianGan && dayunGan);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{width:"44px"}} />
            {keys.map(k => <col key={k} style={{width: showExtra ? "13%" : "22%"}} />)}
            {showExtra && <col style={{width:"13%"}} />}
            {showExtra && <col style={{width:"13%"}} />}
          </colgroup>
          <thead>
            <tr className="border-b border-black/5">
              <td className="py-2 px-0 text-center">
                <span className="text-[10px] text-text-muted tracking-wider">时间</span>
              </td>
              {keys.map((key) => {
                const isDay = key === 'day';
                return (
                  <td key={key} className={`py-2 px-0 text-center ${isDay ? 'bg-accent-gold/[0.03]' : ''}`}>
                    <p className="text-xs font-serif font-bold text-text-primary">{PILLAR_LABELS[key]}</p>
                  </td>
                );
              })}
              {showExtra && (
                <>
                  <td className="py-2 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <p className="text-xs font-serif font-bold" style={{color:'#b2955d'}}>大运</p>
                  </td>
                  <td className="py-2 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <p className="text-xs font-serif font-bold" style={{color:'#b2955d'}}>流年</p>
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[WUXING_MAP[dayunGan||'']||''] || '#1d1d1f'}}>{dayunGan}</span>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[WUXING_MAP[liuNianGan||'']||''] || '#1d1d1f'}}>{liuNianGan}</span>
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[DIZHI_WUXING[dayunZhi||'']||''] || '#1d1d1f'}}>{dayunZhi}</span>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[DIZHI_WUXING[liuNianZhi||'']||''] || '#1d1d1f'}}>{liuNianZhi}</span>
                  </td>
                </>
              )}
            </tr>

            {/* 流年关系 */}
            {showExtra && (
              <tr className="border-b border-black/[0.06] bg-accent-gold/[0.02]">
                <td className="py-1 px-0 text-center">
                  <span className="text-[9px] text-accent-gold tracking-wider">关系</span>
                </td>
                {keys.map((key) => {
                  const p = siZhu[key];
                  const rels = getRelations(liuNianGan||'', liuNianZhi||'', p.gan, p.zhi);
                  return (
                    <td key={key} className="py-1 px-0 text-center">
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {rels.length > 0 ? rels.map((r,i) => (
                          <span key={i} className="text-[9px] font-bold animate-pulse" style={{color: relColor(r)}}>{r}</span>
                        )) : <span className="text-[9px] text-text-muted/20">-</span>}
                      </div>
                    </td>
                  );
                })}
                <td className="py-1 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                  <span className="text-[9px] text-text-muted/20">-</span>
                </td>
                <td className="py-1 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                  <span className="text-[9px] text-text-muted/20">-</span>
                </td>
              </tr>
            )}

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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    {(()=>{const cg=DIZHI_CANGGAN[dayunZhi||'']||[];return cg.length>0?<div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">{cg.map((g,i)=>{const wx=WUXING_MAP[g]||'';return <span key={i} className="text-[11px] font-serif" style={{color:WUXING_COLORS[wx]||'#666'}}>{g}</span>})}</div>:<span className="text-[9px] text-text-muted/25">-</span>})()}
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    {(()=>{const cg=DIZHI_CANGGAN[liuNianZhi||'']||[];return cg.length>0?<div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">{cg.map((g,i)=>{const wx=WUXING_MAP[g]||'';return <span key={i} className="text-[11px] font-serif" style={{color:WUXING_COLORS[wx]||'#666'}}>{g}</span>})}</div>:<span className="text-[9px] text-text-muted/25">-</span>})()}
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <span className="text-[11px] text-text-muted/50 font-serif">{getKongWang(dayunGan||'', dayunZhi||'')}</span>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <span className="text-[11px] text-text-muted/50 font-serif">{getKongWang(liuNianGan||'', liuNianZhi||'')}</span>
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <span className="text-[10px] text-text-muted/50">{getNaYin(dayunGan||'', dayunZhi||'')}</span>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <span className="text-[10px] text-text-muted/50">{getNaYin(liuNianGan||'', liuNianZhi||'')}</span>
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <span className="text-[11px] text-text-muted/40">-</span>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <span className="text-[11px] text-text-muted/40">-</span>
                  </td>
                </>
              )}
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
              {showExtra && (
                <>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.02)'}}>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(()=>{const ss=calcShenSha(dayMaster,siZhu.year.zhi,siZhu.month.zhi,dayunZhi||'',dayunGan||'');return ss.length>0?ss.map((s,i)=><span key={i} className="text-[10px] text-text-muted/50 leading-relaxed">{s}</span>):<span className="text-[9px] text-text-muted/25">-</span>})()}
                    </div>
                  </td>
                  <td className="py-1.5 px-0 text-center" style={{background:'rgba(178,149,93,0.04)'}}>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(()=>{const ss=calcShenSha(dayMaster,siZhu.year.zhi,siZhu.month.zhi,liuNianZhi||'',liuNianGan||'');return ss.length>0?ss.map((s,i)=><span key={i} className="text-[10px] text-text-muted/50 leading-relaxed">{s}</span>):<span className="text-[9px] text-text-muted/25">-</span>})()}
                    </div>
                  </td>
                </>
              )}
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