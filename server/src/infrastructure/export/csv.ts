import type { CleanValue } from '../../domain/table';

/** Byte order mark that makes Excel open a CSV file as UTF-8, so Arabic text shows correctly. */
export const UTF8_BOM = '﻿';

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d[\d,]*(\.\d+)?$/;

/** RFC 4180 CSV text: a header line, then one line per row, each ending in CRLF. */
export function toCsv(columns: string[], rows: CleanValue[][]): string {
  return [columns, ...rows].map((row) => `${row.map(csvField).join(',')}\r\n`).join('');
}

/**
 * One field. Fields holding a comma, quote or line break are quoted, with quotes doubled.
 * Text that a spreadsheet would run as a formula gets a leading apostrophe, so document text stays data.
 */
export function csvField(value: CleanValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
