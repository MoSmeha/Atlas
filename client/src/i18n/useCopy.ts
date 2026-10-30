import type { Bilingual } from './language';
import { useLanguage } from './useLanguage';

/** A feature's interface text in the current language. */
export function useCopy<T>(copy: Bilingual<T>): T {
  return copy[useLanguage().language];
}
