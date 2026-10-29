import { useContext } from 'react';
import { LanguageContext, type LanguageValue } from './LanguageContext';

/** The interface language. Call it inside LanguageProvider. */
export function useLanguage(): LanguageValue {
  const language = useContext(LanguageContext);
  if (!language) throw new Error('useLanguage needs a LanguageProvider above it.');
  return language;
}
