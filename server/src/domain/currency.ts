import { sumExact } from './decimal';
import { foldArabic } from './language';

export const CURRENCY_CODES = ['SAR', 'USD', 'EUR', 'AED', 'GBP'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** The sumByCurrency key for amounts whose currency is not known. */
export const UNSPECIFIED_CURRENCY = 'UNSPECIFIED';

/** How documents write each currency. Matching ignores case, Arabic diacritics and hamza forms. */
export const CURRENCY_ALIASES: Record<CurrencyCode, readonly string[]> = {
  SAR: [
    'SAR', 'SR', 'S.R.', 'S.R', 'Saudi Riyal', 'Saudi Riyals', 'Riyal', 'Riyals',
    'ر.س', 'ر.س.', 'ريال', 'ريالا', 'ريالات', 'ريال سعودي', 'ريالات سعودية',
    '\uFDFC', // RIAL SIGN
    '\u20C1', // SAUDI RIYAL SIGN
  ],
  USD: [
    'USD', 'US$', '$', 'US Dollar', 'US Dollars', 'U.S. Dollar', 'U.S. Dollars',
    'دولار أمريكي', 'دولارات أمريكية', 'الدولار الأمريكي',
  ],
  EUR: ['EUR', '€', 'Euro', 'Euros', 'يورو'],
  AED: ['AED', 'Dirham', 'Dirhams', 'UAE Dirham', 'UAE Dirhams', 'د.إ', 'درهم', 'دراهم', 'درهم إماراتي'],
  GBP: [
    'GBP', '£', 'Pound Sterling', 'Pounds Sterling', 'British Pound', 'British Pounds',
    'جنيه إسترليني', 'الجنيه الإسترليني',
  ],
};

/** Upper case only: "Sr." is "Senior", not riyals. */
const CASE_SENSITIVE = new Set(['SR', 'S.R.', 'S.R']);
/** "SR. NO." heads a serial-number column in many BOQs. */
const SERIAL_NUMBER = /(?<![A-Za-z])S\.?\s?R\.?\s*(?:NO|No|no|Number|NUMBER|#)(?![A-Za-z])\.?/g;

function aliasPattern(alias: string): string {
  const escaped = foldArabic(alias)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/ /g, '\\s+');
  return CASE_SENSITIVE.has(alias) ? `(?-i:${escaped})` : escaped;
}

const ALTERNATIVES = CURRENCY_CODES.map((code) => {
  const aliases = [...CURRENCY_ALIASES[code]].sort((a, b) => b.length - a.length);
  return `(?<${code}>${aliases.map(aliasPattern).join('|')})`;
}).join('|');
/** One alias with no Latin letter touching it, so "SAR" does not match inside "SARL" and "C$" is not dollars. */
const ALIAS = `(?<![A-Za-z])(?:${ALTERNATIVES})(?![A-Za-z])`;
/** A dot may close a Latin alias ("SR. 500") but never a symbol ("$.50" is half a dollar). */
const CLOSING_DOT = '(?:(?<=[A-Za-z])\\.)?';

const ANYWHERE = new RegExp(ALIAS, 'giu');
const LEADING = new RegExp(`^${ALIAS}${CLOSING_DOT}\\s*`, 'iu');
const TRAILING = new RegExp(`\\s*${ALIAS}${CLOSING_DOT}$`, 'iu');
const WHOLE = new RegExp(`^\\s*${ALIAS}${CLOSING_DOT}\\s*$`, 'iu');

function codeOf(match: RegExpExecArray): CurrencyCode {
  const code = CURRENCY_CODES.find((candidate) => match.groups?.[candidate] !== undefined);
  if (code === undefined) throw new Error('Currency pattern matched without a currency group.');
  return code;
}

/** True only for a canonical code such as "SAR"; use currencyCode for aliases like "SR". */
export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

/** The code for a currency written on its own, such as "SR", "US$" or "ريال"; null when the text is anything else. */
export function currencyCode(text: string): CurrencyCode | null {
  const match = WHOLE.exec(foldArabic(text));
  return match === null ? null : codeOf(match);
}

/** Every currency the text mentions, in order of first mention. */
export function detectCurrencies(text: string): CurrencyCode[] {
  const found = new Set<CurrencyCode>();
  for (const match of foldArabic(text).replace(SERIAL_NUMBER, ' ').matchAll(ANYWHERE)) found.add(codeOf(match));
  return [...found];
}

/** The first currency the text mentions, for example SAR for "Amount (SR)" or "المبلغ بالريال"; null when there is none. */
export function detectCurrency(text: string): CurrencyCode | null {
  return detectCurrencies(text)[0] ?? null;
}

/** A currency at the very start of the text and what follows it (Arabic folded), as in "SAR 1,000". */
export function takeLeadingCurrency(text: string): { code: CurrencyCode; rest: string } | null {
  const folded = foldArabic(text);
  const match = LEADING.exec(folded);
  return match === null ? null : { code: codeOf(match), rest: folded.slice(match[0].length) };
}

/** A currency at the very end of the text and what precedes it (Arabic folded), as in "1,000 ريال". */
export function takeTrailingCurrency(text: string): { code: CurrencyCode; rest: string } | null {
  const folded = foldArabic(text);
  const match = TRAILING.exec(folded);
  return match === null ? null : { code: codeOf(match), rest: folded.slice(0, match.index) };
}

const TWO_DECIMALS = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'negative',
});

function groupKey(currency: string | null): string {
  if (currency === null) return UNSPECIFIED_CURRENCY;
  return currencyCode(currency) ?? (currency.trim().toUpperCase() || UNSPECIFIED_CURRENCY);
}

/**
 * Totals per currency; amounts in different currencies are never added together.
 * Aliases share a total ("SR" and "SAR" are both SAR) and amounts with no currency go under UNSPECIFIED.
 */
export function sumByCurrency(items: readonly { amount: number; currency: string | null }[]): Record<string, number> {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const key = groupKey(item.currency);
    const amounts = groups.get(key) ?? [];
    amounts.push(item.amount);
    groups.set(key, amounts);
  }
  return Object.fromEntries([...groups].map(([key, amounts]) => [key, sumExact(amounts)]));
}

/** "SAR 1,250,000.00": the currency code, then the amount grouped in thousands with two decimals. */
export function formatMoney(amount: number, currency: string | null): string {
  const number = TWO_DECIMALS.format(amount);
  if (currency === null || currency === UNSPECIFIED_CURRENCY) return number;
  return `${currencyCode(currency) ?? currency} ${number}`;
}
