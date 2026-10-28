/** A finite number as an integer count of 10^-scale units, taken from its shortest decimal form. */
interface Decimal {
  units: bigint;
  scale: number;
}

function toDecimal(value: number): Decimal | null {
  if (!Number.isFinite(value)) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(value));
  if (match === null) return null;
  const [, sign = '', whole = '', fraction = '', exponent = '0'] = match;
  const scale = fraction.length - Number(exponent);
  const units = BigInt(`${sign}${whole}${fraction}`);
  return scale >= 0 ? { units, scale } : { units: units * 10n ** BigInt(-scale), scale: 0 };
}

/**
 * Adds numbers as exact decimals, so 0.1 + 0.2 is 0.3 and a 10,000-row column sums to the cent.
 * Falls back to plain addition when a value is NaN or infinite.
 */
export function sumExact(values: readonly number[]): number {
  const decimals: Decimal[] = [];
  for (const value of values) {
    const decimal = toDecimal(value);
    if (decimal === null) return values.reduce((total, next) => total + next, 0);
    decimals.push(decimal);
  }
  const scale = decimals.reduce((largest, decimal) => Math.max(largest, decimal.scale), 0);
  let units = 0n;
  for (const decimal of decimals) units += decimal.units * 10n ** BigInt(scale - decimal.scale);
  return Number(`${units}e-${scale}`);
}
