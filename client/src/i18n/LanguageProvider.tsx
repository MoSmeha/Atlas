import { type ReactNode, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useDirection } from '@mantine/core';
import { LanguageContext, type LanguageValue } from './LanguageContext';
import { directionOf, initialLanguage, type Language, saveLanguage } from './language';

/**
 * Holds the interface language. It sets `lang` and `dir` on the page, so Mantine and every logical
 * property mirror for Arabic. Call it inside Mantine's DirectionProvider.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(initialLanguage);
  const { setDirection } = useDirection();
  const dir = directionOf(language);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    setDirection(dir);
  }, [language, dir, setDirection]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    saveLanguage(next);
  }, []);

  const value = useMemo<LanguageValue>(() => ({ language, dir, setLanguage }), [language, dir, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
