// 紫微盘的取数口径披露（D4 / D5：把差异写到盘上，但不改安星）。
//
// 为什么只做披露：紫微这一侧没有任何口径版本戳，改一次安星输入，已经存过的盘再打开
// 就会被新版重算，而且事后**分不出**"这张盘本来就是新版算的"和"老盘被悄悄改了"。
// 所以顺序是先让差异可见，再由运维定口径戳 + 老盘标注，最后才动 `ziwei-standard.ts`。
// 本文件因此**不碰算法层**，也不重新推演任何一条安星规则。
//
// 这里说的每一句都必须能从盘面已经带着的字段读出来。宁可少说一句，也不能说一句
// 需要重算才能成立的话 —— 那等于在显示层写第五份引擎。

/** 本披露的口径名。安星输入哪天真变了，这个戳要跟着换，老盘的措辞按版本分叉。 */
export const ZIWEI_CALIBER = 'ziwei-clock-hour-v1';

/** 只声明用得上的那几个字段，不绑整个 TrueSolarTimeInfo —— 老盘缺字段是常态。 */
export interface ZiweiCaliberInput {
  bazi?: {
    trueSolarTime?: {
      applied?: boolean;
      civilTime?: string;
      trueSolarTime?: string;
    } | null;
  } | null;
  ziwei?: {
    birthInfo?: { year?: number } | null;
  } | null;
}

export interface ZiweiCaliberView {
  口径: string;
  /** 上屏的行。0 行表示这一盘没有可摊开的取数信息。 */
  行: string[];
}

/**
 * 两处已量化的分叉（数字在 docs/backend-handoff-20261021.md §8 与 tools/ziwei-caliber/measure.ts）：
 *  - 时辰：八字在建 Solar 之前做真太阳时校正，紫微直接用填写的钟表时；
 *  - 年界：紫微的阴阳男女用填写的那一年定奇偶，八字年柱按立春换年。
 * 两盘同页展示却各按一套取数，这是用户看得见但推不出来的东西，所以要写出来。
 */
export function describeZiweiCaliber(input: ZiweiCaliberInput): ZiweiCaliberView {
  const 行: string[] = [];
  const tst = input.bazi?.trueSolarTime;

  if (tst && tst.applied === true && tst.civilTime && tst.trueSolarTime) {
    // 不判断"是否跨了时辰"：那需要重排一次时辰边界，属于安星输入本身。
    // 只报两个时刻，并说清两盘各用哪一个。
    行.push(`时辰：紫微按钟表时刻 ${tst.civilTime} 安星，同一张盘的八字时柱按真太阳时 ${tst.trueSolarTime} 取 —— 本盘紫微未做真太阳时校正。若这两个时刻落在不同时辰，命宫与全盘星位随之不同。`);
  } else if (tst && tst.applied === false) {
    行.push(`时辰：紫微与八字用同一个钟表时刻${tst.civilTime ? ` ${tst.civilTime}` : ''}（出生地未能定位到经度，本盘未做真太阳时校正，两盘在这一档上一致）。`);
  } else {
    // 字段整个缺（后端老盘）与字段在但缺 applied，对用户是同一件事：核对不了。
    行.push('时辰：这一盘的八字未随盘面记录真太阳时校正，无法核对两盘用的是不是同一个小时。');
  }

  const year = input.ziwei?.birthInfo?.year;
  if (typeof year === 'number' && Number.isFinite(year)) {
    // 同样只报规则，不报"这一盘到底差没差"：判立春瞬时要用节气数据，那是算法层的活。
    行.push(`年界：紫微的阴阳男女按填写的年份 ${year} 定奇偶，八字年柱按立春换年 —— 立春之前出生的盘，两处用的不是同一年，大限的顺逆方向也随之分叉。`);
  }

  return { 口径: ZIWEI_CALIBER, 行 };
}
