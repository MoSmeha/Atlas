import type { MergedRange } from './document';

/** Excel's own limits: column XFD and row 1,048,576. */
const MAX_COLUMN = 16_384;
const MAX_ROW = 1_048_576;
const CELL = /^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/;

/** Column number for letters such as 'A' (1) or 'AB' (28). */
export function columnNumber(letters: string): number {
  let number = 0;
  for (const letter of letters.toUpperCase()) number = number * 26 + (letter.charCodeAt(0) - 64);
  return number;
}

/** Letters for a column number such as 1 ('A') or 28 ('AB'). */
export function columnLetters(column: number): string {
  let letters = '';
  for (let rest = Math.floor(column); rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}

/**
 * A range in A1 notation, such as 'A1:C2' or a single 'B4', as 1-based inclusive coordinates.
 * Corners may come in either order and '$' signs are ignored. Null when the text is not a cell range.
 */
export function parseCellRange(reference: string): MergedRange | null {
  const parts = reference.trim().toUpperCase().split(':');
  if (parts.length > 2) return null;
  const start = parseCell(parts[0] ?? '');
  const end = parseCell(parts[1] ?? parts[0] ?? '');
  if (start === null || end === null) return null;
  return {
    top: Math.min(start.row, end.row),
    left: Math.min(start.column, end.column),
    bottom: Math.max(start.row, end.row),
    right: Math.max(start.column, end.column),
  };
}

function parseCell(reference: string): { row: number; column: number } | null {
  const match = CELL.exec(reference);
  if (!match) return null;
  const column = columnNumber(match[1] ?? '');
  const row = Number(match[2]);
  return column <= MAX_COLUMN && row <= MAX_ROW ? { row, column } : null;
}
