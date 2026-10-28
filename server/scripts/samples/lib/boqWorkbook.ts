import ExcelJS from 'exceljs';
import { FOOTER_TEXT, project } from '../project';
import { HEADER_ROWS, type BillLayout, type BoqLayout, type SummaryLayout } from './boqLayout';
import { day, longDate } from './dates';
import { setZipDates } from './zipDates';

const MONEY = '#,##0.00';
const WHOLE = '#,##0';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EAEE' } };
const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } };
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB8BEC6' } };
const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const A4 = 9 as ExcelJS.PaperSize;

/** Writes a BOQ revision as an .xlsx: a Summary sheet and one sheet per bill, formulas with cached results. */
export async function writeBoqWorkbook(layout: BoqLayout): Promise<Uint8Array> {
  const { revision } = layout;
  const issued = day(revision.issueDate);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Atlas sample generator';
  workbook.lastModifiedBy = 'Atlas sample generator';
  workbook.created = issued;
  workbook.modified = issued;
  workbook.title = `${project.name} - Bill of Quantities - Phase 1 - Revision ${revision.revision}`;
  workbook.description = FOOTER_TEXT;

  const titles = [
    project.name,
    'Bill of Quantities - Phase 1',
    `Revision ${revision.revision}`,
    `Date: ${longDate(issued)}`,
  ];
  writeSummary(addSheet(workbook, 'Summary', [10, 66, 22]), layout.summary, titles, revision.currency);
  for (const bill of layout.bills) {
    writeBill(addSheet(workbook, bill.bill.sheet, [10, 60, 8, 12, 15, 18]), bill, titles, revision.currency);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return setZipDates(new Uint8Array(buffer as ArrayBuffer), issued);
}

function addSheet(workbook: ExcelJS.Workbook, name: string, widths: number[]): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    pageSetup: { paperSize: A4, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L&8${FOOTER_TEXT}&R&8Page &P of &N` },
  });
  sheet.columns = widths.map((width) => ({ width }));
  return sheet;
}

function writeTitles(sheet: ExcelJS.Worksheet, titles: string[], lastColumn: string): void {
  titles.forEach((title, index) => {
    const row = index + 1;
    sheet.mergeCells(`A${row}:${lastColumn}${row}`);
    const cell = sheet.getCell(`A${row}`);
    cell.value = title;
    cell.font = { bold: index < 2, size: index === 0 ? 14 : 11 };
  });
}

function writeBill(sheet: ExcelJS.Worksheet, layout: BillLayout, titles: string[], currency: string): void {
  writeTitles(sheet, titles, 'F');
  const [top, bottom] = HEADER_ROWS;
  for (const [column, label] of [['A', 'Item'], ['B', 'Description'], ['C', 'Unit'], ['D', 'Qty']] as const) {
    sheet.mergeCells(`${column}${top}:${column}${bottom}`);
    sheet.getCell(`${column}${top}`).value = label;
  }
  sheet.mergeCells(`E${top}:F${top}`);
  sheet.getCell(`E${top}`).value = `Rates and Amounts (${currency})`;
  sheet.getCell(`E${bottom}`).value = 'Rate';
  sheet.getCell(`F${bottom}`).value = 'Amount';
  for (const row of HEADER_ROWS) styleRow(sheet, row, 6, { bold: true, fill: HEADER_FILL, center: true });
  sheet.views = [{ state: 'frozen', ySplit: bottom }];

  for (const line of layout.lines) {
    const row = sheet.getRow(line.row);
    switch (line.kind) {
      case 'section':
        row.getCell(2).value = line.text;
        styleRow(sheet, line.row, 6, { bold: true, fill: SECTION_FILL });
        break;
      case 'item':
        row.getCell(1).value = line.item.code;
        row.getCell(2).value = line.item.description;
        row.getCell(3).value = line.item.unit;
        row.getCell(4).value = line.item.quantity;
        row.getCell(5).value = line.item.rate;
        row.getCell(6).value = line.formula === null ? line.amount : { formula: line.formula, result: line.amount };
        styleRow(sheet, line.row, 6, {});
        break;
      case 'subtotal':
      case 'total':
        row.getCell(2).value = line.text;
        row.getCell(6).value = { formula: line.formula, result: line.value };
        styleRow(sheet, line.row, 6, { bold: true, fill: line.kind === 'total' ? HEADER_FILL : undefined });
        break;
    }
    row.getCell(4).numFmt = line.kind === 'item' && !Number.isInteger(line.item.quantity) ? MONEY : WHOLE;
    row.getCell(5).numFmt = MONEY;
    row.getCell(6).numFmt = MONEY;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'top' };
  }
  writeFooter(sheet, layout.footerRow);
}

function writeSummary(sheet: ExcelJS.Worksheet, summary: SummaryLayout, titles: string[], currency: string): void {
  writeTitles(sheet, titles, 'C');
  const header = sheet.getRow(summary.headerRow);
  header.values = ['Bill No.', 'Description', `Amount (${currency})`];
  styleRow(sheet, summary.headerRow, 3, { bold: true, fill: HEADER_FILL, center: true });
  for (const line of summary.lines) {
    const row = sheet.getRow(line.row);
    row.getCell(1).value = line.bill.number;
    row.getCell(2).value = `Bill ${line.bill.number} - ${line.bill.title}`;
    row.getCell(3).value = { formula: line.formula, result: line.value };
    row.getCell(3).numFmt = MONEY;
    row.getCell(1).alignment = { horizontal: 'center' };
    styleRow(sheet, line.row, 3, {});
  }
  const total = sheet.getRow(summary.totalRow);
  total.getCell(2).value = summary.totalText;
  total.getCell(3).value = { formula: summary.totalFormula, result: summary.total };
  total.getCell(3).numFmt = MONEY;
  styleRow(sheet, summary.totalRow, 3, { bold: true, fill: HEADER_FILL });
  writeFooter(sheet, summary.footerRow);
}

function writeFooter(sheet: ExcelJS.Worksheet, row: number): void {
  const cell = sheet.getCell(`A${row}`);
  cell.value = FOOTER_TEXT;
  cell.font = { italic: true, size: 8, color: { argb: 'FF6B6B75' } };
}

interface RowStyle {
  bold?: boolean;
  fill?: ExcelJS.Fill | undefined;
  center?: boolean;
}

function styleRow(sheet: ExcelJS.Worksheet, rowNumber: number, columns: number, style: RowStyle): void {
  const row = sheet.getRow(rowNumber);
  for (let column = 1; column <= columns; column++) {
    const cell = row.getCell(column);
    cell.border = BOX;
    if (style.bold) cell.font = { bold: true };
    if (style.fill) cell.fill = style.fill;
    cell.alignment = style.center
      ? { horizontal: 'center', vertical: 'middle', wrapText: true }
      : { vertical: 'top', wrapText: column === 2 };
  }
}
