'use client';

import React, { useState } from 'react';

// ===== 类型 =====
interface GongInfo {
  gong: string; tiangan?: string; dizhi?: string;
  mainStars?: string[]; auxStars?: string[];
  sihua?: Array<{star:string;hua:string}>;
}
interface SiHuaOverviewEntry { star: string; gong: string; }
interface ZiweiInfo {
  gongs?: GongInfo[];
  sihuaOverview?: Partial<Record<'lu' | 'quan' | 'ke' | 'ji', SiHuaOverviewEntry | null>>;
}
interface Props { ziwei?: ZiweiInfo | null; bazi?: unknown; }

/** 重点宫位那五张卡的选取名。
 *  这里写的必须是引擎实际产出的名字：`ziwei-standard.ts:22 GONG_NAMES` 除命宫外都不带"宫"
 *  （'官禄'/'财帛'/'夫妻'/'福德'），而 `yiqi-core/types.ts:154 ZiweiGong` 声明成全带"宫"。
 *  按声明写死的那批名字永远 find 不到，结果是重点区只剩命宫一张卡、"其余七宫"实为十一宫，
 *  而页面不报任何错 —— 假声明最贵的一次。名字对不对由 tools/ziwei-acceptance 逐条钉。 */
export const KEY_GONGS = ['命宫', '官禄', '财帛', '夫妻', '福德'];

// 四化是「变化」编码，走 --color-sihua-* 家族；与五行数据色分层，不混用。
// 值已落（色卡方案①修正版）；色只当圆点用，文字一律墨色，见 globals.css 的 .qn-sihua。
const SIHUA_COLOR: Record<string, string> = {
  '化禄': 'var(--color-sihua-lu)',
  '化权': 'var(--color-sihua-quan)',
  '化科': 'var(--color-sihua-ke)',
  '化忌': 'var(--color-sihua-ji)',
};


// ===== 辅助函数 =====
function getGongConfig(gong: GongInfo): string {
  const parts: string[] = [];
  if (gong.tiangan && gong.dizhi) parts.push('宫干 '+gong.tiangan+gong.dizhi);
  if (gong.mainStars?.length) parts.push('主星: '+gong.mainStars.join('、'));
  if (gong.auxStars?.length) parts.push('辅星: '+(gong.auxStars || []).slice(0,4).join('、')+(gong.auxStars.length>4?'…':''));
  if (gong.sihua?.length) parts.push('四化: '+gong.sihua.map(s=>s.star+s.hua).join('、'));
  return parts.join(' | ') || '此宫无星曜配置数据';
}

