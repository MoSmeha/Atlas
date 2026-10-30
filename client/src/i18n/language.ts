/** The interface languages. An answer follows its question's own language, whichever this is. */
export type Language = 'en' | 'ar';

/** Interface text in both languages. Each feature keeps its own, English and Arabic side by side. */
export type Bilingual<T> = Record<Language, T>;

export type Direction = 'ltr' | 'rtl';

export function directionOf(language: Language): Direction {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Where the choice is kept between visits. index.html reads the same key before the app loads. */
export const LANGUAGE_STORAGE_KEY = 'atlas-language';

/** The saved choice, else Arabic for an Arabic browser, else English. */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Storage can be blocked; the browser's language still decides.
  }
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Not saved: the next visit starts from the browser's language again.
  }
}
