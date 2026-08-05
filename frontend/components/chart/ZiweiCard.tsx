'use client';

import React, { useState } from 'react';

// ===== 类型 =====
interface GongInfo {
  gong: string; tiangan?: string; dizhi?: string;
  mainStars?: string[]; auxStars?: string[];
  sihua?: Array<{star:string;hua:string}>;
}
interface Props { ziwei: any; bazi?: any; }

const KEY_GONGS = ['命宫','官禄宫','财帛宫','夫妻宫','福德宫'];


// ===== 星曜个性化解读库 =====
const STAR_DETAIL: Record<string,{p:string,l:string,a:string}> = {
  '紫微':{p:'帝王之星，主领导力与贵气。紫微坐命者天生具有统御气质，做事有格局，不甘平凡，追求卓越与尊贵。',l:'你天生具备领袖气质，在人群中容易被推举为核心。你不喜欢被人指挥，更愿意主导局面。做决定时重视大局观，但有时会显得过于强势，需注意倾听他人。',a:'适合管理、政务、高端服务行业。注意倾听他人意见，避免一意孤行。贵人运强，多与德高望重者结交。'},
  '天机':{p:'谋略之星，主智慧与变通。天机坐命者思维敏捷，善于策划与分析，应变能力极强，是天生的谋士与军师型人物。',l:'你脑子转得快，凡事喜欢想清楚再行动。你擅长学习新事物，但兴趣点容易转移。遇到问题时总能找到变通方案，是个灵活的思考者。需要注意不要过于善变。',a:'适合咨询、策划、研发、IT行业。选准方向后坚持深耕，不要频繁切换赛道。多锻炼身体，注意神经系统保养，保持规律作息。'},
  '太阳':{p:'中天之主，主热情与光明。太阳坐命者胸怀坦荡，乐于助人，有强烈的正义感和公众缘，是天生的公众人物与领导者。',l:'你为人光明磊落，热于助人，走到哪都受欢迎。你在人群中往往是气氛制造者，充满正能量。但有时过于操心他人而忽略自己，也要注意别太爱面子，学会适度保护自己。',a:'适合教育、公益、媒体、公共关系。注意保护眼睛和心脏健康。学会适度拒绝，你的热情需要用在正确的地方，不要过度消耗自己。'},
  '武曲':{p:'财星，主果断与执行。武曲坐命者刚毅果决，执行力超强，有金融头脑，善于资金运作与风险管理，是天生的实干家。',l:'你做事干净利落，不喜欢拖泥带水。你对金钱敏感，理财意识强，但表达方式比较直接，有时显得不近人情。内心其实渴望稳定与安全感，只是不轻易表露脆弱。',a:'适合金融、贸易、军警、制造业。注意培养柔性沟通能力，感情中多表达温柔一面。投资眼光好但需控制风险，避免过于激进的财务决策。'},
  '天同':{p:'福星，主随和与享受。天同坐命者性情温和，与世无争，人缘极佳，是十二主星中最有福气的星曜，知足常乐。',l:'你天性乐观，知足常乐，不喜欢争斗。你的好人缘是天生的，走到哪都有人愿意帮你。但有时缺乏进取心，容易满足现状，需要外力推动才能迈出舒适区。',a:'适合服务、艺术、餐饮、休闲产业。注意培养主动性和竞争意识。你的福气需要行动来激活，不要被动等待机会，适当给自己一些挑战。'},
  '廉贞':{p:'囚星，主原则与清高。廉贞坐命者注重规则与秩序，有强烈的道德感和职业操守，为人正直不阿，宁折不弯。',l:'你有自己的原则底线，不轻易妥协。做事认真负责，但有完美主义倾向，对自己和别人要求都很高。内心情感丰富但不轻易表露，需要学会放松和信任他人。',a:'适合法律、审计、质检、行政管理。学会接纳不完美，不要对自己太苛刻。感情方面需要主动表达真心，不要让原则成为阻隔亲密关系的墙。'},
  '天府':{p:'库星，主稳定与守成。天府坐命者稳重可靠，善于管理与储蓄，是天生的管家型人才，给人满满的安全感与信赖。',l:'你稳重可靠，是朋友圈里最让人放心的那个人。你善于规划和管理资源，做事有条不紊。但有时过于保守，面对变化时会犹豫不决，需要突破舒适区。',a:'适合财务、仓储、行政、物业管理。适当尝试新鲜事物，给自己设定小冒险目标。投资风格偏稳健，适合长期持有策略，但也要关注成长性机会。'},
  '太阴':{p:'母星，主细腻与内敛。太阴坐命者情感丰富细腻，审美眼光独到，善于照顾他人，是温柔体贴的代表，内秀外慧。',l:'你心思细腻，善解人意，有天然的同理心。你对美的事物敏感，可能有艺术天赋。但容易想太多，情绪波动较大，需要学会自我调节，不让情绪主导决策。',a:'适合艺术、设计、护理、心理咨询。注意情绪管理，培养心理韧性。你的细腻是优势，但不要让它变成内耗。学会在适当时候果断行动。'},
  '贪狼':{p:'桃花星，主欲望与才华。贪狼坐命者多才多艺，社交手腕高超，是十二主星中最有魅力的星曜，学什么都快，但需注意节制。',l:'你天生有魅力，社交能力强，走到哪都是焦点。你多才多艺，学东西快，但容易三分钟热度。你对新鲜事物充满好奇，但也容易被诱惑，需要学会聚焦。',a:'适合娱乐、艺术、销售、公关。注意控制欲望，避免沉迷享乐。你的才华需要聚焦，选定一两个方向深耕会有大成就。学会延迟满足。'},
  '巨门':{p:'暗星，主口才与思辨。巨门坐命者善于沟通与辩论，思维深刻，是天生的演说家与分析师，看问题直达本质，但需防口舌是非。',l:'你口才出众，表达能力强，善于深入分析问题。你对事物的本质有强烈好奇心，喜欢刨根问底。但有时言辞过于犀利，容易得罪人而不自知，需要学习说话的智慧。',a:'适合法律、教育、媒体、研究。注意说话方式，柔能克刚。你的分析能力是核心竞争力，但要学会在合适时机表达，不是所有真相都需要说出口。'},
  '天相':{p:'印星，主辅佐与服务。天相坐命者忠诚可靠，善于协调与辅助，是天生的二把手，服务意识强，团队中最不可或缺的粘合剂。',l:'你是团队中最可靠的伙伴，善于协调各方关系。你喜欢帮助他人，从中获得成就感。但有时缺乏主见，过于依赖他人决策，需要培养独立判断的能力。',a:'适合行政、人力资源、客户服务、医疗。学会为自己做决定，不要总把选择权交给别人。你的忠诚会被贵人赏识，但要先对自己忠诚。'},
  '天梁':{p:'药星，主正直与守护。天梁坐命者正义感强，乐于助人，是天然的守护者和保护者，有长者之风，晚年运势尤佳。',l:'你天生有正义感，看不得不公平的事。你乐于助人，朋友有困难第一个想到你。你喜欢照顾别人，但也容易背负过多责任。你的福报在后半生，越老越有福气。',a:'适合医疗、教育、慈善、司法。注意不要过度操心他人之事。你的福报在于助人为乐，但要先照顾好自己。晚年运势佳，早年的积累会在后期回报。'},
  '七杀':{p:'将星，主竞争与拼搏。七杀坐命者敢闯敢拼，竞争意识极强，是天生的开拓者，适合开创性事业，人生注定不平凡。',l:'你不怕挑战，越是困难越有斗志。你有强烈的竞争意识，做事有冲劲，但有时过于急躁。你的人生注定不平凡，大起大落是常态，但每次低谷后都能强势反弹。',a:'适合创业、体育、军警、竞争性行业。注意控制脾气，冲动是魔鬼。你的勇气是资本，但需要与智慧结合。学会在行动前多思考一步。'},
  '破军':{p:'破旧立新之星，主创新与颠覆。破军坐命者敢于打破常规，推陈出新，是天生的改革者与创新者，不破不立，破而后立。',l:'你不喜欢循规蹈矩，总是想打破现状。你有强烈的创新意识，但有时显得不安分。你的人生充满了变化和转折，适应力超强。你需要找到值得你全力以赴的事业。',a:'适合创业、科技、设计、变革型行业。注意不要为了改变而改变，有的放矢。你需要在创新与稳定之间找到平衡点，不是所有旧事物都需要打破。'},
};

