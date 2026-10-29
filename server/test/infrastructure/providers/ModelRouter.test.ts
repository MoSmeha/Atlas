import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { CatalogModel } from '../../../src/application/models/pickLineup';
import type { ModelTurnRequest } from '../../../src/application/ports/ModelClient';
import { ModelRouter } from '../../../src/infrastructure/providers/ModelRouter';
import { FakeModelClient } from '../../fakes/FakeModelClient';

const priced = { inputPrice: 0, cachedInputPrice: 0, outputPrice: 0, label: 'm' };
const models: CatalogModel[] = [
  { id: 'gpt-6-luna', provider: 'openai', tier: 'small', ...priced },
  { id: 'gemini-3.8-flash', provider: 'gemini', tier: 'frontier', ...priced },
];

function turn(model: string): ModelTurnRequest {
  return { model, instructions: 'i', input: [], tools: [], toolChoice: 'auto', previousResponseId: null, reasoningEffort: null };
}

describe('ModelRouter', () => {
  it("sends each call to the provider whose catalog holds the model, and an unknown model to the default's", async () => {
    const openai = new FakeModelClient([{ text: 'from openai' }, { text: 'unknown went here' }]);
    const gemini = new FakeModelClient([{ text: 'from gemini' }]);
    const router = new ModelRouter(new Map([['openai', openai], ['gemini', gemini]]), models, 'openai');

    expect((await router.turn(turn('gemini-3.8-flash'))).text).toBe('from gemini');
    expect((await router.turn(turn('gpt-6-luna'))).text).toBe('from openai');
    await router.turn(turn('some-other-model'));
    expect(openai.requests.map((request) => request.model)).toEqual(['gpt-6-luna', 'some-other-model']);
    expect(gemini.requests.map((request) => request.model)).toEqual(['gemini-3.8-flash']);

    gemini.objects.push({});
    await router.generateObject({ model: 'gemini-3.8-flash', instructions: 'i', input: 'x', schema: z.object({}), schemaName: 's' });
    expect(gemini.objectRequests).toHaveLength(1);
  });

  it("lists every provider's models, skipping one that cannot list them", async () => {
    const openai = new FakeModelClient();
    openai.models = ['gpt-6-luna'];
    const broken = new FakeModelClient();
    broken.listModels = async () => {
      throw new Error('offline');
    };
    const router = new ModelRouter(new Map([['openai', openai], ['gemini', broken]]), models, 'openai');
    expect(await router.listModels()).toEqual(['gpt-6-luna']);
  });

  it('needs a client for the default provider', () => {
    expect(() => new ModelRouter(new Map([['openai', new FakeModelClient()]]), models, 'gemini')).toThrow(/default provider gemini/);
  });
});
