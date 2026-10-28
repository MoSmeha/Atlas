import type { CellValue, ResultTable } from '@atlas/shared';
import { type NumberStyle, fractionDigits } from './formatNumber';

/** One column of a result table as the client lays it out. */
export interface ResultColumn {
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

/** Columns whose decimals differ by more than this keep each number as written instead of padding. */
const MAX_PADDED_DECIMALS = 2;

/** Reads each column's values once: whether it is numeric, and how its numbers are written. */
export function resultColumns(table: Pick<ResultTable, 'columns' | 'rows'>): ResultColumn[] {
  return table.columns.map((label, index) => {
    const values = table.rows.map((row) => row[index] ?? null);
    const numbers = values.filter((value): value is number => typeof value === 'number');
    const decimals = Math.max(0, ...numbers.map(fractionDigits));
    return {
      label,
      numeric: numbers.length > 0 && values.every(isNumberOrEmpty),
      numbers: {
        group: !UNGROUPED_LABEL.test(label),
        fractionDigits: decimals <= MAX_PADDED_DECIMALS ? decimals : 0,
      },
    };
  });
}

function isNumberOrEmpty(value: CellValue): boolean {
  return value === null || typeof value === 'number';
}
