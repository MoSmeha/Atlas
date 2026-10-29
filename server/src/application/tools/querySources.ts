import type { Source } from '@atlas/shared';
import { rowRanges } from '../../domain/rowRanges';
import { META_COLUMNS, type CleanValue } from '../../domain/table';
import { isMetaColumn } from '../../domain/visibleColumns';
import type { QueryResult, TableRowRecord, TableSchema } from '../ports/DocumentIndex';

/** Where a cited row or page sits: a sheet of a workbook, or a PDF (sheet null). */
interface Place {
  document: string;
  sheet: string | null;
  numbers: number[];
}

/**
 * Where a query result comes from. Each result row is traced to its own table by its _row (or _page) value: the
 * tables the query read, narrowed by the row's text columns that name a file, sheet or table (as a UNION ALL query
 * adds with 'BOQ.xlsx' AS document, 'MEP' AS sheet). The row is traced when those tables sit on one sheet (or in one
 * PDF), or when only one sheet among them has that row (or page). Traced rows are cited per sheet in ranges, pages one
 * by one; rows without a _row or _page value are skipped. The tables a row cannot be traced within, and every table
 * when no row has a _row or _page value (a total, say), are cited whole, from their first to their last row.
 */
export function querySources(
  result: QueryResult,
  tables: readonly TableSchema[],
  rowsOf: (table: string) => TableRowRecord[],
): Source[] {
  const rowColumns = columnsNamed(result, META_COLUMNS.sheetRow);
  const pageColumns = columnsNamed(result, META_COLUMNS.page);
  if (tables.length === 0 || rowColumns.length + pageColumns.length === 0) return wholeTables(tables, tables, rowsOf);

  const holds = numberSets(rowsOf);
  const naming = namingColumns(result, tables);
  const places = new Map<string, Place>();
  const untraced = new Set<TableSchema>();
  const cite = (document: string, sheet: string | null, value: number) => {
    const key = `${sheet === null ? 'pdf' : 'excel'}|${document}|${sheet ?? ''}`;
    const place = places.get(key) ?? { document, sheet, numbers: [] };
    place.numbers.push(value);
    places.set(key, place);
  };

  for (const row of result.rows) {
    const named = narrowed(tables, naming.map((at) => row[at] ?? null));
    for (const [columns, onSheets] of [[rowColumns, true], [pageColumns, false]] as const) {
      const among = named.filter((table) => (table.sheet !== null) === onSheets);
      const candidates = among.length > 0 ? among : tables.filter((table) => (table.sheet !== null) === onSheets);
      for (const at of columns) {
        const value = row[at];
        if (!isRowNumber(value)) continue;
        const from = traced(candidates, value, onSheets ? holds.rows : holds.pages);
        if (from === null) for (const table of candidates) untraced.add(table);
        else cite(from.document, from.sheet, value);
      }
    }
  }

  const cited = [...places.values()].flatMap((place) => placeSources(place, tables, rowsOf));
  const whole = wholeTables(tables, [...untraced], rowsOf);
  if (cited.length + whole.length === 0) return wholeTables(tables, tables, rowsOf);
  return withoutCovered([...cited, ...whole]);
}

/** Indexes of the result columns with this name, ignoring case; a join can select _row from two tables. */
function columnsNamed(result: QueryResult, name: string): number[] {
  return result.columns.flatMap((column, at) => (column.toLowerCase() === name ? [at] : []));
}

/**
 * Text columns whose values mostly name a table the query read, by its file, sheet or SQL name: the
 * 'BOQ_Phase1_Rev0.xlsx' AS document and 'MEP' AS sheet literals of a UNION ALL query. Mostly, because a PDF part
 * may fill the sheet column with something that is no sheet; a column of descriptions names a sheet at most by chance.
 */
function namingColumns(result: QueryResult, tables: readonly TableSchema[]): number[] {
  return result.columns.flatMap((column, at) => {
    if (isMetaColumn(column)) return [];
    const values = result.rows.map((row) => row[at] ?? null).filter((value) => value !== null);
    if (values.length === 0 || !values.every((value) => typeof value === 'string')) return [];
    const naming = values.filter((value) => tables.some((table) => names(table, value))).length;
    return naming * 2 > values.length ? [at] : [];
  });
}

/** The tables each value names, one value after another; a value that names none of what is left changes nothing. */
function narrowed(tables: readonly TableSchema[], values: readonly CleanValue[]): TableSchema[] {
  let left = [...tables];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const named = left.filter((table) => names(table, value));
    if (named.length > 0) left = named;
  }
  return left;
}

