import type { ModelOption } from '@atlas/shared';
import { describe, expect, it } from 'vitest';
import { modelGroups } from '../../src/features/topbar/modelGroups';

const headings = { openai: 'OpenAI', gemini: 'Gemini, free tier', ollama: 'On this computer, free' };

function option(id: string, provider: ModelOption['provider']): ModelOption {
  return { id, provider, tier: 'small', label: id.toUpperCase(), inputPrice: 0, outputPrice: 0, defaultEffort: null };
}

describe('modelGroups', () => {
  it('groups the models by provider, in the order the server lists them', () => {
    expect(modelGroups([option('luna', 'openai'), option('sol', 'openai'), option('flash', 'gemini')], headings)).toEqual([
      { group: 'OpenAI', items: [{ value: 'luna', label: 'LUNA' }, { value: 'sol', label: 'SOL' }] },
      { group: 'Gemini, free tier', items: [{ value: 'flash', label: 'FLASH' }] },
    ]);
  });

  it('keeps a list from one provider flat, without a heading', () => {
    expect(modelGroups([option('luna', 'openai'), option('sol', 'openai')], headings)).toEqual([
      { value: 'luna', label: 'LUNA' },
      { value: 'sol', label: 'SOL' },
    ]);
  });
});
