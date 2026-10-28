import type { ColumnType } from '@atlas/shared';
import type { RawCell } from '../document';
import { type CleanColumn, type CleanRow, type CleanTable, type ColumnRole, sqlIdentifier } from '../table';
import { cleanValue, columnType } from './columnTypes';
import { tableCurrency } from './tableCurrency';

/** A column as the document heads it: the header text and the role that text names. */
export interface SourceColumn {
  label: string;
  role: ColumnRole | null;
}

/** A data row before typing: one raw cell per source column, where it sits, and how it was classified. */
export interface SourceRow {
  cells: RawCell[];
  sheetRow: number | null;
  page: number | null;
  isTotal: boolean;
  section: string | null;
}

/** Where a table sits: its title, and its sheet or its PDF pages. */
export interface TablePlace {
  title: string | null;
  sheet: string | null;
  pageFrom: number | null;
  pageTo: number | null;
}

/** Columns of measures and money; section headings only use the text columns before the first of them. */
const MEASURE_ROLES: ReadonlySet<ColumnRole> = new Set(['unit', 'quantity', 'rate', 'amount', 'currency']);

/** The type of each column from its cells, as columnType reads them. */
export function columnTypes(columns: readonly SourceColumn[], rows: readonly { cells: readonly RawCell[] }[]): ColumnType[] {
  return columns.map((column, i) =>
    columnType(
      rows.map((row) => row.cells[i] ?? null),
      column.role,
    ),
  );
}

/** The text columns before the first measure or number column; none when the table has no such column. */
export function leadingTextColumns(columns: readonly SourceColumn[], types: readonly ColumnType[]): Set<number> {
  const boundary = columns.findIndex(
    (column, i) => (column.role !== null && MEASURE_ROLES.has(column.role)) || types[i] !== 'text',
  );
  return new Set(Array.from({ length: Math.max(boundary, 0) }, (_, i) => i));
}

/**
 * The clean table for classified rows: columns typed and named for SQL with role names first, amounts as plain
 * numbers, and the currency from the header, the title or the cells. When rows mix currencies and the table has no
 * currency column, a Currency column is added so each row keeps its own.
 */
export function buildTable(place: TablePlace, sources: readonly SourceColumn[], rows: readonly SourceRow[]): CleanTable {
  const types = columnTypes(sources, rows);
  const currency = tableCurrency(
    sources.map((column, i) => ({ label: column.label, role: column.role, type: types[i] ?? 'text' })),
    rows.map((row) => row.cells),
    place.title,
  );

  const columns = [...sources];
  if (currency.perRow !== null && !sources.some((column) => column.role === 'currency')) {
    columns.push({ label: 'Currency', role: 'currency' });
    types.push('text');
  }
  const currencyColumn = columns.findIndex((column) => column.role === 'currency');
  const names = columnNames(columns);
  return {
    ...place,
    columns: columns.map((column, i): CleanColumn => ({
      name: names[i] ?? `col_${i + 1}`,
      label: column.label,
      type: types[i] ?? 'text',
      role: column.role,
    })),
    rows: rows.map(
      (row, r): CleanRow => ({
        values: columns.map((_, i) =>
          i === currencyColumn && currency.perRow !== null
            ? (currency.perRow[r] ?? null)
            : cleanValue(row.cells[i] ?? null, types[i] ?? 'text'),
        ),
        sheetRow: row.sheetRow,
        page: row.page,
        isTotal: row.isTotal,
        section: row.section,
      }),
    ),
    currency: currency.currency,
  };
}

/** Role columns take their role name; the others a snake_case form of their label, numbered on clashes. */
function columnNames(columns: readonly SourceColumn[]): string[] {
  const used = new Set<string>(columns.flatMap((column) => (column.role === null ? [] : [column.role])));
  return columns.map((column, i) => {
    if (column.role !== null) return column.role;
    const base = sqlIdentifier(column.label, `col_${i + 1}`);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
    used.add(name);
    return name;
  });
}
