import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { z } from 'zod';
import { type ErrorBody, ExportRequest, ExportResponse, routes } from '@atlas/shared';
import { errors } from '../../application/errors';
import type { ExportResult } from '../../application/ExportResult';
import type { SessionStore } from '../../application/session/SessionStore';
import type { RoutePlugin } from '../zod';

export interface ExportsDeps {
  sessions: SessionStore;
  exportResult: ExportResult;
  /** Folder that holds exported files; downloads never read outside it. */
  exportsDir: string;
}

const contentTypes: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
};

/** The only names the exporter writes: ASCII letters, digits, dots, dashes and underscores, ending in .xlsx or .csv. */
const EXPORT_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(xlsx|csv)$/i;

const FileParams = z.object({ fileName: z.string() });

export const exportsRoutes: RoutePlugin<{ deps: ExportsDeps }> = async (app, { deps }) => {
  app.post(routes.exports, { schema: { body: ExportRequest, response: { 200: ExportResponse } } }, async (request) => {
    const { sessionId, resultId, format } = request.body;
    const session = deps.sessions.get(sessionId);
    const file = await deps.exportResult.execute({ session, resultId, format, exportsDir: deps.exportsDir });
    return { ...file, url: routes.exportFile(file.fileName) };
  });

  app.get(`${routes.exports}/:fileName`, { schema: { params: FileParams } }, async (request, reply) => {
    const { fileName } = request.params;
    const path = exportFilePath(deps.exportsDir, fileName);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) {
      const body: ErrorBody = { error: { code: 'invalid_request', message: `No exported file named ${fileName}.` } };
      return reply.status(404).send(body);
    }
    return reply
      .type(contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream')
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .send(createReadStream(path));
  });
};

/** Absolute path of an export, refusing any name that could reach outside the exports folder. */
function exportFilePath(exportsDir: string, fileName: string): string {
  const root = resolve(exportsDir);
  const path = resolve(root, fileName);
  if (!EXPORT_FILE_NAME.test(fileName) || !path.startsWith(root + sep)) {
    throw errors.invalidRequest(`"${fileName}" is not the name of an exported file.`);
  }
  return path;
}
