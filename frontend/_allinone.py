import os, re

path = r'C:\Users\Kobe\Documents\HDAI\frontend\components\bazi\BaziPillars.tsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# ── 1. imports ──
c = c.replace(
    "import { calcShenSha } from './shensha';",
    "import { calcShenSha, calcZhangSheng } from './shensha';\nimport { getNaYin } from '@/app/lib/core/yiqi-core/nayin';"
)

# ── 2. props ──
c = c.replace(
    'enrichment?: Record<string, any>;\n}',
    'enrichment?: Record<string, any>;\n  liuNianGan?: string;\n  liuNianZhi?: string;\n  dayunGan?: string;\n  dayunZhi?: string;\n}'
)
c = c.replace(
    'export default function BaziPillars({ siZhu, dayMaster, dayunStart, cangGan, naYin, zhangSheng, shiShen, enrichment }: BaziPillarsProps) {',
    'export default function BaziPillars({ siZhu, dayMaster, dayunStart, cangGan, naYin, zhangSheng, shiShen, enrichment, liuNianGan, liuNianZhi, dayunGan, dayunZhi }: BaziPillarsProps) {'
)

# ── 3. add DIZHI_CANGGAN after DIZHI_WUXING ──
dizhi_end = c.find('const DIZHI_WUXING')
dizhi_close = c.find('};', dizhi_end) + 2
canggan = '''
const DIZHI_CANGGAN: Record<string, string[]> = {
  "子":["癸"],"丑":["己","癸","辛"],"寅":["甲","丙","戊"],
  "卯":["乙"],"辰":["戊","乙","癸"],"巳":["丙","庚","戊"],
  "午":["丁","己"],"未":["己","丁","乙"],"申":["庚","壬","戊"],
  "酉":["辛"],"戌":["戊","辛","丁"],"亥":["壬","甲"],
};
'''
c = c[:dizhi_close] + canggan + c[dizhi_close:]

# ── 4. calcZhangSheng import + derivation card ──
# Already handled the shensha import above

# ── 5. helpers for 胎元/命宫/十二长生 ──
helpers = '''
const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const DIZHI_LIST = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
function calcTaiYuan(mG: string, mZhi: string): string {
  const gi = GAN.indexOf(mG); const zi = DIZHI_LIST.indexOf(mZhi);
  if (gi < 0 || zi < 0) return "";
  return GAN[(gi + 1) % 10] + DIZHI_LIST[(zi + 3) % 12];
}
function calcMingGong(yG: string, mZhi: string, hZhi: string): string {
  const yi = GAN.indexOf(yG); const mi = DIZHI_LIST.indexOf(mZhi); const hi = DIZHI_LIST.indexOf(hZhi);
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
'''
dmw_marker = 'function getDayMasterWuxing(dayMaster: string): string {'
c = c.replace(dmw_marker, helpers + '\n' + dmw_marker)

# ── 6. table-fixed + colgroup ──
c = c.replace(
    '        <table className="w-full border-collapse">',
    '        <table className="w-full border-collapse table-fixed">'
)
thead_start_pat = '          <thead>'
colgroup = '''          <colgroup>
            <col style={{width:"44px"}} />
            <col style={{width:"14%"}} />
            <col style={{width:"14%"}} />
            <col style={{width:"14%"}} />
            <col style={{width:"14%"}} />
            <col style={{width:"14%"}} />
            <col style={{width:"14%"}} />
          </colgroup>
          <thead>'''
c = c.replace(thead_start_pat, colgroup)

# ── 7. thead: add 大运+流年 headers (remove PILLAR_SUB) ──
old_thead_cells = '''              <td className="py-2 px-0 w-12 text-center">
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
              })}'''

new_thead_cells = '''              <td className="py-2 px-0 w-12 text-center">
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
              {liuNianGan && dayunGan && (
                <>
                  <td className="py-2 px-0 text-center" style={{ background: 'rgba(178,149,93,0.02)' }}>
                    <p className="text-xs font-serif font-bold" style={{ color: '#b2955d' }}>大运</p>
                  </td>
                  <td className="py-2 px-0 text-center" style={{ background: 'rgba(178,149,93,0.04)' }}>
                    <p className="text-xs font-serif font-bold" style={{ color: '#b2955d' }}>流年</p>
                  </td>
                </>
              )}'''
c = c.replace(old_thead_cells, new_thead_cells)

# ── 8. tbody rows: add extra cells ──

# Helper function to add extra td cells
def add_extra_cells(before_tr_close, extra_html):
    """Insert extra_html right before </tr>"""
    return before_tr_close.replace('            </tr>', extra_html + '\n            </tr>')

# Find each row and add cells

# 天干 row
tg_pat = '''            <tr className="border-b border-black/[0.03]">
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
            </tr>'''
tg_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[WUXING_MAP[dayunGan]||""]||"#1d1d1f"}}>{dayunGan}</span></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[WUXING_MAP[liuNianGan]||""]||"#1d1d1f"}}>{liuNianGan}</span></td></>)}'
c = c.replace(tg_pat, tg_pat.replace('            </tr>', tg_extra + '\n            </tr>'))

