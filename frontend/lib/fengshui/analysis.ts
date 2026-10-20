// 户型规则层：把用户确认过的九宫标注推成一条条可核的判定。
//
// 三条纪律：
//  1. 只推几何关系（相邻、对宫、通路、同宫），不推方位吉凶 —— 没有可引的宅经原文，
//     传统方位那一层就明写"未判定"，而不是换一套说法把吉凶讲出来；
//  2. 纯函数、无随机无时钟：同一组输入必须逐字节得到同一份输出（验收钉的就是这个）；
//  3. 每条判定都带依据与不确定项，读者能看出这条结论只建立在"哪个宫挨着哪个宫"上。

import type { FengshuiNote, FengshuiReport, FloorInput, Palace, Room } from './types';

/** 规则层口径戳。改任何一条判据都要升它，否则老截图分不出新旧。 */
export const FENGSHUI_BASIS = 'fengshui-geometry-v1';

// 九宫落在 3×3 格上：x 西→东，y 南→北（与朝向无关，是用户自己标的相对位置）。
const GRID: Record<Palace, [number, number]> = {
  巽: [2, 0], 离: [1, 0], 坤: [0, 0],
  震: [2, 1], 中: [1, 1], 兑: [0, 1],
  艮: [2, 2], 坎: [1, 2], 乾: [0, 2],
};
const PALACE_ORDER = Object.keys(GRID) as Palace[];

const near = (a: Palace, b: Palace) =>
  Math.abs(GRID[a][0] - GRID[b][0]) <= 1 && Math.abs(GRID[a][1] - GRID[b][1]) <= 1;
const opposite = (a: Palace, b: Palace) =>
  GRID[a][0] + GRID[b][0] === 2 && GRID[a][1] + GRID[b][1] === 2;

/** 只走上下左右（不走斜角）的九宫通路 —— 斜穿在平面上通常不是真能走的路。 */
function reachable(from: Palace, to: Palace, blocked: Set<Palace>): boolean {
  if (from === to) return true;
  const seen = new Set<Palace>([from]);
  const queue: Palace[] = [from];
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const p = queue.shift() as Palace;
    const [x, y] = GRID[p];
    for (const [dx, dy] of dirs) {
      const hit = PALACE_ORDER.find(q => GRID[q][0] === x + dx && GRID[q][1] === y + dy);
      if (!hit || seen.has(hit)) continue;
      if (hit === to) return true;
      seen.add(hit);
      if (!blocked.has(hit)) queue.push(hit);
    }
  }
  return false;
}

const byPalace = (rooms: Room[], p: Palace) => rooms.filter(r => r.宫位 === p);

