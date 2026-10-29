import { describe, expect, it } from 'vitest';
import type { ProviderModels } from '../../../src/infrastructure/config/modelConfig';
import { loadModelConfig } from '../../../src/infrastructure/config/modelConfig';
import type { Provider } from '../../../src/infrastructure/providers/connectProvider';
import { resolveChoices } from '../../../src/infrastructure/providers/resolveChoices';
import { FakeEmbeddingClient } from '../../fakes/FakeEmbeddingClient';
import { FakeModelClient } from '../../fakes/FakeModelClient';

const config = loadModelConfig();

function provider(id: Provider['id'], models: ProviderModels, visible: string[]): Provider {
  const modelClient = new FakeModelClient();
  modelClient.models = visible;
  return { id, label: id, notice: null, modelClient, embeddings: new FakeEmbeddingClient(), models, embeddingKey: id };
}

describe('resolveChoices', () => {
  it("offers every provider's lineup side by side, with the default provider's answer tier as the default", async () => {
    const openai = provider('openai', config.openai, ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna']);
    const gemini = provider('gemini', config.gemini, ['gemini-2.5-pro', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
    const { choices, visible } = await resolveChoices([openai, gemini], gemini, config.openai);

    expect(choices.options.map((model) => `${model.provider} ${model.id}`)).toEqual([
      'openai gpt-6-astra',
      'openai gpt-6.1-sol',
      'openai gpt-6-luna',
      'gemini gemini-2.5-pro',
      'gemini gemini-3.6-flash',
      'gemini gemini-3.5-flash-lite',
    ]);
    // Gemini's answer tier is frontier, and its account sees 2.5 Pro there, not 3.8 Flash.
    expect(choices.defaultModel.id).toBe('gemini-2.5-pro');
    expect(choices.reasoningEffort).toEqual({ openai: 'medium', gemini: 'low' });
    expect(visible.get('gemini')).toContain('gemini-3.6-flash');
  });

  it("offers the fallback catalog as it stands when no provider is set up", async () => {
    const { choices, visible } = await resolveChoices([], null, config.openai);
    expect(choices.options.map((model) => model.id)).toEqual(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna']);
    expect(choices.defaultModel.id).toBe('gpt-6-luna');
    expect(visible.size).toBe(0);
  });
});
