import { type RefObject, useEffect, useRef } from 'react';
import { useReducedMotion } from '@mantine/hooks';

/** Within this many pixels of the bottom, the reader counts as following the answer. */
const NEAR_BOTTOM_PX = 64;

/**
 * Scrolls the page to a newly asked turn, then keeps the end of its answer in view as it streams,
 * but never past the point where the question would leave the top of the screen. Scrolling up
 * stops the following; coming back to the bottom starts it again.
 */
export function useFollowScroll(thread: RefObject<HTMLElement | null>, newestTurnId: string | null, streaming: boolean) {
  const reduceMotion = useReducedMotion();
  const following = useRef(true);

  useEffect(() => {
    const onScroll = () => {
      following.current = distanceFromBottom() < NEAR_BOTTOM_PX;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (newestTurnId === null) return;
    following.current = true;
    document.getElementById(newestTurnId)?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [newestTurnId, reduceMotion]);

  useEffect(() => {
    const content = thread.current;
    if (!content || !streaming || newestTurnId === null) return;
    const observer = new ResizeObserver(() => {
      const turn = document.getElementById(newestTurnId);
      if (!following.current || !turn) return;
      const bottom = document.documentElement.scrollHeight - window.innerHeight;
      const questionAtTop = window.scrollY + turn.getBoundingClientRect().top - scrollMarginTop(turn);
      const top = Math.min(bottom, questionAtTop);
      if (top > window.scrollY + 1) window.scrollTo({ top });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [thread, newestTurnId, streaming]);
}

function distanceFromBottom(): number {
  return document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
}

function scrollMarginTop(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}
