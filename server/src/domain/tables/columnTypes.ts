import type { ColumnType } from '@atlas/shared';
import type { RawCell } from '../document';
import type { CleanValue, ColumnRole } from '../table';
import { cellNumber, cellText, isBlank } from './cellText';

/** Share of a column's non-empty cells that must read as numbers for it to be a number column. */
const NUMBER_SHARE = 0.8;
/** Always text, even when the cells look like numbers: item "1.10" is not 1.1. */
const TEXT_ROLES: ReadonlySet<ColumnRole> = new Set(['item_code', 'description', 'unit', 'currency']);

/**
 * 'number' when at least 80% of the column's non-empty cells read as numbers (with parseMoney or parseNumber),
 * 'integer' when those numbers are all whole, otherwise 'text'. Item code, description, unit and currency columns are text.
 */
export function columnType(cells: readonly RawCell[], role: ColumnRole | null = null): ColumnType {
  if (role !== null && TEXT_ROLES.has(role)) return 'text';
  let filled = 0;
  let numbers = 0;
  let whole = true;
  for (const cell of cells) {
    if (isBlank(cell)) continue;
    filled++;
    const parsed = cellNumber(cell);
    if (parsed === null) continue;
    numbers++;
    if (!Number.isInteger(parsed.amount)) whole = false;
  }
  if (filled === 0 || numbers < NUMBER_SHARE * filled) return 'text';
  return whole ? 'integer' : 'number';
}

/** The value stored for a cell: in a number column the number ("SAR 1.2M" is 1200000, "Included" is null), else the text. */
export function cleanValue(cell: RawCell, type: ColumnType): CleanValue {
  if (isBlank(cell)) return null;
  if (type === 'text') return cellText(cell);
  return cellNumber(cell)?.amount ?? null;
}
