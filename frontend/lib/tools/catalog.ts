// 玄学百宝箱目录：整站工具的唯一清单。/tools 页按 INTENTS 渲染四段正文，首页的首屏四类、
// 核心引擎区、启动器轨道三处入口位都只按 slug 引用这里（HOME_FEATURED_SLUGS / LAUNCHER_SLUGS），
// 页面自己不再留一份工具名、说明或链接。
//
// 这份数据只描述「已实现什么」，不描述「打算做什么」——所以每条都要能被机器核对：
// tools/directory-acceptance 会拿文件系统验 href 真的存在、拿引擎导出的常量验口径戳
// 字符串没有写歪、并强制「未开放」的条目不许带链接。目录与实现一旦分叉，断言先红。
//
// 下面的口径戳是**字面量**，不 import 引擎：目录页因此不必把排盘引擎拖进自己的包，
// 而「字面量 == 引擎当前值」由验收单向钉住 —— 引擎改戳而目录没跟上，红的是目录。

export type ToolStatus = '可用' | '部分可用' | '未开放';

export interface ToolEntry {
  /** 展示层用的稳定 key：首页两份清单只按 slug 引用条目，不重抄名字、说明和链接。 */
  slug: string;
  /** 术数名，用于按术数查找。 */
  name: string;
  /** 短展示名：卡片标题位放不下「二十八宿 · 本命宿」这种全名，首页与目录页共用这一个短版。
   *  只在首页有展示位的条目才需要写，写了就必须有（验收按 slug 逐条核对，缺了就红）。 */
  title?: string;
  /** 一句话说明，给首页的引擎行与启动器卡片用。目录页正文用的是下面四段，不用这一句。 */
  teaser?: string;
  /** 一句话说明它回答什么问题。 */
  question: string;
  /** 方法：用户怎么起卦 / 排盘。 */
  method: string;
  /** 计算口径：算法来源与版本戳，用户可据此复核。 */
  basis: string;
  /** 结果怎么读。 */
  reading: string;
  status: ToolStatus;
  /** 未开放的条目必须留空，页面不许给它任何入口。 */
  href?: string;
  /** 状态补充说明（缺陷、依赖、为什么未开放）。 */
  note?: string;
}

export interface IntentGroup {
  intent: string;
  lead: string;
  tools: ToolEntry[];
}

/** 目录里写死的四项口径戳；验收把它们与引擎导出值逐字比对。 */
export const CATALOG_STAMPS = {
  ganzhi: 'jieqi-lichun-v1',
  najia: 'jingfang-neiwai-v2',
  qishu: 'meihua-qishu-v1',
  commit: 'coin-commit-v1',
  fengshui: 'fengshui-geometry-v1',
};

/** 六爻三式的口径戳都写在盘上，目录里的字符串必须与引擎导出一致。 */
export const LIUYAO_BASIS_TEXT = `干支 ${CATALOG_STAMPS.ganzhi} · 纳甲 ${CATALOG_STAMPS.najia} · 取数 ${CATALOG_STAMPS.qishu}`;

