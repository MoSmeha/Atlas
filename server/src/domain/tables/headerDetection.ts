import { currencyCode } from '../currency';
import type { MergedRange, SheetGrid } from '../document';
import type { ColumnRole } from '../table';
import { type Area, cellAt, profileAt, type RowProfile, rowTexts } from './area';
import { cellText, isBlank } from './cellText';
import { columnRole } from './columnRoles';

/** A table header: one row, or up to three when merged cells or currency rows continue it. */
export interface Header {
  /** Grid row indices of the first and last header row. */
  top: number;
  bottom: number;
  /** One label per column of the area, '' where the header is blank. A child label joins its parent: "Amount (SAR)". */
  labels: string[];
  /** One role per column of the area; each role goes to the first column that names it. */
  roles: (ColumnRole | null)[];
}

const MIN_TEXT_SHARE = 0.8;
/** Non-empty rows looked at below a header candidate. */
const LOOKAHEAD = 6;
/** Non-empty rows searched for the first header of an area. */
const MAX_SCAN = 40;
/** Rows with values after the last header candidate that end the search. */
const DATA_ROWS_TO_STOP = 3;
const MAX_HEADER_ROWS = 3;
/** Without recognised labels, the header is the first candidate at least this share as wide as the widest. */
const MIN_WIDTH_SHARE = 0.6;

/** Mostly text, with at least two text cells: what a header row looks like. */
export function looksLikeHeader(profile: RowProfile): boolean {
  return profile.text >= 2 && profile.text >= MIN_TEXT_SHARE * profile.filled;
}

/** Some of the next non-empty rows hold values, or at least two of them have two cells or more. */
export function hasDataBelow(profiles: readonly RowProfile[], row: number, bottom: number): boolean {
  let seen = 0;
  let wide = 0;
  for (let r = row + 1; r <= bottom && seen < LOOKAHEAD; r++) {
    const profile = profileAt(profiles, r);
    if (profile.filled === 0) continue;
    seen++;
    if (profile.values > 0) return true;
    if (profile.filled >= 2) wide++;
  }
  return wide >= 2;
}

/** How many different column roles the cells of one row name. */
export function roleCount(grid: SheetGrid, row: number, area: Area): number {
  return new Set(rowTexts(grid, row, area).map(columnRole).filter((role) => role !== null)).size;
}

/**
 * The header of the first table in the area. Title rows may sit above it. Among the mostly-text rows before the data
 * starts, the one naming the most column roles wins; without two roles, the first row about as wide as the widest.
 */
export function findHeader(grid: SheetGrid, profiles: readonly RowProfile[], area: Area): Header | null {
  const candidates: { row: number; roles: number; filled: number }[] = [];
  let scanned = 0;
  let dataRows = 0;
  for (let r = area.top; r <= area.bottom && scanned < MAX_SCAN; r++) {
    const profile = profileAt(profiles, r);
    if (profile.filled === 0) continue;
    scanned++;
    if (looksLikeHeader(profile) && hasDataBelow(profiles, r, area.bottom)) {
      candidates.push({ row: r, roles: roleCount(grid, r, area), filled: profile.filled });
      dataRows = 0;
    } else if (profile.values > 0 && candidates.length > 0) {
      dataRows++;
      if (dataRows >= DATA_ROWS_TO_STOP || candidates.some((candidate) => candidate.roles >= 2)) break;
    }
  }
  if (candidates.length === 0) return null;
  const mostRoles = Math.max(...candidates.map((candidate) => candidate.roles));
  const widest = Math.max(...candidates.map((candidate) => candidate.filled));
  const chosen =
    mostRoles >= 2
      ? candidates.find((candidate) => candidate.roles === mostRoles)
      : candidates.find((candidate) => candidate.filled >= MIN_WIDTH_SHARE * widest);
  return chosen === undefined ? null : headerAt(grid, profiles, area, chosen.row, area.top);
}

/**
 * The header around `row`: the row above joins when this row continues it, and up to two rows below join when they
 * continue it. Merged header cells fill across their span; `floor` is the first row the header may use.
 */
