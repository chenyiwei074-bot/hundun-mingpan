// 西方玄学目录（#双体系）。
//
// 这一份与 lib/tools/catalog.ts 共用同一套词汇（ToolStatus / ToolEntry / IntentGroup），
// 不另立第二份状态枚举 —— 两套目录各写各的状态词，UI 与路由就会给出两种"可用"的含义。
//
// 本命行星位置与塔罗抽牌已开放为部分可用。塔罗只提供可复算的三张抽取与牌面，
// 尚无经过资料校核的牌义；数字命理取哪种字母-数字表、占星的宫制与相位仍未裁定。
// 未开放 = 没有 href，因此既进不了路由结果，也不会在页面上被伪装成能用的东西。
//
// 「本命行星位置」是 E2 裁定的那一项：口径（地心 / 回归黄道 / 无 ayanamsa / 无宫位无相位）
// 由运维 2026-10-23 裁定后才有 href，不是先做个入口再补口径。

import type { IntentGroup, ToolEntry, ToolStatus } from './catalog';

export type { ToolStatus };

// 口径戳纪律：basis 里不许出现 `xxx-yyy-vN` 形状的字串，除非引擎真的导出同名戳
// （directory-acceptance 扫这两套目录的全部字面量，astro-acceptance 拿引擎导出值逐字比对）。
// E2 之后西方有两个戳：astro-planets-v1（lib/astro/planets.ts）与 astro-moment-iana-v1
// （lib/astro/moment.ts）。谁改戳而目录没跟上，红的是目录。
export const WESTERN_INTENTS: IntentGroup[] = [
  {
    intent: '看本命',
    lead: '用出生时刻与地点，看一套行星落座与宫位的记录。',
    tools: [
      {
        slug: 'astro-natal', name: '本命行星位置', status: '部分可用', href: '/astro',
        question: '我的太阳、月亮与其余行星各落在哪个星座、多少度？',
        method: '填公历日期、当地钟面时间与出生地时区，这一台设备当场算出黄道经度与落座；'
          + '不发请求、不落库，出生信息不出设备。',
        basis: '地心、回归黄道（当日真春分点）、不作恒星黄道换算。口径戳 astro-planets-v1，'
          + '时刻换算口径 astro-moment-iana-v1（用本机自带的时区数据库，含夏令时与历史偏移）。'
          + '历表出处为 MIT 授权的天文引擎内置 DE441 数值，与权威星历抽样对拍，公差 0.02 度。',
        reading: '一张十颗星的表：落座、星座内度数（占星写法 12°34′）、黄经与黄纬；'
          + '表上方单独给太阳与月亮星座。世界时与相对 UTC 的偏移也印在上面，便于自己复核。',
        done: ['太阳、月亮与水金火木土天海冥八颗行星的地心黄道经度（落座与度数）',
          '太阳星座、月亮星座',
          '黄纬（一并给出，便于自查）'],
        notDone: ['上升点与任何宫位（需要宫制与分宫法，本站未裁定）',
          '行星之间的相位',
          '凯龙星等小行星',
          '南北交点（含真假交点之辨）',
          '恒星黄道的读法（要先定岁差换算取哪一张表）'],
        note: '部分可用 = 只算落座与度数这一层。缺的那几样一样都没算，'
          + '所以这一项叫「本命行星位置」而不叫星盘：叫盘会让人以为缺的那几样也算了。',
      },
      {
        slug: 'astro-synastry', name: '西洋占星 · 合盘', status: '未开放',
        question: '两个人的盘叠在一起是什么关系？',
        method: '两张本命盘叠合（或各取中点），看跨盘的行星相位。',
        basis: '缺的是相位那一层：本命行星位置已经能算落座，但合盘的主张全靠跨盘相位，'
          + '而本站不合成相位。缺这一层，叠两张表出来只是两个日期放在一起。',
        reading: '跨盘相位表与逐条依据。',
        note: '与东方合盘是两套不同体系，不互相换算，也不共用算法。',
      },
    ],
  },
  {
    intent: '问一件事',
    lead: '抽牌、记牌阵，再按牌义与位置读。',
    tools: [
      {
        slug: 'tarot-draw', name: '塔罗 · 三张牌抽取', status: '部分可用', href: '/tarot',
        question: '这件事的过去、现在与未来如何？',
        method: '从 78 张牌中以本地随机种子确定性抽取三张，分别放入过去、现在与未来位置；正位与逆位方向也由同一随机种子确定。',
        basis: '牌序与中英文名称采用韦特—史密斯体系常见的 78 张结构；插画由本站原创矢量绘制，借用可辨认的传统象征主题，不复刻原牌图。洗牌先公布 SHA-256 承诺，揭牌后公开种子，可在本地复算抽取结果。',
        reading: '显示三张牌的牌位、牌名、花色/序号、正逆位，以及参考韦特 1910 年《塔罗图像之钥》所述牌义的中文译述（章节对应待校核）；抽取种子可离线复算。',
        done: ['78 张牌的名称与花色目录', '过去/现在/未来三张抽取', '正位与逆位随机方向和分别展示', '参考韦特 1910 年《塔罗图像之钥》所述牌义的 78 张逐牌正逆位译述（章节对应待校核）', '本地 SHA-256 承诺与公开种子', '具有韦特—史密斯传统辨识度的原创矢量牌面'],
        notDone: ['跨传统牌义比较及学术研究综述', 'AI 牌阵综合解读', '其他牌阵与账户内保存'],
        note: '部分可用 = 三张牌抽取、方向化牌义与来源已实现；译述代表韦特 1910 年《塔罗图像之钥》所载的一种传统，不等于各流派共识或学术认证；底本与章节对应待校核。',
      },
    ],
  },
  {
    intent: '择时看周期',
    lead: '月亮盈亏与行星小时的周期表。',
    tools: [
      {
        slug: 'lunar-phase', name: '月相 · 盈亏周期', status: '未开放',
        question: '某一天是农历几时月相？下一个朔与望在什么时候？',
        method: '由天文历表算朔望时刻与月相角，换算到用户所在时区。',
        basis: '缺项未定：历表出处与允许误差。黄历的宜忌是另一套体系，不拿它顶这一项。',
        reading: '朔望时刻表与当日月相照亮比例，逐条标计算来源。',
        note: '等西方线的历表出处裁定后开工。',
      },
    ],
  },
  {
    intent: '看名字与数字',
    lead: '把姓名或出生日期按一种取数表化成数字含义。',
    tools: [
      {
        slug: 'numerology', name: '数字命理 · 生命灵数', status: '未开放',
        question: '我的出生日数与姓名数各是多少？',
        method: '按一张字母-数字表与化简规则求和。',
        basis: '缺项未定：用毕达哥拉斯表还是卡巴拉表、母数与业力数留不留、中文姓名怎么取数。',
        reading: '每个数的取数过程逐步摊开，让人能自己复算。',
        note: '与东方五格剖象是两套表，不混用，也不互相改名。',
      },
    ],
  },
];

export const WESTERN_TOOLS: ToolEntry[] = WESTERN_INTENTS.flatMap(g => g.tools);
export const WESTERN_TOOL_BY_SLUG: Record<string, ToolEntry> = Object.fromEntries(
  WESTERN_TOOLS.map(t => [t.slug, t]));
export const WESTERN_LIVE_HREFS: string[] = [...new Set(
  WESTERN_TOOLS.filter(t => t.status !== '未开放' && t.href).map(t => t.href!))];
export const WESTERN_CLOSED_TOOLS: string[] = WESTERN_TOOLS.filter(t => t.status === '未开放').map(t => t.name);
