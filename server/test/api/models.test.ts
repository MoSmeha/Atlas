import { ModelsResponse } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { makeApiDeps } from '../fakes/apiDeps';
import { testLineup } from '../fakes/lineup';

const gemini = { id: 'gemini-model', provider: 'gemini' as const, tier: 'frontier' as const, label: 'Gemini', inputPrice: 0, cachedInputPrice: 0, outputPrice: 0 };

describe('GET /api/models', () => {
  const choices = { options: [testLineup.frontier, testLineup.balanced, testLineup.small, gemini], defaultModel: testLineup.balanced, reasoningEffort: {} };
  const app = buildApp(makeApiDeps({ models: { choices } }));
  afterAll(() => app.close());

  it("lists every provider's models side by side with their provider, labels and prices, and the default", async () => {
    const response = await app.inject({ method: 'GET', url: '/api/models' });
    expect(response.statusCode).toBe(200);
    const body = ModelsResponse.parse(response.json());
    expect(body).toEqual({
      models: [
        { id: 'frontier-model', provider: 'openai', tier: 'frontier', label: 'Frontier', inputPrice: 10, outputPrice: 50 },
        { id: 'balanced-model', provider: 'openai', tier: 'balanced', label: 'Balanced', inputPrice: 2, outputPrice: 10 },
        { id: 'small-model', provider: 'openai', tier: 'small', label: 'Small', inputPrice: 0.1, outputPrice: 0.5 },
        { id: 'gemini-model', provider: 'gemini', tier: 'frontier', label: 'Gemini', inputPrice: 0, outputPrice: 0 },
      ],
      defaultModel: 'balanced-model',
    });
  });
});
