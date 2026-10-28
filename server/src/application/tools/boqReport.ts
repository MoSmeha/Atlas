import type { Source } from '@atlas/shared';
import type { BoqMismatch, BoqRow } from '../../domain/boqArithmetic';
import { describePages } from '../../domain/pageRanges';
import type { TableSchema } from '../ports/DocumentIndex';

/** For a total, the rows its expected value adds up, in words: "the 6 item rows from row 17 to row 22". */
export function coverage(mismatch: BoqMismatch): string | null {
  if (mismatch.kind === 'item') return null;
  const parts: string[] = [];
  if (mismatch.base) parts.push(`the total ${where(mismatch.base)}`.trimEnd());
  const count = mismatch.covered.length;
  if (count > 0) parts.push(`${count === 1 ? 'the item row' : `the ${count} item rows`} ${span(mismatch.covered)}`.trimEnd());
  return parts.join(' plus ');
}

/** What explains a total's gap, when the check could tell. */
export function mismatchNote(mismatch: BoqMismatch): string | null {
  if (mismatch.matchesSubtotals) return 'It adds up the sub-totals above it correctly, so the gap comes from a wrong sub-total.';
  if (!mismatch.gap) return null;
  const { row, how } = mismatch.gap;
  const which = `${capitalize(label(row))}${row.itemCode === null ? '' : ` (item ${row.itemCode})`}`;
  return `${which} has an amount equal to the gap; the total seems to ${how === 'left_out' ? 'leave it out' : 'count it twice'}.`;
}

/** Where a mismatch is: its row, or for a total also the rows it adds up. */
export function mismatchSources(table: TableSchema, mismatch: BoqMismatch): Source[] {
  const rows = [mismatch.row, ...(mismatch.base ? [mismatch.base] : []), ...mismatch.covered];
  const quote = mismatch.kind === 'item' ? mismatch.row.itemCode : null;
  return sourcesFor(table, rows, quote);
}

/** The whole table, for a check that found nothing wrong. */
export function tableSources(table: TableSchema, rows: readonly BoqRow[]): Source[] {
  const sources = sourcesFor(table, rows, null);
  const first = table.pageFrom;
  if (sources.length > 0 || first === null) return sources;
  const last = table.pageTo ?? first;
  return Array.from({ length: last - first + 1 }, (_, i) => pdfSource(table, first + i, null));
}

export function uniqueSources(sources: readonly Source[]): Source[] {
  const seen = new Map<string, Source>();
  for (const source of sources) seen.set(JSON.stringify(source), source);
  return [...seen.values()];
}

/** One Excel source over the rows' span, or one PDF source per page they are on. */
function sourcesFor(table: TableSchema, rows: readonly BoqRow[], quote: string | null): Source[] {
  const sheetRows = rows.map((row) => row.sheetRow).filter((row): row is number => row !== null);
  if (table.sheet !== null && sheetRows.length > 0) {
    return [{ kind: 'excel', document: table.document, sheet: table.sheet, rowFrom: min(sheetRows), rowTo: max(sheetRows) }];
  }
  const pages = [...new Set(rows.map((row) => row.page).filter((page): page is number => page !== null))].sort((a, b) => a - b);
  return pages.map((page) => pdfSource(table, page, quote));
}

function pdfSource(table: TableSchema, page: number, quote: string | null): Source {
  return { kind: 'pdf', document: table.document, page, quote };
}

function where(row: BoqRow): string {
  if (row.sheetRow !== null) return `in row ${row.sheetRow}`;
  return row.page === null ? '' : `on page ${row.page}`;
}

function label(row: BoqRow): string {
  if (row.sheetRow !== null) return `row ${row.sheetRow}`;
  return row.page === null ? 'an item' : `the item on page ${row.page}`;
}

function span(rows: readonly BoqRow[]): string {
  const sheetRows = rows.map((row) => row.sheetRow).filter((row): row is number => row !== null);
  if (sheetRows.length === rows.length) {
    const from = min(sheetRows);
    const to = max(sheetRows);
    return from === to ? `in row ${from}` : `from row ${from} to row ${to}`;
  }
  const pages = rows.map((row) => row.page).filter((page): page is number => page !== null);
  return pages.length === 0 ? '' : `on ${describePages(pages)}`;
}

function min(values: readonly number[]): number {
  return values.reduce((low, value) => Math.min(low, value), Infinity);
}

function max(values: readonly number[]): number {
  return values.reduce((high, value) => Math.max(high, value), -Infinity);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
