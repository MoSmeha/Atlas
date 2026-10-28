import type { NumberMention } from './numbers';

/** Unsigned values, sorted, so a written number can be looked up with its rounding tolerance. */
export type NumberPool = readonly number[];

export function numberPool(values: Iterable<number>): NumberPool {
  const magnitudes: number[] = [];
  for (const value of values) if (Number.isFinite(value)) magnitudes.push(Math.abs(value));
  return magnitudes.sort((a, b) => a - b);
}

/**
 * How far a value may be from a written number and still be that value written with the same precision:
 * half of the last written digit, so "1.25M" covers 1,245,000 to 1,255,000 and "1,250,000.00" covers half a cent.
 * Never looser than two significant digits, so "1M" does not cover 600,000.
 */
export function tolerance(mention: Pick<NumberMention, 'value' | 'decimals' | 'scale'>): number {
  const magnitude = Math.abs(mention.value);
  const lastDigit = 10 ** (mention.scale - mention.decimals);
  const twoDigits = magnitude > 0 ? 10 ** (Math.floor(Math.log10(magnitude)) - 1) : lastDigit;
  return Math.min(lastDigit, twoDigits) / 2 + magnitude * 8 * Number.EPSILON;
}

/**
 * True when the pool holds the written number, ignoring sign and formatting: 1250000 matches "1,250,000.00",
 * "SAR 1.25M" and "1.25 million". A percentage also matches its fraction, so "15%" matches 0.15.
 */
export function poolHas(pool: NumberPool, mention: Pick<NumberMention, 'value' | 'decimals' | 'scale' | 'percent'>): boolean {
  const target = Math.abs(mention.value);
  const allowed = tolerance(mention);
  if (anyWithin(pool, target, allowed)) return true;
  return mention.percent && anyWithin(pool, target / 100, allowed / 100);
}

/** Binary search for the first value at least target - allowed, then checks it is at most target + allowed. */
function anyWithin(pool: NumberPool, target: number, allowed: number): boolean {
  let low = 0;
  let high = pool.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((pool[middle] ?? 0) < target - allowed) low = middle + 1;
    else high = middle;
  }
  const found = pool[low];
  return found !== undefined && found <= target + allowed;
}
