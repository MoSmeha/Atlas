import { describe, expect, it } from 'vitest';
import { loadModelConfig } from '../../src/infrastructure/config/modelConfig';

describe('models.json', () => {
  it('is valid and has a model for every tier', () => {
    const config = loadModelConfig();
    const tiers = new Set(config.catalog.map((model) => model.tier));
    expect([...tiers].sort()).toEqual(['balanced', 'frontier', 'small']);
    expect(config.embedding.id).toBe('text-embedding-3-small');
  });
});
