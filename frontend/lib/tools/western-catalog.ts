// 西方玄学目录（#双体系）。
//
// 这一份与 lib/tools/catalog.ts 共用同一套词汇（ToolStatus / ToolEntry / IntentGroup），
// 不另立第二份状态枚举 —— 两套目录各写各的状态词，UI 与路由就会给出两种"可用"的含义。
//
// 现在有两项带入口：本命行星位置（引擎项）与塔罗牌阵抽取（无引擎的预览项，只抽牌不解读）。
// 其余三项仍未开放：数字命理取哪种字母-数字表、占星的宫制与相位都还没有裁定的出处与算法口径。
// 未开放 = 没有 href；部分可用 = 有 href，但必须在 done/notDone 里写清缺哪一段。
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
          slug: 'tarot-draw', name: '塔罗 · 牌阵抽取', status: '部分可用', href: '/tarot',
          question: '这件事眼下、阻碍与建议各是哪一张？',
          method: '三张牌阵（过去 / 现在 / 未来），由浏览器安全随机数生成种子并先公布 SHA-256 承诺摘要，'
            + '抽牌后公开种子，可在本机复算这三张牌；不发请求、不落库。',
          basis: '牌阵与随机源已定：78 张标准牌名、三张位置固定、正逆位由同一种子决定。缺的是牌义层：'
            + '牌义底本（1916 年公版，待入仓接线）尚未接入，所以现在只显示牌名与牌位，不生成任何解释。',
          reading: '三张牌、位置、承诺摘要与种子；牌义接入后补上原文与本站白话。',
          done: ['三张牌阵（过去 / 现在 / 未来）',
            'SHA-256 承诺摘要与种子公开，可本地复算',
            '正位与逆位都由同一种子决定，可本地复算'],
          notDone: ['正位/逆位牌义原文与本站白话（等底本接入）',
            '更细的牌义分层（元素、宫位等，未做）',
            '十张牌阵（本站不做）'],
          note: '部分可用 = 能抽牌、能复算正逆位，但不解读：牌义未接入前不给任何含义或综合结论。',
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
