import type { TarotCard } from './deck';

export type MarseilleReading = { upright: string; reversed: string };

/** 本站自研的马赛牌系象征读法，不作为历史流派原文或统一牌义。 */
const MAJOR: Record<string, MarseilleReading> = {
  'major-00': { upright: '轻装探索一条新路；先看清风险边界，再决定前进的步伐。', reversed: '冲动起步、忽略代价或缺少方向；宜先检查准备与边界。' },
  'major-01': { upright: '手边已有可用工具与行动空间；适合先完成一个具体的小步骤。', reversed: '资源分散或只停留在表面展示；先核实能力、材料与实际条件。' },
  'major-02': { upright: '信息仍有未显之处；保持观察，给直觉和事实都留出位置。', reversed: '沉默变成回避，或把猜测当成确定；回到可确认的信息。' },
  'major-03': { upright: '想法进入生长阶段；照料关系、创意或计划，让成果逐步成形。', reversed: '过度付出或急于收成果；先分清照料与替别人承担的界线。' },
  'major-04': { upright: '建立清楚的秩序与责任；把目标落实为可执行的安排。', reversed: '控制欲压过实际需要；检查规则是否僵化，责任是否分配不均。' },
  'major-05': { upright: '传统、经验或共同规则可作参照；选择适合自己的建议来源。', reversed: '只因习惯或权威而照做；重新确认规则是否适用于眼前处境。' },
  'major-06': { upright: '关系与选择来到交会处；明确双方意愿，再作出一致的决定。', reversed: '犹豫、迎合或价值不合；把未说清的期待摆到桌面上。' },
  'major-07': { upright: '将分散的力量带向同一方向；稳住节奏，持续推动计划。', reversed: '方向摇摆或一味求快；先重新确认目标和可控范围。' },
  'major-08': { upright: '以耐心和节制驾驭强烈冲动；坚定推进，不靠压制解决问题。', reversed: '用力过猛、急于证明或被本能牵着走；先恢复稳定节奏。' },
  'major-09': { upright: '暂时退一步，借独处与细察看清重点；决定可以慢一些。', reversed: '独处变成隔绝，或迟迟不肯求证；适度向可信的人核对。' },
  'major-10': { upright: '环境正在转动，局面可能出现新变量；抓住可调整之处。', reversed: '反复陷入同一循环；识别触发条件，改变一个实际环节。' },
  'major-11': { upright: '把事实、责任和边界放在一起衡量；按一致标准作出回应。', reversed: '判断受偏见或情绪拉扯；补齐信息，避免双重标准。' },
  'major-12': { upright: '暂停原有做法，换个角度观察；此刻等待也可以是主动选择。', reversed: '停滞没有带来新认识；设定期限，决定继续、调整或结束。' },
  'major-13': { upright: '旧阶段正在收尾；清理不再适用的安排，为改变腾出空间。', reversed: '紧抓已经失效的做法；辨认真正需要告别的部分。' },
  'major-14': { upright: '让不同部分逐渐调和；以适度、沟通和持续修正维持平衡。', reversed: '节奏失衡或彼此难以配合；先调整比例和沟通方式。' },
  'major-15': { upright: '看见欲望、依赖或束缚如何影响选择；承认它们，才有调整余地。', reversed: '旧束缚开始松动，或仍在否认它的影响；把选择权拿回手中。' },
  'major-16': { upright: '不稳固的结构受到冲击；先处理眼前变化，再重建可靠基础。', reversed: '担心变化而拖延修整；尽早面对裂缝，减少后续代价。' },
  'major-17': { upright: '在经历之后恢复信心与耐心；给修复和长期成长留出时间。', reversed: '希望变得脆弱或过度理想化；把愿景拆成可实行的小目标。' },
  'major-18': { upright: '处于信息不完整、感受起伏的阶段；分辨直觉、恐惧与事实。', reversed: '模糊处逐渐显露；仍需核实，避免把暂时清晰当作全部答案。' },
  'major-19': { upright: '坦诚、清晰与合作有助于推进；共享成果，也照顾各自边界。', reversed: '过度乐观或急于获得认可；校准预期，留意疲惫与细节。' },
  'major-20': { upright: '重要议题再次来到眼前；认真回应反馈，决定是否进入新阶段。', reversed: '回避复盘或受旧判断牵制；把经验转成下一步的具体选择。' },
  'major-21': { upright: '阶段成果正在汇合；完成收尾、确认边界，并准备新的循环。', reversed: '临门收尾仍有缺口；识别未完成事项，逐项落实。' },
};

const SUIT: Record<NonNullable<TarotCard['suit']>, { field: string; focus: string; imbalance: string }> = {
  '权杖': { field: '行动与投入', focus: '让精力落在真正想推进的事上', imbalance: '冲动过快或动力分散' },
  '圣杯': { field: '情感与关系', focus: '留意感受是否表达、回应是否对等', imbalance: '期待未说清或情绪淹没事实' },
  '宝剑': { field: '思考与表达', focus: '厘清事实、判断与沟通方式', imbalance: '过度分析或言语造成隔阂' },
  '星币': { field: '资源与现实安排', focus: '检查时间、能力和可用资源', imbalance: '过度求稳或忽略现实限制' },
};

const RANK: Record<string, { upright: string; reversed: string }> = {
  A: { upright: '新的起点与可用潜能开始出现', reversed: '开端迟疑，潜能尚未转为行动' },
  '2': { upright: '两端协调、选择与分配成为重点', reversed: '摇摆、失衡或双方没有对齐' },
  '3': { upright: '合作与扩展带来下一步空间', reversed: '扩展过快，基础和协作仍不足' },
  '4': { upright: '稳定结构正在建立，适合巩固成果', reversed: '结构过于僵硬，调整空间不足' },
  '5': { upright: '摩擦暴露差异，也带来重新安排的机会', reversed: '冲突累积或回避分歧，问题仍未处理' },
  '6': { upright: '互助、调整与往来使局面恢复平衡', reversed: '付出失衡或调整迟缓，关系需要重谈' },
  '7': { upright: '需要审慎评估并守住真正重要的目标', reversed: '犹疑、防备过度或缺少清楚策略' },
  '8': { upright: '持续练习与专注积累正在产生效果', reversed: '重复消耗、分心或方法需要更新' },
  '9': { upright: '接近成熟阶段，耐心与自我管理很关键', reversed: '疲惫、过度坚持或成果尚不稳固' },
  '10': { upright: '一个循环来到汇总与交接的阶段', reversed: '承担过量或收尾不清，需要重新分担' },
  P: { upright: '以学习者姿态接收新信息并尝试实践', reversed: '准备不足、消息不清或行动不够稳定' },
  N: { upright: '主动行动推动局面前进，注意节奏与方向', reversed: '行动鲁莽、推进受阻或方向反复' },
  Q: { upright: '以成熟照料和判断力经营当前领域', reversed: '照料过度、边界模糊或忽视自身需要' },
  K: { upright: '运用经验承担责任，形成稳定而清晰的安排', reversed: '权责失衡、固执掌控或经验用得过头' },
};

export function getMarseilleReading(card: TarotCard): MarseilleReading | null {
  if (card.arcana === 'major') return MAJOR[card.id] ?? null;
  if (!card.suit || !card.rank) return null;
  const suit = SUIT[card.suit];
  const rank = RANK[card.rank];
  if (!suit || !rank) return null;
  return {
    upright: `${rank.upright}落在${suit.field}层面；${suit.focus}。`,
    reversed: `${rank.reversed}，尤其留意${suit.imbalance}；先校准节奏，再决定如何推进。`,
  };
}
