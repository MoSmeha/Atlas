import type { RawCell } from '../document';
import { foldArabic } from '../language';
import { cellText, isBlank, isValueCell } from './cellText';

const TOTAL_START =
  /^(?:grand\s+total|sub[\s-]?total|page\s+total|total|carried\s+(?:forward|over|to)|brought\s+forward|[bc]\s?\/\s?f)\b/i;
const TOTAL_END = /\b(?:sub[\s-]?total|total)\s*[:.]?$/i;
const CARRIED = /\b(?:carried|brought)\s+(?:forward|over)\b|\bcarried\s+to\s+(?:the\s+)?(?:summary|collection)\b/i;
/** Whole words on Arabic text folded with foldArabic: المجموع, الإجمالي, إجمالي, المرحل, المنقول. */
const ARABIC_TOTAL = /(?:^|\s)(?:ال)?(?:مجموع|اجمالي|مرحل|منقول)(?=\s|$|[:.،])/u;

/**
 * True for text that labels a total: "Total", "Sub-total", "Subtotal", "Grand Total", "Page total",
 * "Carried forward", "Carried to Summary", "Brought forward", "Bill 2 Total", المجموع, الإجمالي, إجمالي, المجموع الكلي.
 */
export function isTotalLabel(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (TOTAL_START.test(cleaned) || TOTAL_END.test(cleaned) || CARRIED.test(cleaned)) return true;
  return ARABIC_TOTAL.test(foldArabic(cleaned));
}

/**
 * A row that names a total in one of its text cells and leaves its `detailColumns` (unit and rate) empty,
 * so an item such as "Total station, robotic | nr | 2 | 85,000" stays a data row.
 */
export function isTotalRow(cells: readonly RawCell[], detailColumns: ReadonlySet<number> = new Set()): boolean {
  const label = cells.findIndex((cell) => typeof cell === 'string' && isTotalLabel(cell));
  if (label < 0) return false;
  return [...detailColumns].every((column) => column === label || isBlank(cells[column] ?? null));
}

/**
 * A row with text only in the `headingColumns` (the leading text columns such as item and description) and no
 * amounts, like "1.2 | Shoring and Piling": it names the section of the rows below instead of being data.
 */
export function isSectionHeading(cells: readonly RawCell[], headingColumns: ReadonlySet<number>): boolean {
  if (headingColumns.size === 0 || headingColumns.size >= cells.length) return false;
  let hasText = false;
  for (const [column, cell] of cells.entries()) {
    if (isBlank(cell)) continue;
    if (!headingColumns.has(column)) return false;
    if (typeof cell === 'string' && !isValueCell(cell)) hasText = true;
  }
  return hasText;
}

/** The section name a heading row gives: its cells joined with spaces, as in "1.2 Shoring and Piling". */
export function headingText(cells: readonly RawCell[]): string {
  return cells
    .map(cellText)
    .filter((text) => text !== '')
    .join(' ');
}
