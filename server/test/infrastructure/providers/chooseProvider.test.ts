import { describe, expect, it } from 'vitest';
import type { LocalPick } from '../../../src/infrastructure/local/pickLocalModels';
import { chooseProvider, type ProviderInputs } from '../../../src/infrastructure/providers/chooseProvider';

const ready: LocalPick = {
  chat: { name: 'qwen3:14b', sizeBytes: 1, parameterBillions: 14.8, capabilities: ['tools'] },
  embedding: { name: 'bge-m3:latest', sizeBytes: 1, parameterBillions: 0.567, capabilities: ['embedding'] },
  budgetBytes: 1,
  problem: null,
};
const notRunning: LocalPick = { chat: null, embedding: null, budgetBytes: 1, problem: 'Ollama is not running; …' };

function inputs(overrides: Partial<ProviderInputs> = {}): ProviderInputs {
  return { setting: 'auto', hasOpenAiKey: false, hasGeminiKey: false, local: notRunning, ...overrides };
}

describe('chooseProvider', () => {
  it('prefers what costs nothing: local first, then Gemini, then OpenAI', () => {
    expect(chooseProvider(inputs({ local: ready, hasGeminiKey: true, hasOpenAiKey: true })).id).toBe('ollama');
    expect(chooseProvider(inputs({ hasGeminiKey: true, hasOpenAiKey: true }))).toEqual({ id: 'gemini', reason: 'GEMINI_API_KEY is set.' });
    expect(chooseProvider(inputs({ hasOpenAiKey: true }))).toEqual({ id: 'openai', reason: 'OPENAI_API_KEY is set.' });
  });

  it('says what to do when nothing is set up', () => {
    expect(chooseProvider(inputs())).toEqual({
      id: null,
      reason: 'No model is set up: add OPENAI_API_KEY or GEMINI_API_KEY to .env, or start Ollama, then restart Atlas.',
    });
  });

  it('uses a provider named in ATLAS_PROVIDER, and no other in its place', () => {
    expect(chooseProvider(inputs({ setting: 'openai', local: ready, hasOpenAiKey: true })).id).toBe('openai');
    expect(chooseProvider(inputs({ setting: 'gemini', hasOpenAiKey: true }))).toEqual({
      id: null,
      reason: 'ATLAS_PROVIDER is gemini, but GEMINI_API_KEY is not set.',
    });
    expect(chooseProvider(inputs({ setting: 'ollama', hasGeminiKey: true }))).toEqual({
      id: null,
      reason: 'ATLAS_PROVIDER is ollama, but Ollama is not running; …',
    });
    expect(chooseProvider(inputs({ setting: 'ollama', local: ready })).id).toBe('ollama');
  });
});