export function headerAt(grid: SheetGrid, profiles: readonly RowProfile[], area: Area, row: number, floor: number): Header {
  let top = row;
  while (
    top - 1 >= floor &&
    row - top < MAX_HEADER_ROWS - 1 &&
    looksLikeHeader(profileAt(profiles, top - 1)) &&
    continuesHeader(grid, profiles, area, top - 1, top)
  ) {
    top--;
  }
  let bottom = row;
  while (bottom + 1 <= area.bottom && bottom - top < MAX_HEADER_ROWS - 1 && continuesHeader(grid, profiles, area, top, bottom + 1)) {
    bottom++;
  }
  const parts = columnParts(grid, area, top, bottom);
  const labels = parts.map(joinParts);
  return { top, bottom, labels, roles: assignRoles(parts, labels) };
}

/**
 * Whether `row` belongs to the header starting at `top`: it holds no values, and a merged header cell spans down into it,
 * a header cell merged across columns sits above two of its cells, or it only names currencies ("SAR" under "Amount").
 */
function continuesHeader(grid: SheetGrid, profiles: readonly RowProfile[], area: Area, top: number, row: number): boolean {
  const profile = profileAt(profiles, row);
  if (profile.filled === 0 || profile.values > 0) return false;
  const merges = headerMerges(grid, area, top, row - 1);
  if (merges.some((merge) => merge.bottom - 1 >= row)) return true;
  if (merges.some((merge) => merge.right > merge.left && filledUnder(grid, row, merge, area) >= 2)) return true;
  return rowTexts(grid, row, area).every((text) => text === '' || currencyCode(text) !== null || /^\(.*\)$/.test(text));
}

/** Merges whose top-left cell is in rows from..to and that reach into the area's columns. */
function headerMerges(grid: SheetGrid, area: Area, from: number, to: number): MergedRange[] {
  return grid.merges.filter(
    (merge) => merge.top - 1 >= from && merge.top - 1 <= to && merge.right - 1 >= area.left && merge.left - 1 <= area.right,
  );
}

function filledUnder(grid: SheetGrid, row: number, merge: MergedRange, area: Area): number {
  let count = 0;
  for (let column = Math.max(merge.left - 1, area.left); column <= Math.min(merge.right - 1, area.right); column++) {
    if (!isBlank(cellAt(grid, row, column))) count++;
  }
  return count;
}

/** Header text of each column from top to bottom, a merged cell repeated across its columns but not down its rows. */
function columnParts(grid: SheetGrid, area: Area, top: number, bottom: number): string[][] {
  const merges = headerMerges(grid, area, top, bottom);
  const parts: string[][] = [];
  for (let column = area.left; column <= area.right; column++) {
    const texts: string[] = [];
    for (let row = top; row <= bottom; row++) {
      const text = headerCellText(grid, merges, row, column);
      if (text !== '' && text !== texts.at(-1)) texts.push(text);
    }
    parts.push(texts);
  }
  return parts;
}

function headerCellText(grid: SheetGrid, merges: readonly MergedRange[], row: number, column: number): string {
  const own = cellText(cellAt(grid, row, column));
  if (own !== '') return own;
  const merge = merges.find(
    (m) => m.top - 1 <= row && row <= m.bottom - 1 && m.left - 1 <= column && column <= m.right - 1,
  );
  return merge !== undefined && merge.top - 1 === row ? cellText(cellAt(grid, row, merge.left - 1)) : '';
}

/** "Amount" over "SAR" gives "Amount (SAR)"; "Rates and Amounts" over "Rate" gives "Rates and Amounts - Rate". */
function joinParts(parts: readonly string[]): string {
  return parts.reduce((label, part) => {
    if (label === '') return part;
    if (currencyCode(part) !== null) return `${label} (${part})`;
    if (/^\(.*\)$/.test(part)) return `${label} ${part}`;
    return `${label} - ${part}`;
  }, '');
}

/** The most specific part decides a column's role, so "Rate" under "Rates and Amounts" is the rate. */
function assignRoles(parts: readonly string[][], labels: readonly string[]): (ColumnRole | null)[] {
  const used = new Set<ColumnRole>();
  return parts.map((columnParts, index) => {
    const role = [...columnParts].reverse().map(columnRole).find((found) => found !== null) ?? columnRole(labels[index] ?? '');
    if (role === null || used.has(role)) return null;
    used.add(role);
    return role;
  });
}
