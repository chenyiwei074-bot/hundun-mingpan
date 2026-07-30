'use client';

import React from 'react';

// ===== 类型定义 =====
interface DoubleAnalysisItem {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  baziEvidence: { title: string; content: string; source: string; };
  ziweiEvidence: { title: string; content: string; source: string; };
  combinedJudgment: string;
  practicalAdvice: string;
  caution?: string;
}

interface LifeStageItem {
  label: string;
  ageRange: string;
  baziHint: string;
  ziweiHint: string;
  theme: string;
}

interface Props { chartData: any; }

// ===== 辅助函数 =====
function getGong(gongs: any[], name: string) {
  return (gongs || []).find((g: any) => g.gong === name) || (gongs || []).find((g: any) => g.gong === name.replace('宫',''));
}

function buildAnalyses(chartData: any): DoubleAnalysisItem[] {
  const bazi = chartData?.bazi;
  const ziwei = chartData?.ziwei;
  const enrichment = bazi?.enrichment;
  const gongs = ziwei?.gongs || [];
  const dm = bazi?.dayMaster || '—';
  const wl = enrichment?.['旺衰']?.level || '';
  const gn = enrichment?.['格局']?.name || '';
  const gnTags = enrichment?.['格局']?.tags || [];
  const ds = bazi?.dayunStart;
  const displayDs = ds != null ? Math.round(ds) || 1 : null;
  const dsLabel = ds != null && ds !== Math.round(ds) ? '约' + displayDs + '岁' : ds != null ? displayDs + '岁' : '';

  const mg = getGong(gongs, '命宫');
  const glg = getGong(gongs, '官禄宫');
  const cbg = getGong(gongs, '财帛宫');
  const fqg = getGong(gongs, '夫妻宫');
  const fdg = getGong(gongs, '福德宫');

  const mgStars = mg?.mainStars?.join('、') || '';
  const glgStars = glg?.mainStars?.join('、') || '';
  const cbgStars = cbg?.mainStars?.join('、') || '';
  const fqgStars = fqg?.mainStars?.join('、') || '';
  const fdgStars = fdg?.mainStars?.join('、') || '';

  return [
    {
      id: 'career', title: '事业格局', subtitle: '先天能力结构 × 后天事业方向',
      keywords: [wl === '身强' ? '主动型' : '协作型', gn || '将在深度报告中展开', glgStars ? '有明确方向' : '将在双盘报告中详细展开'].filter(Boolean),
      baziEvidence: {
        title: '八字：先天能力结构',
        content: dm ? '日主「' + dm + '」，' + (wl || '旺衰数据加载中') + '。' + (gn ? '格局「' + gn + '」决定事业上限与适合领域。' : '格局将在深度报告中详细解读。') + (ds != null ? '起运' + ds + '岁，每十年一次事业方向调整。' : '') : '八字数据未完整加载。',
        source: '来源：日主旺衰 · 格局分析 · 官杀配置'
      },
      ziweiEvidence: {
        title: '紫微：后天事业验证',
        content: glgStars ? '官禄宫「' + glgStars + '」坐守，指明事业方向与社会地位。' + (mgStars ? '命宫「' + mgStars + '」揭示你的核心竞争力与做事风格。' : '') : '根据官禄宫结构可分析事业方向。',
        source: '来源：官禄宫 · 命宫主星 · 四化分布'
      },
      combinedJudgment: '【需后端双盘AI引擎】八字定先天能力上限与事业格局，紫微定后天事业方向与成就领域。两者交叉可精准定位适合你的职业赛道。当前为基础数据结构展示，完整双盘合参需后端AI分析服务生成。',
      practicalAdvice: wl === '身强' ? '你的先天能量充足，适合主动开创。建议选择能发挥主导权的领域。' : wl === '身弱' ? '你的优势在于协作与整合，建议选择需要团队配合与资源协调的方向。' : '先天能量均衡，可在主动与协作间灵活切换，选择与自身能力匹配的领域深耕。',
      caution: '避免追逐短期热点，事业选择应与命格格局匹配，而非盲目跟风。'
    },
    {
      id: 'wealth', title: '财富模式', subtitle: '先天财星配置 × 后天财富获取',
      keywords: [gn ? gn : '将在深度报告中展开', cbgStars ? '有财帛指向' : '将在双盘报告中详细展开', wl === '身强' ? '可担财' : wl === '身弱' ? '需借力' : ''].filter(Boolean),
      baziEvidence: {
        title: '八字：先天财富结构',
        content: '财星与日主的关系决定财富上限与获取难度。' + (wl ? (wl === '身强' ? '日主身强，可担重财，财富获取以主动创造为主。' : '日主身弱，需借助他人之力获取财富，合作共赢为上策。') : '旺衰数据加载中。') + (gn ? '格局「' + gn + '」暗示财富积累模式。' : ''),
        source: '来源：财星配置 · 日主旺衰 · 身财关系'
      },
      ziweiEvidence: {
        title: '紫微：后天财富验证',
        content: cbgStars ? '财帛宫「' + cbgStars + '」坐守，揭示你的金钱观与财富获取方式。' + (fdgStars ? '福德宫「' + fdgStars + '」指向晚年财富积累与精神富足。' : '') : '根据财帛宫结构可分析财富格局。',
        source: '来源：财帛宫 · 福德宫 · 禄存位置'
      },
      combinedJudgment: '【需后端双盘AI引擎】八字看财富格局大小与能否守财，紫微看财富获取方式与最佳时机。双盘叠加可绘制财富生命周期曲线。当前为基础数据结构展示，完整双盘合参需后端AI分析服务生成。',
      practicalAdvice: '建议根据财帛宫主星特性制定理财策略：稳健型宜长期储蓄与不动产，进取型可关注成长性投资。注意大运财星周期的起伏变化，旺财之年大胆进取，弱财之年保守守成。',
      caution: '财富追求需与命格匹配，强求不属自己的财富模式往往适得其反。'
    },
    {
      id: 'relationship', title: '感情关系', subtitle: '先天配偶结构 × 后天缘分深浅',
      keywords: [fqgStars ? '有明确指向' : '将在双盘报告中详细展开', '待双盘分析'].filter(Boolean),
      baziEvidence: {
        title: '八字：先天感情结构',
        content: '日支为配偶宫，代表伴侣特征与婚姻基础。十神中的官杀（女命）/财星（男命）为配偶星，其与日主的关系决定婚姻质量与相处模式。',
        source: '来源：日支(配偶宫) · 配偶星 · 桃花配置'
      },
      ziweiEvidence: {
        title: '紫微：后天缘分验证',
        content: fqgStars ? '夫妻宫「' + fqgStars + '」坐守，揭示你的婚姻观、配偶特征与相处模式。' + (mgStars ? '命宫「' + mgStars + '」与夫妻宫的关系暗示你吸引的伴侣类型。' : '') : '根据夫妻宫结构可分析感情模式。',
        source: '来源：夫妻宫 · 命宫 · 红鸾天喜'
      },
      combinedJudgment: '【需后端双盘AI引擎】八字看婚姻先天基础与配偶特征，紫微看缘分深浅、相处模式与最佳时机。两者结合可精准定位适合你的伴侣特征与婚恋策略。当前为基础数据结构展示。',
      practicalAdvice: '选择与日主互补的伴侣类型为佳，身强者宜找温和型，身弱者宜找担当型。关注夫妻宫大限流年变化，把握婚恋窗口期。',
      caution: '婚姻大事不可强求，时机未到时应先完善自身，以最好的状态迎接缘分。'
    },
    {
      id: 'life_stages', title: '人生阶段', subtitle: '先天大运周期 × 后天领域侧重',
      keywords: [ds != null ? '起运' + ds + '岁' : '', '十年一运', fdgStars ? '晚年有福' : ''].filter(Boolean),
      baziEvidence: {
        title: '八字：先天大运周期',
        content: (ds != null ? '起运' + ds + '岁，每十年为一大运，一生约8-9个大运周期。' : '大运数据加载中。') + '每个大运有特定的天干地支组合，决定该阶段的核心主题与运势走向。',
        source: '来源：大运排盘 · 起运时间 · 顺逆方向'
      },
      ziweiEvidence: {
        title: '紫微：后天领域侧重',
        content: (fdgStars ? '福德宫「' + fdgStars + '」指向晚年福报与精神追求。' : '根据福德宫结构可分析精神追求。') + '各宫大限（十年大限）对应不同人生阶段的重点领域，从命宫开始依次流转十二宫。',
        source: '来源：大限流转 · 福德宫 · 各宫十年大限'
      },
      combinedJudgment: '【需后端双盘AI引擎】八字大运提供时间框架，紫微大限提供领域聚焦。两者叠加可绘制你的人生起伏曲线，明确每个阶段的核心任务与机遇窗口。当前为基础数据结构展示。',
      practicalAdvice: '提前了解各阶段主题，做好人生规划。上升期大胆进取，平台期注重积累，下行期保守守成。关键转折点往往在大运交接前后2-3年。',
      caution: '运势如潮汐，有涨有落。低谷时不气馁，高峰时不骄傲，顺势而为方为人生智慧。'
    },
  ];
}

