import { describe, expect, it } from 'vitest';
import { loadModelConfig } from '../../src/infrastructure/config/modelConfig';

describe('models.json', () => {
  it('is valid and has an OpenAI model for every tier', () => {
    const config = loadModelConfig();
    const tiers = new Set(config.openai.catalog.map((model) => model.tier));
    expect([...tiers].sort()).toEqual(['balanced', 'frontier', 'small']);
    expect(config.openai.embedding.id).toBe('text-embedding-3-small');
  });

  it('has a free Gemini model for every tier and its OpenAI-compatible endpoint', () => {
    const { gemini } = loadModelConfig();
    const tiers = new Set(gemini.catalog.map((model) => model.tier));
    expect([...tiers].sort()).toEqual(['balanced', 'frontier', 'small']);
    for (const model of gemini.catalog) expect([model.inputPrice, model.cachedInputPrice, model.outputPrice]).toEqual([0, 0, 0]);
    expect(gemini.embedding.price).toBe(0);
    expect(gemini.baseUrl).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
  });
});
