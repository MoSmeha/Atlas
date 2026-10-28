import { type CurrencyCode, takeLeadingCurrency, takeTrailingCurrency } from './currency';
import { foldArabic } from './language';

/** Zero-width and direction marks that PDF and Excel text often carries around Arabic numbers. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C]/g;
/** A leading minus (also the Unicode minus and the en dash PDFs use for it) or plus. */
const SIGN = /^([-+\u2212\u2013])\s*/;
/** Thousands groups with one separator used throughout: "1,250,000", "1.250.000", "1 250 000", "1'250'000". */
const GROUPED = /^\d{1,3}([,. '])\d{3}(?:\1\d{3})*$/;

export interface NumberOptions {
  /** Read "12%" as 0.12. Without it a percentage is not a number. */
  percent?: boolean;
}

/** Turns Arabic-Indic and Extended Arabic-Indic digits into ASCII, "٫" into "." and "٬" into ",". */
export function normalizeDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u066B\u066C\u06F0-\u06F9]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code === 0x066b) return '.';
    if (code === 0x066c) return ',';
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** ASCII digits, no invisible marks, single spaces, trimmed. */
function cleanNumberText(text: string): string {
  return normalizeDigits(text).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

/** Strips one layer of accounting parentheses or a leading sign. */
function unwrapSign(text: string): { body: string; negative: boolean } {
  if (text.startsWith('(') && text.endsWith(')')) return { body: text.slice(1, -1).trim(), negative: true };
  const sign = SIGN.exec(text);
  if (sign === null) return { body: text, negative: false };
  return { body: text.slice(sign[0].length), negative: sign[1] !== '+' };
}

/**
 * Which character is the decimal separator. With both "." and "," the last one is ("3.400,50").
 * A single "." is decimal; a single "," is decimal only before one or two digits ("3,5"), since "1,250" groups thousands.
 */
function decimalSeparator(text: string): '.' | ',' | null {
  const dot = text.lastIndexOf('.');
  const comma = text.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) return dot > comma ? '.' : ',';
  if (dot >= 0) return text.indexOf('.') === dot ? '.' : null;
  if (comma >= 0) return text.indexOf(',') === comma && /,\d{1,2}$/.test(text) ? ',' : null;
  return null;
}

/** An unsigned number with optional thousands groups, as a plain decimal string ("1250000.00"); null when the grouping is not valid. */
function readDecimal(text: string): string | null {
  if (!/^[\d.,' ]*\d[\d.,' ]*$/.test(text)) return null;
  const separator = decimalSeparator(text);
  const parts = separator === null ? [text] : text.split(separator);
  if (parts.length > 2) return null;
  const [whole = '', fraction] = parts;
  if (fraction !== undefined && !/^\d+$/.test(fraction)) return null;
  if (!/^\d*$/.test(whole) && !GROUPED.test(whole)) return null;
  const digits = whole.replace(/\D/g, '');
  return fraction === undefined ? digits : `${digits || '0'}.${fraction}`;
}

/** The double closest to decimal × 10^power, built from the digits so 1.2 million is exactly 1200000. */
function decimalToNumber(decimal: string, power: number, negative: boolean): number {
  const value = Number(`${decimal}e${power}`);
  return negative && value !== 0 ? -value : value;
}

/**
 * A plain number such as "1,250,000.00", "-3.5", "(1,000)" (-1000), "3.400,50" or "١٬٢٥٠٫٥".
 * Null for anything else, including "12%" unless `percent` is set.
 */
export function parseNumber(text: string, options: NumberOptions = {}): number | null {
  let rest = cleanNumberText(text);
  let power = 0;
  if (options.percent === true && /[%\u066A]$/.test(rest)) {
    rest = rest.slice(0, -1).trimEnd();
    power = -2;
  }
  const { body, negative } = unwrapSign(rest);
  const decimal = readDecimal(body);
  return decimal === null ? null : decimalToNumber(decimal, power, negative);
}

export interface ParsedMoney {
  amount: number;
  currency: CurrencyCode | null;
}

/** Scale words after an amount, by power of ten. Lower-case "m" is metres and "B" is often an item suffix, so neither is a scale. */
const SCALE_WORDS: readonly (readonly [power: number, words: string])[] = [
  [3, 'k|thousands?|ألف|آلاف'],
  [6, '(?-i:M)|mn|mln|millions?|مليون|ملايين'],
  [9, 'bn|bln|billions?|مليار|مليارات|بليون'],
];
const SCALE = new RegExp(
  `^(?<number>.*?)\\s*(?:${SCALE_WORDS.map(([power, words]) => `(?<p${power}>${foldArabic(words)})`).join('|')})$`,
  'iu',
);
const ARABIC = /\p{Script=Arabic}/u;

/** The unsigned amount, scaled. A bare Arabic scale word is one of it ("ألف ريال" is 1000), but only next to a currency. */
function readAmount(text: string, hasCurrency: boolean): number | null {
  const body = text.replace(/\s*\/-$/, '');
  const scaled = SCALE.exec(body);
  const power = scaled === null ? 0 : (SCALE_WORDS.find(([p]) => scaled.groups?.[`p${p}`] !== undefined)?.[0] ?? 0);
  const number = scaled === null ? body : (scaled.groups?.number ?? '');
  if (scaled !== null && number === '') return hasCurrency && ARABIC.test(scaled[0]) ? 10 ** power : null;
  const decimal = readDecimal(number);
  return decimal === null ? null : decimalToNumber(decimal, power, false);
}

/**
 * An amount with an optional currency and scale word, such as "SAR 1,250,000.00", "1.2M SAR", "(1,000)",
 * "EUR 3.400,50", "SR 1,000/-", "١٬٢٥٠٬٠٠٠ ر.س" or "1.5 مليون ريال". Null when the text is anything but one amount.
 * Never rounds: "1.2M" is exactly 1200000.
 */
export function parseMoney(text: string): ParsedMoney | null {
  const outer = unwrapSign(foldArabic(cleanNumberText(text)));
  const leading = takeLeadingCurrency(outer.body);
  const middle = unwrapSign(leading?.rest ?? outer.body);
  const trailing = takeTrailingCurrency(middle.body);
  const inner = unwrapSign(trailing?.rest.trim() ?? middle.body);
  if (leading !== null && trailing !== null && leading.code !== trailing.code) return null;
  const signs = [outer, middle, inner].filter((part) => part.negative).length;
  if (signs > 1) return null;
  const currency = leading?.code ?? trailing?.code ?? null;
  const amount = readAmount(inner.body, currency !== null);
  if (amount === null) return null;
  return { amount: signs === 1 && amount !== 0 ? -amount : amount, currency };
}
