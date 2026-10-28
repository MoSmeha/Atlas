import type { FileStatus } from '@atlas/shared';
import { chunkPage } from '../../domain/chunking';
import { currencyCode, detectCurrencies } from '../../domain/currency';
import type { ParsedPdf, ParsedWorkbook, RawCell } from '../../domain/document';
import { detectLanguage } from '../../domain/language';
import type { CleanTable, CleanValue } from '../../domain/table';
import { cellText, tidyNumber } from '../../domain/tables/cellText';
import { cleanSheet } from '../../domain/tables/cleanSheet';
import { extractPdfTables } from '../../domain/tables/pdfTables';
import type { DocumentRecord, SheetRow } from '../ports/DocumentIndex';
import type { ReadOutcome } from '../ports/DocumentReader';
import type { ScannedFile } from './scanFolder';

type Content = Pick<DocumentRecord, 'pageCount' | 'scannedPages' | 'sheets' | 'pages' | 'chunks' | 'tables' | 'sheetRows'>;

/**
 * Everything the index keeps for one file a reader opened: page text and search chunks for PDFs, clean SQL tables
 * (cleanSheet per sheet, extractPdfTables over the pages), raw sheet rows for the viewer, and the language and
 * currencies found in the tables and text. A file the reader could not use keeps only its status.
 */
export function buildRecord(file: ScannedFile, outcome: ReadOutcome): DocumentRecord {
  if (outcome.status !== 'ok' && outcome.status !== 'scanned') return statusRecord(file, outcome.status, outcome.detail);
  const { document } = outcome;
  const content = document.kind === 'pdf' ? pdfContent(document) : workbookContent(document);
  const text = document.kind === 'pdf' ? document.pages.map((page) => page.text).join('\n') : workbookText(document);
  return {
    ...identity(file),
    status: outcome.status,
    statusDetail: outcome.detail,
    ...content,
    language: detectLanguage(text),
    currencies: currencies(content.tables, text),
  };
}

/** A record with no content: a file that was skipped, too large, empty, damaged or locked. */
export function statusRecord(file: ScannedFile, status: FileStatus, detail: string | null): DocumentRecord {
  return {
    ...identity(file),
    status,
    statusDetail: detail,
    pageCount: null,
    scannedPages: [],
    sheets: [],
    language: null,
    currencies: [],
    pages: [],
    chunks: [],
    tables: [],
    sheetRows: [],
  };
}

function identity(file: ScannedFile): Pick<DocumentRecord, 'path' | 'name' | 'kind' | 'fingerprint'> {
  const { entry } = file;
  return { path: entry.relativePath, name: entry.name, kind: file.kind, fingerprint: { mtimeMs: entry.mtimeMs, size: entry.size } };
}

function pdfContent(pdf: ParsedPdf): Content {
  return {
    pageCount: pdf.pages.length,
    scannedPages: pdf.pages.filter((page) => !page.hasTextLayer).map((page) => page.number),
    sheets: [],
    pages: pdf.pages.map(({ number, text }) => ({ number, text })),
    chunks: pdf.pages.flatMap((page) => chunkPage(page.text).map((text) => ({ page: page.number, text }))),
    tables: extractPdfTables(pdf.pages),
    sheetRows: [],
  };
}

function workbookContent(workbook: ParsedWorkbook): Content {
  return {
    pageCount: null,
    scannedPages: [],
    sheets: workbook.sheets.map((sheet) => sheet.name),
    pages: [],
    chunks: [],
    tables: workbook.sheets.flatMap(cleanSheet),
    sheetRows: workbook.sheets.map((sheet) => ({ sheet: sheet.name, rows: sheet.rows.map(viewerRow) })),
  };
}

/** Every row from row 1, blank ones included, so row numbers match Excel; trailing empty cells are dropped. */
function viewerRow(cells: RawCell[], index: number): SheetRow {
  const values = cells.map(viewerValue);
  let length = values.length;
  while (length > 0 && values[length - 1] === null) length--;
  return { rowNumber: index + 1, cells: values.slice(0, length) };
}

function viewerValue(cell: RawCell): CleanValue {
  if (cell === null || typeof cell === 'string') return cell;
  if (typeof cell === 'number') return tidyNumber(cell);
  return cellText(cell);
}

/** The text cells of every sheet, for language and currency detection. */
function workbookText(workbook: ParsedWorkbook): string {
  return workbook.sheets
    .flatMap((sheet) => sheet.rows.flatMap((row) => row.filter((cell): cell is string => typeof cell === 'string')))
    .join(' ');
}

/** Table currencies first, then each row's own currency in a currency column, then any currency the text mentions. */
function currencies(tables: readonly CleanTable[], text: string): string[] {
  const found = new Set<string>();
  for (const table of tables) {
    if (table.currency !== null) found.add(table.currency);
    const column = table.columns.findIndex((candidate) => candidate.role === 'currency');
    if (column < 0) continue;
    for (const row of table.rows) {
      const value = row.values[column];
      const code = typeof value === 'string' ? currencyCode(value) : null;
      if (code !== null) found.add(code);
    }
  }
  for (const code of detectCurrencies(text)) found.add(code);
  return [...found];
}