// ===== 辅星 =====
const AUX_STAR: Record<string,string> = {
  '左辅':'贵人星，主协助与支持，得力的左膀右臂','右弼':'贵人星，主辅助与助力，暗中相助的贵人',
  '文昌':'文星，主文采与学识，利于考试和学术','文曲':'文星，主才艺与口才，艺术天赋出众',
  '天魁':'贵人星，主科举与功名，遇难有贵人相助','天钺':'贵人星，主功名与机遇，考试晋升的助力',
  '禄存':'财星，主稳定财源，一生衣食无忧','天马':'动星，主奔波与变动，利于外出发展',
  '擎羊':'煞星，主刚强与竞争，行动力强但易冲动','陀罗':'煞星，主拖延与反复，做事需要耐心',
  '火星':'煞星，主爆发与急躁，来得快去得也快','铃星':'煞星，主暗中的压力与焦虑，需自我调适',
  '地空':'空星，主虚空与幻想，思维跳跃不切实际','地劫':'劫星，主损耗与波折，需谨慎管理资源',
  '天刑':'刑星，主法律与规则','天姚':'桃花星，主浪漫与情缘，异性缘佳',
  '红鸾':'桃花星，主喜事与姻缘','天喜':'桃花星，主欢乐与庆典',
  '三台':'贵星，主稳定与礼仪','八座':'贵星，主权势与地位',
  '龙池':'贵星，主清贵与品味','凤阁':'贵星，主优雅与审美',
  '天才':'才星，主天赋与灵感','天寿':'寿星，主长寿与健康',
};

