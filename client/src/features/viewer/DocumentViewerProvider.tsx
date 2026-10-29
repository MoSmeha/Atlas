import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { useFolderStatus } from '../../api/useFolderStatus';
import { DocumentViewerContext, type DocumentViewerValue } from './DocumentViewerContext';
import { DocumentViewerModal } from './DocumentViewerModal';

/**
 * Holds which file of the loaded folder is open in the document viewer, and draws the viewer.
 * A file that leaves the folder closes it.
 */
export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  const folder = useFolderStatus();
  const opened = folder.data?.documents.find((document) => document.id === openedId) ?? null;
  // Forgotten once the file is gone, so it does not open again if a later folder has the same id.
  if (openedId !== null && folder.data !== undefined && opened === null) setOpenedId(null);

  const open = useCallback((documentId: string) => setOpenedId(documentId), []);
  const close = useCallback(() => setOpenedId(null), []);
  const value = useMemo<DocumentViewerValue>(() => ({ openedId: opened?.id ?? null, open, close }), [opened?.id, open, close]);

  return (
    <DocumentViewerContext.Provider value={value}>
      {children}
      <DocumentViewerModal document={opened} onClose={close} />
    </DocumentViewerContext.Provider>
  );
}
