import type { SheetGrid } from '../document';
import { type Area, cellAt, profileAt, profileRows, type RowProfile, rowTexts } from './area';
import { cellText, isBlank, isValueCell } from './cellText';
import { findHeader, hasDataBelow, type Header, headerAt, looksLikeHeader, roleCount } from './headerDetection';
import { isTotalLabel } from './totalRows';

/** One table found on a sheet, before its rows are cleaned. */
export interface TableBlock {
  /** The table's columns, and its rows from the header to the last row. */
  area: Area;
  header: Header;
  /** Rows above the header that title the table. */
  titleRows: number[];
  /** Rows below the header that repeat it, for example after a page break; they hold no data. */
  repeatedHeaders: number[];
}

/** Text-only rows above a header that can be its title. */
const MAX_TITLE_ROWS = 4;
/** Non-empty rows looked at below a label to see whether its column holds values. */
const LOOKAHEAD = 6;

/**
 * Every table on a sheet. Tables side by side split at an empty column when each has its own header; tables stacked
 * on one sheet split where a new header starts, usually after an empty row and title rows.
 */
export function splitTables(grid: SheetGrid): TableBlock[] {
  return columnBands(grid).flatMap((band) => splitBand(grid, band, profileRows(grid, band)));
}

/** Runs of columns with any content, joined again unless both sides have their own, different header. */
function columnBands(grid: SheetGrid): Area[] {
  const width = grid.rows.reduce((widest, row) => Math.max(widest, row.length), 0);
  const used = new Array<boolean>(width).fill(false);
  for (const row of grid.rows) {
    row.forEach((cell, column) => {
      if (!isBlank(cell)) used[column] = true;
    });
  }
  const runs: Area[] = [];
  let start = -1;
  for (let column = 0; column <= width; column++) {
    if (column < width && used[column]) {
      if (start < 0) start = column;
    } else if (start >= 0) {
      runs.push({ top: 0, bottom: grid.rows.length - 1, left: start, right: column - 1 });
      start = -1;
    }
  }
  if (runs.length < 2) return runs;

  const bands: { area: Area; header: Header | null }[] = [];
  for (const run of runs) {
    const header = findHeader(grid, profileRows(grid, run), run);
    const previous = bands.at(-1);
    if (previous !== undefined && !separateTables(previous.header, header)) {
      previous.area = { ...previous.area, right: run.right };
      previous.header ??= header;
    } else {
      bands.push({ area: run, header });
    }
  }
  return bands.map((band) => band.area);
}

/** Side-by-side tables have headers on different rows, or repeat roles or labels; an empty spacer column does neither. */
function separateTables(left: Header | null, right: Header | null): boolean {
  if (left === null || right === null) return false;
  if (left.top !== right.top) return true;
  const roles = new Set(left.roles.filter((role) => role !== null));
  if (right.roles.some((role) => role !== null && roles.has(role))) return true;
  const labels = new Set(left.labels.filter((label) => label !== '').map((label) => label.toLowerCase()));
  return right.labels.some((label) => label !== '' && labels.has(label.toLowerCase()));
}

function splitBand(grid: SheetGrid, band: Area, profiles: readonly RowProfile[]): TableBlock[] {
  const first = findHeader(grid, profiles, band);
  if (first === null) return [];
  const blocks: TableBlock[] = [];
  let current = openBlock(band, first, filledRows(profiles, band.top, first.top - 1));
  /** Title rows of a new table are looked for below this row: the last header row, or the last repeat of it. */
  let floor = first.bottom;
  for (let row = first.bottom + 1; row <= band.bottom; row++) {
    if (!looksLikeHeader(profileAt(profiles, row))) continue;
    const titles = titlesAbove(grid, profiles, band, row, floor);
    const repeated = repeatedHeaderRows(grid, band, current.header, row);
    if (repeated.length > 0 && titles.rows.length === 0) {
      current.repeatedHeaders.push(...repeated);
      row = floor = repeated.at(-1) ?? row;
      continue;
    }
    if (repeated.length > 0 || startsTable(grid, profiles, band, row, titles)) {
      current.area.bottom = (titles.rows[0] ?? row) - 1;
      blocks.push(current);
      const header = headerAt(grid, profiles, band, row, row);
      current = openBlock(band, header, titles.rows);
      row = floor = header.bottom;
    }
  }
  current.area.bottom = band.bottom;
  blocks.push(current);
  return blocks;
}

