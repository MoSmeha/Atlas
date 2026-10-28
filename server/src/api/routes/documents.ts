import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { z } from 'zod';
import { type DocumentSummary, SheetRows, SheetRowsQuery } from '@atlas/shared';
import { errors } from '../../application/errors';
import type { DocumentIndex } from '../../application/ports/DocumentIndex';
import type { Workspace } from '../../application/workspace/Workspace';
import type { RoutePlugin } from '../zod';

export interface DocumentsDeps {
  workspace: Workspace;
}

/** Rows one call returns at most; the viewer pages through larger sheets. */
export const MAX_SHEET_ROWS = 500;

const contentTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
};

const FileParams = z.object({ id: z.string() });
const SheetParams = z.object({ id: z.string(), sheet: z.string() });

export const documentsRoutes: RoutePlugin<{ deps: DocumentsDeps }> = async (app, { deps }) => {
  app.get('/api/documents/:id/file', { schema: { params: FileParams } }, async (request, reply) => {
    const { folder, index } = deps.workspace.require();
    const document = findDocument(index, request.params.id);
    const path = filePath(folder, document);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw errors.documentNotFound(document.name);
    return reply
      .type(contentTypes[extname(path).toLowerCase()] ?? 'application/octet-stream')
      .header('content-length', info.size)
      .header('content-disposition', inlineDisposition(document.name))
      .send(createReadStream(path));
  });

  app.get(
    '/api/documents/:id/sheets/:sheet/rows',
    { schema: { params: SheetParams, querystring: SheetRowsQuery, response: { 200: SheetRows } } },
    async (request) => {
      const { index } = deps.workspace.require();
      const document = findDocument(index, request.params.id);
      const { sheet } = request.params;
      if (!document.sheets.includes(sheet)) throw errors.sheetNotFound(document.name, sheet);
      const { from } = request.query;
      const last = from + MAX_SHEET_ROWS - 1;
      const to = Math.min(request.query.to ?? last, last);
      if (to < from) throw errors.invalidRequest(`Row ${to} comes before row ${from}; ask for rows from ${from} on.`);
      return { document: document.path, sheet, ...index.sheetRows(document.path, sheet, from, to) };
    },
  );
};

function findDocument(index: DocumentIndex, id: string): DocumentSummary {
  const document = index.documents().find((candidate) => candidate.id === id);
  if (!document) throw errors.documentNotFound(id);
  return document;
}

/** The file on disk, refusing a stored path that would lead outside the loaded folder. */
function filePath(folder: string, document: DocumentSummary): string {
  const root = resolve(folder);
  const path = resolve(root, document.path);
  if (!path.startsWith(root + sep)) throw errors.documentNotFound(document.name);
  return path;
}

/** Shown in the browser rather than downloaded, under its own name; Arabic names go in the UTF-8 form. */
function inlineDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
