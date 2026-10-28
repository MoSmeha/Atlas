import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { UsageMeter } from '../../../src/application/agent/UsageMeter';
import type { TokenPrice } from '../../../src/domain/pricing';
import { fakeUsage, FakeModelClient } from '../../fakes/FakeModelClient';

const prices: Record<string, TokenPrice> = {
  'frontier-model': { inputPrice: 10, cachedInputPrice: 1, outputPrice: 50 },
  'small-model': { inputPrice: 0.1, cachedInputPrice: 0.01, outputPrice: 0.5 },
};

function turnRequest(model: string) {
  return { model, instructions: '', input: [], tools: [], toolChoice: 'auto' as const, previousResponseId: null, reasoningEffort: null };
}

describe('UsageMeter', () => {
  it('passes calls on and adds up the tokens of every model', async () => {
    const inner = new FakeModelClient([{ text: 'one' }, { text: 'two' }]);
    inner.objects = [{ ok: true }];
    const meter = new UsageMeter(inner);

    expect((await meter.turn(turnRequest('frontier-model'))).text).toBe('one');
    await meter.turn(turnRequest('frontier-model'));
    const object = await meter.generateObject({ model: 'small-model', instructions: '', input: 'x', schema: z.object({ ok: z.boolean() }), schemaName: 't' });

    expect(object.value).toEqual({ ok: true });
    expect(meter.turns).toBe(2);
    expect(meter.usage).toEqual({
      inputTokens: 3 * fakeUsage.inputTokens,
      cachedInputTokens: 0,
      outputTokens: 3 * fakeUsage.outputTokens,
      reasoningTokens: 3 * fakeUsage.reasoningTokens,
    });
    expect(await meter.listModels()).toEqual(inner.models);
  });

  it('prices each model at its own rate and an unpriced model at nothing', async () => {
    const inner = new FakeModelClient([{}, {}]);
    inner.objects = [{ ok: true }];
    const meter = new UsageMeter(inner);
    await meter.turn(turnRequest('frontier-model'));
    await meter.turn(turnRequest('unknown-model'));
    await meter.generateObject({ model: 'small-model', instructions: '', input: 'x', schema: z.object({ ok: z.boolean() }), schemaName: 't' });

    const frontier = (100 * 10 + 20 * 50) / 1_000_000;
    const small = (100 * 0.1 + 20 * 0.5) / 1_000_000;
    expect(meter.costUsd((model) => prices[model] ?? null)).toBeCloseTo(frontier + small, 12);
  });

  it('counts nothing for a call that fails', async () => {
    const meter = new UsageMeter(new FakeModelClient([]));
    await expect(meter.turn(turnRequest('frontier-model'))).rejects.toThrow(/no scripted turn/);
    expect(meter.usage.inputTokens).toBe(0);
    expect(meter.costUsd((model) => prices[model] ?? null)).toBe(0);
  });
});
