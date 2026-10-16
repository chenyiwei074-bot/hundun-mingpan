'use client';

import React, { useState } from 'react';

const GAN_WX: Record<string,string>={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const ZHI_WX: Record<string,string>={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
const WX_COLOR: Record<string,string>={'木':'var(--color-wx-mu)','火':'var(--color-wx-huo)','土':'var(--color-wx-tu)','金':'var(--color-wx-jin)','水':'var(--color-wx-shui)'};
const WX_BG: Record<string,string>={'木':'rgba(7,168,48,0.12)','火':'rgba(211,5,5,0.12)','土':'rgba(139,109,3,0.12)','金':'rgba(239,145,4,0.12)','水':'rgba(46,131,246,0.12)'};

const WX_DETAIL: Record<string,{meaning:string,excess:string,deficit:string}> = {
  '木':{meaning:'生长、发展、创造力，代表仁慈与责任感',excess:'固执、不肯让步、容易钻牛角尖',deficit:'缺乏决断力、容易犹豫、做事拖沣'},
  '火':{meaning:'热情、行动力、礼仪，代表活力与表达能力',excess:'急躁、冲动、三分钟热度、容易得罪人',deficit:'缺乏热情、行动迟缓、社交被动'},
  '土':{meaning:'稳重、诚信、容纳，代表实干精神与承载力',excess:'僵化、保守、不懂变通、思想固化',deficit:'缺乏主见、容易动摇、难以承诺'},
  '金':{meaning:'决断、义气、原则，代表竞争力与执行力',excess:'刚猛、不近人情、容易与人冲突',deficit:'缺乏果断、优柔寡断、难以拒绝他人'},
  '水':{meaning:'智慧、沟通、流动，代表思考深度与学习能力',excess:'犹豫、过度思考、情绪波动大',deficit:'缺乏深度、难以专注、学习能力弱'},
};


// ===== 十神含义知识库 =====
const SHI_SHEN_MEANING: Record<string,{meaning:string,represents:string,category:string}> = {
  '比肩':{meaning:'同类相助，代表兄弟姐妹、朋友同事、自我意识与独立精神',represents:'自我、兄弟姐妹、同事、竞争',category:'自我'},
  '劫财':{meaning:'同类相争，代表竞争关系、合作与争夺并存',represents:'竞争、合作、冒险、分享',category:'自我'},
  '食神':{meaning:'我生之物，代表才华、创造力、口福、温和的表达',represents:'创造力、艺术、口才、享受',category:'输出'},
  '伤官':{meaning:'我生之物（异性），代表聪明才智、创新思维、不拘一格',represents:'创新、叛逆、技术、艺术天赋',category:'输出'},
  '偏财':{meaning:'我克之物（同性），代表意外之财、投资、商业头脑',represents:'投资、商业、意外收入、慷慨',category:'财富'},
  '正财':{meaning:'我克之物（异性），代表稳定收入、工资、储蓄、节俭',represents:'工资、储蓄、稳定财源、节俭',category:'财富'},
  '七杀':{meaning:'克我之物（同性），代表压力、挑战、权威、魄力',represents:'压力、竞争、权威、事业心',category:'官杀'},
  '正官':{meaning:'克我之物（异性），代表规则、纪律、事业、社会地位',represents:'事业、规则、地位、责任感',category:'官杀'},
  '偏印':{meaning:'生我之物（同性），代表非正统学识、独特思维、直觉',represents:'直觉、玄学、特殊技能、养母',category:'印星'},
  '正印':{meaning:'生我之物（异性），代表正统学识、贵人、母亲、庇护',represents:'学识、贵人、母亲、保护',category:'印星'},
};

const SHI_SHEN_CATEGORY: Record<string,string> = {
  '自我':'自我星代表个人意志与独立能力。比劫多者自主性强，适合独立发展；比劫少者需借助团队力量。',
  '输出':'输出星代表才华与创造力。食伤多者善于表达和创新，适合艺术、技术类工作；食伤少者需刻意培养表达能力。',
  '财富':'财富星代表获取财富的能力。财星旺者理财能力强，商业嗅觉敏锐；财星弱者需通过专业技能变现。',
  '官杀':'官杀星代表事业心与社会地位。官杀有力者事业心强，适合管理和体制内发展；官杀弱者适合自由职业。',
  '印星':'印星代表学识与贵人运。印星旺者有学习天赋，易得长辈提携；印星弱者需主动寻求知识与他人的帮助。',
};

const PILLAR_LABELS=['年柱','月柱','日柱','时柱'] as const;
const PILLAR_KEYS=['year','month','day','hour'] as const;

const GAN_HE: Record<string,{pair:string,desc:string}> = {
  '甲己':{pair:'甲己合土',desc:'中正之合，讲究规则与诚信，多主事业合作或婚姻缘分'},
  '乙庚':{pair:'乙庚合金',desc:'仁义之合，刚柔并济，多主义气与原则并存的人生态度'},
  '丙辛':{pair:'丙辛合水',desc:'威制之合，外柔内刚，多主权力与智慧的结合'},
  '丁壬':{pair:'丁壬合木',desc:'淫匿之合，情感丰富，多主人际缘分与情感经历'},
  '戊癸':{pair:'戊癸合火',desc:'无情之合，表面随和实则独立，多主表里不一的人生'},
};

const ZHI_RELATION: Record<string,{type:string,desc:string}> = {
  '寅申':{type:'六冲',desc:'人生变动较多，容易经历环境变化，适合动态发展的职业'},
  '巳亥':{type:'六冲',desc:'思想与行动的矛盾，内心冲突较多，需要学会平衡'},
  '午子':{type:'六冲',desc:'波动较大，情绪起伏明显，需注意情绪管理'},
  '卯酉':{type:'六冲',desc:'人际关系复杂，小人较多，需谨慎处理人际'},
  '子丑':{type:'六合',desc:'土水相生，内在融洽，善于整合资源'},
  '午未':{type:'六合',desc:'火土相生，热情与稳重并存，人际和谐'},
  '寅亥':{type:'六合',desc:'木水相生，创造力与智慧结合'},
  '巳申':{type:'六合',desc:'火金相刻中带合，表面矛盾实则互补'},
  '戌未':{type:'相刑',desc:'持之以恒，不轻易放弃，但容易固执'},
  '丑戌':{type:'相刑',desc:'互为特别关系，既有帮助也有摩擦'},
  '子未':{type:'相害',desc:'暗中受损，小心小人或潜在损失'},
  '午丑':{type:'相害',desc:'表面和气实则暗伤，需留意背后损害'},
};

interface Props { bazi: any; enrichment?: any; }

export default function BaziCard({ bazi, enrichment }: Props) {
  const [expanded, setExpanded] = useState(false);
  const siZhu = bazi?.siZhu; const shiShen = bazi?.shiShen;
  const dayunStart = bazi?.dayunStart; const dayun = bazi?.dayun;
  const displayDayunStart = dayunStart != null ? Math.round(dayunStart) || 1 : null;
  const dayunLabel = dayunStart != null && dayunStart !== Math.round(dayunStart) ? '约' + displayDayunStart + '岁' : dayunStart != null ? displayDayunStart + '岁' : '';
  const dayMaster = bazi?.dayMaster;

  if (!siZhu) return <div className='qn-card qn-meta' style={{ textAlign: 'center' }}>八字数据未加载</div>;

  const wxCount: Record<string,number> = {'木':0,'火':0,'土':0,'金':0,'水':0};
  for (const key of PILLAR_KEYS) { const p = siZhu[key]; if (p) { const g=GAN_WX[p.gan]; const z=ZHI_WX[p.zhi]; if(g)wxCount[g]++; if(z)wxCount[z]++; } }

  const zhiSet = PILLAR_KEYS.map(k => siZhu[k]?.zhi).filter(Boolean);
  const zhiPairs: string[] = []; for (let i=0;i<zhiSet.length;i++) for (let j=i+1;j<zhiSet.length;j++) zhiPairs.push(zhiSet[i]+zhiSet[j]);
  const zhiRels = zhiPairs.map(p => ({pair:p,...(ZHI_RELATION[p]||ZHI_RELATION[p.split('').reverse().join('')]||null)})).filter(r => r.type);

  const dmWx = GAN_WX[dayMaster] || '';
  const dmDetail = WX_DETAIL[dmWx];

  return (
    <section className='w-full'>
      <header style={{ marginBottom: 18 }}>
        <p className='qn-eyebrow' style={{ marginBottom: 6 }}>分析依据</p>
        <h3 className='qn-title'>八字四柱</h3>
      </header>

      {/* ━━━ 命格总览 ━━━ */}
      {dmWx && enrichment && (
        <div className='qn-card' style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div className='qn-title' style={{ width: 52, height: 52, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: WX_BG[dmWx], color: 'var(--color-text-primary)', fontWeight: 700 }}>{dayMaster}</div>
            <div>
              <h4 className='qn-body' style={{ fontWeight: 600 }}>{dmWx}性日主 · {enrichment?.['格局']?.primary||'格局待定'}</h4>
              <p className='qn-cap' style={{ marginTop: 3 }}>命格总览</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            <span className='qn-cap' style={{ background: WX_BG[dmWx], color: 'var(--color-text-primary)', padding: '4px 11px', borderRadius: 999, fontWeight: 500 }}>{dmWx} · {dmDetail?.meaning?.slice(0,4)}</span>
            {enrichment?.['格局']?.primary && <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '4px 11px', borderRadius: 999, fontWeight: 500 }}>{enrichment['格局'].primary}</span>}
            {enrichment?.['旺衰']?.verdict && <span className='qn-cap' style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--color-text-primary)', padding: '4px 11px', borderRadius: 999, fontWeight: 500 }}>{enrichment['旺衰'].verdict}</span>}
            {enrichment?.['调候用神']?.length > 0 && <span className='qn-cap' style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--color-text-primary)', padding: '4px 11px', borderRadius: 999, fontWeight: 500 }}>喜{enrichment['调候用神'].slice(0,2).join('')}</span>}
          </div>
          <p className='qn-meta' style={{ color: 'var(--color-text-primary)' }}>
            日主<strong>{dayMaster}</strong>（{dmWx}），
            {enrichment?.['旺衰']?.verdict === '偏旺' ? '命局能量充沛，自主意识强，行事主动果断。' : 
             enrichment?.['旺衰']?.verdict === '偏弱' ? '命局温和内敛，善于借力，在协作中发挥最大价值。' :
             enrichment?.['旺衰']?.verdict?.includes('极旺') ? '命局能量极强，格局宏大，需注意平衡与节制。' :
             enrichment?.['旺衰']?.verdict?.includes('极弱') ? '命局极为内敛，以柔克刚，贵在顺势而为。' :
             '命局中和通达，刚柔并济，适应力强。'}
            {enrichment?.['格局']?.primary ? '格局「'+enrichment['格局'].primary+'」主导人生基调。' : ''}
            {enrichment?.['调候用神']?.length > 0 ? '喜用'+enrichment['调候用神'].join('、')+'调候。' : ''}
          </p>
        </div>
      )}

      {dmWx && dmDetail && (
        <div className='qn-card' style={{ marginBottom: 24 }}>
          <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 16 }}>日主解析</h4>
          <div className='grid md:grid-cols-2' style={{ gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className='qn-hero font-serif' style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{dayMaster}</span>
                <span className='qn-cap' style={{ background: WX_BG[dmWx], color: 'var(--color-text-primary)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>{dmWx}性日主</span>
              </div>
              <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>代表性格：</span>{dmDetail.meaning}</p>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {/* 吉凶走判断编码轴，不用五行色：这里没有数据映射，绿色/红色一旦占用，
                  真正的五行数据就不再有唯一视觉含义 */}
              <p className='qn-meta'><span className='qn-axis' style={{ color: 'var(--color-ji)' }}>优势</span> {dmDetail.excess.replace('，','、').split('、').slice(0,2).join('、')}</p>
              <p className='qn-meta'><span className='qn-axis' style={{ color: 'var(--color-xiong)' }}>不足</span> {dmDetail.deficit.replace('，','、').split('、').slice(0,2).join('、')}</p>
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-4' style={{ gap: 8, marginBottom: 24 }}>
        {PILLAR_KEYS.map((key, idx) => {
          const p = siZhu[key]; if (!p) return null;
          const gb = WX_BG[GAN_WX[p.gan]]||'rgba(0,0,0,0.03)'; const zb = WX_BG[ZHI_WX[p.zhi]]||'rgba(0,0,0,0.03)';
          return (
            <div key={key} className='qn-card' style={{ padding: '14px 8px', textAlign: 'center' }}>
              <div className='qn-cap' style={{ marginBottom: 8 }}>{PILLAR_LABELS[idx]}</div>
              <div className='qn-cap' style={{ color: 'var(--color-accent-gold-text)', marginBottom: 8 }}>{shiShen?.[key]||''}</div>
              <div className='font-serif' style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, borderRadius: 8, padding: '4px 0', width: 44, marginInline: 'auto', color: 'var(--color-text-primary)', background: gb }}>{p.gan}</div>
              <div className='font-serif' style={{ fontSize: 26, fontWeight: 700, borderRadius: 8, padding: '4px 0', width: 44, marginInline: 'auto', color: 'var(--color-text-primary)', background: zb }}>{p.zhi}</div>
            </div>);
        })}
      </div>

      <div className='qn-card' style={{ marginBottom: 24 }}>
        <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 14 }}>五行能量分析</h4>
        <p className='qn-meta' style={{ marginBottom: 16 }}>以下展示你命局中五行的分布与强弱，每种五行代表不同的人生能量维度。</p>
        {(['木','火','土','金','水'] as const).map(wx => {
          const cnt = wxCount[wx]||0; const pct = Math.round((cnt/8)*100); const d = WX_DETAIL[wx];
          return (
            <div key={wx} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span className='qn-body' style={{ width: 22, flex: '0 0 auto', fontWeight: 700, color: 'var(--color-text-primary)' }}>{wx}</span>
                <div style={{ flex: '1 1 auto', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(0,0,0,0.07)' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: pct + '%', background: WX_COLOR[wx] }} />
                </div>
                <span className='qn-cap' style={{ width: 34, flex: '0 0 auto', textAlign: 'right' }}>{cnt}/8</span>
              </div>
              <p className='qn-cap' style={{ paddingLeft: 34, color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-text-primary)' }}>{d.meaning}</span>
                  {cnt>=3 ? <span style={{ color: 'var(--color-xiong)' }}> · 偏强：{d.excess}</span> : cnt<=1 ? <span style={{ color: 'var(--color-xiong)' }}> · 偏弱：{d.deficit}</span> : <span style={{ color: 'var(--color-text-primary)' }}> · 均衡</span>}
                </p>
            </div>);
        })}
      </div>

      <div className='qn-card' style={{ marginBottom: 24 }}>
        <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>干支关系</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {zhiRels.length === 0 && (
            <p className='qn-meta' style={{ color: 'var(--color-text-secondary)' }}>四柱地支暂无明显合冲刑害关系</p>
          )}
          {zhiRels.slice(0,4).map((r:any,i:number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 8px', borderRadius: 6, fontWeight: 500, flex: '0 0 auto' }}>{r.type}</span>
              <span className='qn-body' style={{ fontWeight: 500 }}>{r.pair[0]}{r.pair[1]}</span>
              <span className='qn-meta'>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={()=>setExpanded(!expanded)} className='qn-btn qn-btn--ghost' style={{ width: '100%' }}>
        {expanded ? '收起详情' : '展开更多八字信息'}
      </button>

      {expanded && (
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          {/* 格局分析 */}
          {enrichment?.['格局'] && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>格局分析</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>格局：</span><span style={{ color: 'var(--color-accent-gold-text)', fontWeight: 500 }}>{enrichment['格局'].primary||'—'}</span><span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', marginLeft: 8, padding: '2px 7px', borderRadius: 6 }}>置信度 {enrichment['格局'].confidence||'—'}</span></p>
                {enrichment['格局'].basis && <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>形成原因：</span>{enrichment['格局'].basis}</p>}
                {enrichment['格局'].透干?.length > 0 && <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>透干：</span>{enrichment['格局'].透干.join('、')}</p>}
                {enrichment['格局'].notes?.length > 0 && <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>备注：</span>{enrichment['格局'].notes.slice(0,4).join('、')}</p>}
              </div>
            </div>
          )}

          {/* 旺衰分析 */}
          {enrichment?.['旺衰'] && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>旺衰分析</h4>
              <div className='grid grid-cols-2' style={{ gap: 12, marginBottom: 12 }}>
                <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>日主强弱：</span><span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{enrichment['旺衰'].verdict||'—'}</span></p>
                <p className='qn-meta'><span style={{ color: 'var(--color-text-secondary)' }}>得分：</span><span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{enrichment['旺衰'].score??'—'}</span><span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', marginLeft: 8, padding: '2px 7px', borderRadius: 6 }}>置信度 {enrichment['旺衰'].confidence||'—'}</span></p>
              </div>
              {enrichment['旺衰'].breakdown?.details?.length > 0 && (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div className='qn-axis' style={{ marginBottom: 4 }}>计算明细</div>
                  {enrichment['旺衰'].breakdown.details.map((d:string,i:number) => (
                    <p key={i} className='qn-cap'>{d}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 五行统计与调候 */}
          {enrichment?.['五行统计'] && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>五行统计</h4>
              <div className='grid grid-cols-5' style={{ gap: 8, marginBottom: 12, textAlign: 'center' }}>
                {(Object.entries(enrichment['五行统计'].surface||{}) as [string,any][]).map(([wx,cnt]) => (
                  <div key={wx} style={{ background: WX_BG[wx] || 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '9px 4px' }}>
                    <div className='qn-meta' style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{wx} {cnt}</div>
                  </div>
                ))}
              </div>
              {enrichment['五行统计'].strongest?.length > 0 && <p className='qn-meta' style={{ marginBottom: 6 }}>最强五行：<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{enrichment['五行统计'].strongest.join('、')}</span></p>}
              {enrichment['五行统计'].missing?.length > 0 && <p className='qn-meta' style={{ marginBottom: 6 }}>缺失五行：{enrichment['五行统计'].missing.join('、')}</p>}
              {enrichment?.['调候用神']?.length > 0 && <p className='qn-meta'>调候用神：<span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{enrichment['调候用神'].join('、')}</span></p>}
            </div>
          )}

          {/* 十神分析 */}
          {shiShen && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 10 }}>十神分析</h4>
              <p className='qn-meta' style={{ marginBottom: 12 }}>十神揭示你与外界的关系模式——如何对待他人、获取财富、面对压力。</p>
              <div className='grid grid-cols-2 md:grid-cols-4' style={{ gap: 12 }}>
                {PILLAR_KEYS.map((key,idx) => {
                  const ss = shiShen?.[key];
                  const info = SHI_SHEN_MEANING[ss||''];
                  if (!ss || !info) return null;
                  return (
                    <div key={key} style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                      <div className='qn-cap' style={{ marginBottom: 4 }}>{PILLAR_LABELS[idx]}</div>
                      <div className='qn-body' style={{ fontWeight: 600, marginBottom: 4 }}>{ss}</div>
                      <p className='qn-cap'>{info.meaning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 天干关系 */}
          {enrichment?.['天干关系']?.length > 0 && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>天干关系</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {enrichment['天干关系'].map((r:any,i:number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 8px', borderRadius: 6, fontWeight: 500, flex: '0 0 auto' }}>{r.type}</span>
                    <span className='qn-body'>{r.gans?.join('')}{r.pillars ? '（'+r.pillars.join('')+'柱）' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 地支关系 */}
          {enrichment?.['地支关系']?.length > 0 && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>地支关系</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {enrichment['地支关系'].map((r:any,i:number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 8px', borderRadius: 6, fontWeight: 500, flex: '0 0 auto' }}>{r.type}</span>
                    <span className='qn-body'>{r.zhi?.join('')}{r.pillars ? '（'+r.pillars.join('')+'柱）' : ''}</span>
                    {r.detail && <span className='qn-meta'>{r.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 整柱分析 */}
          {enrichment?.['整柱']?.length > 0 && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>整柱分析</h4>
              <div className='grid grid-cols-4' style={{ gap: 8, textAlign: 'center' }}>
                {enrichment['整柱'].map((r:any,i:number) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 10, padding: '10px 6px' }}>
                    <div className='qn-cap' style={{ marginBottom: 4 }}>{r.pillar}柱</div>
                    <div className='qn-body font-serif' style={{ fontWeight: 600, marginBottom: 4 }}>{r.gan}{r.zhi}</div>
                    <div className='qn-cap' style={{ color: 'var(--color-accent-gold-text)' }}>{r.verdict}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 大运概览 */}
          {dayun && dayun.length > 0 && (
            <div className='qn-card'>
              <h4 className='qn-body' style={{ fontWeight: 600, marginBottom: 12 }}>大运起运：<span style={{ color: 'var(--color-accent-gold-text)' }}>{dayunLabel}</span></h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {dayun.slice(0,8).map((dy:any,i:number)=>(
                  <div key={i} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
                    <div className='qn-cap'>{dy.startAge}岁</div>
                    <div className='qn-meta font-serif' style={{ color: 'var(--color-text-primary)', fontWeight: 500, marginTop: 3 }}>{dy.ganZhi?.gan}{dy.ganZhi?.zhi}</div>
                  </div>))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}