import { pathToFileURL } from 'node:url';
import { buildApp, type ApiDeps } from './api/app';

const VERSION = '0.1.0';

/** The composition root: wires concrete adapters into use cases. The CLI reuses it. */
export async function compose(): Promise<ApiDeps> {
  return {
    health: { version: VERSION, apiKeyPresent: Boolean(process.env.OPENAI_API_KEY) },
  };
}

async function start(): Promise<void> {
  const app = buildApp(await compose());
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`Atlas server listening on http://127.0.0.1:${port}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
