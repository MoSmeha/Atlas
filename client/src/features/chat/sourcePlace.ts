import type { ExcelSource } from '@atlas/shared';

/** The file name at the end of a folder-relative path. */
export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

/** "row 14" or "rows 14–18", numbered as Excel shows them. */
export function rowsText(source: Pick<ExcelSource, 'rowFrom' | 'rowTo'>): string {
  const { rowFrom, rowTo } = source;
  return rowFrom === rowTo ? `row ${rowFrom}` : `rows ${rowFrom}–${rowTo}`;
}
