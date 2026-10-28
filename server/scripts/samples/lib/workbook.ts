import ExcelJS from 'exceljs';
import { FOOTER_TEXT } from '../project';
import { setZipDates } from './zipDates';

export const MONEY = '#,##0.00';
export const WHOLE = '#,##0';
export const DATE = 'dd-mmm-yyyy';
export const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EAEE' } };
export const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } };
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB8BEC6' } };
export const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const A4 = 9 as ExcelJS.PaperSize;

/** A workbook with fixed metadata, so regenerating it gives the same bytes. */
export function createWorkbook(title: string, issued: Date): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Atlas sample generator';
  workbook.lastModifiedBy = 'Atlas sample generator';
  workbook.created = issued;
  workbook.modified = issued;
  workbook.title = title;
  workbook.description = FOOTER_TEXT;
  return workbook;
}

/** An A4 sheet that prints the fictional-document footer, with the given column widths. */
export function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  widths: number[],
  orientation: 'portrait' | 'landscape' = 'portrait',
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    pageSetup: { paperSize: A4, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L&8${FOOTER_TEXT}&R&8Page &P of &N` },
  });
  sheet.columns = widths.map((width) => ({ width }));
  return sheet;
}

/** The .xlsx bytes, with every zip entry dated `issued`. */
export async function saveWorkbook(workbook: ExcelJS.Workbook, issued: Date): Promise<Uint8Array> {
  const buffer = await workbook.xlsx.writeBuffer();
  return setZipDates(new Uint8Array(buffer as ArrayBuffer), issued);
}

/** The fictional-document note in column A of `row`. */
export function writeFooter(sheet: ExcelJS.Worksheet, row: number): void {
  const cell = sheet.getCell(`A${row}`);
  cell.value = FOOTER_TEXT;
  cell.font = { italic: true, size: 8, color: { argb: 'FF6B6B75' } };
}
