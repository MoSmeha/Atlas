import type { ColumnType } from '@atlas/shared';
import { currencyCode, detectCurrency } from '../currency';
import type { RawCell } from '../document';
import type { ColumnRole } from '../table';
import { cellNumber, cellText } from './cellText';

export interface CurrencyColumnInfo {
  label: string;
  role: ColumnRole | null;
  type: ColumnType;
}

export interface TableCurrency {
  /** The one currency of the table's amounts; null when none is stated or rows differ. */
  currency: string | null;
  /** What the currency column holds per row, when the table has one or its amounts mix currencies; otherwise null. */
  perRow: (string | null)[] | null;
}

/** Amount columns first, then rates, so a row's currency is read from its amount. */
function rank(role: ColumnRole | null): number {
  if (role === 'amount') return 0;
  return role === 'rate' ? 1 : 2;
}

/**
 * The currency of a table's amounts, from a currency column, cell prefixes ("SAR 1,000"), money column headers
 * ("Amount (SAR)") or the title, most specific first. When one column's rows mix currencies, each row keeps its own.
 */
export function tableCurrency(columns: readonly CurrencyColumnInfo[], rows: readonly RawCell[][], title: string | null): TableCurrency {
  const titleCurrency = title === null ? null : detectCurrency(title);
  const money = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => isMoneyColumn(column, rows, index))
    .sort((a, b) => rank(a.column.role) - rank(b.column.role));
  const perColumn = money.map(({ column, index }) =>
    rows.map((row) => {
      const parsed = cellNumber(row[index] ?? null);
      return parsed === null ? null : (parsed.currency ?? detectCurrency(column.label) ?? titleCurrency);
    }),
  );
  const mixed = perColumn.some((list) => distinct(list).length > 1);
  const detected = mixed ? rows.map((_, row) => perColumn.map((list) => list[row] ?? null).find((code) => code !== null) ?? null) : null;

  const stated = statedCurrencies(columns, rows);
  if (stated !== null) {
    const perRow = stated.map((code, row) => code ?? detected?.[row] ?? null);
    const codes = distinct(perRow);
    return { currency: codes.length === 1 ? (codes[0] ?? null) : null, perRow };
  }
  if (detected !== null) return { currency: null, perRow: detected };
  const codes = distinct(perColumn.flat());
  return { currency: codes.length === 1 ? (codes[0] ?? null) : null, perRow: null };
}

/** A number column that is a rate or amount, names a currency in its header, or has currencies in its cells. */
function isMoneyColumn(column: CurrencyColumnInfo, rows: readonly RawCell[][], index: number): boolean {
  if (column.type === 'text') return false;
  if (column.role === 'rate' || column.role === 'amount' || detectCurrency(column.label) !== null) return true;
  return rows.some((row) => (cellNumber(row[index] ?? null)?.currency ?? null) !== null);
}

/** The currency column's values as codes where recognised ("SR" is SAR); null when there is no such column or it is empty. */
function statedCurrencies(columns: readonly CurrencyColumnInfo[], rows: readonly RawCell[][]): (string | null)[] | null {
  const index = columns.findIndex((column) => column.role === 'currency');
  if (index < 0) return null;
  const values = rows.map((row) => {
    const text = cellText(row[index] ?? null);
    return text === '' ? null : (currencyCode(text) ?? text);
  });
  return values.some((value) => value !== null) ? values : null;
}

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}
