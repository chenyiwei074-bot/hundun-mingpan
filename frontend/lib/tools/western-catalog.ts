// 西方玄学目录（#双体系）。
//
// 这一份与 lib/tools/catalog.ts 共用同一套词汇（ToolStatus / ToolEntry / IntentGroup），
// 不另立第二份状态枚举 —— 两套目录各写各的状态词，UI 与路由就会给出两种"可用"的含义。
//
// 每项状态与页面范围同步；不可用的运算不会因为目录存在而伪装成已算出。
// 未开放 = 没有 href，因此既进不了路由结果，也不会在页面上被伪装成能用的东西。
//
// 本命行星位置默认地心与回归黄道，支持拉希里恒星黄道、南北交点与凯龙星。

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
        slug: 'astro-natal', name: '本命行星位置', status: '可用', href: '/astro',
        question: '我的太阳、月亮与其余行星各落在哪个星座、多少度？',
        method: '填公历日期、当地钟面时间与出生地；日期与时间在本机换算，选国内地点时仅用地点名称向本站查询坐标，结果不落库。',
        basis: '默认采用地心观察与回归黄道（以春分点为起点），也可切换拉希里恒星黄道；时间按出生地时区处理。'
          + '凯龙星用公开权威星历插值；月球交点可选择平均值或真值。',
        reading: '显示十颗行星、凯龙星与月球交点的位置和黄纬，计算主要相位、上升点及七种宫制宫头，并单列太阳和月亮星座。',
        done: ['太阳、月亮与水金火木土天海冥八颗行星的地心黄道经度（落座与度数）',
          '太阳星座、月亮星座',
          '黄纬（一并给出，便于自查）',
          '上升点与整宫制宫位（按出生经纬度与时刻计算，20 组对拍公差 0.05°）',
          '等宫、三分、普拉西德与科赫宫制（20 组交叉核验，公差 0.05°）',
          '雷吉奥蒙塔努斯与坎帕纳斯宫制（以球面几何定义计算）',
          '行星之间的五类主要相位（公开容许度与逐条角距）',
          '凯龙星地心黄道位置（公开权威星历每日插值，公历 1900—2100）',
          '月球北交点与南交点（平均交点与轨道状态向量真交点）',
          '回归黄道与拉希里恒星黄道（具名岁差模型与章动修正）'],
        note: '开放范围为行星、凯龙星、月球交点、两种黄道参考系与七种宫制；Placidus、Koch、Regiomontanus 与 Campanus 在高纬极区不适用时会明确提示。',
      },
      {
        slug: 'astro-synastry', name: '西洋占星 · 跨盘相位', status: '可用', href: '/synastry',
        question: '两个人出生时的行星之间有哪些角度关系？',
        method: '分别填写双方公历生日、当地钟面时间与出生地时区；本机计算两组行星位置与跨盘相位。',
        basis: '地心回归黄道的行星黄经；合、六分、四分、三分、对分五类相位角度。容许度为本站公开的现代实现选择。',
        reading: '双环行星位置、逐条跨盘角距与容许度；不推断双方是否合适。',
        note: '只做跨盘行星相位，不做宫位叠合与中点盘。东方与西方合盘遵循各自体系。',
      },
    ],
  },
  {
    intent: '问一件事',
    lead: '抽牌、记牌阵，再按牌义与位置读。',
    tools: [
      {
        slug: 'tarot-draw', name: '塔罗 · 多牌阵抽取', status: '可用', href: '/tarot',
        question: '我想用哪种牌阵来整理这件事？',
        method: '从 78 张牌中以本地随机种子确定性抽取；可选单牌、三张牌、五张牌或凯尔特十字，并展示正位与逆位。结果可保存到“我的报告”，保留 7 天。',
        basis: '采用韦特—史密斯体系常见的 78 张牌序与名称；牌面由本站原创绘制。抽牌前固定校验码，揭晓后公开随机值，供复核抽牌记录。',
        reading: '显示牌位、牌名、正逆位与逐牌牌义；可查看韦特—史密斯与马赛牌系的牌名、编号和图像结构对读；可请求混沌自研 AI 综合解读，失败时明示规则回退。抽牌种子可离线复算。',
        done: ['78 张牌的名称与花色目录', '单牌、三张、五张与凯尔特十字四种牌阵', '正位与逆位随机方向和分别展示', '参考韦特 1910 年《塔罗图像之钥》所述牌义的 78 张逐牌正逆位译述', '韦特—史密斯与马赛牌系的牌名、编号及图像结构对读', '抽牌前固定校验码，揭晓后公开随机值，可复核抽牌记录', '抽牌记录保存、列表、详情与删除（7 天保留）', '具有韦特—史密斯传统辨识度的原创矢量牌面', '混沌自研 AI 综合解读（失败时明示规则回退）'],
        note: '当前范围包含四种牌阵、7 天记录保存、78 张韦特—史密斯正逆位牌义与马赛牌名/编号/图像结构对读。页面不把韦特牌义冒充为马赛牌义；历史资料与本站整理分层展示。',
      },
    ],
  },
  {
    intent: '择时看周期',
    lead: '查看月亮盈亏与下一次朔望时刻。',
    tools: [
      {
        slug: 'lunar-phase', name: '月相 · 盈亏周期', status: '可用', href: '/moon',
        question: '此刻月亮在盈亏哪一段，下一个朔与望是什么时候？',
        method: '选公历日期、当地时间与时区，或直接查看此刻；本机计算地心月相。',
        basis: 'Astronomy Engine 的地心日月黄经差、月面光照几何和朔望搜索；八段图标为本站显示规则。',
        reading: '月相角、照亮比例，以及所选时区的下一次朔与望。',
        note: '这是天文月相，不把黄历宜忌或个人吉凶混进来。',
      },
    ],
  },
  {
    intent: '看名字与数字',
    lead: '把姓名或出生日期按一种取数表化成数字含义。',
    tools: [
      {
        slug: 'numerology', name: '数字命理 · 生命灵数', status: '可用', href: '/numerology',
        question: '我的出生日数与姓名数各是多少？',
        method: '填公历生日与自己确认的姓名拉丁拼写；逐位化简并展示每个字母对应的数字。',
        basis: '现代拉丁字母 1–9 循环数表；月、日、年分别化简，11/22/33 保留。汉字不自动转写。',
        reading: '每个数的取数过程逐步摊开，让人能自己复算。',
        note: '不同拼写会得到不同结果；输入仅在本机计算，不保存。',
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
