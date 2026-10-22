// 户型标注的五步（docs/design §8 那张表落成代码）。
//
// 为什么把"现在走到哪一步"算在 lib 里而不是写在组件里：这一步要说出口就得可核 ——
// 「已完成」三个字如果只是 JSX 里一个三元表达式，套件没法喂输入进去验它，
// 而这一页最贵的错恰恰是"页面说做完了、其实还缺门窗"。
//
// 三条不能松的口径：
//  1. 步条只报状态，不折叠内容。把 ②③④ 藏起来确实更清爽，但那会让"未确认的几何"
//     在屏上消失，而确认门是这一页的主张（没确认不许出判定）。
//  2. 「朝向未确认」是一个**答案**，不是"没答"。所以 ② 看的是"用户点过没有"，
//     不是"值不等于未确认"—— 否则默认值会被读成已完成，步条就在替用户撒。
//  3. ④ 关心点可以跳过，但跳过要显式按一次。没按之前它是"未开始"，
//     不然步条会显示"四步都过了，就差结果"，而用户其实什么都没选。

export type StepState = '未开始' | '待补' | '已完成';

export interface StepInput {
  有图: boolean;
  房间数: number;
  开口数: number;
  朝向已答: boolean;
  朝向: '南' | '北' | '未确认';
  关心点数: number;
  关心点已答: boolean;
  已确认: boolean;
}

export interface Step {
  n: number;
  名称: string;
  状态: StepState;
  /** 这一格在页面上要说的那一句短话。步条与探针读的是同一份，不许各写一遍。 */
  提示: string;
}

export const STEP_NAMES = ['选图或手绘', '定朝向', '标房间与门窗', '说你最在意什么', '结果与图上依据'] as const;

export function stepStates(s: StepInput): Step[] {
  const 有几何 = s.房间数 > 0;
  const out: Step[] = [];

  out.push({
    n: 1, 名称: STEP_NAMES[0],
    状态: 有几何 ? '已完成' : s.有图 ? '待补' : '未开始',
    提示: 有几何 ? (s.有图 ? '已有几何（也选了图）' : '已有几何')
      : s.有图 ? '图已选，还没变成几何' : '选一张图，或直接手工画',
  });

  out.push({
    n: 2, 名称: STEP_NAMES[1],
    // 朝向不依赖几何存在，所以这一档也不被几何门住（把控件 disabled 掉是更坏的做法：
    // 一个"看着能点、点了没反应"的按钮，比一个随时能点的更骗人）。
    状态: s.朝向已答 ? '已完成' : '待补',
    提示: s.朝向已答 ? `已答：${s.朝向}` : '朝南 / 朝北 / 都没有把握，都算答过',
  });

  out.push({
    n: 3, 名称: STEP_NAMES[2],
    状态: !有几何 ? '未开始' : s.开口数 === 0 ? '待补' : '已完成',
    提示: !有几何 ? '先有几何' : s.开口数 === 0
      ? '一个门窗都没标：采光、对流、动线三类判定会写成缺输入'
      : `房间 ${s.房间数} 间 · 门窗 ${s.开口数} 个`,
  });

  out.push({
    n: 4, 名称: STEP_NAMES[3],
    状态: s.关心点已答 ? '已完成' : '未开始',
    提示: s.关心点已答
      ? (s.关心点数 === 0 ? '已跳过：按几何本身讲' : `已选 ${s.关心点数} 项：只影响讲哪几段的次序`)
      : '可跳过；这四项不改判定，只决定先讲哪几段',
  });

  out.push({
    n: 5, 名称: STEP_NAMES[4],
    状态: !有几何 ? '未开始' : s.已确认 ? '已完成' : '待补',
    提示: !有几何 ? '先有几何' : s.已确认 ? '已确认，判定在下面' : '没勾「我自己核对过」之前不出判定',
  });

  return out;
}

/** 当前位置 = 第一个没完成的那一步；全完成就停在最后一步。 */
export function currentStep(steps: Step[]): number {
  const next = steps.find(x => x.状态 !== '已完成');
  return next ? next.n : steps[steps.length - 1].n;
}

/** ④ 的四个关心点。写在这里是因为规则层要能证明"这些名字改不了判定" ——
 *  一个住在组件里的字符串数组，套件只能靠正则去猜。 */
export const CONCERNS = ['采光', '动线', '睡眠', '工作区'] as const;
export type Concern = typeof CONCERNS[number];

/** 判定与关心点的关系：**只排序，不增删、不改结论**。
 *  规则层的 判定 数组原样进来，出去的是同一批对象的另一个次序（以及一个说明）。
 *  排序键：命中该关心点的条目排前面，其余保持规则层原有次序（稳定）。 */
export function orderNotes<T extends { 规则: string; 结论: string; 不确定项: string[] }>(
  notes: T[], picked: Concern[],
): { 排序后: T[]; 命中: Record<Concern, number> } {
  const 关键词: Record<Concern, RegExp> = {
    采光: /采光|窗|日照|亮/,
    动线: /动线|通路|穿过|走/,
    睡眠: /卧室|私密|睡/,
    工作区: /书房|工作|书桌/,
  };
  const hits = (n: T, c: Concern) => 关键词[c].test(n.规则 + n.结论 + n.不确定项.join(''));
  const 命中 = Object.fromEntries(CONCERNS.map(c => [c, notes.filter(n => picked.includes(c) && hits(n, c)).length])) as Record<Concern, number>;
  const top = notes.filter(n => picked.some(c => hits(n, c)));
  const rest = notes.filter(n => !picked.some(c => hits(n, c)));
  return { 排序后: [...top, ...rest], 命中 };
}
