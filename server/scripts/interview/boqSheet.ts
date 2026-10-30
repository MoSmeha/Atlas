import type ExcelJS from 'exceljs';
import type { BoqSection } from '../samples/lib/boqTypes';
import { lineAmount, sumAmounts } from '../samples/lib/money';
import { addSheet, BOX, HEADER_FILL, MONEY, SECTION_FILL, WHOLE, writeFooter } from '../samples/lib/workbook';

export interface SheetItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  /** The Excel row, 1-based. */
  row: number;
  section: string;
}

export interface BillSheet {
  sheet: string;
  headerRow: number;
  items: SheetItem[];
  subtotals: { section: string; row: number; value: number }[];
  total: number;
  totalRow: number;
  footerRow: number;
}

const QUANTITY_2DP = '#,##0.00';
const HEADERS = ['Item', 'Description', 'Unit', 'Qty', 'Rate (SAR)', 'Amount (SAR)'];

/**
 * Writes one priced bill as a plain table, in a different layout from the riyadh-tower BOQs: title rows, a one-row
 * header, section rows, items whose Amount is a Qty x Rate formula, a sub-total per section and one total.
 */
export function writeBillSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  titles: readonly string[],
  sections: readonly BoqSection[],
  totalLabel: string,
): BillSheet {
  const sheet = addSheet(workbook, name, [10, 64, 8, 12, 14, 18]);
  titles.forEach((title, index) => {
    const cell = sheet.getCell(`A${index + 1}`);
    cell.value = title;
    cell.font = { bold: index === 0, size: index === 0 ? 13 : 10 };
  });
  const headerRow = titles.length + 2;
  const header = sheet.getRow(headerRow);
  HEADERS.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
    cell.alignment = { horizontal: index >= 3 ? 'right' : 'left' };
  });

  let row = headerRow + 1;
  const items: SheetItem[] = [];
  const subtotals: BillSheet['subtotals'] = [];
  for (const section of sections) {
    const sectionRow = sheet.getRow(row);
    sectionRow.getCell(1).value = section.code;
    sectionRow.getCell(2).value = section.title;
    for (let column = 1; column <= HEADERS.length; column++) {
      sectionRow.getCell(column).font = { bold: true };
      sectionRow.getCell(column).fill = SECTION_FILL;
    }
    row++;
    const first = row;
    for (const item of section.items) {
      const amount = lineAmount(item.quantity, item.rate);
      const line = sheet.getRow(row);
      line.getCell(1).value = item.code;
      line.getCell(2).value = item.description;
      line.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      line.getCell(3).value = item.unit;
      line.getCell(4).value = item.quantity;
      line.getCell(4).numFmt = Number.isInteger(item.quantity) ? WHOLE : QUANTITY_2DP;
      line.getCell(5).value = item.rate;
      line.getCell(5).numFmt = MONEY;
      line.getCell(6).value = { formula: `D${row}*E${row}`, result: amount };
      line.getCell(6).numFmt = MONEY;
      for (let column = 1; column <= HEADERS.length; column++) line.getCell(column).border = BOX;
      items.push({
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        amount,
        row,
        section: section.code,
      });
      row++;
    }
    const last = row - 1;
    const value = sumAmounts(section.items.map((item) => lineAmount(item.quantity, item.rate)));
    const subtotal = sheet.getRow(row);
    subtotal.getCell(2).value = `Sub-total ${section.code} ${section.title}`;
    subtotal.getCell(2).font = { bold: true };
    subtotal.getCell(6).value = { formula: `SUM(F${first}:F${last})`, result: value };
    subtotal.getCell(6).numFmt = MONEY;
    subtotal.getCell(6).font = { bold: true };
    subtotals.push({ section: section.code, row, value });
    row += 2;
  }

  const total = sumAmounts(subtotals.map((subtotal) => subtotal.value));
  const totalRow = row;
  const totalLine = sheet.getRow(totalRow);
  totalLine.getCell(2).value = totalLabel;
  totalLine.getCell(6).value = { formula: subtotals.map((subtotal) => `F${subtotal.row}`).join('+'), result: total };
  totalLine.getCell(6).numFmt = MONEY;
  for (let column = 1; column <= HEADERS.length; column++) {
    const cell = totalLine.getCell(column);
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
  }
  const footerRow = totalRow + 2;
  writeFooter(sheet, footerRow);
  return { sheet: name, headerRow, items, subtotals, total, totalRow, footerRow };
}
