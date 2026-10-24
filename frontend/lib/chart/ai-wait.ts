// 免费 AI 解读的等待状态机（纯函数，可注入时钟 —— 210 秒这种东西不该靠真等来验收）。
//
// 后端 GET /api/chart/result/:id 已经支持「排盘先出」：status=processing 且 chartJson 已落库时
// 就返回 chartData（不带 aiAnalysis）。以前前端在 processing 分支里直接 return 继续轮询，
// 于是盘面要等 AI 跑完（实测 94–116 秒）才画出来 —— 这是这条链上真正的缺陷，不是动画问题。
//
// 裁定 6 的五条：① 210s 停轮询、保留盘面；② 超时提示「还在生成中，稍后刷新本页或从我的报告回看」；
// ③ 不许伪造百分比/假进度；④ 完成后不刷新自动替换；⑤ 刷新不丢盘面，aiAnalysis 已就绪就直接显示。

/** 轮询间隔 2s（要求 ≥1.5s），截止 210s（要求 210s 停）。 */
export const AI_POLL_MS = 2000;
export const AI_DEADLINE_MS = 210_000;

export type AiWaitState =
  /** 排盘都还没出来（后端 202，chartJson 尚未落库） */
  | 'chart-pending'
  /** 盘面已出，AI 还在跑 */
  | 'ai-waiting'
  /** AI 已出 */
  | 'ai-ready'
  /** 后端已终态但没有 AI 解读（成本闸拦下或生成失败）—— 不会再来了，别继续等 */
  | 'ai-none'
  /** 到 210s 仍在跑：停轮询，留提示 */
  | 'ai-timeout'
  /** 后端明确 failed */
  | 'chart-failed';

export interface PollResponse {
  httpStatus: number;
  status?: string;
  chartData?: unknown;
  aiAnalysis?: unknown;
}

export interface AiWaitDecision {
  state: AiWaitState;
  /** 盘面该画了吗 */
  showPlate: boolean;
  /** 还要不要继续轮询 */
  keepPolling: boolean;
  /** 下一次间隔（ms） */
  nextDelayMs: number;
}

const hasPlate = (r: PollResponse) => r.chartData !== null && r.chartData !== undefined;
const hasAi = (r: PollResponse) => r.aiAnalysis !== null && r.aiAnalysis !== undefined;

/** elapsedMs 由调用方注入（同一份代码在真时钟与假时钟下走同一条判定）。 */
export function decideAiWait(res: PollResponse, elapsedMs: number): AiWaitDecision {
  if (res.status === 'failed' || (res.httpStatus >= 400 && res.httpStatus !== 404)) {
    return { state: 'chart-failed', showPlate: hasPlate(res), keepPolling: false, nextDelayMs: 0 };
  }
  if (hasAi(res)) {
    return { state: 'ai-ready', showPlate: true, keepPolling: false, nextDelayMs: 0 };
  }
  const processing = res.httpStatus === 202 || res.status === 'processing' || res.status === 'pending';
  if (processing) {
    if (!hasPlate(res)) {
      return { state: 'chart-pending', showPlate: false, keepPolling: elapsedMs < AI_DEADLINE_MS, nextDelayMs: AI_POLL_MS };
    }
    return {
      state: elapsedMs >= AI_DEADLINE_MS ? 'ai-timeout' : 'ai-waiting',
      showPlate: true,
      keepPolling: elapsedMs < AI_DEADLINE_MS,
      nextDelayMs: AI_POLL_MS,
    };
  }
  // 后端已是终态（completed 等）却没有 aiAnalysis：不会再来了。
  return { state: hasPlate(res) ? 'ai-none' : 'chart-failed', showPlate: hasPlate(res), keepPolling: false, nextDelayMs: 0 };
}

/**
 * 给 UI 的一句话。三条硬约束：不承诺百分比、不说「预计 X 秒」（我们真的不知道，
 * 免费模型实测 94–116 秒但会随负载变）、超时后不把责任推给用户操作。
 */
export function aiWaitMessage(state: AiWaitState): string {
  switch (state) {
    case 'chart-pending': return '正在排盘';
    case 'ai-waiting': return '命盘已就绪。混沌自研 AI 正在生成解读，完成后会自动显示在这里。';
    case 'ai-timeout': return '混沌自研 AI 解读还在生成中，你可以稍后刷新本页或从「我的报告」查看。盘面内容不受影响。';
    case 'ai-none': return '本次暂未生成混沌自研 AI 解读，盘面已完整展示；稍后可在「我的报告」重试。';
    case 'ai-ready': return '';
    case 'chart-failed': return '排盘未完成，请返回重试。';
  }
}
