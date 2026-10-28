import { pathToFileURL } from 'node:url';
import { buildApp, type ApiDeps } from './api/app';
import type { Lineup } from './application/models/pickLineup';
import type { ModelClient } from './application/ports/ModelClient';
import { loadModelConfig, type ModelConfig } from './infrastructure/config/modelConfig';
import { createOpenAiClient } from './infrastructure/openai/createOpenAiClient';
import { OpenAiModelClient } from './infrastructure/openai/OpenAiModelClient';
import { resolveLineup } from './infrastructure/openai/resolveLineup';
import { loadSettings, type Settings } from './infrastructure/settings';

const VERSION = '0.1.0';

/** Everything the server and the CLI share, built once by compose(). */
export interface Container {
  settings: Settings;
  modelConfig: ModelConfig;
  /** One model per tier; the default answer model is `lineup[modelConfig.answerTier]`. */
  lineup: Lineup;
  /** Null while OPENAI_API_KEY is unset; use cases then throw missing_api_key. */
  modelClient: ModelClient | null;
  api: ApiDeps;
}

/** The composition root: wires concrete adapters into use cases. The CLI reuses it. */
export async function compose(settings: Settings = loadSettings()): Promise<Container> {
  const modelConfig = loadModelConfig();
  const openAi = settings.openAiApiKey === null ? null : createOpenAiClient(settings.openAiApiKey);
  const modelClient = openAi === null ? null : new OpenAiModelClient(openAi);
  const lineup = await resolveLineup(modelClient, modelConfig);
  return {
    settings,
    modelConfig,
    lineup,
    modelClient,
    api: {
      health: { version: VERSION, apiKeyPresent: settings.openAiApiKey !== null },
    },
  };
}

async function start(): Promise<void> {
  const settings = loadSettings();
  const container = await compose(settings);
  const app = buildApp(container.api);
  await app.listen({ port: settings.port, host: settings.host });
  const { frontier, balanced, small } = container.lineup;
  console.log(`Atlas server listening on http://${settings.host}:${settings.port}`);
  console.log(`Models: frontier ${frontier.id}, balanced ${balanced.id}, small ${small.id}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
