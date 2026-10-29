/**
 * Every React Query key in the client. Keys nest, so invalidating `folder.all` also refreshes
 * the folder status and every sheet view that belongs to the loaded folder.
 */
export const queryKeys = {
  health: ['health'] as const,
  models: ['models'] as const,
  voices: ['voices'] as const,
  usage: (sessionId: string) => ['usage', sessionId] as const,
  folder: {
    all: ['folder'] as const,
    status: ['folder', 'status'] as const,
    sheetRows: (documentId: string, sheet: string, from: number, to: number) =>
      ['folder', 'sheet-rows', documentId, sheet, from, to] as const,
  },
};
