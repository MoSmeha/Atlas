import { describe, expect, it } from 'vitest';
import { chooseModel } from '../../src/application/models/chooseModel';
import type { CatalogModel, Lineup } from '../../src/application/models/pickLineup';

function model(id: string, tier: CatalogModel['tier']): CatalogModel {
  return { id, tier, label: id, inputPrice: 1, cachedInputPrice: 0.1, outputPrice: 2 };
}

const lineup: Lineup = {
  frontier: model('frontier-model', 'frontier'),
  balanced: model('balanced-model', 'balanced'),
  small: model('small-model', 'small'),
};

describe('chooseModel', () => {
  it('uses a requested model of the lineup', () => {
    expect(chooseModel(lineup, 'frontier', 'small-model').id).toBe('small-model');
  });

  it('falls back to the answer tier for an unknown or missing model', () => {
    expect(chooseModel(lineup, 'balanced', 'gpt-unknown').id).toBe('balanced-model');
    expect(chooseModel(lineup, 'frontier', null).id).toBe('frontier-model');
    expect(chooseModel(lineup, 'frontier', undefined).id).toBe('frontier-model');
  });
});
