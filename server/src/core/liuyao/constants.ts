// 混沌六爻 常量表
// Ported from 混沌六爻 skill engine.py v2.0

import { TianGan, DiZhi, WuXing, GuaName, LiuQin, LiuShen, YaoValue, LiuYaoData } from './types';

// ============================================================
// 天干地支
// ============================================================
export const GANS: TianGan[] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
export const ZHIS: DiZhi[] = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ============================================================
// 八卦基础
// ============================================================
export const GUA_NAMES: GuaName[] = ['乾','兑','离','震','巽','坎','艮','坤'];
export const GUA_YAOS = ['111','110','101','100','011','010','001','000']; // 三爻编码 阳1阴0 初→上
export const GUA_WUXING: WuXing[] = ['金','金','火','木','木','水','土','土'];
export const GUA_YINYANG: ('阳'|'阴')[] = ['阳','阴','阴','阳','阴','阳','阳','阴'];
export const GUA_XIANTIAN: number[] = [1,2,3,4,5,6,7,8];
export const GUA_HOUTIAN: Record<string,number> = { '乾':6,'兑':7,'离':9,'震':3,'巽':4,'坎':1,'艮':8,'坤':2 };
export const GUA_EMOJI: Record<string,string> = { '乾':'☰','兑':'☱','离':'☲','震':'☳','巽':'☴','坎':'☵','艮':'☶','坤':'☷' };

// ============================================================
// 六十四卦 (6位二进制 初→上 → 卦名)
// ============================================================
export const GUA64: Record<string,string> = {
  '111111':'乾为天','011111':'天风姤','001111':'天山遁','000111':'天地否',
  '000011':'风地观','000001':'山地剥','000101':'火地晋','111101':'火天大有',
  '110110':'兑为泽','010110':'泽水困','000110':'泽地萃','001110':'泽山咸',
  '001010':'水山蹇','001000':'地山谦','001100':'雷山小过','110100':'雷泽归妹',
  '101101':'离为火','001101':'火山旅','011101':'火风鼎','010101':'火水未济',
  '010001':'山水蒙','010011':'风水涣','010111':'天水讼','101111':'天火同人',
  '100100':'震为雷','000100':'雷地豫','010100':'雷水解','011100':'雷风恒',
  '011000':'地风升','011010':'水风井','011110':'泽风大过','100110':'泽雷随',
  '011011':'巽为风','111011':'风天小畜','101011':'风火家人','100011':'风雷益',
  '100111':'天雷无妄','100101':'火雷噬嗑','100001':'山雷颐','011001':'山风蛊',
  '010010':'坎为水','110010':'水泽节','100010':'水雷屯','101010':'水火既济',
  '101110':'泽火革','101100':'雷火丰','101000':'地火明夷','010000':'地水师',
  '001001':'艮为山','101001':'山火贲','111001':'山天大畜','110001':'山泽损',
  '110101':'火泽睽','110111':'天泽履','110011':'风泽中孚','001011':'风山渐',
  '000000':'坤为地','100000':'地雷复','110000':'地泽临','111000':'地天泰',
  '111100':'雷天大壮','111110':'泽天夬','111010':'水天需','000010':'水地比',
};

// ============================================================
// 纳甲表 (内卦干支, 外卦干支) 索引对应八卦
// ============================================================
export const NAJIA: [string,string][] = [
  ['甲子寅辰','壬午申戌'], // 乾
  ['丁巳卯丑','丁亥酉未'], // 兑
  ['己卯丑亥','己酉未巳'], // 离
  ['庚子寅辰','庚午申戌'], // 震
  ['辛丑亥酉','辛未巳卯'], // 巽
  ['戊寅辰午','戊申戌子'], // 坎
  ['丙辰午申','丙戌子寅'], // 艮
  ['乙未巳卯','癸丑亥酉'], // 坤
];

// ============================================================
// 八宫卦序 (8宫 × 8卦)
// ============================================================
export const GONG8: string[][] = [
  ['乾为天','天风姤','天山遁','天地否','风地观','山地剥','火地晋','火天大有'],
  ['兑为泽','泽水困','泽地萃','泽山咸','水山蹇','地山谦','雷山小过','雷泽归妹'],
  ['离为火','火山旅','火风鼎','火水未济','山水蒙','风水涣','天水讼','天火同人'],
  ['震为雷','雷地豫','雷水解','雷风恒','地风升','水风井','泽风大过','泽雷随'],
  ['巽为风','风天小畜','风火家人','风雷益','天雷无妄','火雷噬嗑','山雷颐','山风蛊'],
  ['坎为水','水泽节','水雷屯','水火既济','泽火革','雷火丰','地火明夷','地水师'],
  ['艮为山','山火贲','山天大畜','山泽损','火泽睽','天泽履','风泽中孚','风山渐'],
  ['坤为地','地雷复','地泽临','地天泰','雷天大壮','泽天夬','水天需','水地比'],
];