function buildLifeStages(chartData: any): LifeStageItem[] {
  const bazi = chartData?.bazi;
  const ziwei = chartData?.ziwei;
  const ds = bazi?.dayunStart;
  const dayun = bazi?.dayun || [];
  const gongs = ziwei?.gongs || [];

  if (ds == null || dayun.length === 0) {
    return [
      { label: '少年', ageRange: '—', baziHint: '大运数据数据同步中，刷新页面后展现', ziweiHint: '大限数据数据同步中，刷新页面后展现', theme: '将在深度报告中展开' },
      { label: '青年', ageRange: '—', baziHint: '大运数据数据同步中，刷新页面后展现', ziweiHint: '大限数据数据同步中，刷新页面后展现', theme: '将在深度报告中展开' },
      { label: '中年', ageRange: '—', baziHint: '大运数据数据同步中，刷新页面后展现', ziweiHint: '大限数据数据同步中，刷新页面后展现', theme: '将在深度报告中展开' },
      { label: '晚年', ageRange: '—', baziHint: '大运数据数据同步中，刷新页面后展现', ziweiHint: '大限数据数据同步中，刷新页面后展现', theme: '将在深度报告中展开' },
    ];
  }

  const stages: LifeStageItem[] = [];
  const lifePhases = [
    { label: '少年', maxAge: 20, keyword: '学习成长' },
    { label: '青年', maxAge: 40, keyword: '奋斗拼搏' },
    { label: '中年', maxAge: 60, keyword: '收获巩固' },
    { label: '晚年', maxAge: 120, keyword: '享受传承' },
  ];

  for (const phase of lifePhases) {
    const relevantDayun = dayun.filter((d: any) => {
      const startAge = d.startAge || 0;
      return startAge >= (phase.label === '少年' ? 0 : phase.label === '青年' ? 20 : phase.label === '中年' ? 40 : 60)
        && startAge < phase.maxAge;
    });

    const firstDy = relevantDayun[0];
    const ageStart = firstDy?.startAge || '—';
    const ageEnd = relevantDayun[relevantDayun.length - 1]?.endAge || '—';

    stages.push({
      label: phase.label,
      ageRange: ageStart + '-' + ageEnd + '岁',
      baziHint: firstDy ? '起运' + ds + '岁，' + phase.label + '阶段涵盖' + relevantDayun.length + '个大运' : '将在深度报告中展开',
      ziweiHint: phase.label === '少年' ? '命宫→父母宫大限' : phase.label === '青年' ? '福德→官禄大限' : phase.label === '中年' ? '交友→财帛大限' : '子女→命宫大限（第二轮）',
      theme: phase.keyword,
    });
  }

  return stages;
}

