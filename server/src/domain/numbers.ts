import { normalizeDigits } from './money';

/** A number written in a text, such as an amount in an answer. */
export interface NumberMention {
  /** The number as written, with its sign, scale and percent sign: "(1,000)", "1.25M", "١٥٪". */
  text: string;
  /** Where the mention starts in the text. */
  index: number;
  /** The value, scaled: 1250000 for "1.25M", 15 for "15%", negative for "-3" and "(3)". */
  value: number;
  /** Digits written after the decimal separator: 2 for "1.25M". */
  decimals: number;
  /** Power of ten of the scale word or suffix: 6 for "1.25M", "1.25 million" and "1.25 مليون". */
  scale: number;
  percent: boolean;
  /** Written with thousands separators, as in "1,250". */
  grouped: boolean;
}

const GROUP_SPACES = '   ';
/** Letters and digits joined by single separators: "1,250,000.00", "1.25M", "BOQ-Phase1", "2026-10-28". */
const TOKEN = new RegExp(`[\\p{L}\\p{M}\\p{N}_]+(?:[-/:.,${GROUP_SPACES}][\\p{L}\\p{M}\\p{N}_]+)*`, 'gu');
const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
/** "1,250,000.75" and "1 250 000" (one kind of separator throughout), or plain "1250000.75". */
const ENGLISH = new RegExp(`^(?<whole>\\d{1,3}(?<sep>[,${GROUP_SPACES}])\\d{3}(?:\\k<sep>\\d{3})*|\\d+)(?:\\.(?<fraction>\\d+))?$`);
/** "1.250.000" and "3.400,50". A single dot is a decimal point, so "1.250" is English. */
const EUROPEAN = /^(?<whole>\d{1,3}(?:\.\d{3})+)(?:,(?<fraction>\d+))?$/;
/** Dates, times and ratios are not amounts: 2026-10-28, 28/10/2026, 10:30, 1:100. */
const DATE_LIKE = /^\d+(?:[/:]\d+)+$|^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{4}$/;
const RANGE = /^(?<from>\d[\d.,]*)-(?<to>\d[\d.,]*)$/;
/** A number with a currency or an Arabic proclitic glued before it and a unit or scale after it: SAR1,000, و5, 1.25M, 30-day. */
const AFFIXED = new RegExp(
  `^(?<prefix>[\\p{L}\\p{M}.${GROUP_SPACES}]*?)(?<body>\\d(?:[\\d.,${GROUP_SPACES}]*\\d)?)(?<suffix>-?[\\p{L}\\p{M}]+)?$`,
  'u',
);
/** One or two of و، ب، ل، ف، ك (and, with, for, so, as) glued to a number, with an optional tatweel: "وب٢٠٠". */
const PROCLITIC = /^[وبلفك]{1,2}ـ?$/u;
const CURRENCY_PREFIX = /^(?:SAR|SR\.?|USD|US\$|EUR|AED|GBP)[\s.]*$/u;
const SCALE_WORDS: readonly (readonly [power: number, pattern: string])[] = [
  [3, 'thousands?|ألف|الف|آلاف|الاف'],
  [6, 'millions?|mn|mln|مليون|ملايين'],
  [9, 'billions?|bn|bln|مليار|مليارات'],
];
const SCALE_AFTER = new RegExp(
  `^[ ${GROUP_SPACES}]?(?:${SCALE_WORDS.map(([power, words]) => `(?<p${power}>${words})`).join('|')})(?![\\p{L}\\p{M}\\p{N}_])`,
  'iu',
);
/** "%", "٪", "percent", "بالمئة" and "في المائة" after a number. */
const PERCENT_AFTER = new RegExp(
  `^[ ${GROUP_SPACES}]?(?:%|٪|per ?cent(?![\\p{L}])|بالم(?:ئ|ائ)ة|في الم(?:ئ|ائ)ة)`,
  'iu',
);
/** Numbers inside any text, grouped ones whole, for the generous evidence side: "B2-005" gives 2 and 5. */
const DIGIT_RUN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

interface Numeric {
  /** Plain decimal digits, as in "1250000.75". */
  decimal: string;
  decimals: number;
  grouped: boolean;
}

/** Where a number's digits are in the text and what is glued to them. */
interface Span {
  start: number;
  end: number;
  numeric: Numeric;
  /** Scale of a glued suffix such as "M"; null when there is no suffix, 0 for a unit such as "mm". */
  suffixScale: number | null;
  /** False when a currency or proclitic is glued before the digits, so no sign can precede them. */
  bare: boolean;
}

/**
 * Every number written in a text, in order: grouped and decimal numbers, Arabic-Indic digits, scale words
 * and suffixes ("1.2M", "3 million", "1.5 مليون"), percentages, and negatives written "-3" or "(1,000)".
 * Item codes, versions, dates and times are not numbers: "A-12", "Rev2", "3.2.1", "2026-10-28" and "10:30" give nothing.
 */
