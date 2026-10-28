/** Prices in US dollars per one million tokens. */
export interface TokenPrice {
  inputPrice: number;
  cachedInputPrice: number;
  outputPrice: number;
}

export interface TokenUsage {
  inputTokens: number;
  /** Part of inputTokens served from the prompt cache. */
  cachedInputTokens: number;
  /** Includes reasoning tokens. */
  outputTokens: number;
  reasoningTokens: number;
}

export const zeroUsage: TokenUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  };
}

export function costUsd(usage: TokenUsage, price: TokenPrice): number {
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const dollars =
    uncached * price.inputPrice + usage.cachedInputTokens * price.cachedInputPrice + usage.outputTokens * price.outputPrice;
  return dollars / 1_000_000;
}
