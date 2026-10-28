import type { CleanValue } from './table';

export interface ColumnsAndRows {
  columns: string[];
  rows: CleanValue[][];
}

/**
 * Columns Atlas adds to every SQL table (_row, _page, _is_total, _section) start with "_". Queries select them so
 * answers can cite rows and pages; they mean nothing to a reader. Document columns never start with "_".
 */
export function isMetaColumn(name: string): boolean {
  return name.startsWith('_');
}

/**
 * A result as the reader sees it, in the answer's table and in exports: without its meta columns, which the saved
 * result keeps for its sources. A meta column the query renamed, such as _row AS excel_row, is the query's own and
 * stays. When every column is a meta column nothing is left out, so a table never loses all its columns.
 */
export function visibleColumns(table: { columns: readonly string[]; rows: readonly (readonly CleanValue[])[] }): ColumnsAndRows {
  const kept = table.columns.flatMap((name, at) => (isMetaColumn(name) ? [] : [at]));
  const shown = kept.length > 0 ? kept : table.columns.map((_, at) => at);
  return {
    columns: shown.map((at) => table.columns[at] ?? ''),
    rows: table.rows.map((row) => shown.map((at) => row[at] ?? null)),
  };
}
