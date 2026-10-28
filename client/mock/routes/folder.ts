import { type IndexEvent, LoadFolderRequest, routes } from '@atlas/shared';
import { openSse, readBody, readJson, sendError, sendJson } from '../http';
import { type Route, route } from '../router';
import { state } from '../state';

/** Paths with these words fail, so the sidebar's error messages can be tried. */
const MISSING = /missing|not[-_ ]?found|nope/i;
const EMPTY = /empty/i;

/** Loading a folder, its status and events, and uploads. */
export const folderRoutes: Route[] = [
  route('POST', routes.folder, async ({ req, res }) => {
    const parsed = LoadFolderRequest.safeParse(await readJson(req));
    if (!parsed.success) return sendError(res, 'invalid_request', 'Type the path of a folder to load.');
    const { path } = parsed.data;
    if (MISSING.test(path)) return sendError(res, 'folder_not_found', `Folder not found: ${path}`);
    // Same wording as the real server's errors.folderEmpty, with a few other files skipped.
    if (EMPTY.test(path)) return sendError(res, 'folder_empty', `No PDF or Excel files in ${path} (2 other files skipped).`);
    sendJson(res, 200, state.workspace.load(path));
  }),

  route('GET', routes.folderStatus, ({ res }) => sendJson(res, 200, state.workspace.status())),

  route('GET', routes.folderEvents, ({ res }) => {
    const channel = openSse<IndexEvent>(res);
    const unsubscribe = state.workspace.subscribe((event) => channel.send(event));
    res.on('close', unsubscribe);
  }),

  route('POST', routes.uploads, async ({ req, res }) => {
    if (!(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
      return sendError(res, 'invalid_request', 'Send the files as multipart form data.');
    }
    const names = fileNames((await readBody(req)).toString('utf8'));
    if (names.length === 0) return sendError(res, 'invalid_request', 'No files came with the upload.');
    sendJson(res, 200, state.workspace.upload(names));
  }),
];

/** File names from the part headers of a multipart body; the file bytes themselves are ignored. */
function fileNames(body: string): string[] {
  const names = [...body.matchAll(/filename="([^"]*)"/g)].map((m) => m[1] ?? '').filter((name) => name !== '');
  return [...new Set(names.map((name) => name.split(/[\\/]/).pop() ?? name))];
}
