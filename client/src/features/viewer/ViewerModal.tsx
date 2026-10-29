import type { ReactNode } from 'react';
import { Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from './SourceViewer.module.css';

interface ViewerModalProps {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  /** What the close button says to a screen reader. */
  closeLabel: string;
  children: ReactNode;
}

/** Wide enough for a page at reading size or a sheet's first columns, and never wider than the screen. */
const VIEWER_WIDTH = 1040;

const modalClasses = { content: classes.content, header: classes.header, title: classes.title, body: classes.body };

/** The viewer's frame: a large modal with a title, a control bar and a stage that scrolls. Full screen on a phone. */
export function ViewerModal({ opened, onClose, title, closeLabel, children }: ViewerModalProps) {
  const phone = useMediaQuery('(max-width: 48em)');
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={VIEWER_WIDTH}
      fullScreen={phone}
      yOffset="3dvh"
      classNames={modalClasses}
      title={title}
      closeButtonProps={{ 'aria-label': closeLabel }}
    >
      {children}
    </Modal>
  );
}