export const GONG_TYPE: string[] = ['本宫','一世','二世','三世','四世','五世','游魂','归魂'];

// 世应位置 (对应宫序索引)
export const SHI_YAO_POS: number[] = [6,1,2,3,4,5,4,3];
export const YING_YAO_POS: number[] = [3,4,5,6,1,2,1,6];

// ============================================================
// 五行
// ============================================================
export const WUXING_NAMES: WuXing[] = ['木','火','土','金','水'];
export const ZHI_WUXING: WuXing[] = ['水','土','木','木','土','火','火','土','金','金','土','水'];
export const GAN_WUXING: WuXing[] = ['木','木','火','火','土','土','金','金','水','水'];

// 五行生克: sheng[我] = 我生者, ke[我] = 我克者
export const WUXING_SHENG: Record<WuXing,WuXing> = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
export const WUXING_KE: Record<WuXing,WuXing> = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
export const WUXING_SHENGWO: Record<WuXing,WuXing> = { '木':'水','火':'木','土':'火','金':'土','水':'金' };
export const WUXING_KEWO: Record<WuXing,WuXing> = { '木':'金','金':'火','火':'水','水':'土','土':'木' };

// ============================================================
// 六亲推算: 以宫五行(=我)看爻地支五行
// ============================================================
export const LIUQIN_NAMES: LiuQin[] = ['兄弟','父母','官鬼','妻财','子孙'];

/** 根据宫五行和爻地支五行返回六亲 */
export function getLiuQin(gongWx: WuXing, zhiWx: WuXing): LiuQin {
  if (gongWx === zhiWx) return '兄弟';
  if (WUXING_SHENGWO[gongWx] === zhiWx) return '父母';
  if (WUXING_KEWO[gongWx] === zhiWx) return '官鬼';
  if (WUXING_KE[gongWx] === zhiWx) return '妻财';
  return '子孙';
}

// ============================================================
// 六神 (按日干排列)
// ============================================================
export const LIUSHEN_NAMES: LiuShen[] = ['青龙','朱雀','勾陈','螣蛇','白虎','玄武'];

/** 根据日干获取六神顺序 (甲乙日起青龙...) */
export function getLiuShenOrder(riGan: TianGan): LiuShen[] {
  const idx = GANS.indexOf(riGan);
  // 与 engine.py get_god6 一致: 甲乙→青龙始, 丙丁→朱雀始, 戊己→勾陈始, 庚辛→螣蛇始, 壬癸→白虎始
  const starts: Record<number,number> = { 0:0, 1:0, 2:1, 3:1, 4:2, 5:2, 6:3, 7:3, 8:4, 9:4 };
  const start = starts[idx] ?? 0;
  return [...LIUSHEN_NAMES.slice(start), ...LIUSHEN_NAMES.slice(0, start)];
}

// ============================================================
// 旬空 (日干支→旬空地支对)
// ============================================================
export const XUNKONG_TABLE: [DiZhi,DiZhi][] = [
  ['子','丑'],['寅','卯'],['辰','巳'],['午','未'],['申','酉'],['戌','亥']
];

/** 根据日干支获取旬空地支 */
export function getXunKong(riGan: TianGan, riZhi: DiZhi): DiZhi[] {
  // 与 engine.py xkong 一致: xk = int((zhi - gan)/2) - 1, KONG[xk]
  const gm = GANS.indexOf(riGan);
  let zm = ZHIS.indexOf(riZhi);
  if (zm < gm) zm += 12;
  let xk = Math.floor((zm - gm) / 2) - 1;
  xk = ((xk % 6) + 6) % 6; // Python 负索引: KONG[-1] → KONG[5] = '戌亥'
  const pair = XUNKONG_TABLE[xk];
  return [pair[0], pair[1]];
}

