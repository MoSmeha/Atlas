import { describe, expect, it } from 'vitest';
import type { CatalogModel } from '../../../src/application/models/pickLineup';
import type { ProviderModels } from '../../../src/infrastructure/config/modelConfig';
import { resolveLineup, resolveModels } from '../../../src/infrastructure/openai/resolveLineup';
import { FakeModelClient } from '../../fakes/FakeModelClient';

function model(id: string, tier: CatalogModel['tier']): CatalogModel {
  return { id, tier, label: id, inputPrice: 1, cachedInputPrice: 0.1, outputPrice: 2 };
}

const config: ProviderModels = {
  catalog: [
    model('new-frontier', 'frontier'),
    model('new-balanced', 'balanced'),
    model('new-small', 'small'),
    model('old-frontier', 'frontier'),
    model('old-balanced', 'balanced'),
    model('old-small', 'small'),
  ],
  answerTier: 'frontier',
  reasoningEffort: 'medium',
  embedding: { id: 'embed', price: 0.02, dimensions: 1536 },
};

const ids = (lineup: Awaited<ReturnType<typeof resolveLineup>>) => [lineup.frontier.id, lineup.balanced.id, lineup.small.id];

describe('resolveLineup', () => {
  it('uses the models the account can see', async () => {
    const client = new FakeModelClient();
    client.models = ['old-frontier', 'new-balanced', 'old-small'];
    expect(ids(await resolveLineup(client, config))).toEqual(['old-frontier', 'new-balanced', 'old-small']);
  });

  it('also returns the models the account can see, or null without a client', async () => {
    const client = new FakeModelClient();
    client.models = ['old-frontier', 'gpt-live-1'];
    expect((await resolveModels(client, config)).visible).toEqual(['old-frontier', 'gpt-live-1']);
    expect((await resolveModels(null, config)).visible).toBeNull();
  });

  it('trusts the catalog order without a client', async () => {
    expect(ids(await resolveLineup(null, config))).toEqual(['new-frontier', 'new-balanced', 'new-small']);
  });

  it('trusts the catalog order when listing fails', async () => {
    const client = new FakeModelClient();
    client.listModels = async () => {
      throw new Error('offline');
    };
    expect(ids(await resolveLineup(client, config))).toEqual(['new-frontier', 'new-balanced', 'new-small']);
  });

  it('gives up on a slow listing after the timeout', async () => {
    const client = new FakeModelClient();
    client.listModels = () => new Promise<string[]>(() => {});
    const started = Date.now();
    expect(ids(await resolveLineup(client, config, 30))).toEqual(['new-frontier', 'new-balanced', 'new-small']);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('reads server/config/models.json by default', async () => {
    expect((await resolveLineup(null)).small.tier).toBe('small');
  });
});
