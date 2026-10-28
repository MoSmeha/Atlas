import { mkdtempSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChatEvent } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { pickLineup } from '../src/application/models/pickLineup';
import { loadSettings } from '../src/infrastructure/settings';
import { compose } from '../src/main';

const logDir = mkdtempSync(join(tmpdir(), 'atlas-compose-logs-'));
const noKey = { ...loadSettings({}, 'no-such.env'), openAiApiKey: null, logDir };

afterAll(() => rm(logDir, { recursive: true, force: true }));

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

  it('refuses a chat question with 503 missing_api_key when there is no key', async () => {
    const container = await compose(noKey);
    expect(container.api.chat.askQuestion).toBe(container.askQuestion);
    const app = buildApp(container.api);
    const response = await app.inject({ method: 'POST', url: '/api/chat', payload: { sessionId: 's1', question: 'What is the total?' } });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('missing_api_key');
  });

  it('wires AskQuestion to the shared sessions; without a key it answers missing_api_key and logs it', async () => {
    const container = await compose(noKey);
    expect(container.api.exports.sessions).toBe(container.sessions);
    expect(container.api.usage.sessions).toBe(container.sessions);

    const events: ChatEvent[] = [];
    const outcome = await container.askQuestion.execute({ sessionId: 's1', question: 'What is the total?', onEvent: (e) => events.push(e) });

    expect(outcome).toEqual({ ok: false, error: expect.objectContaining({ code: 'missing_api_key' }) });
    expect(events).toEqual([{ type: 'error', error: expect.objectContaining({ code: 'missing_api_key' }) }]);
    expect(readdirSync(logDir)).toHaveLength(1);
  });

  it('offers the lineup with the configured answer tier as the default model', async () => {
    const container = await compose(noKey);
    const response = await buildApp(container.api).inject({ method: 'GET', url: '/api/models' });
    const { lineup, modelConfig } = container;
    expect(response.json()).toMatchObject({
      models: [{ id: lineup.frontier.id }, { id: lineup.balanced.id }, { id: lineup.small.id }],
      defaultModel: lineup[modelConfig.answerTier].id,
    });
  });
});
