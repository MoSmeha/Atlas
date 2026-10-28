import { describe, expect, it } from 'vitest';
import { addUsage, costUsd, zeroUsage } from '../../src/domain/pricing';

const price = { inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 };

describe('costUsd', () => {
  it('charges cached input at the cached rate', () => {
    const usage = { inputTokens: 100_000, cachedInputTokens: 60_000, outputTokens: 2_000, reasoningTokens: 1_000 };
    // 40k * $10 + 60k * $1 + 2k * $50, per million tokens
    expect(costUsd(usage, price)).toBeCloseTo(0.4 + 0.06 + 0.1, 10);
  });

  it('is zero for no usage', () => {
    expect(costUsd(zeroUsage, price)).toBe(0);
  });

  it('adds usage across rounds', () => {
    const round = { inputTokens: 10, cachedInputTokens: 2, outputTokens: 3, reasoningTokens: 1 };
    expect(addUsage(round, round)).toEqual({ inputTokens: 20, cachedInputTokens: 4, outputTokens: 6, reasoningTokens: 2 });
  });
});
