import type { Source } from '@atlas/shared';
import { rowRanges } from '../../domain/rowRanges';
import { META_COLUMNS } from '../../domain/table';
import type { QueryResult, TableRowRecord, TableSchema } from '../ports/DocumentIndex';

/**
 * Where a query result comes from. When every table the query read sits on one sheet (or in one PDF), the
 * _row (or _page) values in the result name the exact rows (or pages). Otherwise, or when the result has
 * none, each table the query read is cited whole, from its first to its last row.
 */
export function querySources(
  result: QueryResult,
  tables: readonly TableSchema[],
  rowsOf: (table: string) => TableRowRecord[],
): Source[] {
  const [first] = tables;
  if (first !== undefined && tables.every((table) => table.document === first.document)) {
    const cited: Source[] = [];
    const sheet = first.sheet;
    const rows = numbersIn(result, META_COLUMNS.sheetRow);
    if (sheet !== null && rows.length > 0 && tables.every((table) => table.sheet === sheet)) {
      const tableRows = tables.flatMap((table) => rowsOf(table.name).map((row) => row.sheetRow)).filter(isRowNumber);
      for (const { from, to } of rowRanges(rows, tableRows)) {
        cited.push({ kind: 'excel', document: first.document, sheet, rowFrom: from, rowTo: to });
      }
    }
    for (const page of distinct(numbersIn(result, META_COLUMNS.page))) {
      cited.push({ kind: 'pdf', document: first.document, page, quote: null });
    }
    if (cited.length > 0) return cited;
  }
  return tables.flatMap((table) => wholeTable(table, rowsOf(table.name)));
}

function wholeTable(table: TableSchema, rows: TableRowRecord[]): Source[] {
  if (table.sheet !== null) {
    const numbers = rows.map((row) => row.sheetRow).filter(isRowNumber);
    if (numbers.length === 0) return [];
    const rowFrom = numbers.reduce((a, b) => Math.min(a, b));
    const rowTo = numbers.reduce((a, b) => Math.max(a, b));
    return [{ kind: 'excel', document: table.document, sheet: table.sheet, rowFrom, rowTo }];
  }
  let pages = distinct(rows.map((row) => row.page).filter(isRowNumber));
  if (pages.length === 0 && table.pageFrom !== null) {
    const from = table.pageFrom;
    pages = Array.from({ length: Math.max(from, table.pageTo ?? from) - from + 1 }, (_, i) => from + i);
  }
  return pages.map((page) => ({ kind: 'pdf', document: table.document, page, quote: null }));
}

/** The whole numbers of 1 or more in the result column with this name, ignoring case; empty without the column. */
function numbersIn(result: QueryResult, column: string): number[] {
  const at = result.columns.findIndex((name) => name.toLowerCase() === column);
  if (at === -1) return [];
  return result.rows.map((row) => row[at]).filter(isRowNumber);
}

function isRowNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function distinct(numbers: number[]): number[] {
  return [...new Set(numbers)].sort((a, b) => a - b);
}