// ===== 星曜组合 =====
const STAR_COMBO: Record<string,string> = {
  '紫微+天府':'帝王双星同度，既有紫微的领导气魄，又有天府的稳重守成，是难得的大格局。你天生适合做管理者，格局大、能容人、善守成。',
  '紫微+破军':'帝星破军，先立后破。你的人生有大起大落的特点，有强烈的创业冲动和创新精神，前半生建立，后半生转型。',
  '紫微+天相':'帝星带印，掌印之才。你有权力有责任，适合在体制内发展，天生是辅佐型领导，忠诚可靠且有能力。',
  '紫微+七杀':'杀破帝星，化权为祸。你权力欲望强但需谨慎行事，权力带杀气，适合竞争激烈的高压行业。',
  '天机+太阳':'阳明智慧，谋略与热情并存。你既有智慧又乐于分享，适合需要公众沟通的智慧型工作。',
  '天机+巨门':'智慧加口才，谋略与表达兼备。你善于分析和表达复杂问题，适合咨询、法律、媒体行业。',
  '太阳+太阴':'日月同宫，明暗共济。你内外兼修，既能在台前发光也能在幕后运筹，人际关系极佳。',
  '太阳+巨门':'阳巨同宫，热情与口才的结合。你适合销售、演讲、公关等需要感染力的工作。',
  '武曲+天府':'财库双星，金融才华配稳定储蓄。你理财能力超强，既有赚钱的魄力又有守财的智慧。',
  '武曲+贪狼':'财桃双星，金钱与人际兼得。你偏财运佳，能通过人际关系获取财富，但需注意节制。',
  '武曲+七杀':'财带杀气，果断中带竞争。你适合金融、法律等高压高回报行业，敢冒险但需控制风险。',
  '天同+太阴':'福母双星，温柔享受，福气深厚。你生性温和，人生较少波折，晚年福气尤其深厚。',
  '天同+天梁':'福寿双星，正直且有福。你天生有守护者角色，乐于助人，晚年清福。',
  '廉贞+天相':'清高辅佐，原则与服务并存。你适合行政、人力资源等需要公正心的职业。',
  '廉贞+破军':'囚破双星，先困后解，绝处逢生。你适合研发、创新类工作，在困局中往往能找到突破口。',
  '贪狼+廉贞':'桃囚双星，欲望与原则内斗。你需要在自由与规则间找到平衡，学会自律才能大成。',
  '天府+天相':'库印双星，稳定辅佐。你适合财务管理、行政管理等需要稳重可靠的岗位。',
  '太阴+天机':'母智双星，细腻谋略。你善于细致规划，适合策划、研究等需要周密思考的工作。',
};



