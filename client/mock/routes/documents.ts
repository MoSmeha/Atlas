import { type CellValue, SheetRowsQuery, routes } from '@atlas/shared';
import { findDocument } from '../data/documents';
import { pdfPages } from '../data/pages';
import { sheetGrid } from '../data/sheets';
import { sendError, sendJson } from '../http';
import { buildPdf } from '../pdf';
import { PARAM, type Route, route } from '../router';
import { state } from '../state';

/** Rows sent when the viewer does not ask for an end row. */
const DEFAULT_PAGE_ROWS = 100;
const MAX_PAGE_ROWS = 1_000;

/** The original PDF of a document, and raw sheet rows for the Excel viewer. */
export const documentRoutes: Route[] = [
  route('GET', routes.documentFile(PARAM), ({ res, params: [id = ''] }) => {
    const document = findDocument(state.workspace.status().documents, id);
    if (!document) return sendError(res, 'document_not_found', `No loaded document has the id ${id}.`);
    if (document.kind !== 'pdf' || (document.status !== 'ok' && document.status !== 'scanned')) {
      return sendError(res, 'document_not_found', `The mock serves only readable PDFs, and ${document.name} is not one.`);
    }
    const pdf = buildPdf(pdfPages(document));
    res.writeHead(200, {
      'content-type': 'application/pdf',
      'content-length': pdf.length,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
    });
    res.end(pdf);
  }),

  route('GET', routes.sheetRows(PARAM, PARAM), ({ res, url, params: [id = '', sheet = ''] }) => {
    const document = findDocument(state.workspace.status().documents, id);
    if (!document) return sendError(res, 'document_not_found', `No loaded document has the id ${id}.`);
    if (!document.sheets.includes(sheet)) {
      return sendError(res, 'document_not_found', `${document.name} has no sheet named "${sheet}".`);
    }
    const query = SheetRowsQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) return sendError(res, 'invalid_request', 'Rows are numbered from 1; check "from" and "to".');

    const grid = sheetGrid(document.path, sheet) ?? placeholderGrid(document.name);
    const from = query.data.from;
    const to = Math.min(query.data.to ?? from + DEFAULT_PAGE_ROWS - 1, from + MAX_PAGE_ROWS - 1, grid.length);
    const columnCount = Math.max(0, ...grid.map((row) => row.length));
    const rows = [];
    for (let rowNumber = from; rowNumber <= to; rowNumber++) {
      const cells = grid[rowNumber - 1] ?? [];
      rows.push({ rowNumber, cells: Array.from({ length: columnCount }, (_, i) => cells[i] ?? null) });
    }
    sendJson(res, 200, { document: document.path, sheet, columnCount, totalRows: grid.length, rows });
  }),
];

/** A few rows for an uploaded workbook, which the mock has no real data for. */
function placeholderGrid(name: string): CellValue[][] {
  return [
    ['Uploaded workbook', name],
    ['The mock server has no data for uploaded files.', null],
  ];
}
