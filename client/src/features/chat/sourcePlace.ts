import type { ExcelSource } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { chatCopy } from './chatCopy';

/** The file name at the end of a folder-relative path. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

/** "row 14" or "rows 14–18", numbered as Excel shows them; "الصفوف من 14 إلى 18" in Arabic. */
export function rowsText(source: Pick<ExcelSource, 'rowFrom' | 'rowTo'>, language: Language = 'en'): string {
  return chatCopy[language].sources.rows(source.rowFrom, source.rowTo);
}
