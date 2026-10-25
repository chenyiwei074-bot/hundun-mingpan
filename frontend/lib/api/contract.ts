// 前端 ↔ 后端的取值契约（D6：不许发后端不接受的取值）。
//
// 为什么单独成文件：这几条判据必须能在 node 里被 tools/api-contract-acceptance 直接跑
// （与 lib/fengshui/upload.ts、recognize.ts 同一个理由 —— 写在组件里就只能抠源码 eval）。
//
// 真值住在后端：`server/src/utils/types.ts` 的 `CreateChartSchema`。
// 这里那份字面量是它的**副本**，所以套件里有一条闸门逐字比对两边 —— 后端改枚举而这条没红，
// 就是同步漏了。副本本身是必要的（浏览器包里不能 import zod 的服务端定义），
// 但"要不要同步"这件事不能靠人记得住。
//
// 一条不能让步的口径：`calendar` 与 `birthday` 的**值语义**是冻结的 —— 它们表示"用户的原始输入"，
// 不是"引擎能解析的形式"。所以遇到后端不收的取值（'四柱'），
// 正确做法是**不发**并明说，而不是把它改写成别的值蒙过校验：
// 后者会让 charts.birth_data 同一列的新旧行分叉成两种意思，那是静默的数据污染。

/** 与 server CreateChartSchema.gender 同一条枚举。 */
export const SERVER_GENDER = ['男', '女'] as const;
/** 与 server CreateChartSchema.calendar 同一条枚举（注意：前端界面还有第三个 tab「四柱」，那个后端不收）。 */
export const SERVER_CALENDAR = ['公历', '农历'] as const;
/** 与 server CreateChartSchema.birthday 的 regex 同一条。 */
export const SERVER_BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export type ServerGender = typeof SERVER_GENDER[number];
export type ServerCalendar = typeof SERVER_CALENDAR[number];

/** 界面上能选的历法 tab。'四柱' 是纯前端能力：直接给四柱干支排盘，后端 schema 里没有这一档。 */
export type UiCalendar = ServerCalendar | '四柱';

/** 要发给 POST /api/chart/create 的那份 body。字段名与顺序照服务端 schema。 */
export interface CreateChartPayload {
  visitor_id: string;
  name: string;
  gender: string;
  calendar: string;
  birthday: string;
  isLeapMonth?: boolean;
  birthPlace: string;
  currentPlace: string;
}

export type Validation = { ok: true } | { ok: false; field: string; why: string };

/** 逐字段对着服务端 schema 判一遍。返回第一个不合格项 —— 调用方要把它显示出来，
 *  而不是吞掉之后照样往下走（现在的问题正是吞掉之后静默走本机兜底）。 */
export function validateCreateChart(p: CreateChartPayload): Validation {
  if (!p.visitor_id || !p.visitor_id.trim()) return { ok: false, field: 'visitor_id', why: '这台设备还没有访客标识，后端按缺字段拒收。' };
  if (!p.name || !p.name.trim()) return { ok: false, field: 'name', why: '名字是必填的（后端 min(1)），空着会被拒。' };
  if (!(SERVER_GENDER as readonly string[]).includes(p.gender)) {
    return { ok: false, field: 'gender', why: `gender 只收 ${SERVER_GENDER.join(' / ')}，实得「${p.gender}」。` };
  }
  if (!(SERVER_CALENDAR as readonly string[]).includes(p.calendar)) {
    return { ok: false, field: 'calendar', why: `calendar 只收 ${SERVER_CALENDAR.join(' / ')}，实得「${p.calendar}」—— 四柱直批目前不在后端契约里。` };
  }
  if (!SERVER_BIRTHDAY_RE.test(p.birthday)) {
    return { ok: false, field: 'birthday', why: `birthday 必须是 YYYY-MM-DD HH:mm，实得「${p.birthday}」。` };
  }
  if (typeof p.isLeapMonth !== 'undefined' && typeof p.isLeapMonth !== 'boolean') {
    return { ok: false, field: 'isLeapMonth', why: 'isLeapMonth 只能是 true/false 或不传。' };
  }
  return { ok: true };
}

/** 这一条能不能由现有建盘流程处理。'四柱' 缺少出生日期，不能生成完整八字与紫微盘。 */
export function canPersist(calendar: UiCalendar): { 能: boolean; 原因: string } {
  if (calendar === '四柱') {
    return {
      能: false,
      原因: '四柱直批暂未开放：仅凭四柱干支无法确定出生日期、起运与紫微宫位，'
        + '现有本机引擎也不能据此生成可信的完整命盘；后端仅接收公历或农历生日。'
        + '此输入方式不会存进「我的报告」，请改用完整出生资料。',
    };
  }
  return { 能: true, 原因: '' };
}
