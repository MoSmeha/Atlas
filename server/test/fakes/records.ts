import type { DocumentRecord } from '../../src/application/ports/DocumentIndex';
import type { CleanTable } from '../../src/domain/table';

/** A readable PDF record with the given page texts (page 1 first); one chunk per page. */
export function pdfRecord(path: string, pages: string[]): DocumentRecord {
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'pdf',
    status: 'ok',
    statusDetail: null,
    fingerprint: { mtimeMs: 1, size: 1000 },
    pageCount: pages.length,
    scannedPages: [],
    sheets: [],
    language: 'en',
    currencies: [],
    pages: pages.map((text, i) => ({ number: i + 1, text })),
    chunks: pages.map((text, i) => ({ page: i + 1, text })),
    tables: [],
    sheetRows: [],
  };
}

/** A readable workbook record holding the given tables. */
export function excelRecord(path: string, tables: CleanTable[]): DocumentRecord {
  const sheets = [...new Set(tables.map((table) => table.sheet ?? 'Sheet1'))];
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'excel',
    status: 'ok',
    statusDetail: null,
    fingerprint: { mtimeMs: 1, size: 1000 },
    pageCount: null,
    scannedPages: [],
    sheets,
    language: 'en',
    currencies: [...new Set(tables.map((table) => table.currency).filter((c): c is string => c !== null))],
    pages: [],
    chunks: [],
    tables,
    sheetRows: [],
  };
}

/** A small BOQ table: item_code, description, quantity, rate, amount, in SAR, starting at sheet row 5. */
export function boqTable(rows: [string, string, number, number, number][], sheet = 'Bill 1'): CleanTable {
  return {
    title: 'Bill of Quantities',
    sheet,
    pageFrom: null,
    pageTo: null,
    currency: 'SAR',
    columns: [
      { name: 'item_code', label: 'Item', type: 'text', role: 'item_code' },
      { name: 'description', label: 'Description', type: 'text', role: 'description' },
      { name: 'quantity', label: 'Qty', type: 'number', role: 'quantity' },
      { name: 'rate', label: 'Rate', type: 'number', role: 'rate' },
      { name: 'amount', label: 'Amount', type: 'number', role: 'amount' },
    ],
    rows: rows.map((values, i) => ({ values, sheetRow: 5 + i, page: null, isTotal: false, section: null })),
  };
}
