import { useState } from 'react';
import type { Source } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { SourceViewer } from './SourceViewer';
import { ViewerModal } from './ViewerModal';
import { ViewerTitle } from './ViewerTitle';
import { viewerCopy } from './viewerCopy';

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
  const copy = useCopy(viewerCopy);
  // The last source stays on screen while the modal fades out.
  const [shown, setShown] = useState<Source | null>(source);
  if (source !== null && source !== shown) setShown(source);

  return (
    <ViewerModal
      opened={source !== null}
      onClose={onClose}
      title={shown && <ViewerTitle kind={shown.kind} path={shown.document} place={<SourcePlace source={shown} />} />}
      closeLabel={copy.closeSource}
    >
      {shown && <SourceViewer key={sourceKey(shown)} source={shown} />}
    </ViewerModal>
  );
}

/** "page 37", or "sheet Summary, rows 4–12". */
function SourcePlace({ source }: { source: Source }) {
  const copy = useCopy(viewerCopy);
  if (source.kind === 'pdf') return copy.pagePlace(source.page);
  return (
    <>
      {copy.sheetPlace} <bdi>{source.sheet}</bdi>
      {copy.listSeparator}
      {copy.rows(source.rowFrom, source.rowTo)}
    </>
  );
}

/** A new key for each different place, so the viewer starts fresh at it. */
function sourceKey(source: Source): string {
  return source.kind === 'pdf'
    ? `pdf|${source.document}|${source.page}|${source.quote ?? ''}`
    : `excel|${source.document}|${source.sheet}|${source.rowFrom}|${source.rowTo}`;
}
