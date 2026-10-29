import { useState } from 'react';
import type { Source } from '@atlas/shared';
import { formatNumber } from '../chat/formatNumber';
import { rowsText } from '../chat/sourcePlace';
import { SourceViewer } from './SourceViewer';
import { ViewerModal } from './ViewerModal';
import { ViewerTitle } from './ViewerTitle';

interface SourceViewerModalProps {
  /** The source to show; null closes the viewer. */
  source: Source | null;
  onClose: () => void;
}

/**
 * The source viewer: opens when a source row is clicked, at the cited PDF page with the quote
 * highlighted, or at the cited sheet rows.
 */
export function SourceViewerModal({ source, onClose }: SourceViewerModalProps) {
  // The last source stays on screen while the modal fades out.
  const [shown, setShown] = useState<Source | null>(source);
  if (source !== null && source !== shown) setShown(source);

  return (
    <ViewerModal
      opened={source !== null}
      onClose={onClose}
      title={shown && <ViewerTitle kind={shown.kind} path={shown.document} place={<SourcePlace source={shown} />} />}
      closeLabel="Close the source"
    >
      {shown && <SourceViewer key={sourceKey(shown)} source={shown} />}
    </ViewerModal>
  );
}

/** "page 37", or "sheet Summary, rows 4–12". */
function SourcePlace({ source }: { source: Source }) {
  if (source.kind === 'pdf') return `page ${formatNumber(source.page)}`;
  return (
    <>
      sheet <bdi>{source.sheet}</bdi>, {rowsText(source)}
    </>
  );
}

/** A new key for each different place, so the viewer starts fresh at it. */
function sourceKey(source: Source): string {
  return source.kind === 'pdf'
    ? `pdf|${source.document}|${source.page}|${source.quote ?? ''}`
    : `excel|${source.document}|${source.sheet}|${source.rowFrom}|${source.rowTo}`;
}
