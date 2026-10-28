import { pathToFileURL } from 'node:url';
import { buildApp, type ApiDeps } from './api/app';
import { ExportResult } from './application/ExportResult';
import { SessionStore } from './application/session/SessionStore';
import { XlsxExporter } from './infrastructure/export/XlsxExporter';
import { loadSettings, type Settings } from './infrastructure/settings';
import { SystemClock } from './infrastructure/SystemClock';

const VERSION = '0.1.0';

/** The composition root: wires concrete adapters into use cases. The CLI reuses it. */
export async function compose(settings: Settings = loadSettings()): Promise<ApiDeps> {
  const clock = new SystemClock();
  const sessions = new SessionStore();
  const exporter = new XlsxExporter();

  return {
    health: { version: VERSION, apiKeyPresent: settings.openAiApiKey !== null },
    exports: { sessions, exportResult: new ExportResult(exporter, clock), exportsDir: settings.exportsDir },
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