export function extractNumbers(text: string): NumberMention[] {
  const normal = normalizeDigits(text);
  const mentions: NumberMention[] = [];
  for (const match of normal.matchAll(TOKEN)) {
    if (!/\d/.test(match[0])) continue;
    for (const span of spansOf(match[0], match.index)) mentions.push(mention(text, normal, span));
  }
  return mentions;
}

/**
 * Every number a JSON value holds: number values, and every number written inside its strings, including
 * those inside codes and dates. A percentage also counts as a fraction, so "15%" gives 15 and 0.15. Keys are skipped.
 */
export function numbersFromValue(value: unknown): number[] {
  const found: number[] = [];
  collect(value, found);
  return found;
}

function collect(value: unknown, found: number[]): void {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) found.push(value);
  } else if (typeof value === 'string') {
    collectText(value, found);
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, found);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collect(item, found);
  }
}

function collectText(text: string, found: number[]): void {
  if (!/[\d٠-٩۰-۹]/.test(text)) return;
  for (const mention of extractNumbers(text)) {
    found.push(mention.value);
    if (mention.percent) found.push(mention.value / 100);
  }
  for (const run of normalizeDigits(text).matchAll(DIGIT_RUN)) found.push(Number(run[0].replaceAll(',', '')));
}

function spansOf(token: string, start: number): Span[] {
  if (DATE_LIKE.test(token)) return [];
  const range = RANGE.exec(token);
  if (range?.groups) {
    const from = readNumeric(range.groups.from ?? '');
    const to = readNumeric(range.groups.to ?? '');
    if (from === null || to === null) return [];
    const middle = start + (range.groups.from ?? '').length;
    return [
      { start, end: middle, numeric: from, suffixScale: 0, bare: true },
      { start: middle + 1, end: start + token.length, numeric: to, suffixScale: null, bare: false },
    ];
  }
  const parts = AFFIXED.exec(token)?.groups;
  if (parts === undefined) return [];
  const prefix = parts.prefix ?? '';
  if (prefix !== '' && !CURRENCY_PREFIX.test(prefix) && !PROCLITIC.test(prefix)) return [];
  const numeric = readNumeric(parts.body ?? '');
  if (numeric === null) return [];
  const suffixScale = parts.suffix === undefined ? null : scaleOfSuffix(parts.suffix);
  return [{ start: start + prefix.length, end: start + token.length, numeric, suffixScale, bare: prefix === '' }];
}

function readNumeric(body: string): Numeric | null {
  const groups = (ENGLISH.exec(body) ?? EUROPEAN.exec(body))?.groups;
  if (groups?.whole === undefined) return null;
  const whole = groups.whole.replace(/\D/g, '');
  const fraction = groups.fraction ?? '';
  return {
    decimal: fraction === '' ? whole : `${whole}.${fraction}`,
    decimals: fraction.length,
    grouped: whole.length !== groups.whole.length,
  };
}

/** "M", "mn" and "mln" are millions, "bn" billions, "k" thousands. Lower-case "m" is metres, so any other suffix is a unit. */
function scaleOfSuffix(suffix: string): number {
  if (suffix === 'M' || /^(?:mn|mln)$/i.test(suffix)) return 6;
  if (/^(?:bn|bln)$/i.test(suffix)) return 9;
  if (/^k$/i.test(suffix)) return 3;
  return 0;
}

function scaleOfWord(match: RegExpExecArray): number {
  return SCALE_WORDS.find(([power]) => match.groups?.[`p${power}`] !== undefined)?.[0] ?? 0;
}

function mention(original: string, normal: string, span: Span): NumberMention {
  let { start, end } = span;
  let scale = span.suffixScale ?? 0;
  let percent = false;
  if (span.suffixScale === null) {
    const after = normal.slice(end, end + 24);
    const word = SCALE_AFTER.exec(after);
    const percentSign = word === null ? PERCENT_AFTER.exec(after) : null;
    if (word !== null) {
      scale = scaleOfWord(word);
      end += word[0].length;
    } else if (percentSign !== null) {
      percent = true;
      end += percentSign[0].length;
    }
  }

  let negative = false;
  const before = normal[start - 1] ?? '';
  if (span.bare && (before === '-' || before === '−') && !WORD_CHAR.test(normal[start - 2] ?? '')) {
    negative = true;
    start -= 1;
  } else if (span.bare && before === '(' && normal[end] === ')' && !percent && scale === 0) {
    negative = true;
    start -= 1;
    end += 1;
  }

  const magnitude = Number(`${span.numeric.decimal}e${scale}`);
  return {
    text: original.slice(start, end),
    index: start,
    value: negative && magnitude !== 0 ? -magnitude : magnitude,
    decimals: span.numeric.decimals,
    scale,
    percent,
    grouped: span.numeric.grouped,
  };
}
