import type { RawCell, SheetGrid } from '../document';
import { cellText, isBlank, isValueCell } from './cellText';

/** A rectangle of a sheet grid in 0-based, inclusive indices: grid.rows[top..bottom], columns left..right. */
export interface Area {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** What one row holds within an area's columns. A merged cell counts once, at its top-left cell. */
export interface RowProfile {
  filled: number;
  /** Non-empty cells that are text and do not read as numbers. */
  text: number;
  /** Numbers, dates, booleans and text amounts. */
  values: number;
}

const EMPTY: RowProfile = { filled: 0, text: 0, values: 0 };

/** The cell at grid indices; null outside the grid. */
export function cellAt(grid: SheetGrid, row: number, column: number): RawCell {
  return grid.rows[row]?.[column] ?? null;
}

/** Display text of each cell of one row within the area's columns. */
export function rowTexts(grid: SheetGrid, row: number, area: Area): string[] {
  const texts: string[] = [];
  for (let column = area.left; column <= area.right; column++) texts.push(cellText(cellAt(grid, row, column)));
  return texts;
}

/** One profile per grid row, counting only the area's columns; rows outside the area are empty. */
export function profileRows(grid: SheetGrid, area: Area): RowProfile[] {
  return grid.rows.map((row, index) => (index < area.top || index > area.bottom ? EMPTY : profileRow(row, area)));
}

export function profileAt(profiles: readonly RowProfile[], row: number): RowProfile {
  return profiles[row] ?? EMPTY;
}

function profileRow(row: readonly RawCell[], area: Area): RowProfile {
  let filled = 0;
  let values = 0;
  for (let column = area.left; column <= area.right; column++) {
    const cell = row[column] ?? null;
    if (isBlank(cell)) continue;
    filled++;
    if (isValueCell(cell)) values++;
  }
  return { filled, text: filled - values, values };
}
