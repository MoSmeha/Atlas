import type ExcelJS from 'exceljs';
import { parseCellRange } from '../../domain/cellRange';
import type { MergedRange, RawCell, SheetGrid } from '../../domain/document';
import { rawCellValue } from './cellValue';

/** Cells one sheet may hold in memory; a stray value far down a sheet would otherwise make a huge empty grid. */
export const MAX_SHEET_CELLS = 2_000_000;

export interface SheetGridResult {
  grid: SheetGrid;
  /** The last row read when the sheet was too large to read in full, otherwise null. */
  truncatedAtRow: number | null;
}

/**
 * One worksheet as a dense grid from row 1 and column A to the last cell with a value, with its merged ranges
 * sorted top to bottom, then left to right. Merges whose top-left cell is empty carry nothing and are left out;
 * the others count towards the grid's size.
 */
export function sheetGrid(worksheet: ExcelJS.Worksheet, maxCells: number = MAX_SHEET_CELLS): SheetGridResult {
  const values = collectValues(worksheet);
  let merges = worksheet.model.merges
    .map(parseCellRange)
    .filter((merge): merge is MergedRange => merge !== null && (values[merge.top - 1]?.[merge.left - 1] ?? null) !== null)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  let rowCount = merges.reduce((last, merge) => Math.max(last, merge.bottom), values.length);
  let columnCount = usedColumns(values, merges, rowCount);
  let truncatedAtRow: number | null = null;
  if (rowCount * columnCount > maxCells) {
    rowCount = Math.max(1, Math.floor(maxCells / columnCount));
    truncatedAtRow = rowCount;
    merges = merges
      .filter((merge) => merge.top <= rowCount)
      .map((merge) => ({ ...merge, bottom: Math.min(merge.bottom, rowCount) }));
    columnCount = usedColumns(values, merges, rowCount);
  }

  const rows = Array.from({ length: rowCount }, (_, index) => denseRow(values[index], columnCount));
  return { grid: { name: worksheet.name, rows, merges }, truncatedAtRow };
}

/** Sparse rows of non-null values: values[r][c] is sheet row r + 1, column c + 1, so each length is its last used column. */
function collectValues(worksheet: ExcelJS.Worksheet): RawCell[][] {
  const values: RawCell[][] = [];
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell, columnNumber) => {
      const value = rawCellValue(cell);
      if (value === null) return;
      const target = (values[rowNumber - 1] ??= []);
      target[columnNumber - 1] = value;
    });
  });
  return values;
}

function usedColumns(values: RawCell[][], merges: MergedRange[], rowCount: number): number {
  let count = merges.reduce((last, merge) => Math.max(last, merge.right), 0);
  values.forEach((row, index) => {
    if (index < rowCount) count = Math.max(count, row.length);
  });
  return count;
}

function denseRow(source: RawCell[] | undefined, columnCount: number): RawCell[] {
  const row = new Array<RawCell>(columnCount).fill(null);
  source?.forEach((value, index) => {
    if (index < columnCount) row[index] = value;
  });
  return row;
}
