import { describe, expect, it } from 'vitest';
import { loadModelConfig } from '../../../src/infrastructure/config/modelConfig';
import { ChatModelClient } from '../../../src/infrastructure/chat/ChatModelClient';
import type { LocalPick } from '../../../src/infrastructure/local/pickLocalModels';
import { OpenAiModelClient } from '../../../src/infrastructure/openai/OpenAiModelClient';
import { connectProvider } from '../../../src/infrastructure/providers/connectProvider';
import { loadSettings } from '../../../src/infrastructure/settings';

const config = loadModelConfig();
const settings = { ...loadSettings({}, 'no-such.env'), openAiApiKey: 'sk-test', geminiApiKey: 'gm-test' };
const local: LocalPick = {
  chat: { name: 'qwen3:14b', sizeBytes: 1, parameterBillions: 14.8, capabilities: ['tools'] },
  embedding: { name: 'bge-m3:latest', sizeBytes: 1, parameterBillions: 0.567, capabilities: ['embedding'] },
  budgetBytes: 1,
  problem: null,
};

// Building a provider makes clients only; nothing here sends a request.
describe('connectProvider', () => {
  it('keeps OpenAI on the Responses API with its own catalog', () => {
    const provider = connectProvider('openai', settings, config, null);
    expect(provider.modelClient).toBeInstanceOf(OpenAiModelClient);
    expect(provider.models).toBe(config.openai);
    expect(provider.embeddingKey).toBe('openai:text-embedding-3-small:1536');
    expect(provider.notice).toBeNull();
  });

  it('puts Gemini on Chat Completions with its free catalog, and warns where the documents go', () => {
    const provider = connectProvider('gemini', settings, config, null);
    expect(provider.modelClient).toBeInstanceOf(ChatModelClient);
    expect(provider.models.catalog).toEqual(config.gemini.catalog);
    expect(provider.models).not.toHaveProperty('baseUrl');
    expect(provider.embeddings.model).toBe('gemini-embedding-001');
    expect(provider.embeddingKey).toBe('gemini:gemini-embedding-001:default');
    expect(provider.notice).toMatch(/Google uses what its free tier is sent/);
  });

  it('puts the one local chat model in every tier, free, and searches with the local embedding model', () => {
    const provider = connectProvider('ollama', settings, config, local);
    expect(provider.modelClient).toBeInstanceOf(ChatModelClient);
    expect(provider.models.catalog.map((model) => [model.tier, model.id, model.inputPrice])).toEqual([
      ['frontier', 'qwen3:14b', 0],
      ['balanced', 'qwen3:14b', 0],
      ['small', 'qwen3:14b', 0],
    ]);
    expect(provider.models.reasoningEffort).toBeNull();
    expect(provider.embeddingKey).toBe('ollama:bge-m3:latest:default');
    expect(provider.label).toBe('Ollama on this machine (qwen3:14b, search by bge-m3:latest)');
  });

  it('refuses Ollama without both models', () => {
    expect(() => connectProvider('ollama', settings, config, { ...local, embedding: null })).toThrow(/chat and an embedding model/);
  });
});
