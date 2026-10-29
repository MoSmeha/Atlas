import type { ModelProvider } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { chooseModel } from '../../src/application/models/chooseModel';
import { smallModelFor, type ModelChoices } from '../../src/application/models/modelChoices';
import type { CatalogModel } from '../../src/application/models/pickLineup';

function model(id: string, tier: CatalogModel['tier'], provider: ModelProvider = 'openai'): CatalogModel {
  return { id, provider, tier, label: id, inputPrice: 1, cachedInputPrice: 0.1, outputPrice: 2 };
}

const choices: ModelChoices = {
  options: [
    model('frontier-model', 'frontier'),
    model('balanced-model', 'balanced'),
    model('small-model', 'small'),
    model('gemini-frontier', 'frontier', 'gemini'),
    model('gemini-small', 'small', 'gemini'),
    model('local-model', 'frontier', 'ollama'),
  ],
  defaultModel: model('balanced-model', 'balanced'),
  reasoningEffort: {},
};

describe('chooseModel', () => {
  it('uses a requested model from any provider', () => {
    expect(chooseModel(choices, 'small-model').id).toBe('small-model');
    expect(chooseModel(choices, 'gemini-frontier').provider).toBe('gemini');
  });

  it('falls back to the default for an unknown or missing model', () => {
    expect(chooseModel(choices, 'gpt-unknown').id).toBe('balanced-model');
    expect(chooseModel(choices, null).id).toBe('balanced-model');
    expect(chooseModel(choices, undefined).id).toBe('balanced-model');
  });
});

describe('smallModelFor', () => {
  it("keeps a question's side jobs on its own provider, or on the model itself when the provider has no small one", () => {
    expect(smallModelFor(choices, model('frontier-model', 'frontier')).id).toBe('small-model');
    expect(smallModelFor(choices, model('gemini-frontier', 'frontier', 'gemini')).id).toBe('gemini-small');
    expect(smallModelFor(choices, model('local-model', 'frontier', 'ollama')).id).toBe('local-model');
  });
});
