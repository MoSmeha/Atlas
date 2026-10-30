import { createContext } from 'react';
import type { Direction, Language } from './language';

/** The interface language and its reading direction. */
export interface LanguageValue {
  language: Language;
  dir: Direction;
  /** Switches every label, hint and message, mirrors the layout, and remembers the choice. */
  setLanguage(language: Language): void;
}

export const LanguageContext = createContext<LanguageValue | null>(null);
