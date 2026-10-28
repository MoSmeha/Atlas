import { createServer } from 'node:http';
import { sendError } from './http';
import { match } from './router';
import { chatRoutes } from './routes/chat';
import { documentRoutes } from './routes/documents';
import { exportRoutes } from './routes/exports';
import { folderRoutes } from './routes/folder';
import { metaRoutes } from './routes/meta';

/**
 * Dev mock of the Atlas API: every route in shared/src/routes.ts with canned data for an invented
 * Riyadh tower project, so the UI can be built before the real routes land. Run it with
 * `pnpm --dir client mock`; it listens on PORT (default 3001), where the Vite proxy expects the server.
 */
const allRoutes = [...metaRoutes, ...folderRoutes, ...documentRoutes, ...chatRoutes, ...exportRoutes];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://mock.local');
  const found = match(allRoutes, req.method ?? 'GET', url.pathname);
  if (!found) return sendError(res, 'invalid_request', `No route ${req.method} ${url.pathname}`);
  Promise.resolve(found.route.handle({ req, res, url, params: found.params })).catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) sendError(res, 'internal', 'Something went wrong on the server. Details are in the server log.');
    else res.end();
  });
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '127.0.0.1', () => {
  console.log(`Atlas mock API listening on http://127.0.0.1:${port}`);
  console.log('Any folder path loads the canned project; paths with "missing" or "empty" fail.');
  console.log('Questions: retention, delay damages, concrete cover, items over SAR 1 million, what changed,');
  console.log('ledger debits over SAR 240,000, quotations per currency, any Arabic question, "slow" to try Stop,');
  console.log('"fail" for a rate limit.');
});
