import { pathToFileURL } from 'node:url';
import { buildApp, type ApiDeps } from './api/app';
import { loadSettings, type Settings } from './infrastructure/settings';

const VERSION = '0.1.0';

/** The composition root: wires concrete adapters into use cases. The CLI reuses it. */
export async function compose(settings: Settings = loadSettings()): Promise<ApiDeps> {
  return {
    health: { version: VERSION, apiKeyPresent: settings.openAiApiKey !== null },
  };
}

async function start(): Promise<void> {
  const settings = loadSettings();
  const app = buildApp(await compose(settings));
  await app.listen({ port: settings.port, host: settings.host });
  console.log(`Atlas server listening on http://${settings.host}:${settings.port}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
