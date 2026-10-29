import { type ReactNode, useRef } from 'react';
import { ScrollContainerContext } from './ScrollContainerContext';
import classes from './Sheet.module.css';

/**
 * The conversation's sheet: the page ground inset on the chrome field, a hairline round it, and its
 * own scroll so the top bar and sidebar stay one still frame. Edge to edge on a phone.
 */
export function Sheet({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  return (
    <ScrollContainerContext.Provider value={container}>
      <div ref={container} className={classes.sheet}>
        {children}
      </div>
    </ScrollContainerContext.Provider>
  );
}
