import { ModelsResponse } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { makeApiDeps } from '../fakes/apiDeps';
import { testLineup } from '../fakes/lineup';

describe('GET /api/models', () => {
  const app = buildApp(makeApiDeps({ models: { lineup: testLineup, answerTier: 'balanced', defaultEffort: 'low', provider: 'gemini' } }));
  afterAll(() => app.close());

  it('lists the three models of the lineup with labels and prices, the default model and effort, and who answers', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/models' });
    expect(response.statusCode).toBe(200);
    const body = ModelsResponse.parse(response.json());
    expect(body).toEqual({
      models: [
        { id: 'frontier-model', tier: 'frontier', label: 'Frontier', inputPrice: 10, outputPrice: 50 },
        { id: 'balanced-model', tier: 'balanced', label: 'Balanced', inputPrice: 2, outputPrice: 10 },
        { id: 'small-model', tier: 'small', label: 'Small', inputPrice: 0.1, outputPrice: 0.5 },
      ],
      defaultModel: 'balanced-model',
      defaultEffort: 'low',
      provider: 'gemini',
    });
  });

  it('says no provider answers while none is set up', async () => {
    const none = buildApp(makeApiDeps({ models: { lineup: testLineup, answerTier: 'balanced', defaultEffort: 'medium', provider: null } }));
    const response = await none.inject({ method: 'GET', url: '/api/models' });
    expect(response.json().provider).toBeNull();
    await none.close();
  });

  it('offers no effort when the provider leaves thinking to each model', async () => {
    const local = buildApp(makeApiDeps({ models: { lineup: testLineup, answerTier: 'frontier', defaultEffort: null, provider: 'ollama' } }));
    const response = await local.inject({ method: 'GET', url: '/api/models' });
    expect(response.json().defaultEffort).toBeNull();
    await local.close();
  });
});
