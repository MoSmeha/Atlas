/** How one result column shows its numbers. */
export interface NumberStyle {
  /** Thousands separators; off for codes, years and row numbers. */
  group: boolean;
  /** Decimals every number is padded to so the points line up. A number never loses digits it has. */
  fractionDigits: number;
}

export const groupedNumber: NumberStyle = { group: true, fractionDigits: 0 };

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * A number exactly as the server sent it, with thousands separators and padded decimals.
 * It is never rounded: 1234.567 stays 1,234.567. Values JavaScript writes in exponent form
 * (above 1e21 or below 1e-6) are shown as they are.
 */
export function formatNumber(value: number, style: NumberStyle = groupedNumber): string {
  const text = String(value);
  if (!PLAIN_NUMBER.test(text)) return text;
  const negative = text.startsWith('-');
  const [whole = '', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const digits = style.group ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  const decimals = fraction.padEnd(style.fractionDigits, '0');
  return `${negative ? '-' : ''}${digits}${decimals === '' ? '' : `.${decimals}`}`;
}

/** Digits after the decimal point, as the number is written. */
export function fractionDigits(value: number): number {
  const text = String(value);
  if (!PLAIN_NUMBER.test(text)) return 0;
  return text.split('.')[1]?.length ?? 0;
}
