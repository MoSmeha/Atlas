import { ModelsResponse } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import type { ModelChoices } from '../../src/application/models/modelChoices';
import { makeApiDeps } from '../fakes/apiDeps';
import { testLineup } from '../fakes/lineup';

const gemini = { id: 'gemini-model', provider: 'gemini' as const, tier: 'frontier' as const, label: 'Gemini', inputPrice: 0, cachedInputPrice: 0, outputPrice: 0 };

describe('GET /api/models', () => {
  const choices: ModelChoices = {
    options: [testLineup.frontier, testLineup.balanced, testLineup.small, gemini],
    defaultModel: testLineup.balanced,
    reasoningEffort: { openai: 'medium', gemini: 'low' },
  };
  const app = buildApp(makeApiDeps({ models: { choices } }));
  afterAll(() => app.close());

  it("lists every provider's models side by side with their provider, labels, prices and default effort, and the default", async () => {
    const response = await app.inject({ method: 'GET', url: '/api/models' });
    expect(response.statusCode).toBe(200);
    const body = ModelsResponse.parse(response.json());
    expect(body).toEqual({
      models: [
        { id: 'frontier-model', provider: 'openai', tier: 'frontier', label: 'Frontier', inputPrice: 10, outputPrice: 50, defaultEffort: 'medium' },
        { id: 'balanced-model', provider: 'openai', tier: 'balanced', label: 'Balanced', inputPrice: 2, outputPrice: 10, defaultEffort: 'medium' },
        { id: 'small-model', provider: 'openai', tier: 'small', label: 'Small', inputPrice: 0.1, outputPrice: 0.5, defaultEffort: 'medium' },
        { id: 'gemini-model', provider: 'gemini', tier: 'frontier', label: 'Gemini', inputPrice: 0, outputPrice: 0, defaultEffort: 'low' },
      ],
      defaultModel: 'balanced-model',
    });
  });

  it('offers no effort for a model whose provider leaves thinking to it or names a level the picker does not offer', async () => {
    const fixed = buildApp(makeApiDeps({ models: { choices: { ...choices, reasoningEffort: { openai: null, gemini: 'minimal' } } } }));
    const body = ModelsResponse.parse((await fixed.inject({ method: 'GET', url: '/api/models' })).json());
    expect(body.models.map((model) => model.defaultEffort)).toEqual([null, null, null, null]);
    await fixed.close();
  });
});