// ============================================================
// 二十八宿 (地支→星宿)
// ============================================================
export const XIU28: string[] = [
  '角木蛟','亢金龙','氐土貉','房日兔','心月狐','尾火虎','箕水豹',
  '斗木獬','牛金牛','女土蝠','虚日鼠','危月燕','室火猪','壁水貐',
  '奎木狼','娄金狗','胃土雉','昴日鸡','毕月乌','觜火猴','参水猿',
  '井木犴','鬼金羊','柳土獐','星日马','张月鹿','翼火蛇','轸水蚓',
];

export const DZ_XIU: Record<DiZhi,string[]> = {
  '子':['虚日鼠','女土蝠','危月燕'], '丑':['斗木獬','牛金牛'],
  '寅':['尾火虎','箕水豹'],           '卯':['房日兔','氐土貉','心月狐'],
  '辰':['角木蛟','亢金龙'],           '巳':['翼火蛇','轸水蚓'],
  '午':['星日马','柳土獐','张月鹿'],  '未':['井木犴','鬼金羊'],
  '申':['觜火猴','参水猿'],           '酉':['昴日鸡','胃土雉','毕月乌'],
  '戌':['奎木狼','娄金狗'],           '亥':['室火猪','壁水貐'],
};

// 地支相冲 (月破: 与月建相冲的地支, 与 engine.py chong_map 一致)
export const CHONG_ZHI: Record<DiZhi,DiZhi> = {
  '子':'午','午':'子','丑':'未','未':'丑','寅':'申','申':'寅',
  '卯':'酉','酉':'卯','辰':'戌','戌':'辰','巳':'亥','亥':'巳',
};

// ============================================================
// 年月日时转干支
// ============================================================
/** 年的天干索引 */
export function yearGan(year: number): number { return (year - 4) % 10; }
/** 年的地支索引 */
export function yearZhi(year: number): number { return (year - 4) % 12; }

// 1900年1月1日 = 甲戌日 (用于日干支计算)
const BASE_DATE = new Date(1900, 0, 1);
const BASE_GAN_IDX = 0;  // 甲
const BASE_ZHI_IDX = 10; // 戌

/** 日期转日干支 */
export function dateToGanZhi(date: Date): { gan: TianGan; zhi: DiZhi } {
  const msPerDay = 86400000;
  const diffDays = Math.floor((date.getTime() - BASE_DATE.getTime()) / msPerDay);
  const ganIdx = ((BASE_GAN_IDX + diffDays) % 10 + 10) % 10;
  const zhiIdx = ((BASE_ZHI_IDX + diffDays) % 12 + 12) % 12;
  return { gan: GANS[ganIdx], zhi: ZHIS[zhiIdx] };
}

/** 月份→月建地支 */
export function monthToJian(month: number): DiZhi { return ZHIS[(month + 1) % 12]; }

/** 小时→时辰地支 */
export function hourToZhi(hour: number): DiZhi {
  const idx = Math.floor((hour + 1) / 2) % 12;
  return ZHIS[idx];
}

// ============================================================
// 铜钱模拟
// ============================================================
/** 随机生成一爻 (6/7/8/9) */
export function randomYao(): YaoValue {
  // 三枚铜钱: 每枚0或1背, 共0-3背
  const backs = Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2) + Math.floor(Math.random() * 2);
  const map: Record<number,YaoValue> = { 0:9, 1:7, 2:8, 3:6 };
  return map[backs];
}

/** 时间起卦: 取日期时分秒生成六爻 */
export function timeQiGua(date: Date): { yaoData: LiuYaoData; shangGua: number; xiaGua: number; dongYao: number } {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  
  // 农历年地支序数
  const nianZhi = (y - 4) % 12 + 1;
  const shang = (nianZhi + m + d) % 8 || 8;
  const xia = (nianZhi + m + d + h) % 8 || 8;
  const dong = (nianZhi + m + d + h) % 6 || 6;
  
  // 根据上下卦和动爻位生成六爻
  const shangCode = GUA_YAOS[shang - 1];  // 上卦三爻
  const xiaCode = GUA_YAOS[xia - 1];      // 下卦三爻
  const fullCode = xiaCode + shangCode;    // 6位: 初→上
  
  const yaoData: number[] = [];
  for (let i = 0; i < 6; i++) {
    const isYang = fullCode[i] === '1';
    if (i + 1 === dong) {
      yaoData.push(isYang ? 9 : 6); // 动爻
    } else {
      yaoData.push(isYang ? 7 : 8); // 静爻
    }
  }
  
  return { yaoData: yaoData as LiuYaoData, shangGua: shang, xiaGua: xia, dongYao: dong };
}
