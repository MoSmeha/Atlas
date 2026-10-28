import type { CellValue } from '@atlas/shared';

/** Text up to this many characters never wraps, so codes and short labels keep to one line. */
export const SHORT_TEXT = 24;

export interface SpannedCell {
  value: CellValue;
  /** Columns the cell covers: more than one when long text runs on into empty neighbours. */
  span: number;
}

/**
 * A row's cells padded to `columnCount`, where long text followed by empty cells runs across
 * them on one line, as Excel shows a title in A1. Other cells cover one column each.
 */
export function cellSpans(cells: CellValue[], columnCount: number): SpannedCell[] {
  const out: SpannedCell[] = [];
  for (let index = 0; index < columnCount; ) {
    const value = cells[index] ?? null;
    let span = 1;
    if (typeof value === 'string' && value.length > SHORT_TEXT) {
      while (index + span < columnCount && (cells[index + span] ?? null) === null) span++;
    }
    out.push({ value, span });
    index += span;
  }
  return out;
}
