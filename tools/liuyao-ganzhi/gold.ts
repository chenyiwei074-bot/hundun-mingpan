// 手写的六爻金标准：京房纳甲表 + 五行生克 + 京房八宫变爻规则。
//
// 为什么单独立一个文件：这份表要同时喂两个消费者 ——
//   tools/liuyao-ganzhi/acceptance.ts  拿它钉前端 getNaJia 与后端 paiPan（64 卦 × 6 爻）；
//   tools/liuyao-ganzhi/make-fixture.ts 拿它派生 harness 的盘面断言值。
// 两边各抄一份的话，抄错的那一份会变成第二个真相；两边都从实现里取，又会把同一个 bug
// 洗成"正确"（#66 的错在下标，不在表，两份表都是对的）。所以金标准只写一次，且只手写。
//
// 手写来源：《京氏易传》纳甲口诀 —— 乾金甲子外壬午、坤土乙未外癸丑、
// 震庚巽辛丙艮丁兑、坎戊离己；阳卦顺排（地支 +2）、阴卦逆排（−2），只有乾坤分纳内外两干。
// 这里既不 import 前端 core/constants 的 NA_GAN+NA_ZHI，也不抄后端 core/liuyao/constants 的 NAJIA。

/** 8 经卦各纳 [内三爻, 外三爻]，位序 初→上。 */
export const NAJIA_GOLD: Record<string, { nei: string[]; wai: string[] }> = {
  乾: { nei: ['甲子', '甲寅', '甲辰'], wai: ['壬午', '壬申', '壬戌'] },
  坤: { nei: ['乙未', '乙巳', '乙卯'], wai: ['癸丑', '癸亥', '癸酉'] },
  震: { nei: ['庚子', '庚寅', '庚辰'], wai: ['庚午', '庚申', '庚戌'] },
  巽: { nei: ['辛丑', '辛亥', '辛酉'], wai: ['辛未', '辛巳', '辛卯'] },
  坎: { nei: ['戊寅', '戊辰', '戊午'], wai: ['戊申', '戊戌', '戊子'] },
  离: { nei: ['己卯', '己丑', '己亥'], wai: ['己酉', '己未', '己巳'] },
  艮: { nei: ['丙辰', '丙午', '丙申'], wai: ['丙戌', '丙子', '丙寅'] },
  兑: { nei: ['丁巳', '丁卯', '丁丑'], wai: ['丁亥', '丁酉', '丁未'] },
};
export const YANG_GUA = ['乾', '震', '坎', '艮'];   // 阳卦顺排（+2），阴卦逆排（−2）

// 六亲金标准需要的三份独立小表：五行生克 + 地支五行 + 八卦五行，都是通书口径，手写不抄实现。
export const WX_BY_ZHI: Record<string, string> = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
export const WX_BY_GONG: Record<string, string> = { 乾: '金', 兑: '金', 离: '火', 震: '木', 巽: '木', 坎: '水', 艮: '土', 坤: '土' };
export const WX_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const WX_KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 六亲按宫五行与爻地支五行的关系定（同我兄弟 / 我生子孙 / 我克妻财 / 克我官鬼 / 生我父母）。 */
export function goldLiuQin(gong: string, zhi: string): string {
  const g = WX_BY_GONG[gong], y = WX_BY_ZHI[zhi];
  if (g === y) return '兄弟';
  if (WX_SHENG[g] === y) return '子孙';
  if (WX_KE[g] === y) return '妻财';
  if (WX_KE[y] === g) return '官鬼';
  if (WX_SHENG[y] === g) return '父母';
  return '?';
}

// 世爻规则（本宫/一世/二世/三世/四世/五世/游魂/归魂，1-based）；应 = 世 ± 3。
export const SHI_RULE = [6, 1, 2, 3, 4, 5, 4, 3];
export const goldShiYing = (k: number) => { const shi = SHI_RULE[k]; return { shi, ying: shi <= 3 ? shi + 3 : shi - 3 }; };