# 地支 row
dz_pat = '''            <tr className="border-b border-black/[0.03]">
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
            </tr>'''
dz_extra = '              {liuNianZhi && dayunZhi && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[DIZHI_WUXING[dayunZhi]||""]||"#1d1d1f"}}>{dayunZhi}</span></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="font-serif font-bold text-2xl sm:text-3xl" style={{color: WUXING_COLORS[DIZHI_WUXING[liuNianZhi]||""]||"#1d1d1f"}}>{liuNianZhi}</span></td></>)}'
c = c.replace(dz_pat, dz_pat.replace('            </tr>', dz_extra + '\n            </tr>'))

# 藏干 row
cg_pat_end = '              })}\n            </tr>\n\n            {/* 空亡 */}'
cg_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}>{(()=>{const cg=DIZHI_CANGGAN[dayunZhi]||[];return cg.length>0?<div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">{cg.map((g,i)=>{const wx=WUXING_MAP[g]||"";const cl=WUXING_COLORS[wx]||"#666";return <span key={i} className="text-[11px] font-serif" style={{color:cl}}>{g}</span>})}</div>:<span className="text-[9px] text-text-muted/25">-</span>})()}</td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}>{(()=>{const cg=DIZHI_CANGGAN[liuNianZhi]||[];return cg.length>0?<div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">{cg.map((g,i)=>{const wx=WUXING_MAP[g]||"";const cl=WUXING_COLORS[wx]||"#666";return <span key={i} className="text-[11px] font-serif" style={{color:cl}}>{g}</span>})}</div>:<span className="text-[9px] text-text-muted/25">-</span>})()}</td></>)}'
c = c.replace(cg_pat_end, cg_extra + '\n            </tr>\n\n            {/* 空亡 */}')

# 空亡 row
kw_pat_end = '              })}\n            </tr>\n\n            {/* 纳音 */}'
kw_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="text-[11px] text-text-muted/50 font-serif">{getKongWang(dayunGan,dayunZhi)}</span></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="text-[11px] text-text-muted/50 font-serif">{getKongWang(liuNianGan,liuNianZhi)}</span></td></>)}'
c = c.replace(kw_pat_end, kw_extra + '\n            </tr>\n\n            {/* 纳音 */}')

# 纳音 row
ny_pat_end = '              })}\n            </tr>\n\n            {/* 十神'
ny_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="text-[10px] text-text-muted/50">{getNaYin(dayunGan as any, dayunZhi as any)}</span></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="text-[10px] text-text-muted/50">{getNaYin(liuNianGan as any, liuNianZhi as any)}</span></td></>)}'
c = c.replace(ny_pat_end, ny_extra + '\n            </tr>\n\n            {/* 十神')

# 十神 row
ss_pat_end = '              })}\n            </tr>\n\n            {/* 神煞 */}'
ss_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="text-[11px] text-text-secondary/70">{(()=>{const ss=WUXING_MAP[dayunGan]||"";const dm=WUXING_MAP[dayMaster]||"";if(ss&&dm){const order=["木","火","土","金","水"];const di=order.indexOf(dm);const si=order.indexOf(ss);const diff=(si-di+5)%5;const names=["比劫","食伤","财","官杀","印"];return names[diff]||""}return""})()}</span></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="text-[11px] text-text-secondary/70">{(()=>{const ss=WUXING_MAP[liuNianGan]||"";const dm=WUXING_MAP[dayMaster]||"";if(ss&&dm){const order=["木","火","土","金","水"];const di=order.indexOf(dm);const si=order.indexOf(ss);const diff=(si-di+5)%5;const names=["比劫","食伤","财","官杀","印"];return names[diff]||""}return""})()}</span></td></>)}'
c = c.replace(ss_pat_end, ss_extra + '\n            </tr>\n\n            {/* 神煞 */}')

# 神煞 row - last one
shensha_pat_end = '              })}\n            </tr>\n          </tbody>'
shensha_extra = '              {liuNianGan && dayunGan && (<><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><div className="flex flex-wrap justify-center gap-1">{(()=>{const ss=calcShenSha(dayMaster,siZhu.year.zhi,siZhu.month.zhi,dayunZhi,dayunGan);return ss.length>0?ss.map((s,i)=><span key={i} className="text-[10px] text-text-muted/50 leading-relaxed">{s}</span>):<span className="text-[9px] text-text-muted/25">-</span>})()}</div></td><td className="py-1.5 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><div className="flex flex-wrap justify-center gap-1">{(()=>{const ss=calcShenSha(dayMaster,siZhu.year.zhi,siZhu.month.zhi,liuNianZhi,liuNianGan);return ss.length>0?ss.map((s,i)=><span key={i} className="text-[10px] text-text-muted/50 leading-relaxed">{s}</span>):<span className="text-[9px] text-text-muted/25">-</span>})()}</div></td></>)}'
c = c.replace(shensha_pat_end, shensha_extra + '\n            </tr>\n          </tbody>')

