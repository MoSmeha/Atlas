import { useContext } from 'react';
import { DocumentViewerContext, type DocumentViewerValue } from './DocumentViewerContext';

/** The document viewer's open file and its controls. Call it inside DocumentViewerProvider. */
export function useDocumentViewer(): DocumentViewerValue {
  const viewer = useContext(DocumentViewerContext);
  if (!viewer) throw new Error('useDocumentViewer needs a DocumentViewerProvider above it.');
  return viewer;
}
