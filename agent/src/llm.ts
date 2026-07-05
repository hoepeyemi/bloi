import OpenAI from 'openai';
import { AnalysisResult, Strategy, AgentThought } from './types.js';
import { STRATEGY_NAMES } from './constants.js';

const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 300;
const TIMEOUT_MS = 30_000;
const MAX_CALLS_PER_MINUTE = 30;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(id); resolve(v); })
           .catch((e) => { clearTimeout(id); reject(e); });
  });
}

export class LLMService {
  private client: OpenAI | null = null;
  private enabled = false;
  private callCount = 0;
  private windowStart = 0;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      this.enabled = true;
      console.log(`LLM Service initialized: ${MODEL}`);
    } else {
      console.warn('No OPENAI_API_KEY provided — using template-based explanations.');
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.windowStart > 60_000) {
      this.callCount = 0;
      this.windowStart = now;
    }
    return this.callCount < MAX_CALLS_PER_MINUTE;
  }

  async generateExplanation(analysis: AnalysisResult): Promise<string> {
    if (!this.enabled || !this.client || !this.checkRateLimit()) {
      return this.generateTemplateExplanation(analysis);
    }

    try {
      const call = this.client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'system',
            content: `You are an AI financial advisor agent analyzing tokenized invoices for yield optimization on Base Sepolia.
Explain investment decisions in clear, concise language a small business owner can understand.
Keep explanations under 3 sentences. Be direct and actionable. Focus on the "why" behind recommendations.`,
          },
          { role: 'user', content: this.buildPrompt(analysis) },
        ],
      });

      const response = await withTimeout(call, TIMEOUT_MS, 'LLM generateExplanation');
      this.callCount++;

      return response.choices[0]?.message?.content ?? this.generateTemplateExplanation(analysis);
    } catch (error) {
      console.error('LLM error, falling back to template:', error instanceof Error ? error.message : error);
      return this.generateTemplateExplanation(analysis);
    }
  }

  private buildPrompt(analysis: AnalysisResult): string {
    return `Explain this invoice yield strategy decision to a business owner:

Invoice Details:
- Token ID: ${analysis.tokenId}
- Days until payment due: ${analysis.daysUntilDue}
- Risk Score: ${analysis.riskScore}/100 (higher = safer)
- Payment Probability: ${analysis.paymentProbability}%
- Current Strategy: ${STRATEGY_NAMES[analysis.currentStrategy]}
- Recommended Strategy: ${STRATEGY_NAMES[analysis.recommendedStrategy]}
- Confidence: ${analysis.confidence}%
- Should Change: ${analysis.shouldAct ? 'Yes' : 'No'}

Strategy Definitions:
- Hold: Keep invoice without yield optimization (0% APY)
- Conservative: Low-risk Aave V3 lending (3.5% APY)
- Aggressive: Higher-yield Aave V3 pools (7% APY)

Explain why we're ${analysis.shouldAct ? 'changing to' : 'keeping'} the ${STRATEGY_NAMES[analysis.recommendedStrategy]} strategy in 2-3 sentences.`;
  }

  private generateTemplateExplanation(analysis: AnalysisResult): string {
    const strategy = STRATEGY_NAMES[analysis.recommendedStrategy];
    const current = STRATEGY_NAMES[analysis.currentStrategy];

    if (!analysis.shouldAct) {
      if (analysis.currentStrategy === analysis.recommendedStrategy) {
        return `Maintaining ${current} strategy. Current conditions remain optimal for this approach ` +
          `with ${analysis.confidence}% confidence based on ${analysis.daysUntilDue} days until due ` +
          `and ${analysis.paymentProbability}% payment probability.`;
      }
      return `No strategy change recommended at this time. While ${strategy} might offer benefits, ` +
        `confidence level (${analysis.confidence}%) is below our threshold for strategy changes.`;
    }

    if (analysis.recommendedStrategy === Strategy.Aggressive) {
      return `Upgrading to Aggressive strategy for higher yields (7% APY via Aave V3). ` +
        `Strong fundamentals: ${analysis.riskScore}/100 risk score, ${analysis.paymentProbability}% payment probability, ` +
        `and ${analysis.daysUntilDue} days of yield accumulation time make this a confident move.`;
    } else if (analysis.recommendedStrategy === Strategy.Conservative) {
      return `Moving to Conservative strategy for balanced risk-reward (3.5% APY via Aave V3). ` +
        `Moderate conditions suggest stable yield generation while protecting capital. ` +
        `${analysis.confidence}% confidence in this recommendation.`;
    } else {
      return `Switching to Hold strategy to protect capital. ` +
        `Current risk metrics (${analysis.riskScore}/100 risk, ${analysis.paymentProbability}% payment probability) ` +
        `suggest caution until conditions improve.`;
    }
  }

  async generateThinkingStream(analysis: AnalysisResult): Promise<AgentThought[]> {
    const thoughts: AgentThought[] = [];
    const now = Date.now();

    thoughts.push({
      type: 'thinking',
      tokenId: analysis.tokenId,
      message: `Analyzing Invoice #${analysis.tokenId.slice(0, 8)}...`,
      timestamp: now,
      data: { step: 1, total: 4 },
    });

    thoughts.push({
      type: 'analysis',
      tokenId: analysis.tokenId,
      message: `Risk Assessment: Score ${analysis.riskScore}/100, Payment Probability ${analysis.paymentProbability}%`,
      timestamp: now + 500,
      data: {
        riskScore: analysis.riskScore,
        paymentProbability: analysis.paymentProbability,
        daysUntilDue: analysis.daysUntilDue,
      },
    });

    const strategyName = STRATEGY_NAMES[analysis.recommendedStrategy];
    thoughts.push({
      type: 'analysis',
      tokenId: analysis.tokenId,
      message: `Evaluating strategies... ${strategyName} appears optimal with ${analysis.confidence}% confidence`,
      timestamp: now + 1000,
      data: {
        currentStrategy: STRATEGY_NAMES[analysis.currentStrategy],
        recommendedStrategy: strategyName,
        confidence: analysis.confidence,
      },
    });

    thoughts.push({
      type: 'decision',
      tokenId: analysis.tokenId,
      message: await this.generateExplanation(analysis),
      timestamp: now + 1500,
      data: {
        shouldAct: analysis.shouldAct,
        strategy: analysis.recommendedStrategy,
        reasoning: analysis.reasoning,
      },
    });

    return thoughts;
  }
}
