/** Every HTTP path the server exposes, in one place for the server routes and the client API module. */
export const routes = {
  health: '/api/health',
  folder: '/api/folder',
  folderStatus: '/api/folder/status',
  folderEvents: '/api/folder/events',
  uploads: '/api/uploads',
  documentFile: (id: string) => `/api/documents/${encodeURIComponent(id)}/file`,
  sheetRows: (id: string, sheet: string) =>
    `/api/documents/${encodeURIComponent(id)}/sheets/${encodeURIComponent(sheet)}/rows`,
  chat: '/api/chat',
  chatSession: (sessionId: string) => `/api/chat/${encodeURIComponent(sessionId)}`,
  models: '/api/models',
  usage: '/api/usage',
  exports: '/api/exports',
  exportFile: (fileName: string) => `/api/exports/${encodeURIComponent(fileName)}`,
  voices: '/api/voice/voices',
  voiceCalls: '/api/voice/calls',
  voiceCallEnd: (callId: string) => `/api/voice/calls/${encodeURIComponent(callId)}/end`,
  transcriptions: '/api/voice/transcriptions',
} as const;
