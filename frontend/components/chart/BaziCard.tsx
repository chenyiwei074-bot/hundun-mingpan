'use client';

import React, { useState } from 'react';

const GAN_WX: Record<string,string>={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const ZHI_WX: Record<string,string>={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
const WX_COLOR: Record<string,string>={'木':'#07a830','火':'#d30505','土':'#8b6d03','金':'#ef9104','水':'#2e83f6'};
const WX_BG: Record<string,string>={'木':'rgba(7,168,48,0.08)','火':'rgba(211,5,5,0.08)','土':'rgba(139,109,3,0.08)','金':'rgba(239,145,4,0.08)','水':'rgba(46,131,246,0.08)'};

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

  if (!siZhu) return <div className='rounded-xl border border-black/5 bg-white p-6 text-center text-sm' style={{color:'#86868b'}}>八字数据未加载</div>;

  const wxCount: Record<string,number> = {'木':0,'火':0,'土':0,'金':0,'水':0};
  for (const key of PILLAR_KEYS) { const p = siZhu[key]; if (p) { const g=GAN_WX[p.gan]; const z=ZHI_WX[p.zhi]; if(g)wxCount[g]++; if(z)wxCount[z]++; } }

  const zhiSet = PILLAR_KEYS.map(k => siZhu[k]?.zhi).filter(Boolean);
  const zhiPairs: string[] = []; for (let i=0;i<zhiSet.length;i++) for (let j=i+1;j<zhiSet.length;j++) zhiPairs.push(zhiSet[i]+zhiSet[j]);
  const zhiRels = zhiPairs.map(p => ({pair:p,...(ZHI_RELATION[p]||ZHI_RELATION[p.split('').reverse().join('')]||null)})).filter(r => r.type);

  const dmWx = GAN_WX[dayMaster] || '';
  const dmDetail = WX_DETAIL[dmWx];

  return (
    <section className='w-full'>
      <h3 className='font-serif text-xl font-bold mb-5 tracking-wider' style={{color:'#1d1d1f'}}>
        <span className='inline-block w-1.5 h-5 rounded-full mr-2.5 align-middle' style={{background:'#07a830'}} />
        <span className='text-xs font-normal tracking-wider px-2 py-0.5 rounded mr-2 align-middle' style={{color:'#86868b',background:'rgba(0,0,0,0.04)'}}>分析依据</span>
        八字四柱
      </h3>

      {/* ━━━ 命格总览 ━━━ */}
      {dmWx && enrichment && (
        <div className='rounded-2xl p-5 md:p-6 mb-6' style={{background:'rgba(7,168,48,0.03)',border:'1px solid rgba(7,168,48,0.1)'}}>
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-10 h-10 rounded-full flex items-center justify-center text-xl font-serif font-bold' style={{background:WX_BG[dmWx],color:WX_COLOR[dmWx]}}>{dayMaster}</div>
            <div>
              <h4 className='font-serif text-base font-bold' style={{color:'#1d1d1f'}}>{dmWx}性日主 · {enrichment?.['格局']?.primary||'格局待定'}</h4>
              <p className='text-xs' style={{color:'#86868b'}}>命格总览</p>
            </div>
          </div>
          <div className='flex flex-wrap gap-1.5 mb-3'>
            <span className='inline-block px-2.5 py-1 rounded-full text-[11px] font-medium' style={{background:WX_BG[dmWx],color:WX_COLOR[dmWx]}}>{dmWx} · {dmDetail?.meaning?.slice(0,4)}</span>
            {enrichment?.['格局']?.primary && <span className='inline-block px-2.5 py-1 rounded-full text-[11px] font-medium' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d'}}>{enrichment['格局'].primary}</span>}
            {enrichment?.['旺衰']?.verdict && <span className='inline-block px-2.5 py-1 rounded-full text-[11px] font-medium' style={{background:'rgba(0,0,0,0.04)',color:'#555'}}>{enrichment['旺衰'].verdict}</span>}
            {enrichment?.['调候用神']?.length > 0 && <span className='inline-block px-2.5 py-1 rounded-full text-[11px] font-medium' style={{background:'rgba(46,131,246,0.08)',color:'#2e83f6'}}>喜{enrichment['调候用神'].slice(0,2).join('')}</span>}
          </div>
          <p className='text-sm leading-relaxed' style={{color:'#555'}}>
            日主<strong style={{color:WX_COLOR[dmWx]}}>{dayMaster}</strong>（{dmWx}），
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
        <div className='rounded-xl border border-black/5 bg-white p-5 mb-6 shadow-sm'>
          <h4 className='text-sm font-bold mb-4 tracking-wider' style={{color:'#1d1d1f'}}>日主解析</h4>
          <div className='grid md:grid-cols-2 gap-4'>
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <span className='text-3xl font-serif font-bold' style={{color:WX_COLOR[dmWx]||'#1d1d1f'}}>{dayMaster}</span>
                <span className='text-xs px-2 py-0.5 rounded-full' style={{background:WX_BG[dmWx],color:WX_COLOR[dmWx]}}>{dmWx}性日主</span>
              </div>
              <p className='text-sm' style={{color:'#555'}}>
                <span style={{color:'#86868b'}}>代表性格：</span>{dmDetail.meaning}
              </p>
            </div>
            <div className='space-y-2 text-sm'>
              <div><span style={{color:'#07a830'}}>优势：</span>{dmDetail.excess.replace('，','、').split('、').slice(0,2).join('、')}</div>
              <div><span style={{color:'#d30505'}}>不足：</span>{dmDetail.deficit.replace('，','、').split('、').slice(0,2).join('、')}</div>
            </div>
          </div>
        </div>
      )}

      <div className='grid grid-cols-4 gap-2 md:gap-4 mb-6'>
        {PILLAR_KEYS.map((key, idx) => {
          const p = siZhu[key]; if (!p) return null;
          const gc = WX_COLOR[GAN_WX[p.gan]]||'#1d1d1f'; const zc = WX_COLOR[ZHI_WX[p.zhi]]||'#1d1d1f';
          const gb = WX_BG[GAN_WX[p.gan]]||'rgba(0,0,0,0.03)'; const zb = WX_BG[ZHI_WX[p.zhi]]||'rgba(0,0,0,0.03)';
          return (
            <div key={key} className='rounded-xl border border-black/5 bg-white p-3 md:p-4 text-center shadow-sm'>
              <div className='text-xs tracking-wider mb-2' style={{color:'#86868b'}}>{PILLAR_LABELS[idx]}</div>
              <div className='text-xs mb-2' style={{color:'#b2955d'}}>{shiShen?.[key]||''}</div>
              <div className='text-2xl md:text-3xl font-serif font-bold mb-1 rounded-lg py-1 mx-auto' style={{color:gc,background:gb,maxWidth:'60px'}}>{p.gan}</div>
              <div className='text-2xl md:text-3xl font-serif font-bold rounded-lg py-1 mx-auto' style={{color:zc,background:zb,maxWidth:'60px'}}>{p.zhi}</div>
            </div>);
        })}
      </div>

      <div className='rounded-xl border border-black/5 bg-white p-5 mb-6 shadow-sm'>
        <h4 className='text-sm font-bold mb-4 tracking-wider' style={{color:'#1d1d1f'}}>五行能量分析</h4>
        <p className='text-xs mb-4 leading-relaxed' style={{color:'#86868b'}}>以下展示你命局中五行的分布与强弱，每种五行代表不同的人生能量维度。</p>
        {(['木','火','土','金','水'] as const).map(wx => {
          const cnt = wxCount[wx]||0; const pct = Math.round((cnt/8)*100); const d = WX_DETAIL[wx];
          return (
            <div key={wx} className='mb-3 last:mb-0'>
              <div className='flex items-center gap-3 mb-1'>
                <span className='text-xs w-8 font-bold' style={{color:WX_COLOR[wx]}}>{wx}</span>
                <div className='flex-1 h-2 rounded-full overflow-hidden' style={{background:'rgba(0,0,0,0.06)'}}>
                  <div className='h-full rounded-full' style={{width:pct+'%',background:WX_COLOR[wx]}} />
                </div>
                <span className='text-xs w-10 text-right' style={{color:'#86868b'}}>{cnt}/8</span>
              </div>
              <p className='text-[11px] leading-relaxed pl-11' style={{color:'#aaa'}}>
                  <span style={{color:'#555'}}>{d.meaning}</span>
                  {cnt>=3 ? <span style={{color:'#d30505'}}> · 偏强：{d.excess}</span> : cnt<=1 ? <span style={{color:'#2e83f6'}}> · 偏弱：{d.deficit}</span> : <span style={{color:'#07a830'}}> · 均衡</span>}
                </p>
            </div>);
        })}
      </div>

      {zhiRels.length > 0 && (
        <div className='rounded-xl border border-black/5 bg-white p-5 mb-6 shadow-sm'>
          <h4 className='text-sm font-bold mb-3 tracking-wider' style={{color:'#1d1d1f'}}>干支关系</h4>
          <div className='space-y-2'>
            {zhiRels.slice(0,4).map((r:any,i:number) => (
              <div key={i} className='flex items-start gap-2 text-sm'>
                <span className='px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d'}}>{r.type}</span>
                <span style={{color:'#1d1d1f'}}>{r.pair[0]}{r.pair[1]}</span>
                <span className='text-xs' style={{color:'#86868b'}}>{r.desc}</span>
              </div>
            ))}
          </div>
          {zhiRels.length === 0 && <p className='text-xs' style={{color:'#aaa'}}>四柱地支暂无明显合冲刑害关系</p>}
        </div>
      )}

      <button onClick={()=>setExpanded(!expanded)} className='w-full text-center py-2.5 rounded-lg text-xs tracking-wider transition-colors' style={{color:'#b2955d',background:'rgba(178,149,93,0.06)'}}>
        {expanded ? '收起详情 ▲' : '展开更多八字信息 ▼'}
      </button>

      {expanded && (
        <div className='mt-4 space-y-4'>
          {/* 格局分析 */}
          {enrichment?.['格局'] && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>格局分析</h4>
              <div className='space-y-2 text-sm'>
                <div><span style={{color:'#86868b'}}>格局：</span><span className='font-medium ml-1' style={{color:'#b2955d'}}>{enrichment['格局'].primary||'—'}</span><span className='ml-2 text-[10px] px-1.5 py-0.5 rounded' style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>置信度 {enrichment['格局'].confidence||'—'}</span></div>
                {enrichment['格局'].basis && <div><span style={{color:'#86868b'}}>形成原因：</span><span className='ml-1' style={{color:'#555'}}>{enrichment['格局'].basis}</span></div>}
                {enrichment['格局'].透干?.length > 0 && <div><span style={{color:'#86868b'}}>透干：</span><span className='ml-1' style={{color:'#555'}}>{enrichment['格局'].透干.join('、')}</span></div>}
                {enrichment['格局'].notes?.length > 0 && <div><span style={{color:'#86868b'}}>备注：</span><span className='ml-1' style={{color:'#555'}}>{enrichment['格局'].notes.slice(0,4).join('、')}</span></div>}
              </div>
            </div>
          )}

          {/* 旺衰分析 */}
          {enrichment?.['旺衰'] && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>旺衰分析</h4>
              <div className='grid grid-cols-2 gap-3 text-sm mb-3'>
                <div><span style={{color:'#86868b'}}>日主强弱：</span><span className='font-medium' style={{color:'#1d1d1f'}}>{enrichment['旺衰'].verdict||'—'}</span></div>
                <div><span style={{color:'#86868b'}}>得分：</span><span className='font-medium' style={{color:'#1d1d1f'}}>{enrichment['旺衰'].score??'—'}</span><span className='ml-2 text-[10px] px-1.5 py-0.5 rounded' style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>置信度 {enrichment['旺衰'].confidence||'—'}</span></div>
              </div>
              {enrichment['旺衰'].breakdown?.details?.length > 0 && (
                <div className='space-y-1'>
                  <div className='text-[11px] tracking-wider mb-2' style={{color:'#86868b'}}>计算明细</div>
                  {enrichment['旺衰'].breakdown.details.map((d:string,i:number) => (
                    <div key={i} className='text-xs' style={{color:'#999'}}>{d}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 五行统计与调候 */}
          {enrichment?.['五行统计'] && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>五行统计</h4>
              <div className='grid grid-cols-5 gap-2 text-center text-xs mb-3'>
                {(Object.entries(enrichment['五行统计'].surface||{}) as [string,any][]).map(([wx,cnt]) => (
                  <div key={wx} className='rounded-lg p-2' style={{background:wx==='木'?'rgba(7,168,48,0.06)':wx==='火'?'rgba(211,5,5,0.06)':wx==='土'?'rgba(139,109,3,0.06)':wx==='金'?'rgba(239,145,4,0.06)':'rgba(46,131,246,0.06)'}}>
                    <div style={{color:wx==='木'?'#07a830':wx==='火'?'#d30505':wx==='土'?'#8b6d03':wx==='金'?'#ef9104':'#2e83f6'}}>{wx} {cnt}</div>
                  </div>
                ))}
              </div>
              {enrichment['五行统计'].strongest?.length > 0 && <p className='text-xs mb-2' style={{color:'#555'}}>最强五行：<span className='font-medium' style={{color:'#07a830'}}>{enrichment['五行统计'].strongest.join('、')}</span></p>}
              {enrichment['五行统计'].missing?.length > 0 && <p className='text-xs mb-2' style={{color:'#999'}}>缺失五行：{enrichment['五行统计'].missing.join('、')}</p>}
              {enrichment?.['调候用神']?.length > 0 && <p className='text-xs' style={{color:'#555'}}>调候用神：<span className='font-medium' style={{color:'#b2955d'}}>{enrichment['调候用神'].join('、')}</span></p>}
            </div>
          )}

          {/* 十神分析 */}
          {shiShen && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>十神分析</h4>
              <p className='text-xs mb-3 leading-relaxed' style={{color:'#86868b'}}>十神揭示你与外界的关系模式——如何对待他人、获取财富、面对压力。</p>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mb-3'>
                {PILLAR_KEYS.map((key,idx) => {
                  const ss = shiShen?.[key];
                  const info = SHI_SHEN_MEANING[ss||''];
                  if (!ss || !info) return null;
                  return (
                    <div key={key} className='rounded-lg p-3 text-center' style={{background:'rgba(0,0,0,0.02)'}}>
                      <div className='text-[10px] mb-1' style={{color:'#86868b'}}>{PILLAR_LABELS[idx]}</div>
                      <div className='text-sm font-bold mb-1' style={{color:'#1d1d1f'}}>{ss}</div>
                      <div className='text-[10px] leading-relaxed' style={{color:'#999'}}>{info.meaning}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 天干关系 */}
          {enrichment?.['天干关系']?.length > 0 && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>天干关系</h4>
              <div className='space-y-2'>
                {enrichment['天干关系'].map((r:any,i:number) => (
                  <div key={i} className='flex items-start gap-2 text-sm'>
                    <span className='px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d'}}>{r.type}</span>
                    <span style={{color:'#1d1d1f'}}>{r.gans?.join('')}{r.pillars ? '（'+r.pillars.join('')+'柱）' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 地支关系 */}
          {enrichment?.['地支关系']?.length > 0 && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>地支关系</h4>
              <div className='space-y-2'>
                {enrichment['地支关系'].map((r:any,i:number) => (
                  <div key={i} className='flex items-start gap-2 text-sm'>
                    <span className='px-1.5 py-0.5 rounded text-[11px] font-medium flex-shrink-0' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d'}}>{r.type}</span>
                    <span style={{color:'#1d1d1f'}}>{r.zhi?.join('')}{r.pillars ? '（'+r.pillars.join('')+'柱）' : ''}</span>
                    {r.detail && <span className='text-xs' style={{color:'#86868b'}}>{r.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 整柱分析 */}
          {enrichment?.['整柱']?.length > 0 && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>整柱分析</h4>
              <div className='grid grid-cols-4 gap-2 text-center text-xs'>
                {enrichment['整柱'].map((r:any,i:number) => (
                  <div key={i} className='rounded-lg p-2' style={{background:'rgba(0,0,0,0.02)'}}>
                    <div className='mb-1' style={{color:'#86868b'}}>{r.pillar}柱</div>
                    <div className='font-serif font-bold text-sm mb-0.5' style={{color:'#1d1d1f'}}>{r.gan}{r.zhi}</div>
                    <div style={{color:'#b2955d'}}>{r.verdict}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 大运概览 */}
          {dayun && dayun.length > 0 && (
            <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
              <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>大运起运：<span style={{color:'#b2955d'}}>{dayunLabel}</span></h4>
              <div className='flex flex-wrap gap-2'>
                {dayun.slice(0,8).map((dy:any,i:number)=>(
                  <div key={i} className='rounded-lg px-3 py-2 text-center text-xs' style={{background:'rgba(0,0,0,0.03)'}}>
                    <div style={{color:'#86868b'}}>{dy.startAge}岁</div>
                    <div className='font-medium mt-0.5' style={{color:'#1d1d1f'}}>{dy.ganZhi?.gan}{dy.ganZhi?.zhi}</div>
                  </div>))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}