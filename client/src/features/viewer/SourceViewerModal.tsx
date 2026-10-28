import { useState } from 'react';
import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { Source } from '@atlas/shared';
import { SourceViewer } from './SourceViewer';
import { ViewerTitle } from './ViewerTitle';
import classes from './SourceViewer.module.css';

interface SourceViewerModalProps {
  /** The source to show; null closes the viewer. */
  source: Source | null;
  onClose: () => void;
}

/** Wide enough for a page at reading size or a sheet's first columns, and never wider than the screen. */
const VIEWER_WIDTH = 1040;

const modalClasses = { content: classes.content, header: classes.header, title: classes.title, body: classes.body };

/**
 * The source viewer: a large modal that opens when a source row is clicked, at the cited PDF
 * page with the quote highlighted, or at the cited sheet rows. Full screen on a phone.
 */
export function SourceViewerModal({ source, onClose }: SourceViewerModalProps) {
  const phone = useMediaQuery('(max-width: 48em)');
  // The last source stays on screen while the modal fades out.
  const [shown, setShown] = useState<Source | null>(source);
  if (source !== null && source !== shown) setShown(source);

  return (
    <Modal
      opened={source !== null}
      onClose={onClose}
      size={VIEWER_WIDTH}
      fullScreen={phone}
      yOffset="3dvh"
      classNames={modalClasses}
      title={shown && <ViewerTitle source={shown} />}
      closeButtonProps={{ 'aria-label': 'Close the source' }}
    >
      {shown && <SourceViewer key={sourceKey(shown)} source={shown} />}
    </Modal>
  );
}

/** A new key for each different place, so the viewer starts fresh at it. */
function sourceKey(source: Source): string {
  return source.kind === 'pdf'
    ? `pdf|${source.document}|${source.page}|${source.quote ?? ''}`
    : `excel|${source.document}|${source.sheet}|${source.rowFrom}|${source.rowTo}`;
}
