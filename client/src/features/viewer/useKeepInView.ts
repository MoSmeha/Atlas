import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { offsetTopWithin } from './stageScroll';

/** How long a held row stays put while the rows above it load and draw. */
const HOLD_MS = 4000;

/**
 * Keeps a row where it is on screen while content is added above it, as rows load in steps.
 * The browser does not do this at the very top of a scroller, where "show earlier rows" sits.
 * The hold ends when the reader scrolls or after a few seconds.
 */
export function useKeepInView(stage: RefObject<HTMLElement | null>): (element: HTMLElement) => void {
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);

  return useCallback(
    (element: HTMLElement) => {
      const container = stage.current;
      const content = container?.querySelector('table');
      const start = container ? offsetTopWithin(container, element) : null;
      if (!container || !content || start === null) return;
      release.current?.();
      const gap = start - container.scrollTop;

      const observer = new ResizeObserver(() => {
        const top = offsetTopWithin(container, element);
        if (top !== null) container.scrollTop = top - gap;
      });
      const stop = () => {
        observer.disconnect();
        clearTimeout(timer);
        for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) container.removeEventListener(type, stop);
        release.current = null;
      };
      const timer = setTimeout(stop, HOLD_MS);
      for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
        container.addEventListener(type, stop, { passive: true });
      }
      observer.observe(content);
      release.current = stop;
    },
    [stage],
  );
}
