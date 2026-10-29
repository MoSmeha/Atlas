import { resolve } from 'node:path';
import { FolderItemRequest, IndexEvent, IndexStatus, LoadFolderRequest, routes } from '@atlas/shared';
import { errors } from '../../application/errors';
import type { IndexFolder } from '../../application/indexing/IndexFolder';
import type { Workspace } from '../../application/workspace/Workspace';
import { openSse } from '../sse';
import type { RoutePlugin } from '../zod';

export interface FolderDeps {
  indexFolder: IndexFolder;
  workspace: Workspace;
  /** Relative folder paths start here: the repository root. */
  repoRoot: string;
}

export const folderRoutes: RoutePlugin<{ deps: FolderDeps }> = async (app, { deps }) => {
  app.post(routes.folder, { schema: { body: LoadFolderRequest, response: { 202: IndexStatus } } }, async (request, reply) => {
    const status = await deps.indexFolder.load(folderPath(deps.repoRoot, request.body.path));
    return reply.status(202).send(status);
  });

  // Removes the loaded folder from Atlas and deletes its index; uploaded files are deleted too.
  app.delete(routes.folder, { schema: { response: { 200: IndexStatus } } }, async () => deps.indexFolder.unload());

  app.post(routes.folderRemove, { schema: { body: FolderItemRequest, response: { 200: IndexStatus } } }, async (request) =>
    deps.indexFolder.remove(request.body.path),
  );

  app.post(routes.folderRestore, { schema: { body: FolderItemRequest, response: { 202: IndexStatus } } }, async (request, reply) => {
    const status = await deps.indexFolder.restore(request.body.path);
    return reply.status(202).send(status);
  });

  app.get(routes.folderStatus, { schema: { response: { 200: IndexStatus } } }, async () => deps.workspace.status());

  app.get(routes.folderEvents, async (_request, reply) => {
    const channel = openSse<IndexEvent>(reply);
    const unsubscribe = deps.workspace.subscribe((event) => channel.send(IndexEvent.parse(event)));
    channel.signal.addEventListener('abort', unsubscribe, { once: true });
  });
};

/** An absolute path as typed, or a relative one from the repository root; quotes pasted from Explorer are dropped. */
function folderPath(repoRoot: string, typed: string): string {
  const path = typed.replace(/^(["'])(.*)\1$/, '$2').trim();
  if (path === '') throw errors.invalidRequest('Type the path of a folder to load.');
  return resolve(repoRoot, path);
}
