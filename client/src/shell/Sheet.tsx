import { type ReactNode, useRef } from 'react';
import { ScrollContainerContext } from './ScrollContainerContext';
import classes from './Sheet.module.css';

interface SheetProps {
  children: ReactNode;
  /** The sidebar is closed on a wide screen, so the sheet keeps a margin on both sides. */
  sidebarClosed: boolean;
}

/**
 * The conversation's sheet: the page ground inset on the chrome field, a hairline round it, and its
 * own scroll so the top bar and sidebar stay one still frame. Edge to edge on a phone.
 */
export function Sheet({ children, sidebarClosed }: SheetProps) {
  const container = useRef<HTMLDivElement>(null);
  return (
    <ScrollContainerContext.Provider value={container}>
      <div ref={container} className={classes.sheet} data-sidebar-closed={sidebarClosed || undefined}>
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}
