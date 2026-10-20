// 户型风水的输入与输出契约（东方 · 只吃用户自己确认过的结构化标注）。
//
// 一条底线：这一层不给任何"古籍怎么说"的方位断语。docs/classics 里没有可引的宅经原文
// （阳宅十书、八宅明镜、玄空一类都没入库），所以原典之外不发明 —— 能说的只有从
// 用户标的方位格子里推出来的采光、通风、动线与分区关系，每一条都带着它的输入依据。

export const FACING_LIST = ['南', '北', '东', '西', '东南', '西南', '东北', '西北'] as const;
export type Facing = typeof FACING_LIST[number];
/** 朝向没确认时用的那一个值。绝不从"图片朝上"推方向 —— 那是把猜当成输入。 */
export type FacingInput = Facing | '未确认';

/** 后天九宫：中宫 + 八个方位宫。用户把房间摆在这九格里。 */
export const PALACES = ['坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离'] as const;
export type Palace = typeof PALACES[number];

export const ROOM_KINDS = ['卧室', '客厅', '厨房', '卫生间', '书房', '餐厅', '阳台', '储物', '玄关'] as const;
export type RoomKind = typeof ROOM_KINDS[number];

/** 后天九宫的版面排法（行从上到下、列从左到右）。表单格子与几何层的宫位归属必须读这一份：
 *  两处各写一遍的话，改一处就会让"图上看到的宫"和"算出来的宫"悄悄分家。 */
export const PALACE_GRID: Palace[][] = [['乾', '坎', '艮'], ['兑', '中', '震'], ['坤', '离', '巽']];

export interface Room {
  id: string;
  名称: string;
  用途: RoomKind;
  宫位: Palace;
}

export interface FloorInput {
  朝向: FacingInput;
  /** 坐向：门朝哪、背靠哪。只有朝向确认时才有意义。 */
  入户门: Palace[];
  主窗: Palace[];
  房间: Room[];
  /** 用户是否逐条确认过这些标注。没确认过就不出结论，只出提示。 */
  已确认: boolean;
}

export interface FengshuiNote {
  /** 规则名，例如"采光面相邻"。 */
  规则: string;
  结论: string;
  /** 这条结论是从输入的哪几项推出来的（上屏，让用户能核）。 */
  依据: string[];
  /** 这条结论说不准的地方（输入粒度不够、需要现场看的部分）。 */
  不确定项: string[];
}

export interface FengshuiReport {
  输入摘要: string[];
  判定: FengshuiNote[];
  未判定: string[];
  /** 规则层版本。改判据必须升它，否则老截图分不出新旧。 */
  口径戳: string;
}
