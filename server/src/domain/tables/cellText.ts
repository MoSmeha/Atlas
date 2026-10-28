import type { RawCell } from '../document';
import { parseMoney, parseNumber, type ParsedMoney } from '../money';

/** Amounts are short; longer text is a description and never read as a number. */
const MAX_AMOUNT_LENGTH = 48;
const DIGIT_OR_ARABIC = /[0-9\p{Script=Arabic}]/u;

/** Excel keeps 15 significant digits; anything past that in a cached formula result is float noise (0.1 + 0.2). */
export function tidyNumber(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(15)) : value;
}

/** yyyy-mm-dd of the UTC date, since Excel dates are read as UTC midnight. Empty for an invalid date. */
export function isoDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** True for null and for text that is only spaces. */
export function isBlank(cell: RawCell): boolean {
  return cell === null || (typeof cell === 'string' && cell.trim() === '');
}

/** A cell as text: numbers without grouping, dates as yyyy-mm-dd, booleans as TRUE or FALSE, '' when empty. */
export function cellText(cell: RawCell): string {
  if (cell === null) return '';
  if (typeof cell === 'string') return cell.replace(/\s+/g, ' ').trim();
  if (typeof cell === 'number') return String(tidyNumber(cell));
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  return isoDate(cell);
}

/**
 * A cell as a number and the currency written with it: a number cell as is, or text such as "SAR 1.2M",
 * "1,250,000.00", "١٬٢٥٠٬٠٠٠ ر.س" or "12%" (0.12). Null for dates, booleans and any other text.
 */
export function cellNumber(cell: RawCell): ParsedMoney | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? { amount: tidyNumber(cell), currency: null } : null;
  if (typeof cell !== 'string' || cell.length > MAX_AMOUNT_LENGTH || !DIGIT_OR_ARABIC.test(cell)) return null;
  const money = parseMoney(cell);
  if (money !== null) return money;
  const percent = parseNumber(cell, { percent: true });
  return percent === null ? null : { amount: percent, currency: null };
}

/** Numbers, dates, booleans and text that reads as an amount: what fills a data row rather than a header. */
export function isValueCell(cell: RawCell): boolean {
  if (cell === null) return false;
  if (typeof cell === 'string') return cellNumber(cell) !== null;
  return typeof cell !== 'number' || Number.isFinite(cell);
}