export const INTENTS: IntentGroup[] = [
  {
    intent: '认识自己',
    lead: '看一个人的结构：四柱命盘与本命星宿，都按出生那一刻的历法事实取数。',
    tools: [
      {
        slug: 'bazi',
        name: '八字 & 紫微斗数',
        title: '八字 & 紫微',
        teaser: '四柱天干地支 + 十二宫排盘。大运流年、主星四化，一盘双参。',
        question: '我这个人是什么样的一套结构，现在正走在哪一段。',
        method: '填公历或农历生日、时辰、出生地与现居地，可选性别；农历闰月要显式勾选。',
        basis: `四柱年柱以立春为界、月柱以节气为界（${CATALOG_STAMPS.ganzhi}）；选城市后按真太阳时与历史夏令时校正，校正量逐条显示；夜子时统一按 23:00 归次日，不提供开关。`,
        reading: '先看四柱与日主强弱，再看大运流年落在哪一柱；紫微侧看命宫与主星四化。盘面同时给出换算前的原始输入。',
        status: '可用',
        href: '/create',
        note: '建盘后免费自动生成 AI 解读，站内已无付费解锁步骤；成本闸四道：日 token 预算、同生辰 90 天去重、每访客每日 8 份、异常吞掉不影响盘面。',
      },
      {
        slug: 'xiu-benming',
        name: '二十八宿 · 本命宿',
        title: '二十八宿',
        teaser: '生日落在哪一宿。通书值日循环 28 日一周，四象七曜，逐日可核。',
        question: '我出生那天值哪一宿，与另一个人的宿性怎么配。',
        method: '填生日（公历或农历），只认日历日，不认时辰；可加一个对象做合宿。',
        basis: '通书二十八宿值日循环，28 日一周，随公历日历日连续排，不做闰月调整；宿表复用站里六爻内核那一份 XIU28，宿名中之曜恒等于该日星期，可自证相位不失。',
        reading: '先看本宿的性语与吉凶，再看两人宿性之间的生克；「吉 / 凶」是通书以此宿直日的宜忌口径，属择日一面，不是命定吉凶。',
        status: '可用',
        href: '/xiu',
        note: '三九秘宿的命宿取法缺可引来源，未做；合宿倾向指数为本站自研规则，权重写在引擎顶部注释里。',
      },
    ],
  },
  {
    intent: '问一件事',
    lead: '针对具体一事起卦：六爻看细节与成败，梅花看当下之象与体用。',
    tools: [
      {
        slug: 'liuyao',
        name: '六爻纳甲',
        title: '六爻问卦',
        teaser: '金钱起卦，六爻纳甲。世应用神，一事一问，即时断卦。',
        question: '这一件事会怎么发展，哪一爻在动，应期与吉凶在哪。',
        method: '三种起卦：铜钱摇卦（逐爻记录）、时间起卦（按起卦时刻）、报数起卦（报 2 个正整数，第一数定上卦、第二数定下卦、动爻取两数之和）。可一起提交起卦地点。',
        basis: LIUYAO_BASIS_TEXT + '；时间起卦年界按农历正月初一，与四柱的立春界不同，这是两套系统各自的规则，不互相改写。',
        reading: '先看用神与世应，再看动爻变出什么；盘面逐爻给六亲、干支、纳音、旬空与六神，并显示取数过程。',
        status: '可用',
        href: '/liuyao/create',
        note: `铜钱摇卦走 commit-reveal（${CATALOG_STAMPS.commit}）：首掷之前先锁定 32 字节 seed 并公布 seedHash，六轮面值全部由 seed 的前 18 bit 派生（一字节一 bit，无取模偏差），回执 v2 里带 seed 供双向重放。它证明的是「盘上爻值与事先的承诺对得上、事后没被改过」，不证明掷钱这个动作真的发生过，也管不到揭晓之前的整盘重来（重来即新承诺）；实体掷钱同理不在范围内。`,
      },
      {
        slug: 'meihua',
        name: '梅花易数',
        title: '梅花易数',
        teaser: '年月日时或报数成卦。体用为纲，本卦互卦变卦一气看完，即时取断。',
        question: '眼前这个象怎么读，体用生克往哪边偏。',
        method: '时间起卦或报数起卦，成卦后看本卦、互卦、变卦与体用。',
        basis: `取数 ${CATALOG_STAMPS.qishu}（与六爻报数共用同一份公式，改一处两边同变）；卦与动爻转爻值按动爻取老、静爻取少。`,
        reading: '以体为己、用以事，看生克定轻重；变卦看走向。三卦并排，取数过程可复核。',
        status: '可用',
        href: '/meihua',
      },
      {
        slug: 'fengshui',
        name: '户型 · 九宫标注',
        question: '这个户型的采光、动线与分区关系，按我自己标的方位格子能推出什么。',
        method: '把朝向、入户门、主窗与各房间摆进后天九宫，逐条确认后再让规则层推。',
        basis: `规则层 ${CATALOG_STAMPS.fengshui}：只判同宫/相邻/对宫/通路四类几何关系，纯函数无随机；朝向未确认时日照那一层不出判定。`,
        reading: '每条判定都列出它用了哪几项标注、以及说不准的地方；传统方位（八宅、玄空）那一层本站不做，因为没有可引的宅经原文。',
        status: '可用',
        href: '/fengshui',
        note: '不上传户型图：图片要落地就得加存储与告知流程，那一半属于后端；本页所有标注只存在浏览器内存里。',
      },
    ],
  },
  {
    intent: '择时看周期',
    lead: '什么时候动手，以及一段周期正走到哪里。',
    tools: [
      {
        slug: 'huangli',
        name: '黄历宜忌',
        title: '黄历宜忌',
        teaser: '逐日宜忌、吉神凶煞、冲煞胎神、建除黄黑道。通书原样转录，一日一换。',
        question: '某一天通书写宜什么、忌什么，神煞与冲煞怎么摆。',
        method: '选一个公历日，或用农历日换算后查询；前后各五日速览。',
        basis: '宜忌、吉神凶煞、冲煞、彭祖百忌、胎神、五方、建除十二神、黄黑道值神全部由站里唯一的八字引擎按《协纪辨方书》一系规则推算；年/月柱随四柱同用交节瞬时口径，与印本「当日即换」在 199 个立春日中的 100 天、2388 个节日中的 1191 天会不同，页面正文写明。',
        reading: '宜与忌是并列的两组通书原话，「诸事不宜」「馀事勿取」按原样保留不改写；这些是择日口径，不构成对个人命运的判断。',
        status: '可用',
        href: '/huangli',
        note: '只报单日盘面，按事项反查吉日（择日搜索）未做。',
      },
      {
        slug: 'dayun',
        name: '大运 · 流年 · 人生曲线',
        question: '我这几年的起伏节奏，哪几段是上坡哪几段是换挡。',
        method: '在命盘结果里看大运与流年；独立的人生曲线视图未做。',
        basis: '大运由四柱月柱顺逆排，起运岁数按生日与节气的实际差数换算，口径随命盘同一条链。',
        reading: '先看大运换柱的年份，再看流年与命局的生克；曲线视图若做，会显式标注评分为自研模型。',
        status: '部分可用',
        href: '/create',
        note: '命盘内已有大运流年；独立「人生 K 线」评分视图尚未开始，属自研评分，做的时候必须写明非还原。',
      },
    ],
  },
  {
    intent: '看关系',
    lead: '两个人之间的结构差与配合度。',
    tools: [
      {
        slug: 'xiu-he',
        name: '合宿（星宿）',
        question: '我们俩的宿性相生还是相克，谁在供力。',
        method: '在二十八宿页加一个对象的生日，双向看一次。',
        basis: '以我为本看彼、以彼为本看我，两个方向分开报；生克表复用六爻内核的 WUXING_SHENG / WUXING_KE。',
        reading: '先看两宿的吉凶与生克方向，再看对称性——你感受到的那一面，不等于对方感受到的那一面。',
        status: '可用',
        href: '/xiu',
      },
      {
        slug: 'hepan',
        name: '合盘（八字 / 紫微双盘）',
        question: '两个人的命局怎么互相作用。',
        method: '需要双方生辰；当前表单可录入对方生日，但不会提交到后端，也没有双盘对照视图。',
        basis: '无。没有实现就没有口径可写。',
        reading: '无。',
        status: '未开放',
        note: '首页已撤掉「双人合盘」的入口承诺；表单里那半截输入字段仍在，属已知缺陷，不当作功能。',
      },
      {
        slug: 'xingming',
        name: '姓名合盘（五格剖象）',
        title: '姓名合盘',
        teaser: '未做。五格剖象与站内引擎不同源，口径与来源未定；首页的示意只是版式，不给入口，也不是结果。',
        question: '两个姓名之间的五行适配。',
        method: '未实现。',
        basis: '无。',
        reading: '无。',
        status: '未开放',
        note: '五格剖象是近代日本体系，与站内东方引擎不同源，做的话要单列口径与来源。',
      },
    ],
  },
];

