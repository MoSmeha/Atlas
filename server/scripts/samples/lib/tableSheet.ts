import type ExcelJS from 'exceljs';
import { BOX, HEADER_FILL, MONEY } from './workbook';

export interface Column<T> {
  header: string;
  width: number;
  /** The cell value for one data row; `row` is the Excel row number, for formulas. */
  value: (item: T, row: number) => ExcelJS.CellValue;
  numFmt?: string;
}

/** Where one table sits on a sheet. Rows are 1-based, as Excel shows them. */
export interface TableRows {
  titleRow: number | null;
  headerRow: number;
  firstRow: number;
  lastRow: number;
  totalRow: number | null;
  /** The first row after the table. */
  end: number;
}

export interface TableTotal {
  label: string;
  /** 1-based columns: where the label goes and which column is summed. */
  labelColumn: number;
  sumColumn: number;
  value: number;
}

/** Decides the rows of a table of `count` data rows starting at `start`: optional title, header, data, optional total. */
export function placeTable(start: number, count: number, options: { title: boolean; total: boolean }): TableRows {
  const headerRow = options.title ? start + 1 : start;
  const firstRow = headerRow + 1;
  const lastRow = firstRow + count - 1;
  const totalRow = options.total ? lastRow + 1 : null;
  return { titleRow: options.title ? start : null, headerRow, firstRow, lastRow, totalRow, end: (totalRow ?? lastRow) + 1 };
}

/** "A" for 1, "H" for 8. */
export function columnLetter(column: number): string {
  if (column < 1 || column > 26) throw new Error(`Column ${column} is outside A to Z`);
  return String.fromCharCode(64 + column);
}

/** Project and document titles in column A, the first two bold. */
export function writeTitleBlock(sheet: ExcelJS.Worksheet, titles: readonly string[]): void {
  titles.forEach((title, index) => {
    const cell = sheet.getCell(`A${index + 1}`);
    cell.value = title;
    cell.font = { bold: index < 2, size: index === 0 ? 14 : 11 };
  });
}

export interface TableOptions {
  title?: string;
  total?: TableTotal;
  /** No borders or fills, like a raw system export. */
  plain?: boolean;
}

/** Writes a table at the rows `placeTable` chose. */
export function writeTable<T>(
  sheet: ExcelJS.Worksheet,
  rows: TableRows,
  columns: readonly Column<T>[],
  data: readonly T[],
  options: TableOptions = {},
): void {
  if (rows.lastRow - rows.firstRow + 1 !== data.length) throw new Error('Table rows and data do not match');
  if (rows.titleRow !== null) {
    const cell = sheet.getCell(`A${rows.titleRow}`);
    cell.value = options.title ?? '';
    cell.font = { bold: true, size: 11 };
  }
  const header = sheet.getRow(rows.headerRow);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true };
    if (!options.plain) {
      cell.fill = HEADER_FILL;
      cell.border = BOX;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  });
  data.forEach((item, index) => {
    const rowNumber = rows.firstRow + index;
    const row = sheet.getRow(rowNumber);
    columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = column.value(item, rowNumber);
      if (column.numFmt) cell.numFmt = column.numFmt;
      if (!options.plain) {
        cell.border = BOX;
        cell.alignment = { vertical: 'top', wrapText: typeof cell.value === 'string' && cell.value.length > 30 };
      }
    });
  });
  if (rows.totalRow !== null && options.total) writeTotal(sheet, rows, columns.length, options.total);
}

function writeTotal(sheet: ExcelJS.Worksheet, rows: TableRows, width: number, total: TableTotal): void {
  const row = sheet.getRow(rows.totalRow as number);
  const letter = columnLetter(total.sumColumn);
  row.getCell(total.labelColumn).value = total.label;
  row.getCell(total.sumColumn).value = { formula: `SUM(${letter}${rows.firstRow}:${letter}${rows.lastRow})`, result: total.value };
  row.getCell(total.sumColumn).numFmt = MONEY;
  for (let column = 1; column <= width; column++) {
    const cell = row.getCell(column);
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = BOX;
  }
}