/** True when the text is the table's SQL name, its sheet, or its file (path, name, or name without extension). */
function names(table: TableSchema, text: string): boolean {
  const key = normal(text);
  if (key === '') return false;
  if (key === normal(table.name) || (table.sheet !== null && key === normal(table.sheet))) return true;
  const path = normal(table.document);
  const file = path.split('/').pop() ?? path;
  return key === path || key === file || key === file.replace(/\.[^.]+$/, '');
}

function normal(text: string): string {
  return text.replaceAll('\\', '/').trim().toLowerCase();
}

/**
 * The one sheet (or PDF) among the candidates the row number (or page) comes from: theirs when they all sit on one,
 * otherwise the one whose tables have that row (or page); null when that is still more than one, or none.
 */
function traced(
  candidates: readonly TableSchema[],
  value: number,
  holds: (table: TableSchema) => Set<number>,
): { document: string; sheet: string | null } | null {
  const one = (list: readonly TableSchema[]) => {
    const [first] = list;
    return first !== undefined && list.every((table) => table.document === first.document && table.sheet === first.sheet) ? first : null;
  };
  return one(candidates) ?? one(candidates.filter((table) => holds(table).has(value)));
}

/** The sheet rows and the pages of each table, read once. */
function numberSets(rowsOf: (table: string) => TableRowRecord[]) {
  const cache = new Map<string, Set<number>>();
  const cached = (key: string, make: () => number[]) => {
    const set = cache.get(key) ?? new Set(make());
    cache.set(key, set);
    return set;
  };
  return {
    rows: (table: TableSchema) => cached(`row|${table.name}`, () => rowNumbers(rowsOf(table.name))),
    pages: (table: TableSchema) => cached(`page|${table.name}`, () => pagesOf(table, rowsOf(table.name))),
  };
}

/** A sheet's cited rows in ranges, against the rows of every table on that sheet; a PDF's cited pages in order. */
function placeSources(place: Place, tables: readonly TableSchema[], rowsOf: (table: string) => TableRowRecord[]): Source[] {
  const { document, sheet } = place;
  if (sheet === null) return distinct(place.numbers).map((page) => ({ kind: 'pdf', document, page, quote: null }));
  const onSheet = tables.filter((table) => table.document === document && table.sheet === sheet);
  const tableRows = onSheet.flatMap((table) => rowNumbers(rowsOf(table.name)));
  return rowRanges(place.numbers, tableRows).map(({ from, to }) => ({ kind: 'excel', document, sheet, rowFrom: from, rowTo: to }));
}

/** The chosen tables, in the order the query read them, each cited whole. */
function wholeTables(
  tables: readonly TableSchema[],
  chosen: readonly TableSchema[],
  rowsOf: (table: string) => TableRowRecord[],
): Source[] {
  return tables.filter((table) => chosen.includes(table)).flatMap((table) => wholeTable(table, rowsOf(table.name)));
}

function wholeTable(table: TableSchema, rows: TableRowRecord[]): Source[] {
  if (table.sheet !== null) {
    const numbers = rowNumbers(rows);
    if (numbers.length === 0) return [];
    const rowFrom = numbers.reduce((a, b) => Math.min(a, b));
    const rowTo = numbers.reduce((a, b) => Math.max(a, b));
    return [{ kind: 'excel', document: table.document, sheet: table.sheet, rowFrom, rowTo }];
  }
  return pagesOf(table, rows).map((page) => ({ kind: 'pdf', document: table.document, page, quote: null }));
}

/** A PDF table's pages: those its rows are on, or else its page range. */
function pagesOf(table: TableSchema, rows: TableRowRecord[]): number[] {
  const pages = distinct(rows.map((row) => row.page).filter(isRowNumber));
  if (pages.length > 0 || table.pageFrom === null) return pages;
  const from = table.pageFrom;
  return Array.from({ length: Math.max(from, table.pageTo ?? from) - from + 1 }, (_, i) => from + i);
}

/** Leaves out repeated pages and ranges that another range on the same sheet covers, such as a table cited whole. */
function withoutCovered(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source, at) => {
    if (source.kind === 'pdf') {
      const key = `${source.document}|${source.page}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
    return !sources.some(
      (other, otherAt) =>
        other !== source &&
        other.kind === 'excel' &&
        other.document === source.document &&
        other.sheet === source.sheet &&
        other.rowFrom <= source.rowFrom &&
        other.rowTo >= source.rowTo &&
        // Of two equal ranges, the first stays.
        (other.rowFrom < source.rowFrom || other.rowTo > source.rowTo || otherAt < at),
    );
  });
}

function rowNumbers(rows: TableRowRecord[]): number[] {
  return rows.map((row) => row.sheetRow).filter(isRowNumber);
}

function isRowNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function distinct(numbers: number[]): number[] {
  return [...new Set(numbers)].sort((a, b) => a - b);
}
