import { parseCellRange } from '../../../src/domain/cellRange';
import type { MergedRange, RawCell, SheetGrid } from '../../../src/domain/document';

/** A dense sheet grid from rows (row 1 first) and merged ranges in A1 notation, as ExcelJsReader builds it. */
export function sheet(rows: RawCell[][], merges: string[] = [], name = 'Sheet1'): SheetGrid {
  const width = rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  return {
    name,
    rows: rows.map((row) => [...row, ...new Array<RawCell>(width - row.length).fill(null)]),
    merges: merges.map((reference) => {
      const range = parseCellRange(reference);
      if (range === null) throw new Error(`Not a cell range: ${reference}`);
      return range satisfies MergedRange;
    }),
  };
}

/** The four title rows of the sample BOQs, each in column A. */
export const TITLE_ROWS: RawCell[][] = [
  ['Najd Gate Mixed-Use Tower'],
  ['Bill of Quantities - Phase 1'],
  ['Revision 0'],
  ['Date: 28 December 2025'],
];
