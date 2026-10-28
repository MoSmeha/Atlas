import ExcelJS from 'exceljs';
import type { Source } from '@atlas/shared';
import type { ExportableTable } from '../../application/ports/ResultExporter';
import type { CleanValue } from '../../domain/table';

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
const SOURCE_COLUMNS = ['File', 'Page', 'Sheet', 'Rows', 'Quote'];
/** Numbers in these columns are codes or positions, so they get no thousands separator. */
const PLAIN_NUMBER_COLUMN = /^_|(^|[_\s])(code|ref|no|number|id|row|rows|page|pages|year)$/i;

/** An Excel workbook with the rows on a "Result" sheet and where they came from on a "Sources" sheet. */
export async function buildWorkbook(table: ExportableTable): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Atlas';
  if (table.title) workbook.title = table.title;

  addTableSheet(workbook, 'Result', table.columns, table.rows, true);
  const sourceRows = table.sources.length > 0 ? table.sources.map(sourceRow) : [['No sources were recorded for this result.']];
  addTableSheet(workbook, 'Sources', SOURCE_COLUMNS, sourceRows, false);

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

function addTableSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: string[],
  rows: CleanValue[][],
  formatNumbers: boolean,
): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(columns);
  sheet.addRows(rows);

  columns.forEach((header, i) => {
    const column = sheet.getColumn(i + 1);
    const values = rows.map((row) => row[i] ?? null);
    const format = formatNumbers ? numberFormat(header, values) : null;
    if (format) column.numFmt = format;
    column.width = columnWidth(header, values);
    if (column.width >= MAX_WIDTH) column.alignment = { vertical: 'top', wrapText: true };
  });

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEFF2' } };
  if (columns.length > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function sourceRow(source: Source): CleanValue[] {
  if (source.kind === 'pdf') return [source.document, source.page, null, null, source.quote];
  const rows = source.rowFrom === source.rowTo ? `${source.rowFrom}` : `${source.rowFrom}-${source.rowTo}`;
  return [source.document, null, source.sheet, rows, null];
}

function numberFormat(header: string, values: CleanValue[]): string | null {
  const numbers = values.filter((value): value is number => typeof value === 'number');
  if (numbers.length === 0 || PLAIN_NUMBER_COLUMN.test(header)) return null;
  return numbers.every(Number.isInteger) ? '#,##0' : '#,##0.00##';
}

function columnWidth(header: string, values: CleanValue[]): number {
  const longest = values.reduce<number>((max, value) => Math.max(max, displayLength(value)), header.length);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
}

function displayLength(value: CleanValue): number {
  if (value === null) return 0;
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 4 }).length;
  return value.split(/\r?\n/).reduce((max, line) => Math.max(max, line.length), 0);
}
