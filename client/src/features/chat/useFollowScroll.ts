import { type RefObject, useEffect, useRef } from 'react';
import { useReducedMotion } from '@mantine/hooks';
import { useScrollContainer } from '../../shell/useScrollContainer';

/** Within this many pixels of the bottom, the reader counts as following the answer. */
const NEAR_BOTTOM_PX = 64;
/** The finished parts render just after streaming ends; keep following long enough to bring them into view. */
const SETTLE_MS = 1000;

/**
 * Scrolls the sheet to a newly asked turn, then keeps the end of its answer in view as it streams
 * and settles, but never past the point where the question would leave the top of the sheet.
 * Scrolling up stops the following; coming back to the bottom starts it again.
 */
export function useFollowScroll(thread: RefObject<HTMLElement | null>, newestTurnId: string | null, streaming: boolean) {
  const reduceMotion = useReducedMotion();
  const scroller = useScrollContainer();
  const following = useRef(true);
  const activeUntil = useRef(0);

  useEffect(() => {
    activeUntil.current = streaming ? Number.POSITIVE_INFINITY : performance.now() + SETTLE_MS;
  }, [streaming]);

  useEffect(() => {
    const sheet = scroller.current;
    if (!sheet) return;
    const onScroll = () => {
      following.current = distanceFromBottom(sheet) < NEAR_BOTTOM_PX;
    };
    sheet.addEventListener('scroll', onScroll, { passive: true });
    return () => sheet.removeEventListener('scroll', onScroll);
  }, [scroller]);

  useEffect(() => {
    if (newestTurnId === null) return;
    following.current = true;
    document.getElementById(newestTurnId)?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [newestTurnId, reduceMotion]);

  useEffect(() => {
    const content = thread.current;
    const sheet = scroller.current;
    if (!content || !sheet || newestTurnId === null) return;
    const observer = new ResizeObserver(() => {
      const turn = document.getElementById(newestTurnId);
      if (!turn || !following.current || performance.now() > activeUntil.current) return;
      const bottom = sheet.scrollHeight - sheet.clientHeight;
      const questionAtTop =
        sheet.scrollTop + turn.getBoundingClientRect().top - sheet.getBoundingClientRect().top - scrollMarginTop(turn);
      const top = Math.min(bottom, questionAtTop);
      if (top > sheet.scrollTop + 1) sheet.scrollTo({ top });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [thread, scroller, newestTurnId]);
}

function distanceFromBottom(sheet: HTMLElement): number {
  return sheet.scrollHeight - (sheet.scrollTop + sheet.clientHeight);
}

function scrollMarginTop(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}