# ── 9. relationship row ──
dz_close_pat = '            </tr>\n\n            {/* 藏干 */}'
relation_row = '''            </tr>

            {/* 流年关系 */}
            {liuNianGan && liuNianZhi && dayunGan && dayunZhi && (
              <tr className="border-b border-black/[0.06] bg-accent-gold/[0.02]">
                <td className="py-1 px-0 text-center">
                  <span className="text-[9px] text-accent-gold tracking-wider">关系</span>
                </td>
                {keys.map((key) => {
                  const p = siZhu[key];
                  const items: string[] = [];
                  const ganHe: Record<string,string> = {"甲":"己","己":"甲","乙":"庚","庚":"乙","丙":"辛","辛":"丙","丁":"壬","壬":"丁","戊":"癸","癸":"戊"};
                  const zhiHe: Record<string,string> = {"子":"丑","丑":"子","寅":"亥","亥":"寅","卯":"戌","戌":"卯","辰":"酉","酉":"辰","巳":"申","申":"巳","午":"未","未":"午"};
                  const zhiChong: Record<string,string> = {"子":"午","午":"子","丑":"未","未":"丑","寅":"申","申":"寅","卯":"酉","酉":"卯","辰":"戌","戌":"辰","巳":"亥","亥":"巳"};
                  if (liuNianGan && ganHe[liuNianGan] === p.gan) items.push("合");
                  else if (liuNianGan && liuNianGan !== p.gan && WUXING_MAP[liuNianGan] === WUXING_MAP[p.gan]) items.push("比");
                  if (liuNianZhi && zhiHe[liuNianZhi] === p.zhi) items.push("合");
                  if (liuNianZhi && zhiChong[liuNianZhi] === p.zhi) items.push("冲");
                  const sanHe: Record<string,string[]> = {"申":["子","辰"],"子":["申","辰"],"辰":["申","子"],"亥":["卯","未"],"卯":["亥","未"],"未":["亥","卯"],"寅":["午","戌"],"午":["寅","戌"],"戌":["寅","午"],"巳":["酉","丑"],"酉":["巳","丑"],"丑":["巳","酉"]};
                  if (sanHe[liuNianZhi]?.includes(p.zhi)) items.push("三合");
                  const haiMap: Record<string,string> = {"子":"未","未":"子","丑":"午","午":"丑","寅":"巳","巳":"寅","卯":"辰","辰":"卯","申":"亥","亥":"申","酉":"戌","戌":"酉"};
                  if (haiMap[liuNianZhi] === p.zhi) items.push("害");
                  const xingMap: Record<string,string[]> = {"寅":["巳","申"],"巳":["寅","申"],"申":["寅","巳"],"丑":["戌","未"],"戌":["丑","未"],"未":["丑","戌"],"子":["卯"],"卯":["子"]};
                  if (xingMap[liuNianZhi]?.includes(p.zhi)) items.push("刑");
                  return (
                    <td key={key} className="py-1 px-0 text-center">
                      {items.length > 0 ? items.map((it,i) => (
                        <span key={i} className="inline-block text-[10px] font-bold mx-0.5 animate-pulse" style={{
                          color: it==="合"||it==="三合"?"#07a830":it==="冲"||it==="刑"?"#d30505":it==="害"?"#ef9104":"#8b6d03"
                        }}>{it}</span>
                      )) : <span className="text-[9px] text-text-muted/20">·</span>}
                    </td>
                  );
                })}
                <td className="py-1 px-0 text-center" style={{background:"rgba(178,149,93,0.02)"}}><span className="text-[9px] text-text-muted/20">-</span></td>
                <td className="py-1 px-0 text-center" style={{background:"rgba(178,149,93,0.04)"}}><span className="text-[9px] text-text-muted/20">-</span></td>
              </tr>
            )}

            {/* 藏干 */}'''
c = c.replace(dz_close_pat, relation_row)

# ── 10. derivation card ──
old_close_pat = '    </>\n  );'
derivation_card = '''
      {/* 十二长生 */}
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
                      <p className="text-[10px] tracking-wider mb-1" style={{ color: 'rgba(0,0,0,0.3)' }}>{PILLAR_LABELS[key]}</p>
                      <span className="text-xs font-serif font-bold" style={{ color: zsColor(zs) }}>{zs || '-'}</span>
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
                  <span className="text-sm font-serif font-bold" style={{ color: '#1d1d1f' }}>{calcTaiYuan(siZhu.month.gan, siZhu.month.zhi)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-wider" style={{ color: 'rgba(0,0,0,0.3)' }}>命宫</span>
                  <span className="text-sm font-serif font-bold" style={{ color: '#1d1d1f' }}>{calcMingGong(siZhu.year.gan, siZhu.month.zhi, siZhu.hour.zhi)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );'''
c = c.replace(old_close_pat, derivation_card)

# Also need to make the energy bar number colored
# Fix: change text-text-muted/40 to use color
c = c.replace(
    '<span className="text-[10px] w-3 text-right text-text-muted/40">{count}</span>',
    '<span className="text-[10px] w-3 text-right font-bold" style={{ color, opacity: isDayMaster ? 1 : 0.5 }}>{count}</span>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print(f'ALL DONE. File size: {len(c)} bytes')