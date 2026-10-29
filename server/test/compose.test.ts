import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChatEvent } from '@atlas/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { pickLineup } from '../src/application/models/pickLineup';
import type { LocalModel } from '../src/infrastructure/local/listOllamaModels';
import type { LocalScan } from '../src/infrastructure/local/pickLocalModels';
import { loadSettings, type Settings } from '../src/infrastructure/settings';
import { compose as composeWith, providerReport } from '../src/main';

const logDir = mkdtempSync(join(tmpdir(), 'atlas-compose-logs-'));
const workDir = mkdtempSync(join(tmpdir(), 'atlas-compose-work-'));
// Port 9 refuses connections, so nothing here reaches a real Ollama.
const noKey: Settings = { ...loadSettings({}, 'no-such.env'), openAiApiKey: null, geminiApiKey: null, ollamaUrl: 'http://127.0.0.1:9', logDir };
const GIB = 1024 ** 3;
const machine = { ramBytes: 32 * GIB, gpuBytes: 16 * GIB, unifiedMemory: false };

/** compose with a stand-in for the local scan: by default no Ollama is running. */
function compose(settings: Settings, scan: LocalScan = { machine, models: null }) {
  return composeWith(settings, async () => scan);
}

function localModel(name: string, capabilities: string[], parameterBillions: number, sizeGib: number): LocalModel {
  return { name, capabilities, parameterBillions, sizeBytes: sizeGib * GIB };
}

afterAll(async () => {
  await rm(logDir, { recursive: true, force: true });
  await rm(workDir, { recursive: true, force: true });
});

describe('compose', () => {
  it('works without an API key: no model client, lineup in catalog order', async () => {
    const container = await compose(noKey);
    expect(container.modelClient).toBeNull();
    expect(container.lineup).toEqual(pickLineup(container.modelConfig.catalog, null));
    expect(container.api.health.apiKeyPresent).toBe(false);
  });

  it('says why no provider answers and what the local scan found', async () => {
    const container = await compose(noKey);
    expect(container.provider).toBeNull();
    expect(container.providerChoice.reason).toMatch(/OPENAI_API_KEY or GEMINI_API_KEY/);
    expect(container.localProblem).toMatch(/^Ollama is not running; this machine can run a model of about \d+ billion parameters/);
    expect(providerReport(container)).toEqual([
      expect.stringMatching(/^Models: none\. No model is set up/),
      expect.stringMatching(/^ {2}Local models: Ollama is not running/),
    ]);
  });

  it('answers with Ollama when this machine can run the models it has pulled, one model in every tier', async () => {
    const models = [localModel('qwen3:14b', ['completion', 'tools'], 14.8, 9), localModel('bge-m3:latest', ['embedding'], 0.567, 1.2)];
    const container = await compose({ ...noKey, dataDir: join(workDir, 'local-data') }, { machine, models });

    expect(container.provider?.id).toBe('ollama');
    expect(container.localProblem).toBeNull();
    expect(container.embeddings?.model).toBe('bge-m3:latest');
    expect(Object.values(container.lineup).map((model) => model.id)).toEqual(['qwen3:14b', 'qwen3:14b', 'qwen3:14b']);
    expect(container.api.health.apiKeyPresent).toBe(true);
    const response = await buildApp(container.api).inject({ method: 'GET', url: '/api/models' });
    expect(response.json()).toEqual({
      models: [{ id: 'qwen3:14b', tier: 'frontier', label: 'qwen3:14b (local)', inputPrice: 0, outputPrice: 0 }],
      defaultModel: 'qwen3:14b',
      provider: 'ollama',
    });
  });

  it('does not scan the machine when a cloud provider is named', async () => {
    let scanned = false;
    const container = await composeWith({ ...noKey, provider: 'openai' }, async () => {
      scanned = true;
      return { machine, models: null };
    });
    expect(scanned).toBe(false);
    expect(container.providerChoice).toEqual({ id: null, reason: 'ATLAS_PROVIDER is openai, but OPENAI_API_KEY is not set.' });
    expect(container.localProblem).toBeNull();
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

  it('ends indexing with five suggested questions for the folder', async () => {
    const folder = join(workDir, 'project');
    mkdirSync(folder);
    copyFileSync(fileURLToPath(new URL('fixtures/arabic-edge.pdf', import.meta.url)), join(folder, 'Site_Note.pdf'));
    const container = await compose({ ...noKey, dataDir: join(workDir, 'data'), logDir: join(workDir, 'logs') });

    await container.indexFolder.load(folder);
    const status = await container.indexFolder.idle();

    expect(status.phase).toBe('ready');
    expect(status.suggestions).toHaveLength(5);
    expect(status.suggestions.map((question) => question.en)).toContain('Extract all dates and deliverables from these documents');
    await container.watchFolder.stop();
    container.workspace.require().index.close();
  });

  it('watches each folder the indexer loads', async () => {
    const first = join(workDir, 'first');
    const second = join(workDir, 'second');
    for (const folder of [first, second]) {
      mkdirSync(folder);
      copyFileSync(fileURLToPath(new URL('fixtures/arabic-edge.pdf', import.meta.url)), join(folder, 'Site_Note.pdf'));
    }
    const container = await compose({ ...noKey, dataDir: join(workDir, 'watch-data'), logDir: join(workDir, 'watch-logs') });
    expect(container.watchFolder.folder()).toBeNull();

    await container.indexFolder.load(first);
    expect(container.watchFolder.folder()).toBe(first);
    await container.indexFolder.load(second);
    expect(container.watchFolder.folder()).toBe(second);

    await container.indexFolder.idle();
    await container.watchFolder.stop();
    expect(container.watchFolder.folder()).toBeNull();
    container.workspace.require().index.close();
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
