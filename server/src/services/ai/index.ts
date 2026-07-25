import type { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './AIProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { OpenAIProvider } from './OpenAIProvider';

/**
 * AI 服务统一入口
 *
 * 使用方式：
 *   import { aiService } from './services/ai';
 *   const result = await aiService.generateAnalysis({ chartData, type: 'comprehensive' });
 *
 * 自动检测可用的 AI Provider（按优先级）：
 *   1. DeepSeek (DEEPSEEK_API_KEY)
 *   2. OpenAI (OPENAI_API_KEY)
 *   3. 如果都不可用，使用规则引擎（现有逻辑，不需要 AI）
 */
class AIService {
  private providers: AIProvider[] = [];
  private initialized = false;

  private init() {
    if (this.initialized) return;
    this.providers = [
      new DeepSeekProvider(),
      new OpenAIProvider(),
    ];
    this.initialized = true;
  }

  /**
   * 检查是否有可用的 AI Provider
   */
  async isAIEnabled(): Promise<boolean> {
    this.init();
    for (const p of this.providers) {
      if (await p.isAvailable()) return true;
    }
    return false;
  }

  /**
   * 获取当前可用的 Provider
   */
  async getAvailableProvider(): Promise<AIProvider | null> {
    this.init();
    for (const p of this.providers) {
      if (await p.isAvailable()) return p;
    }
    return null;
  }

  /**
   * 调用 AI 进行分析
   * 如果 AI 不可用，返回 null（调用方应使用规则引擎作为 fallback）
   */
  async generateAnalysis(request: AIAnalysisRequest): Promise<AIAnalysisResponse | null> {
    const provider = await this.getAvailableProvider();
    if (!provider) return null;

    try {
      return await provider.generateAnalysis(request);
    } catch (error) {
      console.error('[AI] ' + provider.name + ' error:', error);
      return null;
    }
  }
}

export const aiService = new AIService();
export type { AIProvider, AIAnalysisRequest, AIAnalysisResponse };
