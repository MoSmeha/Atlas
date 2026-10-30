import { useState } from 'react';
import type { DocumentSummary } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { documentMeta } from '../sidebar/documentMeta';
import { sidebarCopy } from '../sidebar/sidebarCopy';
import { DocumentViewer } from './DocumentViewer';
import { ViewerModal } from './ViewerModal';
import { ViewerTitle } from './ViewerTitle';
import { viewerCopy } from './viewerCopy';

interface DocumentViewerModalProps {
  /** The file to show; null closes the viewer. */
  document: DocumentSummary | null;
  onClose: () => void;
}

/** The viewer for a whole file, opened from its row in the register. */
export function DocumentViewerModal({ document, onClose }: DocumentViewerModalProps) {
  const copy = useCopy(viewerCopy);
  const sidebar = useCopy(sidebarCopy);
  // The last file stays on screen while the modal fades out.
  const [shown, setShown] = useState<DocumentSummary | null>(document);
  if (document !== null && document !== shown) setShown(document);

  return (
    <ViewerModal
      opened={document !== null}
      onClose={onClose}
      title={shown && <ViewerTitle kind={shown.kind} path={shown.path} place={documentMeta(shown, sidebar)} />}
      closeLabel={copy.closeFile}
    >
      {shown && <DocumentViewer key={shown.id} document={shown} />}
    </ViewerModal>
  );
}