export function analyzeFloor(input: FloorInput): FengshuiReport {
  const 判定: FengshuiNote[] = [];
  const 未判定: string[] = [];
  const { 房间, 主窗, 入户门 } = input;

  const 摘要 = [
    `朝向：${input.朝向}`,
    `入户门所在宫：${入户门.join('、') || '未标'}`,
    `主窗所在宫：${主窗.join('、') || '未标'}`,
    `房间 ${房间.length} 间：${房间.map(r => `${r.名称}(${r.用途}·${r.宫位})`).join('、') || '未标'}`,
  ];

  if (!input.已确认) {
    return {
      输入摘要: 摘要,
      判定: [],
      未判定: ['这些标注还没被逐条确认，规则层不出任何判定 —— 拿没确认的东西算出来的结论，看起来和确认过的一样。'],
      口径戳: FENGSHUI_BASIS,
    };
  }
  if (房间.length === 0) {
    return { 输入摘要: 摘要, 判定: [], 未判定: ['一个房间都没标，没有可推的关系。'], 口径戳: FENGSHUI_BASIS };
  }
  if (主窗.length === 0) 未判定.push('没标主窗位置：采光与对流两类判定都缺输入，不猜。');
  if (入户门.length === 0) 未判定.push('没标入户门位置：动线判定缺输入，不猜。');
  if (input.朝向 === '未确认') 未判定.push('朝向未确认：日照强弱与方位那一层不做（本站也没有可引的宅经原文，见页脚说明）。');

  // 1. 采光面相邻
  for (const r of 房间.filter(x => ['卧室', '客厅', '书房', '餐厅'].includes(x.用途)).sort((a, b) => a.id.localeCompare(b.id))) {
    const hit = 主窗.filter(w => near(w, r.宫位));
    if (hit.length) {
      判定.push({
        规则: '起居房间与采光面相邻',
        结论: `${r.名称}（${r.用途}·${r.宫位}）与标了主窗的 ${hit.join('、')} 同宫或相邻。`,
        依据: [`房间 ${r.名称} 标在 ${r.宫位}`, `主窗标在 ${主窗.join('、')}`],
        不确定项: ['窗的实际尺寸、高度与窗外遮挡都不在这份输入里，白天够不够光还得看现场。'],
      });
    } else if (主窗.length) {
      判定.push({
        规则: '起居房间离采光面远',
        结论: `${r.名称}（${r.用途}·${r.宫位}）与任何一扇主窗都不同宫、也不相邻。`,
        依据: [`房间 ${r.名称} 标在 ${r.宫位}`, `主窗只标在 ${主窗.join('、')}`],
        不确定项: ['九宫是粗格子：同一格里隔一堵墙与紧挨着窗，这里分不出来。'],
      });
    }
  }

  // 2. 穿堂通路（门与窗对宫）
  for (const d of 入户门) {
    const face = 主窗.filter(w => opposite(w, d));
    if (face.length) {
      判定.push({
        规则: '门与窗在一条通路上',
        结论: `入户门在 ${d}，主窗在 ${face.join('、')}，两者处在九宫的相对两侧，具备形成对流的几何条件。`,
        依据: [`入户门标在 ${d}`, `主窗标在 ${face.join('、')}`],
        不确定项: ['能不能真对流取决于沿途有没有墙、柜与门洞，这份输入里没有。'],
      });
    }
  }

  // 3. 动线是否必须穿过别人的房间
  const 私密 = new Set(房间.filter(r => ['卧室', '厨房'].includes(r.用途)).map(r => r.宫位));
  for (const d of 入户门) {
    for (const r of 房间.filter(x => x.用途 !== '玄关')) {
      if (私密.has(r.宫位)) continue;                       // 目的地本身就是私密间，穿过它是应有之义
      const others = new Set([...私密].filter(p => p !== r.宫位));
      if (reachable(d, r.宫位, others)) continue;           // 有绕开别人的路
      判定.push({
        规则: '到达该房间需穿过私密区',
        结论: `从入户门（${d}）走到 ${r.名称}（${r.宫位}），在九宫格上必须经过标了卧室或厨房的宫。`,
        依据: [`入户门标在 ${d}`, `${r.名称} 标在 ${r.宫位}`, `私密区所在宫：${[...others].join('、') || '无'}`],
        不确定项: ['真实户型的门洞位置比九宫细得多，这里只判"格子层面有没有别的路"。'],
      });
    }
  }

  // 4. 厨卫相邻/同宫
  const 厨 = 房间.filter(r => r.用途 === '厨房');
  const 卫 = 房间.filter(r => r.用途 === '卫生间');
  for (const k of 厨) for (const w of 卫) {
    if (near(k.宫位, w.宫位)) {
      判定.push({
        规则: '厨房与卫生间相邻或同宫',
        结论: `${k.名称}（${k.宫位}）与 ${w.名称}（${w.宫位}）同宫或相邻。`,
        依据: [`${k.名称} 标在 ${k.宫位}`, `${w.名称} 标在 ${w.宫位}`],
        不确定项: ['气味与排水主要取决于风道与管井在哪，这份输入里没有那两项。'],
      });
    }
  }

  // 5. 中宫被占
  const 中占 = byPalace(房间, '中').filter(r => !['玄关', '储物', '餐厅'].includes(r.用途));
  if (中占.length) {
    判定.push({
      规则: '中宫被固定功能占用',
      结论: `中宫标了 ${中占.map(r => `${r.名称}(${r.用途})`).join('、')}。`,
      依据: ['中宫是九宫的中心格，通常是从各房间经过的通道区。'],
      不确定项: ['如果那是一整片开敞的过厅，占用反而是合理的；格子看不出高差与家具摆法。'],
    });
  }

  return { 输入摘要: 摘要, 判定, 未判定, 口径戳: FENGSHUI_BASIS };
}
