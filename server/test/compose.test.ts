import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { pickLineup } from '../src/application/models/pickLineup';
import { loadSettings } from '../src/infrastructure/settings';
import { compose } from '../src/main';

const noKey = { ...loadSettings({}, 'no-such.env'), openAiApiKey: null };

describe('compose', () => {
  it('works without an API key: no model client, lineup in catalog order', async () => {
    const container = await compose(noKey);
    expect(container.modelClient).toBeNull();
    expect(container.lineup).toEqual(pickLineup(container.modelConfig.catalog, null));
    expect(container.api.health.apiKeyPresent).toBe(false);
  });

  it('wires the indexer without embeddings when there is no key', async () => {
    const container = await compose(noKey);
    expect(container.embeddings).toBeNull();
    expect(container.workspace.status()).toMatchObject({ folder: null, phase: 'idle' });
    expect(container.api.folder.indexFolder).toBe(container.indexFolder);
    expect(container.api.uploads.uploadsDir).toBe(join(noKey.dataDir, 'uploads'));
  });

  it('gives the API what the health route needs', async () => {
    const app = buildApp((await compose(noKey)).api);
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.json()).toMatchObject({ ok: true, apiKeyPresent: false });
  });
});