// ===== 组件 =====
export default function ZiweiCard({ ziwei }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['命宫']));
  const gongs: GongInfo[] = ziwei?.gongs || [];

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  if (!gongs.length) {
    return <div className='qn-card qn-meta' style={{ textAlign: 'center' }}>紫微数据未加载</div>;
  }

  const keyGongs = KEY_GONGS.map(name => gongs.find(g => g.gong === name)).filter(Boolean) as GongInfo[];
  const otherGongs = gongs.filter(g => !KEY_GONGS.includes(g.gong));
  const sihuaOverview = ziwei?.sihuaOverview;
  const sihuaRows: Array<[string, SiHuaOverviewEntry | null | undefined]> = sihuaOverview
    ? [['化禄', sihuaOverview.lu], ['化权', sihuaOverview.quan], ['化科', sihuaOverview.ke], ['化忌', sihuaOverview.ji]]
    : [];
  const visibleSihuaRows = sihuaRows.filter((row): row is [string, SiHuaOverviewEntry] => row[1] != null);

  const blockLabel = 'qn-axis';
  const softBox: React.CSSProperties = { background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 14px' };

  return (
    <section className='w-full'>
      {/* 标题 */}
      <header style={{ marginBottom: 18 }}>
        <p className='qn-eyebrow' style={{ marginBottom: 6 }}>盘面结构</p>
        <h3 className='qn-title'>紫微十二宫 · 星曜分布</h3>
        <p className='qn-meta' style={{ marginTop: 8 }}>查看各宫位的主星、辅星与生年四化配置。</p>
      </header>

      <div className='qn-card' style={{ marginBottom: 24 }}>
        <p className='qn-meta' style={{ margin: 0 }}>
          八字与紫微分别依各自体系排盘。出生时间接近时辰或节气交界时，盘面可能出现差异，建议分别核对出生资料与排盘结果。
        </p>
      </div>

      {/* 5个重点宫位 */}
      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {keyGongs.map((gong) => {
          const isOpen = expanded.has(gong.gong);
          const mainStars = gong.mainStars || [];

          return (
            <div key={gong.gong} data-zw-key={gong.gong} className='qn-card' style={{ padding: 0 }}>
              {/* 宫位头部 */}
              <button
                onClick={() => toggle(gong.gong)}
                aria-expanded={isOpen}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '15px 20px', fontFamily: 'inherit',
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className='qn-body' style={{ fontWeight: 600 }}>{gong.gong}</span>
                  <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>
                    {mainStars.length > 0 ? mainStars.join(' · ') : '无主星'}
                  </span>
                  {(gong.sihua?.length ?? 0) > 0 && (
                    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                      {(gong.sihua || []).map(sh => (
                        <span key={sh.star + sh.hua} className='qn-cap qn-sihua'><i className='qn-sihua__dot' style={{ background: SIHUA_COLOR[sh.hua] || 'var(--color-accent-gold)' }} />{sh.star}{sh.hua}</span>
                      ))}
                    </span>
                  )}
                </span>
                <span className='qn-cap' style={{ flex: '0 0 auto', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }}>▾</span>
              </button>

              {/* 展开内容 */}
              {isOpen && (
                <div style={{ padding: '0 20px 20px', display: 'grid', gap: 12 }}>
                  {/* 1. 我的宫位配置 */}
                  <div style={softBox}>
                    <div className={blockLabel} style={{ marginBottom: 6 }}>我的宫位配置</div>
                    <p className='qn-meta' style={{ color: 'var(--color-text-primary)' }}>{getGongConfig(gong)}</p>
                  </div>

                  {/* 辅星配置 */}
                  {gong.auxStars && gong.auxStars.length > 0 && (
                    <div style={softBox}>
                      <div className={blockLabel} style={{ marginBottom: 8 }}>辅星配置</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {gong.auxStars.map((s, j) => (
                          <span key={j} className='qn-cap' style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.07)', borderRadius: 8, padding: '5px 9px', lineHeight: 1.6 }}>
                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className='qn-cap' style={{ margin: 0 }}>
                    星曜含义需结合整张命盘与可核验的文献阅读；本页仅呈现盘面配置，不据单颗星曜直接判断职业、财富或健康。
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 其余宫位 - 紧凑网格。数量按实际分区写，不写死"七"：
          写死的那一次刚好就是 KEY_GONGS 名字对不上、其余变成十一宫的那一次。 */}
      <button aria-expanded={otherGongs.length > 0 && otherGongs.every(g => expanded.has(g.gong))} onClick={() => {
        const allOpen = otherGongs.every(g => expanded.has(g.gong));
        setExpanded(prev => {
          const next = new Set(prev);
          otherGongs.forEach(g => allOpen ? next.delete(g.gong) : next.add(g.gong));
          return next;
        });
      }} className='qn-btn qn-btn--quiet' style={{ width: '100%', minHeight: 44, marginBottom: 16 }}>
        {otherGongs.every(g => expanded.has(g.gong)) ? '收起全部宫位详情' : `展开其余${otherGongs.length}宫详情`}
      </button>

      <div className='grid grid-cols-2 md:grid-cols-4' style={{ gap: 12, marginBottom: 16 }}>
        {otherGongs.map((gong) => {
          const isOpen = expanded.has(gong.gong);
          const mainStars = gong.mainStars || [];
          return (
            <button key={gong.gong} type='button' data-zw-other={gong.gong} className='qn-card' aria-expanded={isOpen} onClick={() => toggle(gong.gong)} style={{ padding: 14, textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', width: '100%', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className='qn-cap'>{gong.gong}</div>
              <div className='qn-meta' style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginTop: 4 }}>
                {mainStars.length > 0 ? mainStars.join(' ') : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
              </div>
              {(gong.auxStars?.length ?? 0) > 0 && (
                <div className='qn-cap' style={{ marginTop: 3 }}>{(gong.auxStars || []).slice(0, 2).join(' ')}</div>
              )}
              {(gong.sihua?.length ?? 0) > 0 && (
                <div style={{ marginTop: 6 }}>
                  {(gong.sihua || []).slice(0, 1).map((sh, j) => (
                    <span key={j} className='qn-cap qn-sihua' style={{ padding: '2px 7px', borderRadius: 6, fontWeight: 500, background: `color-mix(in srgb, ${SIHUA_COLOR[sh.hua] || 'var(--color-accent-gold)'} 10%, transparent)` }}><i className='qn-sihua__dot' style={{ background: SIHUA_COLOR[sh.hua] || 'var(--color-accent-gold)' }} />{sh.star}{sh.hua}</span>
                  ))}
                </div>
              )}
              {isOpen && (
                <p className='qn-cap' style={{ marginTop: 8, textAlign: 'left', lineHeight: 1.7 }}>{getGongConfig(gong)}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* 四化总览 */}
      {visibleSihuaRows.length > 0 && (
        <div className='qn-card'>
          <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 14 }}>生年四化</h4>
          <div className='grid grid-cols-2 md:grid-cols-4' style={{ gap: 12 }}>
            {visibleSihuaRows.map(([hua, v]) => (
              <div key={hua} style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div className='qn-cap qn-sihua' style={{ fontWeight: 500 }}><i className='qn-sihua__dot' style={{ background: SIHUA_COLOR[hua] }} />{hua}</div>
                <div className='qn-meta' style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginTop: 4 }}>{v.star}</div>
                <div className='qn-cap' style={{ marginTop: 2 }}>{v.gong}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