/** 每类意图的代表入口（首页首屏用这一份，页面不再自己列第二套工具清单）。
 *  取的是该类里第一个已开放且有 href 的条目 —— 没有可去之处的意图不会伪装出一个入口。 */
export const INTENT_ENTRIES: { intent: string; lead: string; href: string; tool: string }[] = INTENTS
  .map(g => {
    const first = g.tools.find(t => t.status !== '未开放' && t.href);
    return first ? { intent: g.intent, lead: g.lead, href: first.href as string, tool: first.name } : null;
  })
  .filter((x): x is { intent: string; lead: string; href: string; tool: string } => !!x);

/** 目录页上所有可点入口的去重列表，供首页与验收共用。 */
export const LIVE_HREFS: string[] = Array.from(
  new Set(INTENTS.flatMap(g => g.tools.filter(t => t.status !== '未开放' && t.href).map(t => t.href as string))),
);

/** 明确未开放、因此不许出现在任何入口位上的条目名。 */
export const CLOSED_TOOLS: string[] = INTENTS.flatMap(g => g.tools.filter(t => t.status === '未开放').map(t => t.name));

/** 目录页自己也是首页启动器的一格。它不是一个术数，所以不进 INTENTS（否则本页会把自己列成工具），
 *  但它的名字与说明同样只留这一份，首页不许再抄一遍。 */
