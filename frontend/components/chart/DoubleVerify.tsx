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
      <header style={{ marginBottom: 24 }}>
        <p className='qn-eyebrow' style={{ marginBottom: 6 }}>双盘合参</p>
        <h3 className='qn-title' style={{ marginBottom: 10 }}>你的双盘人生分析</h3>
        <p className='qn-meta'>
          八字提供<strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>先天结构</strong>与<strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>时间框架</strong>，
          紫微提供<strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>人生领域</strong>与<strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>场景验证</strong>。
          两者交叉得出<strong style={{ color: 'var(--color-accent-gold-text)', fontWeight: 500 }}>双盘综合判断</strong>。
        </p>
      </header>

      {/* 4个分析维度 */}
      <div style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
        {analyses.filter(a => a.id !== 'life_stages').map((item) => (
          <div key={item.id} className='qn-card' style={{ padding: 0 }}>
            {/* 维度头部 */}
            <div style={{ padding: '18px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className='qn-body' style={{ fontWeight: 600 }}>{item.title}</span>
                <span className='qn-cap'>{item.subtitle}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {item.keywords.map((kw, j) => (
                  <span key={j} className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>{kw}</span>
                ))}
              </div>
            </div>

            {/* 双盘融合 */}
            <div style={{ padding: '18px 20px' }}>
              {/* 八字依据 + 紫微验证 并排 */}
              <div className='grid md:grid-cols-2' style={{ gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className='qn-cap' style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-primary)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>八字</span>
                    <span className='qn-cap'>{item.baziEvidence.title}</span>
                  </div>
                  <p className='qn-meta' style={{ color: 'var(--color-text-primary)', marginBottom: 6 }}>{item.baziEvidence.content}</p>
                  <p className='qn-cap'>{item.baziEvidence.source}</p>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className='qn-cap' style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-primary)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>紫微</span>
                    <span className='qn-cap'>{item.ziweiEvidence.title}</span>
                  </div>
                  <p className='qn-meta' style={{ color: 'var(--color-text-primary)', marginBottom: 6 }}>{item.ziweiEvidence.content}</p>
                  <p className='qn-cap'>{item.ziweiEvidence.source}</p>
                </div>
              </div>

              {/* 融合箭头 */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <p className='qn-cap' style={{ color: 'var(--color-accent-gold-text)', background: 'rgba(178,149,93,0.07)', padding: '5px 14px', borderRadius: 999 }}>八字结构 + 紫微验证 → 双盘结论</p>
              </div>

              {/* 综合判断 */}
              <div style={{ background: 'rgba(178,149,93,0.05)', boxShadow: 'inset 0 0 0 1px rgba(178,149,93,0.16)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
                <div className='qn-axis' style={{ marginBottom: 6 }}>双盘综合判断</div>
                <p className='qn-meta' style={{ color: 'var(--color-text-primary)' }}>{item.combinedJudgment}</p>
              </div>

              {/* 行动建议 */}
              <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                <div className='qn-axis' style={{ marginBottom: 6 }}>行动建议</div>
                <p className='qn-meta' style={{ color: 'var(--color-text-primary)' }}>{item.practicalAdvice}</p>
              </div>

              {/* 注意事项 */}
              {item.caution && (
                <div style={{ background: 'rgba(178,58,46,0.04)', boxShadow: 'inset 0 0 0 1px rgba(178,58,46,0.16)', borderRadius: 12, padding: '12px 14px' }}>
                  <div className='qn-axis' style={{ color: 'var(--color-xiong)', marginBottom: 6 }}>注意事项</div>
                  <p className='qn-meta' style={{ color: 'var(--color-text-primary)' }}>{item.caution}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 人生阶段时间轴 */}
      <div className='qn-card' style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className='qn-body' style={{ fontWeight: 600 }}>人生阶段</span>
            <span className='qn-cap'>先天大运周期 × 后天领域侧重</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {lifeStages[0]?.baziHint !== '大运数据数据同步中，刷新页面后展现' ? (
              <>
                <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>起运{chartData?.bazi?.dayunStart}岁</span>
                <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 10px', borderRadius: 999, fontWeight: 500 }}>十年一运</span>
              </>
            ) : (
              <span className='qn-cap' style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--color-text-secondary)', padding: '3px 10px', borderRadius: 999 }}>大运数据数据同步中，刷新页面后展现</span>
            )}
          </div>
        </div>
        <div style={{ padding: '22px 20px' }}>
          {/* 时间轴 */}
          <div style={{ position: 'relative' }}>
            {/* 横线 */}
            <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, rgba(178,149,93,0.15), rgba(178,149,93,0.55), rgba(178,149,93,0.15))' }} />

            <div className='grid grid-cols-4' style={{ position: 'relative', gap: 8 }}>
              {lifeStages.map((stage) => (
                <div key={stage.label} style={{ textAlign: 'center' }}>
                  {/* 圆点 */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-accent-gold)', boxShadow: '0 0 0 4px #fff' }} />
                  </div>
                  {/* 内容 */}
                  <div style={{ display: 'grid', gap: 5 }}>
                    <div className='qn-body' style={{ fontWeight: 600 }}>{stage.label}</div>
                    <div className='qn-cap' style={{ color: 'var(--color-accent-gold-text)' }}>{stage.ageRange}</div>
                    {stage.theme !== '将在深度报告中展开' && (
                      <div>
                        <span className='qn-cap' style={{ background: 'rgba(178,149,93,0.10)', color: 'var(--color-accent-gold-text)', padding: '3px 10px', borderRadius: 999, display: 'inline-block', fontWeight: 500 }}>{stage.theme}</span>
                      </div>
                    )}
                    {stage.theme === '将在深度报告中展开' && (
                      <div className='qn-cap'>将在深度报告中展开</div>
                    )}
                    <div className='qn-cap' style={{ marginTop: 4 }}>
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>八字 </span>{stage.baziHint}
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>紫微 </span>{stage.ziweiHint}
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
      <div className='qn-card' style={{ marginTop: 24, padding: '16px 20px', textAlign: 'center', boxShadow: 'none', border: '0.5px dashed rgba(0,0,0,0.12)' }}>
        <p className='qn-cap'>
          以上双盘分析基于 <strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>前端静态知识库</strong> 与 <strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>命盘结构数据</strong> 生成。
          完整双盘AI合参分析需 <strong style={{ color: 'var(--color-accent-gold-text)', fontWeight: 500 }}>后端双盘分析引擎</strong> 支持。
        </p>
      </div>
    </section>
  );
}
