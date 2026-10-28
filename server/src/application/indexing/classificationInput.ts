import type { DocumentSummary } from '@atlas/shared';
import type { CleanValue } from '../../domain/table';
import { sliceText } from '../../domain/text';
import type { DocumentIndex } from '../ports/DocumentIndex';

/** The classifier never sees more than this much of a document. */
export const MAX_CLASSIFICATION_CHARS = 6_000;
/** Only the opening pages of a PDF: title page, parties and recitals are there. */
export const CLASSIFICATION_PAGES = 3;
/** Rows read from the top of a sheet that holds no table, such as a cover or notes sheet. */
export const SHEET_TOP_ROWS = 5;

const MAX_ROW_CHARS = 300;

/**
 * The text the classifier reads for one document: the first three pages of a PDF, or for a workbook its sheet
 * names and the title and headers of each table, never its data rows. Capped at MAX_CLASSIFICATION_CHARS;
 * null when the document has nothing to read.
 */
export function classificationInput(document: DocumentSummary, index: DocumentIndex): string | null {
  const body = document.kind === 'pdf' ? pdfText(document, index) : document.kind === 'excel' ? workbookText(document, index) : '';
  if (body.trim() === '') return null;
  return sliceText(`File: ${document.name}\n\n${body}`, MAX_CLASSIFICATION_CHARS);
}

function pdfText(document: DocumentSummary, index: DocumentIndex): string {
  return index
    .readPages(document.path, 1, CLASSIFICATION_PAGES)
    .filter((page) => page.text.trim() !== '')
    .map((page) => `--- Page ${page.number} ---\n${page.text.trim()}`)
    .join('\n\n');
}

/** Sheet names, then each table's title rows and header; a sheet with no table shows its top rows instead. */
function workbookText(document: DocumentSummary, index: DocumentIndex): string {
  if (document.sheets.length === 0) return '';
  const parts = [`Sheets: ${document.sheets.join(', ')}`];
  for (const table of document.tables) {
    const title = table.title === null ? '' : `, title "${table.title}"`;
    const currency = table.currency === null ? '' : `, currency ${table.currency}`;
    const headers = table.columns.map((column) => column.label).join(' | ');
    parts.push(`Table on sheet "${table.sheet ?? '?'}"${title}${currency}, ${table.rowCount} rows, columns: ${headers}`);
  }
  const withTables = new Set(document.tables.map((table) => table.sheet));
  for (const sheet of document.sheets.filter((name) => !withTables.has(name))) {
    const rows = index
      .sheetRows(document.path, sheet, 1, SHEET_TOP_ROWS)
      .rows.map((row) => ({ number: row.rowNumber, text: rowText(row.cells) }))
      .filter((row) => row.text !== '');
    if (rows.length > 0) parts.push(`Sheet "${sheet}", no table, top rows:\n${rows.map((row) => `row ${row.number}: ${row.text}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

function rowText(cells: CleanValue[]): string {
  const text = cells
    .filter((cell) => cell !== null && String(cell).trim() !== '')
    .map((cell) => String(cell).replace(/\s+/g, ' ').trim())
    .join(' | ');
  return sliceText(text, MAX_ROW_CHARS);
}