export const TOOLS_INDEX = {
  slug: 'tools',
  title: '玄学百宝箱',
  teaser: '按「问什么」找工具：每个工具写明方法、取数口径与结果怎么读。',
  href: '/tools',
};

/** 按 slug 取术数条目。目录页那一格（tools）不在这张表里 —— 它不是术数，由 homeCard 单独认。 */
export const TOOL_BY_SLUG: Record<string, ToolEntry> = Object.fromEntries(
  INTENTS.flatMap(g => g.tools).map(t => [t.slug, t]),
);

/** 首页卡片拿到的东西：只有名字、一句话、以及「到底有没有入口」。
 *  href 由 status 再过一道闸门才给出 —— 数据里漏了 href 的未开放条目也照样不会有链接。
 *  slug 解析不到就返回 null：调用方过滤掉，验收则把「首页清单里有 slug 解析不到」判为失败。 */
export interface HomeCard { slug: string; title: string; teaser: string; href?: string }

export function homeCard(slug: string): HomeCard | null {
  if (slug === TOOLS_INDEX.slug) {
    return { slug, title: TOOLS_INDEX.title, teaser: TOOLS_INDEX.teaser, href: TOOLS_INDEX.href };
  }
  const t = TOOL_BY_SLUG[slug];
  if (!t || !t.title || !t.teaser) return null;
  return { slug, title: t.title, teaser: t.teaser, href: t.status === '未开放' ? undefined : t.href };
}

/** 核心引擎区：五张带示意图的行。六爻在目录里指向 /liuyao/create，而首页原来写的 /liuyao
 *  只是一个 replace 到同一页的中转，所以统一吃目录之后少一跳、落点没变。 */
export const HOME_FEATURED_SLUGS: string[] = ['liuyao', 'meihua', 'xiu-benming', 'xingming', 'huangli'];

/** 启动器轨道：七格 —— 六个术数 + 目录页那一格，未开放的仍排在最后但同样不给入口。 */
export const LAUNCHER_SLUGS: string[] = ['bazi', 'liuyao', 'meihua', 'xiu-benming', 'huangli', 'tools', 'xingming'];
