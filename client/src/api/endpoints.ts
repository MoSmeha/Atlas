import {
  type ExportRequest,
  ExportResponse,
  HealthResponse,
  IndexStatus,
  type LoadFolderRequest,
  ModelsResponse,
  SheetRows,
  UsageResponse,
  routes,
} from '@atlas/shared';
import { requestJson, send } from './http';

/** Rows 1-based and inclusive, as Excel numbers them. */
export interface RowRange {
  from: number;
  to: number;
}

/**
 * One typed function per JSON endpoint. The hooks call these; components use the hooks.
 * Streams live in useAskStream and useIndexEvents.
 */
export const api = {
  health: (signal?: AbortSignal) => requestJson(routes.health, HealthResponse, { signal }),

  models: (signal?: AbortSignal) => requestJson(routes.models, ModelsResponse, { signal }),

  usage: (sessionId: string, signal?: AbortSignal) =>
    requestJson(routes.usage, UsageResponse, { query: { sessionId }, signal }),

  folderStatus: (signal?: AbortSignal) => requestJson(routes.folderStatus, IndexStatus, { signal }),

  loadFolder: (request: LoadFolderRequest) =>
    requestJson(routes.folder, IndexStatus, { method: 'POST', body: request }),

  /** Sends the files as multipart form data, each under the field name "files". */
  upload: (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    return requestJson(routes.uploads, IndexStatus, { method: 'POST', body: form });
  },

  sheetRows: (documentId: string, sheet: string, range: RowRange, signal?: AbortSignal) =>
    requestJson(routes.sheetRows(documentId, sheet), SheetRows, { query: { ...range }, signal }),

  exportTable: (request: ExportRequest) =>
    requestJson(routes.exports, ExportResponse, { method: 'POST', body: request }),

  /** Forgets the chat on the server: its turns, saved results and spend. */
  clearChat: async (sessionId: string) => {
    await send(routes.chatSession(sessionId), { method: 'DELETE' });
  },

  /** URL of the original file, for the PDF viewer and download links. */
  documentFileUrl: (documentId: string) => routes.documentFile(documentId),
};
