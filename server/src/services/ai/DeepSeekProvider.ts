import type { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './AIProvider';

/**
 * DeepSeek AI Provider
 * 使用 DeepSeek API (兼容 OpenAI 格式)
 * 环境变量: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (默认 https://api.deepseek.com)
 */
export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek';

  private get apiKey(): string | undefined {
    return process.env.DEEPSEEK_API_KEY;
  }

  private get baseUrl(): string {
    return process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generateAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const apiKey = this.apiKey;
    if (!apiKey) throw new Error('DeepSeek API key not configured');

    const startTime = Date.now();

    const messages = this.buildMessages(request);
    const modelName = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const response = await fetch(this.baseUrl + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.7,
        max_tokens: request.type === 'comprehensive' ? 16384 : 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('DeepSeek API error: ' + response.status + ' ' + errorText);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '{}';

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(content);
    } catch {
      result = { raw: content };
    }

    return {
      result,
      model: modelName,
      tokensUsed: data.usage?.total_tokens,
      latencyMs: Date.now() - startTime,
    };
  }

  private buildMessages(request: AIAnalysisRequest) {
    const systemPrompt = request.promptOverride || this.getDefaultPrompt(request.type);
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(request.chartData) },
    ];
  }

  private getDefaultPrompt(type: string): string {
    switch (type) {
      case 'bazi':
        return '你是一位精通八字命理的专家。请基于用户提供的八字排盘数据，进行专业分析并以 JSON 格式返回。';
      case 'ziwei':
        return '你是一位精通紫微斗数的命理专家。请基于用户提供的紫微排盘数据，进行专业分析并以 JSON 格式返回。';
      case 'comprehensive':
        return '你是一位精通八字和紫微斗数的命理大师。请基于用户提供的综合命盘数据，进行双盘印证分析并以 JSON 格式返回。';
      default:
        return '你是一位命理专家，请基于提供的命盘数据进行专业分析。';
    }
  }
}
