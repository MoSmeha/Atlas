import { type RefObject, useContext } from 'react';
import { ScrollContainerContext } from './ScrollContainerContext';

/** The conversation's scrolling element. Call it inside Sheet. */
export function useScrollContainer(): RefObject<HTMLDivElement | null> {
  const container = useContext(ScrollContainerContext);
  if (!container) throw new Error('useScrollContainer needs a Sheet above it.');
  return container;
}
