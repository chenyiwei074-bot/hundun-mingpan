/**
 * AI Provider 统一接口
 * 所有 AI 服务提供商必须实现此接口
 */

export interface AIAnalysisRequest {
  /** 命盘 JSON 数据 */
  chartData: Record<string, unknown>;
  /** 分析类型: bazi | ziwei | comprehensive */
  type: 'bazi' | 'ziwei' | 'comprehensive';
  /** 用户姓名（可选） */
  name?: string;
  /** 提示词覆盖（可选，用于自定义 prompt） */
  promptOverride?: string;
}

export interface AIAnalysisResponse {
  /** 分析结果 JSON */
  result: Record<string, unknown>;
  /** 使用的模型名称 */
  model: string;
  /** 消耗的 token 数 */
  tokensUsed?: number;
  /** 耗时 (ms) */
  latencyMs: number;
}

export interface AIProvider {
  /** 提供商名称 */
  readonly name: string;

  /** 生成命盘分析 */
  generateAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;

  /** 检查是否可用（API Key 已配置且有效） */
  isAvailable(): Promise<boolean>;
}
