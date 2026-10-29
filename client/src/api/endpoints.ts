import {
  type EndCallRequest,
  type ExportRequest,
  ExportResponse,
  type FolderItemRequest,
  HealthResponse,
  IndexStatus,
  type LoadFolderRequest,
  ModelsResponse,
  SheetRows,
  type StartCallRequest,
  StartCallResponse,
  TranscriptionResponse,
  UsageResponse,
  VoicesResponse,
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
 * Streams live in useAskStream and useIndexEvents, and a voice call's connection in liveCall.
 */
export const api = {
  health: (signal?: AbortSignal) => requestJson(routes.health, HealthResponse, { signal }),

  models: (signal?: AbortSignal) => requestJson(routes.models, ModelsResponse, { signal }),

  usage: (sessionId: string, signal?: AbortSignal) =>
    requestJson(routes.usage, UsageResponse, { query: { sessionId }, signal }),

  folderStatus: (signal?: AbortSignal) => requestJson(routes.folderStatus, IndexStatus, { signal }),

  loadFolder: (request: LoadFolderRequest) =>
    requestJson(routes.folder, IndexStatus, { method: 'POST', body: request }),

  /** Removes the loaded folder from Atlas and deletes its index; uploaded files are deleted too. */
  unloadFolder: () => requestJson(routes.folder, IndexStatus, { method: 'DELETE' }),

  /** Removes a file or subfolder from Atlas: an uploaded copy is deleted, a file in a loaded folder is left out. */
  removeFromFolder: (request: FolderItemRequest) =>
    requestJson(routes.folderRemove, IndexStatus, { method: 'POST', body: request }),

  /** Puts a removed file or subfolder back, which reads it again. */
  restoreToFolder: (request: FolderItemRequest) =>
    requestJson(routes.folderRestore, IndexStatus, { method: 'POST', body: request }),

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

  voices: (signal?: AbortSignal) => requestJson(routes.voices, VoicesResponse, { signal }),

  /** Exchanges the browser's WebRTC offer for the call's answer. */
  startCall: (request: StartCallRequest) =>
    requestJson(routes.voiceCalls, StartCallResponse, { method: 'POST', body: request }),

  /** Reports how long a call lasted and, when the browser could not close it, has the server hang it up. */
  endCall: async (callId: string, request: EndCallRequest) => {
    await send(routes.voiceCallEnd(callId), { method: 'POST', body: request });
  },

  /** endCall for a page that is closing: the browser still delivers it after the page is gone. */
  endCallOnExit: (callId: string, request: EndCallRequest) =>
    navigator.sendBeacon(routes.voiceCallEnd(callId), new Blob([JSON.stringify(request)], { type: 'application/json' })),

  /** Sends a dictated recording, as multipart form data under the field name "audio", and returns its text. */
  transcribe: (sessionId: string, recording: Blob, recordedMs: number, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('audio', recording, `dictation.${recordingExtension(recording.type)}`);
    return requestJson(routes.transcriptions, TranscriptionResponse, {
      method: 'POST',
      body: form,
      query: { sessionId, recordedMs: Math.round(recordedMs) },
      signal,
    });
  },
};

/** "audio/webm;codecs=opus" is saved as .webm, "audio/mp4" as .mp4. */
function recordingExtension(type: string): string {
  const subtype = type.split(';')[0]?.split('/')[1]?.trim();
  return subtype === undefined || subtype === '' ? 'webm' : subtype;
}
