import { type CellValue, ExportRequest, type ExportResponse, type ResultTable, routes } from '@atlas/shared';
import { readJson, sendError, sendJson } from '../http';
import { PARAM, type Route, route } from '../router';
import { state } from '../state';

const EXPORTS_DIR = 'C:\\Users\\you\\Atlas\\.atlas\\exports';

const exported = new Map<string, ResultTable>();

/**
 * Exporting a result table and downloading it. The mock cannot write .xlsx, so an .xlsx
 * export downloads as CSV with the same rows; the reply is shaped exactly like the server's.
 */
export const exportRoutes: Route[] = [
  route('POST', routes.exports, async ({ req, res }) => {
    const parsed = ExportRequest.safeParse(await readJson(req));
    if (!parsed.success) return sendError(res, 'invalid_request', 'Say which result to export and as xlsx or csv.');
    const { sessionId, resultId, format } = parsed.data;
    const table = state.sessions.result(sessionId, resultId);
    if (!table) return sendError(res, 'result_not_found', `No saved result with id ${resultId} in this chat.`);
    const fileName = `${slug(table.title ?? 'atlas-result')}-${resultId}.${format}`;
    exported.set(fileName, table);
    const body: ExportResponse = { fileName, path: `${EXPORTS_DIR}\\${fileName}`, url: routes.exportFile(fileName) };
    sendJson(res, 200, body);
  }),

  route('GET', routes.exportFile(PARAM), ({ res, params: [fileName = ''] }) => {
    const table = exported.get(fileName);
    if (!table) return sendError(res, 'invalid_request', `No exported file named ${fileName}.`);
    const csvName = fileName.replace(/\.xlsx$/i, '.csv');
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${csvName}"`,
    });
    res.end(`\ufeff${toCsv(table)}`);
  }),
];

function toCsv(table: ResultTable): string {
  return [table.columns, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: CellValue): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'atlas-result';
}