// ===== 辅助函数 =====
function getStarCombo(mainStars: string[]): string {
  if (!mainStars || mainStars.length < 2) return '';
  const k1 = mainStars[0]+'+'+mainStars[1];
  const k2 = mainStars[1]+'+'+mainStars[0];
  return STAR_COMBO[k1] || STAR_COMBO[k2] || '';
}

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
    return <div className='rounded-xl border border-black/5 bg-white p-6 text-center text-sm' style={{color:'#86868b'}}>紫微数据未加载</div>;
  }

  const keyGongs = KEY_GONGS.map(name => gongs.find(g => g.gong === name)).filter(Boolean) as GongInfo[];
  const otherGongs = gongs.filter(g => !KEY_GONGS.includes(g.gong));

  return (
    <section className='w-full'>
      {/* 标题 */}
      <h3 className='font-serif text-xl font-bold mb-5 tracking-wider' style={{color:'#1d1d1f'}}>
        <span className='inline-block w-1.5 h-5 rounded-full mr-2.5 align-middle' style={{background:'#2e83f6'}} />
        <span className='text-xs font-normal tracking-wider px-2 py-0.5 rounded mr-2 align-middle' style={{color:'#86868b',background:'rgba(0,0,0,0.04)'}}>分析依据</span>
        紫微十二宫 · 个人化解读
      </h3>

      {/* 5个重点宫位 */}
      <div className='space-y-3 mb-6'>
        {keyGongs.map((gong, i) => {
          const isOpen = expanded.has(gong.gong);
          const mainStars = gong.mainStars || [];
          const combo = getStarCombo(mainStars);
          const primaryStar = mainStars[0] || '';
          const detail = STAR_DETAIL[primaryStar];

          return (
            <div key={i} className='rounded-xl border border-black/5 bg-white shadow-sm overflow-hidden'>
              {/* 宫位头部 */}
              <button onClick={() => toggle(gong.gong)} className='w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50/30 transition-colors'>
                <div className='flex items-center gap-3'>
                  <span className='text-sm font-bold' style={{color:'#1d1d1f'}}>{gong.gong}</span>
                  <span className='text-xs px-2 py-0.5 rounded-full' style={{background:'rgba(178,149,93,0.1)',color:'#b2955d'}}>
                    {mainStars.length > 0 ? mainStars.join(' · ') : '无主星'}
                  </span>
                  {(gong.sihua?.length ?? 0) > 0 && (
                    <span className='text-[10px]' style={{color:'#86868b'}}>
                      {gong.sihua?.map(s=>s.star+s.hua).join(' ') || ''}
                    </span>
                  )}
                </div>
                <span className='text-xs transition-transform' style={{color:'#86868b',transform:isOpen?'rotate(180deg)':''}}>▼</span>
              </button>

              {/* 展开内容 */}
              {isOpen && (
                <div className='px-4 pb-4 space-y-3'>
                  {/* 1. 我的宫位配置 */}
                  <div className='rounded-lg p-3' style={{background:'rgba(0,0,0,0.02)'}}>
                    <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#86868b'}}>📋 我的宫位配置</div>
                    <p className='text-sm' style={{color:'#1d1d1f'}}>{getGongConfig(gong)}</p>
                  </div>

                  {/* 2. 星曜组合 */}
                  {combo && (
                    <div className='rounded-lg p-3' style={{background:'rgba(178,149,93,0.04)',border:'1px solid rgba(178,149,93,0.1)'}}>
                      <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#b2955d'}}>⭐ 星曜组合</div>
                      <p className='text-sm leading-relaxed' style={{color:'#555'}}>{combo}</p>
                    </div>
                  )}

                  {/* 3. 专业含义 */}
                  {detail && (
                    <div className='rounded-lg p-3' style={{background:'rgba(46,131,246,0.03)'}}>
                      <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#2e83f6'}}>🔬 专业含义</div>
                      <p className='text-sm leading-relaxed' style={{color:'#555'}}>{detail.p}</p>
                    </div>
                  )}

                  {/* 4. 人生表现 */}
                  {detail && (
                    <div className='rounded-lg p-3' style={{background:'rgba(7,168,48,0.03)'}}>
                      <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#07a830'}}>🧬 你的人生表现</div>
                      <p className='text-sm leading-relaxed' style={{color:'#555'}}>{detail.l}</p>
                    </div>
                  )}

                  

                  {/* 6. 实际建议 */}
                  {detail && (
                    <div className='rounded-lg p-3' style={{background:'rgba(139,109,3,0.03)'}}>
                      <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#8b6d03'}}>💡 实际建议</div>
                      <p className='text-sm leading-relaxed' style={{color:'#555'}}>{detail.a}</p>
                    </div>
                  )}

                  {/* 辅星解读 */}
                  {gong.auxStars && gong.auxStars.length > 0 && (
                    <div className='rounded-lg p-3' style={{background:'rgba(0,0,0,0.01)'}}>
                      <div className='text-[11px] tracking-wider mb-1.5' style={{color:'#86868b'}}>🔸 辅星解读</div>
                      <div className='flex flex-wrap gap-2'>
                        {gong.auxStars.map((s, j) => (
                          <span key={j} className='inline-block px-2 py-1 rounded text-[11px]' style={{background:'rgba(0,0,0,0.03)',color:'#555'}}>
                            <span className='font-medium' style={{color:'#1d1d1f'}}>{s}</span>
                            {AUX_STAR[s] && <span className='ml-1' style={{color:'#999'}}>{AUX_STAR[s]}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 其余7个宫位 - 紧凑网格 */}
      <button onClick={() => {
        const allOpen = otherGongs.every(g => expanded.has(g.gong));
        setExpanded(prev => {
          const next = new Set(prev);
          otherGongs.forEach(g => allOpen ? next.delete(g.gong) : next.add(g.gong));
          return next;
        });
      }} className='w-full text-center py-2.5 rounded-lg text-xs tracking-wider mb-4 transition-colors' style={{color:'#b2955d',background:'rgba(178,149,93,0.06)'}}>
        {otherGongs.every(g => expanded.has(g.gong)) ? '收起全部宫位详情 ▲' : '展开其余七宫详情 ▼'}
      </button>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3 mb-4'>
        {otherGongs.map((gong, i) => {
          const isOpen = expanded.has(gong.gong);
          const mainStars = gong.mainStars || [];
          const detail = STAR_DETAIL[mainStars[0] || ''];
          return (
            <div key={i} className='rounded-xl border border-black/5 bg-white p-3 text-center shadow-sm' onClick={() => toggle(gong.gong)} style={{cursor:'pointer'}}>
              <div className='text-xs tracking-wider mb-1' style={{color:'#86868b'}}>{gong.gong}</div>
              <div className='text-xs font-medium mb-1' style={{color:'#1d1d1f'}}>
                {mainStars.length > 0 ? mainStars.join(' ') : <span style={{color:'#ccc'}}>—</span>}
              </div>
              {(gong.auxStars?.length ?? 0) > 0 && (
                <div className='text-[10px]' style={{color:'#aaa'}}>{(gong.auxStars || []).slice(0,2).join(' ')}</div>
              )}
              {(gong.sihua?.length ?? 0) > 0 && (
                <div className='mt-1'>
                  {(gong.sihua || []).slice(0,1).map((sh, j) => (
                    <span key={j} className='inline-block px-1.5 py-0.5 rounded text-[10px] font-medium' style={{background:sh.hua==='化忌'?'rgba(211,5,5,0.1)':'rgba(178,149,93,0.1)',color:sh.hua==='化忌'?'#d30505':'#b2955d'}}>{sh.star}{sh.hua}</span>
                  ))}
                </div>
              )}
              {isOpen && detail && (
                <p className='text-[10px] mt-2 leading-relaxed' style={{color:'#999'}}>{detail.l.slice(0,50)}…</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 四化总览 */}
      {ziwei?.sihuaOverview && (
        <div className='rounded-xl border border-black/5 bg-white p-4 shadow-sm'>
          <h4 className='text-sm font-bold mb-3' style={{color:'#1d1d1f'}}>生年四化</h4>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
            {ziwei.sihuaOverview.lu && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(7,168,48,0.06)'}}><div style={{color:'#07a830'}}>化禄</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.lu.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.lu.gong}</div></div>)}
            {ziwei.sihuaOverview.quan && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(211,5,5,0.06)'}}><div style={{color:'#d30505'}}>化权</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.quan.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.quan.gong}</div></div>)}
            {ziwei.sihuaOverview.ke && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(46,131,246,0.06)'}}><div style={{color:'#2e83f6'}}>化科</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.ke.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.ke.gong}</div></div>)}
            {ziwei.sihuaOverview.ji && (<div className='rounded-lg p-3 text-center' style={{background:'rgba(139,109,3,0.06)'}}><div style={{color:'#8b6d03'}}>化忌</div><div className='font-medium mt-1' style={{color:'#1d1d1f'}}>{ziwei.sihuaOverview.ji.star}</div><div style={{color:'#86868b'}}>{ziwei.sihuaOverview.ji.gong}</div></div>)}
          </div>
        </div>
      )}
    </section>
  );
}
