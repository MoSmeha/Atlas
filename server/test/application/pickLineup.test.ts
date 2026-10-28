import { describe, expect, it } from 'vitest';
import { pickLineup, type CatalogModel } from '../../src/application/models/pickLineup';

function model(id: string, tier: CatalogModel['tier']): CatalogModel {
  return { id, tier, label: id, inputPrice: 1, cachedInputPrice: 0.1, outputPrice: 2 };
}

const catalog = [
  model('new-frontier', 'frontier'),
  model('new-balanced', 'balanced'),
  model('new-small', 'small'),
  model('old-frontier', 'frontier'),
  model('old-balanced', 'balanced'),
  model('old-small', 'small'),
];

describe('pickLineup', () => {
  it('prefers the newest model of each tier the account can see', () => {
    const lineup = pickLineup(catalog, ['old-frontier', 'new-balanced', 'old-small', 'new-small']);
    expect(lineup.frontier.id).toBe('old-frontier');
    expect(lineup.balanced.id).toBe('new-balanced');
    expect(lineup.small.id).toBe('new-small');
  });

  it('trusts the catalog order when the list is unavailable', () => {
    const lineup = pickLineup(catalog, null);
    expect([lineup.frontier.id, lineup.balanced.id, lineup.small.id]).toEqual(['new-frontier', 'new-balanced', 'new-small']);
  });

  it('falls back to the first catalog entry when the account sees none of a tier', () => {
    expect(pickLineup(catalog, []).frontier.id).toBe('new-frontier');
  });
});
