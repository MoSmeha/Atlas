import { formatNumber } from './formatNumber';

/** "214 rows", "1 row", or "Showing 50 of 214 rows" when only some are on screen. */
export function rowCountText(shown: number, total: number): string {
  const rows = total === 1 ? 'row' : 'rows';
  if (shown >= total) return `${formatNumber(total)} ${rows}`;
  return `Showing ${formatNumber(shown)} of ${formatNumber(total)} ${rows}`;
}
