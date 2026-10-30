import { createContext, type RefObject } from 'react';

/** The element the conversation scrolls in: the inset sheet, not the window. */
export const ScrollContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