function openBlock(band: Area, header: Header, titleRows: number[]): TableBlock {
  return { area: { ...band, top: header.top }, header, titleRows, repeatedHeaders: [] };
}

function filledRows(profiles: readonly RowProfile[], from: number, to: number): number[] {
  const rows: number[] = [];
  for (let row = from; row <= to; row++) if (profileAt(profiles, row).filled > 0) rows.push(row);
  return rows;
}

/** Title-like rows right above `row`, back to `floor` (exclusive), and whether an empty row comes between. */
function titlesAbove(
  grid: SheetGrid,
  profiles: readonly RowProfile[],
  band: Area,
  row: number,
  floor: number,
): { rows: number[]; gap: boolean } {
  const rows: number[] = [];
  let gap = false;
  for (let r = row - 1; r > floor; r--) {
    const profile = profileAt(profiles, r);
    if (profile.filled === 0) {
      gap = true;
      continue;
    }
    if (rows.length >= MAX_TITLE_ROWS || profile.values > 0 || profile.filled > 2) break;
    if (rowTexts(grid, r, band).some(isTotalLabel)) break;
    rows.unshift(r);
  }
  return { rows, gap };
}

/** The rows from `row` on that repeat the header row for row; empty when `row` does not repeat its first row. */
function repeatedHeaderRows(grid: SheetGrid, band: Area, header: Header, row: number): number[] {
  const rows: number[] = [];
  for (let offset = 0; offset <= header.bottom - header.top; offset++) {
    if (!sameTexts(rowTexts(grid, header.top + offset, band), rowTexts(grid, row + offset, band))) break;
    rows.push(row + offset);
  }
  return rows;
}

function sameTexts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text.toLowerCase() === (b[index] ?? '').toLowerCase());
}

/**
 * A header-like row starts a new table when data follows and it names two column roles, or when it comes after an
 * empty row or title rows and at least two different labels stand over columns of values.
 */
function startsTable(
  grid: SheetGrid,
  profiles: readonly RowProfile[],
  band: Area,
  row: number,
  titles: { rows: number[]; gap: boolean },
): boolean {
  if (!hasDataBelow(profiles, row, band.bottom)) return false;
  if (roleCount(grid, row, band) >= 2) return true;
  return (titles.gap || titles.rows.length > 0) && labelsOverValues(grid, profiles, band, row) >= 2;
}

/** How many different labels in `row` stand over columns whose next rows hold values, like "Date" over dates. */
function labelsOverValues(grid: SheetGrid, profiles: readonly RowProfile[], band: Area, row: number): number {
  const labels = new Set<string>();
  for (let column = band.left; column <= band.right; column++) {
    const cell = cellAt(grid, row, column);
    if (typeof cell !== 'string' || isBlank(cell) || isValueCell(cell)) continue;
    if (valueBelow(grid, profiles, band, row, column)) labels.add(cellText(cell).toLowerCase());
  }
  return labels.size;
}

function valueBelow(grid: SheetGrid, profiles: readonly RowProfile[], band: Area, row: number, column: number): boolean {
  let seen = 0;
  for (let r = row + 1; r <= band.bottom && seen < LOOKAHEAD; r++) {
    if (profileAt(profiles, r).filled === 0) continue;
    seen++;
    if (isValueCell(cellAt(grid, r, column))) return true;
  }
  return false;
}
