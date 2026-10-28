/** Money arithmetic in halalas (1/100 riyal) so totals never drift. */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Quantity times rate, rounded to two decimals as a BOQ shows it. */
export function lineAmount(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100) / 100;
}

export function sumAmounts(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + toCents(amount), 0) / 100;
}

const TWO_DECIMALS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "187,462,350.00". */
export function formatAmount(amount: number): string {
  return TWO_DECIMALS.format(amount);
}
