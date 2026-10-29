import type { Language } from '../../i18n/language';
import { traceCopy } from './traceCopy';

/** "Searched the text" for search_documents; a tool added later reads as "Used find tables". */
export function stepLabel(name: string, language: Language = 'en'): string {
  const copy = traceCopy[language];
  return copy.labels[name] ?? copy.otherLabel(name);
}