// ===== 组件 =====
export default function DoubleVerify({ chartData }: Props) {
  const analyses = buildAnalyses(chartData);
  const lifeStages = buildLifeStages(chartData);
  const bazi = chartData?.bazi;
  const ziwei = chartData?.ziwei;

  return (
    <section className='w-full'>
      {/* 标题区域 */}
      <div className='mb-6'>
        <h3 className='font-serif text-xl font-bold mb-2 tracking-wider' style={{color:'#1d1d1f'}}>
          <span className='inline-block w-1.5 h-5 rounded-full mr-2.5 align-middle' style={{background:'#b2955d'}} />
          你的双盘人生分析
        </h3>
        <p className='text-sm leading-relaxed' style={{color:'#86868b'}}>
          八字提供<strong style={{color:'#1d1d1f'}}>先天结构</strong>与<strong style={{color:'#1d1d1f'}}>时间框架</strong>，
          紫微提供<strong style={{color:'#1d1d1f'}}>人生领域</strong>与<strong style={{color:'#1d1d1f'}}>场景验证</strong>。
          两者交叉得出<strong style={{color:'#b2955d'}}>双盘综合判断</strong>。
        </p>
      </div>

      {/* 4个分析维度 */}
      <div className='space-y-5 mb-8'>
        {analyses.filter(a => a.id !== 'life_stages').map((item, i) => (
          <div key={item.id} className='rounded-xl border border-black/5 bg-white shadow-sm overflow-hidden'>
            {/* 维度头部 */}
            <div className='px-5 py-4' style={{borderBottom:'0.5px solid rgba(0,0,0,0.05)'}}>
              <div className='flex items-center gap-3 mb-2'>
                <span className='font-serif text-base font-bold' style={{color:'#1d1d1f'}}>{item.title}</span>
                <span className='text-xs' style={{color:'#86868b'}}>{item.subtitle}</span>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {item.keywords.map((kw, j) => (
                  <span key={j} className='inline-block px-2 py-0.5 rounded-full text-[11px] font-medium'
                    style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>{kw}</span>
                ))}
              </div>
            </div>

            {/* 双盘融合 */}
            <div className='px-5 py-4'>
              {/* 八字依据 + 紫微验证 并排 */}
              <div className='grid md:grid-cols-2 gap-3 mb-4'>
                <div className='rounded-lg p-3 relative' style={{background:'rgba(46,131,246,0.03)',border:'0.5px solid rgba(46,131,246,0.1)'}}>
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='text-xs font-bold px-1.5 py-0.5 rounded' style={{background:'rgba(46,131,246,0.1)',color:'#2e83f6'}}>八字</span>
                    <span className='text-[11px]' style={{color:'#2e83f6'}}>{item.baziEvidence.title}</span>
                  </div>
                  <p className='text-sm leading-relaxed mb-2' style={{color:'#555'}}>{item.baziEvidence.content}</p>
                  <p className='text-[10px]' style={{color:'#aaa'}}>{item.baziEvidence.source}</p>
                </div>
                <div className='rounded-lg p-3 relative' style={{background:'rgba(7,168,48,0.03)',border:'0.5px solid rgba(7,168,48,0.1)'}}>
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='text-xs font-bold px-1.5 py-0.5 rounded' style={{background:'rgba(7,168,48,0.1)',color:'#07a830'}}>紫微</span>
                    <span className='text-[11px]' style={{color:'#07a830'}}>{item.ziweiEvidence.title}</span>
                  </div>
                  <p className='text-sm leading-relaxed mb-2' style={{color:'#555'}}>{item.ziweiEvidence.content}</p>
                  <p className='text-[10px]' style={{color:'#aaa'}}>{item.ziweiEvidence.source}</p>
                </div>
              </div>

              {/* 融合箭头 */}
              <div className='flex justify-center mb-4'>
                <div className='flex items-center gap-2 px-4 py-1.5 rounded-full' style={{background:'rgba(178,149,93,0.06)'}}>
                  <span style={{color:'#b2955d',fontSize:'10px'}}>八字结构</span>
                  <span style={{color:'#b2955d'}}>+</span>
                  <span style={{color:'#b2955d',fontSize:'10px'}}>紫微验证</span>
                  <span style={{color:'#b2955d'}}>→</span>
                  <span className='font-bold' style={{color:'#b2955d',fontSize:'10px'}}>双盘结论</span>
                </div>
              </div>

              {/* 综合判断 */}
              <div className='rounded-lg p-4 mb-3' style={{background:'rgba(178,149,93,0.04)',border:'0.5px solid rgba(178,149,93,0.12)'}}>
                <div className='text-xs font-bold mb-1.5' style={{color:'#b2955d'}}>⚡ 双盘综合判断</div>
                <p className='text-sm leading-relaxed' style={{color:'#555'}}>{item.combinedJudgment}</p>
              </div>

              {/* 行动建议 */}
              <div className='rounded-lg p-3 mb-2' style={{background:'rgba(0,0,0,0.02)'}}>
                <div className='text-xs font-bold mb-1.5' style={{color:'#1d1d1f'}}>💡 行动建议</div>
                <p className='text-sm leading-relaxed' style={{color:'#555'}}>{item.practicalAdvice}</p>
              </div>

              {/* 注意事项 */}
              {item.caution && (
                <div className='rounded-lg p-3' style={{background:'rgba(211,5,5,0.02)',border:'0.5px dashed rgba(211,5,5,0.1)'}}>
                  <div className='text-xs font-bold mb-1.5' style={{color:'#d30505'}}>⚠️ 注意事项</div>
                  <p className='text-sm leading-relaxed' style={{color:'#777'}}>{item.caution}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 人生阶段时间轴 */}
      <div className='rounded-xl border border-black/5 bg-white shadow-sm overflow-hidden'>
        <div className='px-5 py-4' style={{borderBottom:'0.5px solid rgba(0,0,0,0.05)'}}>
          <div className='flex items-center gap-3 mb-2'>
            <span className='font-serif text-base font-bold' style={{color:'#1d1d1f'}}>人生阶段</span>
            <span className='text-xs' style={{color:'#86868b'}}>先天大运周期 × 后天领域侧重</span>
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {lifeStages[0]?.baziHint !== '大运数据数据同步中，刷新页面后展现' ? (
              <>
                <span className='inline-block px-2 py-0.5 rounded-full text-[11px] font-medium' style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>起运{chartData?.bazi?.dayunStart}岁</span>
                <span className='inline-block px-2 py-0.5 rounded-full text-[11px] font-medium' style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>十年一运</span>
              </>
            ) : (
              <span className='inline-block px-2 py-0.5 rounded-full text-[11px] font-medium' style={{background:'rgba(0,0,0,0.04)',color:'#86868b'}}>大运数据数据同步中，刷新页面后展现</span>
            )}
          </div>
        </div>
        <div className='px-5 py-5'>
          {/* 时间轴 */}
          <div className='relative'>
            {/* 横线 */}
            <div className='absolute top-6 left-0 right-0 h-0.5' style={{background:'linear-gradient(90deg, rgba(178,149,93,0.15), rgba(178,149,93,0.5), rgba(178,149,93,0.15))'}} />

            <div className='grid grid-cols-4 gap-2 relative'>
              {lifeStages.map((stage, i) => (
                <div key={i} className='text-center'>
                  {/* 圆点 */}
                  <div className='flex justify-center mb-3'>
                    <div className='w-3 h-3 rounded-full relative z-10' style={{
                      background: i === 1 ? '#b2955d' : i === 2 ? '#8b6d03' : 'rgba(178,149,93,0.3)',
                      boxShadow: i === 1 ? '0 0 0 3px rgba(178,149,93,0.2)' : 'none'
                    }} />
                  </div>
                  {/* 内容 */}
                  <div className='space-y-1.5'>
                    <div className='font-serif text-sm font-bold' style={{color:'#1d1d1f'}}>{stage.label}</div>
                    <div className='text-xs' style={{color:'#b2955d'}}>{stage.ageRange}</div>
                    {stage.theme !== '将在深度报告中展开' && (
                      <div className='text-[11px] px-2 py-0.5 rounded-full inline-block' style={{background:'rgba(178,149,93,0.08)',color:'#b2955d'}}>{stage.theme}</div>
                    )}
                    {stage.theme === '将在深度报告中展开' && (
                      <div className='text-[11px]' style={{color:'#ccc'}}>将在深度报告中展开</div>
                    )}
                    <div className='text-[10px] leading-relaxed' style={{color:'#aaa'}}>
                      <div className='mb-0.5'>
                        <span style={{color:'#2e83f6'}}>八字 </span>
                        {stage.baziHint}
                      </div>
                      <div>
                        <span style={{color:'#07a830'}}>紫微 </span>
                        {stage.ziweiHint}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 后端数据提示 */}
      <div className='mt-6 rounded-lg p-4 text-center' style={{background:'rgba(0,0,0,0.02)',border:'0.5px dashed rgba(0,0,0,0.08)'}}>
        <p className='text-xs' style={{color:'#999'}}>
          ⚡ 以上双盘分析基于 <strong style={{color:'#1d1d1f'}}>前端静态知识库</strong> 与 <strong style={{color:'#1d1d1f'}}>命盘结构数据</strong> 生成。
          完整双盘AI合参分析需 <strong style={{color:'#b2955d'}}>后端双盘分析引擎</strong> 支持。
        </p>
      </div>
    </section>
  );
}
