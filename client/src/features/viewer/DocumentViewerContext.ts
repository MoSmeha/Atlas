import { createContext } from 'react';

/** Which file is open in the document viewer, and how to open or close one. */
export interface DocumentViewerValue {
  /** The id of the file open in the viewer; null when none is. */
  openedId: string | null;
  /** Opens a file of the loaded folder, by its id, at its first page or first sheet. */
  open(documentId: string): void;
  close(): void;
}

export const DocumentViewerContext = createContext<DocumentViewerValue | null>(null);
