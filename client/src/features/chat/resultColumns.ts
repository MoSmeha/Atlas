import type { CellValue, ResultTable } from '@atlas/shared';
import { type NumberStyle, fractionDigits } from './formatNumber';

/** One column of a result table as the client lays it out. */
export interface ResultColumn {
  /** Where the column's values sit in each row the server sent. */
  index: number;
  label: string;
  /** Every value is a number or empty, so the column and its header align right. */
  numeric: boolean;
  numbers: NumberStyle;
}

/**
 * Labels of columns that hold identifiers, years or positions rather than amounts. Words are split
 * on anything but a letter, so SQL names such as entry_no and item_code count too.
 */
const UNGROUPED_LABEL = /(?:^|[^a-z])(?:year|code|id|no|ref|entry|row|page)(?:[^a-z]|$)/i;

/**
 * An amount column with any decimals shows every value with this many: 40,096,972.5 reads
 * 40,096,972.50 and a whole 138,283,555 beside it reads 138,283,555.00. Digits past it are never cut.
 */
const AMOUNT_DECIMALS = 2;

/** The flag Atlas adds to every SQL table so sums can skip total rows; it means nothing on screen. Exports keep it. */
const HIDDEN_COLUMNS = new Set(['_is_total']);

/** Where-from columns Atlas adds; a sheet has no _page and a PDF table no _row, so an empty one is left out. */
const HIDDEN_WHEN_EMPTY = new Set(['_row', '_page', '_section']);

/** An SQL name such as item_code, total_SAR or _row, which reads better as "Item code", "Total SAR" or "Row". */
const SQL_NAME = /^_?[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/i;

/** Words in SQL names that are written in capitals. */
const CAPITALS = new Set(['sar', 'usd', 'eur', 'gbp', 'aed', 'vat', 'boq', 'id']);

/** Reads each column's values once: whether it is numeric, and how its numbers are written. */
export function resultColumns(table: Pick<ResultTable, 'columns' | 'rows'>): ResultColumn[] {
  return table.columns.flatMap((name, index) => {
    const key = name.toLowerCase();
    if (HIDDEN_COLUMNS.has(key)) return [];
    const values = table.rows.map((row) => row[index] ?? null);
    if (HIDDEN_WHEN_EMPTY.has(key) && values.every((value) => value === null)) return [];
    const numbers = values.filter((value): value is number => typeof value === 'number');
    const hasDecimals = numbers.some((value) => fractionDigits(value) > 0);
    const group = !UNGROUPED_LABEL.test(name);
    return {
      index,
      label: columnLabel(name),
      numeric: numbers.length > 0 && values.every(isNumberOrEmpty),
      numbers: {
        group,
        // Whole-number amounts stay integers; codes and row numbers keep each number as written.
        fractionDigits: group && hasDecimals ? AMOUNT_DECIMALS : 0,
      },
    };
  });
}

/** "item_code" becomes "Item code" and "_row" becomes "Row"; any other name is shown as the query wrote it. */
export function columnLabel(name: string): string {
  if (!SQL_NAME.test(name)) return name;
  const words = name.replace(/^_/, '').split('_');
  const label = words.map((word) => (CAPITALS.has(word.toLowerCase()) ? word.toUpperCase() : word)).join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isNumberOrEmpty(value: CellValue): boolean {
  return value === null || typeof value === 'number';
}
