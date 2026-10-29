import type { RowRange } from '../../api/endpoints';
import { formatNumber } from '../chat/formatNumber';

/** Rows shown above and below the cited ones when the sheet opens. */
const CONTEXT_ROWS = 10;
/** The first window never holds fewer rows than this, so a short citation still shows its surroundings. */
const MIN_FIRST_ROWS = 50;
/** Nor more than this; a citation of thousands of rows loads the rest on request. */
const MAX_FIRST_ROWS = 300;
/** Rows each "show more" or "show earlier" adds. */
export const MORE_ROWS = 200;

/** The rows fetched when the sheet opens: the cited ones with some context, starting no earlier than row 1. */
export function firstWindow(rowFrom: number, rowTo: number): RowRange {
  const from = Math.max(1, rowFrom - CONTEXT_ROWS);
  const to = Math.max(rowTo + CONTEXT_ROWS, from + MIN_FIRST_ROWS - 1);
  return { from, to: Math.min(to, from + MAX_FIRST_ROWS - 1) };
}

/** The rows fetched when a sheet opens with nothing cited: its top. */
export function topWindow(): RowRange {
  return { from: 1, to: MORE_ROWS };
}

/** The next rows after a window. */
export function rowsAfter(range: RowRange): RowRange {
  return { from: range.to + 1, to: range.to + MORE_ROWS };
}

/** The rows just before a window, or null when it already starts at row 1. */
export function rowsBefore(range: RowRange): RowRange | null {
  if (range.from <= 1) return null;
  return { from: Math.max(1, range.from - MORE_ROWS), to: range.from - 1 };
}

/** Excel's column name for a 0-based index: A to Z, then AA, AB and on. */
export function columnLetter(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** "All 29 rows", "Showing rows 2,768–2,817 of 10,001", or that the sheet is empty. */
export function shownRowsText(from: number, to: number, total: number): string {
  if (total === 0) return 'This sheet is empty';
  if (from <= 1 && to >= total) return total === 1 ? 'The only row' : `All ${formatNumber(total)} rows`;
  return `Showing rows ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`;
}
