import type { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './AIProvider';
import fs from 'fs';

/**
 * 免费模型兜底（A 方案）
 * 兼容任意 OpenAI 格式的免费/低价模型：智谱 GLM-4-Flash、通义 qwen-flash（百炼兼容模式）、ModelScope 等。
 * 环境变量：FREE_AI_API_KEY / FREE_AI_BASE_URL / FREE_AI_MODEL
 * 未配置 key 时 isAvailable()=false，分析层自动回落到 DeepSeek —— 不配置也不影响现有功能。
 */
export class FreeModelProvider implements AIProvider {
  readonly name = 'free-model';

  private get apiKey(): string | undefined {
    const k = process.env.FREE_AI_API_KEY;
    return k && k.trim() ? k.trim() : undefined;
  }
  private get baseUrl(): string {
    return (process.env.FREE_AI_BASE_URL || '').replace(/\/$/, '');
  }
  private get modelName(): string {
    return process.env.FREE_AI_MODEL || '';
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey && this.baseUrl && this.modelName);
  }

  async generateAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('Free model API key not configured');

    const startTime = Date.now();
    const modelName = this.modelName;
    const messages = [
      { role: 'system', content: request.promptOverride || '你是一位命理专家，请基于提供的命盘数据做专业分析并以 JSON 输出。' },
      { role: 'user', content: JSON.stringify(request.chartData) },
    ];

    // 超时（B 方案）：免费模型太慢时中止，交由 analysis.service 回落 DeepSeek
    const timeoutMs = Number(process.env.FREE_AI_TIMEOUT_MS || 60000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // 不传 response_format：部分免费模型不支持该参数，靠 prompt 约束 + 容错解析
    let response: Response;
    try {
      response = await fetch(this.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.6,
          max_tokens: request.maxTokens ?? 2048,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        throw new Error('Free model timeout after ' + timeoutMs + 'ms');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Free model API error: ' + response.status + ' ' + errorText.slice(0, 300));
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '{}';
    let result: Record<string, unknown>;
    try {
      const clean = String(content).replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      result = JSON.parse(clean);
    } catch {
      result = { raw: content };
    }

    try {
      fs.appendFileSync('/srv/chaos/logs/ai-usage.jsonl', JSON.stringify({
        ts: new Date().toISOString(),
        model: modelName,
        purpose: 'free-provider',
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
      }) + '\n');
    } catch { /* ignore */ }

    return { result, model: modelName, tokensUsed: data.usage?.total_tokens, latencyMs: Date.now() - startTime };
  }
}