// 卦形：八口卦诀，1=阳，位序 初→上（乾三连、坤六断、兑上缺、离中虚、震仰盂、巽下断、坎中满、艮覆碗）。
export const TRIGRAM_BITS: Record<string, string> = {
  乾: '111', 坤: '000', 兑: '110', 离: '101', 震: '100', 巽: '011', 坎: '010', 艮: '001',
};
export const TRIGRAM_BY_BITS: Record<string, string> = {};
for (const g of Object.keys(TRIGRAM_BITS)) TRIGRAM_BY_BITS[TRIGRAM_BITS[g]] = g;
/** 先天八卦数 1..8 的次序，只用来给验收脚本按序号取卦；本身不是金标准内容。 */
export const TRIGRAMS = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/**
 * 京房八宫的 64 卦用「变爻规则」现算，不 import 前端 PALACE、不抄后端 GONG8：
 * 本宫卦（上下同卦）→ 依次变 初/二/三/四/五 爻 = 一世…五世 → 游魂再把四爻变回来 → 归魂内卦整体回本宫。
 * 位序 初→上，1=阳。这样宫位是从规则推出来的，PALACE/GONG8 只要抄错一格就会被六亲打回来。
 */
export function gongBits(g: string, k: number): string {
  const base = TRIGRAM_BITS[g] + TRIGRAM_BITS[g];
  const b = base.split('');
  const flip = (i: number) => { b[i] = b[i] === '1' ? '0' : '1'; };
  if (k >= 1) for (let i = 0; i < k && i < 5; i++) flip(i);   // 一世…五世：变 初..五（上爻是本宫卦，永不变）
  if (k >= 6) flip(3);                                        // 游魂：四爻回变；归魂承接游魂的外卦再换内卦
  if (k === 7) base.slice(0, 3).split('').forEach((c, i) => { b[i] = c; });  // 归魂：内卦整体回本宫
  return b.join('');
}

/** 上卦 + 下卦 → 六爻纳甲干支（初→上）：内卦取该卦内三爻，外卦取该卦外三爻。 */
export function goldFor(shang: string, xia: string): string[] {
  return [...NAJIA_GOLD[xia].nei, ...NAJIA_GOLD[shang].wai];
}

/** 修前那一条写法复算：外卦的支也按 [0..2] 取（= 该卦自己的内三爻），干仍取外卦干。
 *  金标准修好后 live 输出就等于正确答案，所以"修前"必须像 oldDayGanZhi 那样复算，不能抓现值。 */
export function goldOld(shang: string, xia: string): string[] {
  const waiGan = NAJIA_GOLD[shang].wai[0][0];
  return [...NAJIA_GOLD[xia].nei, ...NAJIA_GOLD[shang].nei.map(z => waiGan + z[1])];
}

/** 一卦六爻的完整金标准（宫 / 世应 / 每爻 干支·六亲·五行），位序一律 初→上。 */
export function goldPlate(shang: string, xia: string) {
  const gong = goldGongOf(shang, xia);
  const gz = goldFor(shang, xia);
  return {
    ...gong, shangGua: shang, xiaGua: xia, ganZhi: gz,
    liuQin: gz.map(z => goldLiuQin(gong.gong, z[1])),
    wx: gz.map(z => WX_BY_ZHI[z[1]]),
    old: goldOld(shang, xia),
  };
}

/** 由上下卦反查京房宫位与世序：从变爻规则现算，不查任何一份 PALACE/GONG8 表。 */
export function goldGongOf(shang: string, xia: string) {
  const bits = TRIGRAM_BITS[xia] + TRIGRAM_BITS[shang];
  for (const g of TRIGRAMS) for (let k = 0; k < 8; k++) {
    if (gongBits(g, k) === bits) return { gong: g, k, ...goldShiYing(k) };
  }
  throw new Error(`上下卦 上${shang}下${xia}（形 ${bits}）不在八宫变爻规则生成的 64 卦里`);
}

// 64 卦卦名的读法：前两字是「上卦象名 + 下卦象名」；八个纯卦写作「经卦名 + 为 + 象名」（乾为天、坤为地…），
// 首字直接就是经卦名。手写这张表，用来把盘面上存的卦名反推回上下卦，从而独立复算金标准 ——
// 不 import 前端 S64 / 后端 GUA64，否则「卦名对不对」这一环就变成自己证明自己。
const XIANG_TO_GUA: Record<string, string> = { 天: '乾', 地: '坤', 雷: '震', 风: '巽', 水: '坎', 火: '离', 山: '艮', 泽: '兑' };
export function guaNameToTrigrams(name: string): { shang: string; xia: string } {
  const c = Array.from(name);
  if (c[1] === '为' && TRIGRAM_BITS[c[0]]) return { shang: c[0], xia: c[0] };   // 纯卦：乾为天
  const shang = XIANG_TO_GUA[c[0]];
  const xia = XIANG_TO_GUA[c[1]];
  if (!shang || !xia) throw new Error(`卦名「${name}」读不出上下卦（前两字应为 上象名+下象名，纯卦为 经卦名+为+象名）`);
  return { shang, xia };
}
