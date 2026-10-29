import { useState } from 'react';
import type { DocumentSummary } from '@atlas/shared';
import { documentMeta } from '../sidebar/documentMeta';
import { DocumentViewer } from './DocumentViewer';
import { ViewerModal } from './ViewerModal';
import { ViewerTitle } from './ViewerTitle';

interface DocumentViewerModalProps {
  /** The file to show; null closes the viewer. */
  document: DocumentSummary | null;
  onClose: () => void;
}

/** The viewer for a whole file, opened from its row in the register. */
export function DocumentViewerModal({ document, onClose }: DocumentViewerModalProps) {
  // The last file stays on screen while the modal fades out.
  const [shown, setShown] = useState<DocumentSummary | null>(document);
  if (document !== null && document !== shown) setShown(document);

  return (
    <ViewerModal
      opened={document !== null}
      onClose={onClose}
      title={shown && <ViewerTitle kind={shown.kind} path={shown.path} place={documentMeta(shown)} />}
      closeLabel="Close the file"
    >
      {shown && <DocumentViewer key={shown.id} document={shown} />}
    </ViewerModal>
  );
}
