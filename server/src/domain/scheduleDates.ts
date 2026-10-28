import { foldArabic } from './language';
import { normalizeDigits } from './money';

/** A date or a length of time found in a sentence. */
export interface DateMention {
  kind: 'date' | 'duration';
  /** Offsets in the searched text. */
  start: number;
  end: number;
  /** The text as written, digits included. */
  text: string;
  /** yyyy-mm-dd, or yyyy-mm when only the month and year are given; null for Hijri-only dates and durations. */
  isoDate: string | null;
  /** A Hijri date exactly as written; never converted. */
  hijri: string | null;
  /** For durations, the length as written without "within": "28 calendar days", "٢٨ يوماً". */
  duration: string | null;
}

/** Arabic diacritics and tatweel, allowed after any Arabic letter. */
const MARKS = '[\\u064B-\\u065F\\u0670\\u0640]*';
/** Letters that documents write in several forms: alef with or without hamza, final yeh, teh marbuta. */
const ARABIC_VARIANTS: Record<string, string> = {
  'ا': '[\\u0627\\u0623\\u0625\\u0622\\u0671]',
  'ي': '[\\u064A\\u0649\\u06CC]',
  'ه': '[\\u0647\\u0629]',
  'ة': '[\\u0629\\u0647]',
  'ك': '[\\u0643\\u06A9]',
};

/** A pattern for an Arabic word or phrase that tolerates hamza and yeh forms, diacritics and tatweel. */
export function arabicPattern(phrase: string): string {
  return [...foldArabic(phrase)]
    .map((char) => {
      if (char === ' ') return '\\s+';
      if (!/\p{Script=Arabic}/u.test(char)) return escapeRegExp(char);
      return `${ARABIC_VARIANTS[char] ?? char}${MARKS}`;
    })
    .join('');
}

/** Folded form used to look up a matched Arabic month name. */
function arabicKey(text: string): string {
  return foldArabic(text).replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
}

const ENGLISH_MONTHS: string[][] = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sept', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
];

/** Egyptian and Gulf names first, then the Levantine ones. */
const ARABIC_MONTHS: string[][] = [
  ['يناير', 'كانون الثاني'],
  ['فبراير', 'شباط'],
  ['مارس', 'آذار'],
  ['أبريل', 'إبريل', 'نيسان'],
  ['مايو', 'أيار'],
  ['يونيو', 'يونية', 'حزيران'],
  ['يوليو', 'يولية', 'تموز'],
  ['أغسطس', 'آب'],
  ['سبتمبر', 'أيلول'],
  ['أكتوبر', 'تشرين الأول'],
  ['نوفمبر', 'تشرين الثاني'],
  ['ديسمبر', 'كانون الأول'],
];

const ARABIC_HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة', 'جمادى الثانية',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذي القعدة', 'ذو الحجة', 'ذي الحجة',
];

const APOSTROPHE = "[’'ʿ‘`]?";
const JOIN = '[\\s-]*';
const ENGLISH_HIJRI_MONTHS = [
  'Muharr?am',
  'Safar',
  `Rabi${APOSTROPHE}(?:${JOIN}(?:al|ul|el))?${JOIN}(?:Awwal|Awal|Thani|Thaani|Akhir|Akhar|II|I)`,
  `Jumad[ae]?${APOSTROPHE}(?:${JOIN}(?:al|ul|el))?${JOIN}(?:Awwal|Awal|Ula|Oula|Thani|Thaniyah|Akhirah|Akhira|Akhir|II|I)`,
  'Rajab',
  `Sha${APOSTROPHE}ban`,
  'Rama[dz]h?an',
  'Shaww?al',
  `(?:Dhu|Dhul|Zul|Dhi)${APOSTROPHE}(?:${JOIN}(?:al|l))?${JOIN}Q[ai]${APOSTROPHE}d[ae]h?`,
  `(?:Dhu|Dhul|Zul|Dhi)${APOSTROPHE}(?:${JOIN}(?:al|l))?${JOIN}Hijj?[ae]h?`,
];

const englishMonthNumber = new Map(ENGLISH_MONTHS.flatMap((names, i) => names.map((name) => [name, i + 1] as const)));
const arabicMonthNumber = new Map(ARABIC_MONTHS.flatMap((names, i) => names.map((name) => [arabicKey(name), i + 1] as const)));

const NOT_AFTER_WORD = '(?<![\\p{L}\\p{M}\\p{N}])';
const NOT_BEFORE_WORD = '(?![\\p{L}\\p{N}])';
/** Arabic years may carry a mark straight after the digits ("2026م"), so only a further digit ends them. */
const NO_DIGIT = '(?![\\p{N}])';
/** No digit, slash, dot or dash touching a numeric date, so "1.2.2026.4" and "12/03/2026/5" are not dates. */
const NUMERIC_BEFORE = '(?<![\\p{N}/.\\-])';
const NUMERIC_AFTER = '(?![\\p{N}]|[/.\\-]\\p{N})';
const ORDINAL = '(?:st|nd|rd|th)?';
const YEAR = '(\\d{4})';
const DAY = '(\\d{1,2})';
const EN_MONTH = `(${alternatives(ENGLISH_MONTHS.flat())})(?![\\p{L}])\\.?`;
const AR_MONTH = `(${ARABIC_MONTHS.flat().map(arabicPattern).join('|')})(?![\\p{L}])`;
const EN_HIJRI_MONTH = `(?:${ENGLISH_HIJRI_MONTHS.join('|')})(?![\\p{L}])`;
const AR_HIJRI_MONTH = `(?:${ARABIC_HIJRI_MONTHS.map(arabicPattern).join('|')})(?![\\p{L}])`;
const HIJRI_YEAR = '(1[3-5]\\d{2})';
/** "AH", "A.H." or "هـ" / "هجري" after a Hijri year. */
const HIJRI_MARK = `(?:\\s*(?:A\\.H\\.?|AH|${arabicPattern('هجرية')}|${arabicPattern('هجري')}|هـ?)(?![\\p{L}\\p{M}]))`;
/** "م" or "ميلادي" after a Gregorian year in Arabic. */
const GREGORIAN_MARK = `(?:\\s*(?:${arabicPattern('ميلادية')}|${arabicPattern('ميلادي')}|م)(?![\\p{L}\\p{M}]))`;
/** "سنة" or "عام" between an Arabic month and its year. */
const AR_YEAR_WORD = `(?:(?:${arabicPattern('سنة')}|${arabicPattern('لعام')}|${arabicPattern('عام')})\\s*)?`;

type Reader = (groups: string[], text: string) => Omit<DateMention, 'start' | 'end' | 'text'> | null;

interface DatePattern {
  regex: RegExp;
  read: Reader;
}

function pattern(source: string, read: Reader): DatePattern {
  return { regex: new RegExp(source, 'giu'), read };
}

const hijri = (text: string) => ({ kind: 'date' as const, isoDate: null, hijri: text.trim(), duration: null });
const gregorian = (isoDate: string | null) =>
  isoDate === null ? null : { kind: 'date' as const, isoDate, hijri: null, duration: null };

const DATE_PATTERNS: DatePattern[] = [
  // Hijri with a month name: "11 Ramadan 1447 AH", "Ramadan 11, 1447", "11 رمضان 1447 هـ", "رمضان 1447هـ".
  pattern(`${NOT_AFTER_WORD}\\d{1,2}${ORDINAL}\\s+(?:of\\s+)?${EN_HIJRI_MONTH},?\\s+${HIJRI_YEAR}${HIJRI_MARK}?${NOT_BEFORE_WORD}`, (_, text) => hijri(text)),
  pattern(`${NOT_AFTER_WORD}${EN_HIJRI_MONTH}\\s+\\d{1,2}${ORDINAL},?\\s+${HIJRI_YEAR}${HIJRI_MARK}?${NOT_BEFORE_WORD}`, (_, text) => hijri(text)),
  pattern(`${NOT_AFTER_WORD}${EN_HIJRI_MONTH},?\\s+${HIJRI_YEAR}${HIJRI_MARK}?${NOT_BEFORE_WORD}`, (_, text) => hijri(text)),
  pattern(`${NOT_AFTER_WORD}\\d{1,2}\\s*${AR_HIJRI_MONTH}\\s*${AR_YEAR_WORD}${HIJRI_YEAR}${NO_DIGIT}${HIJRI_MARK}?`, (_, text) => hijri(text)),
  pattern(`${NOT_AFTER_WORD}${AR_HIJRI_MONTH}\\s*${AR_YEAR_WORD}${HIJRI_YEAR}${NO_DIGIT}${HIJRI_MARK}?`, (_, text) => hijri(text)),
  // ISO: "2026-03-01", also the date part of "2026-03-01T09:00".
  pattern(`${NUMERIC_BEFORE}(\\d{4})-(\\d{2})-(\\d{2})(?![\\p{N}])`, ([y, m, d]) => gregorian(isoDay(y, m, d))),
  // Year first with slashes or dots: Gregorian "2026/03/01", or Hijri "1447/09/11 هـ".
  pattern(`${NUMERIC_BEFORE}(\\d{4})([/.])(\\d{1,2})\\2(\\d{1,2})${NUMERIC_AFTER}(${HIJRI_MARK}|${GREGORIAN_MARK})?`, ([y, , m, d, mark], text) =>
    readNumeric(y, m, d, mark, text),
  ),
  // Day first: "01/03/2026", "1-3-2026", "01.03.2026", or Hijri "11/09/1447 هـ". A second number above 12 reads as month/day.
  pattern(`${NUMERIC_BEFORE}(\\d{1,2})([/.\\-])(\\d{1,2})\\2(\\d{4})${NUMERIC_AFTER}(${HIJRI_MARK}|${GREGORIAN_MARK})?`, ([d, , m, y, mark], text) =>
    Number(m) > 12 && Number(d) <= 12 ? readNumeric(y, d, m, mark, text) : readNumeric(y, m, d, mark, text),
  ),
  // "1 March 2026", "1st of March, 2026", "15 Mar. 2026".
  pattern(`${NOT_AFTER_WORD}${DAY}${ORDINAL}\\s+(?:of\\s+)?${EN_MONTH},?\\s+${YEAR}${NOT_BEFORE_WORD}`, ([d, m, y]) =>
    gregorian(isoDay(y, englishMonth(m), d)),
  ),
  // "March 1, 2026", "March 1st 2026".
  pattern(`${NOT_AFTER_WORD}${EN_MONTH}\\s+${DAY}${ORDINAL},?\\s+${YEAR}${NOT_BEFORE_WORD}`, ([m, d, y]) =>
    gregorian(isoDay(y, englishMonth(m), d)),
  ),
  // "March 2026".
  pattern(`${NOT_AFTER_WORD}${EN_MONTH},?\\s+${YEAR}${NOT_BEFORE_WORD}`, ([m, y]) => gregorian(isoMonth(y, englishMonth(m)))),
  // "15 مارس 2026م", "١ كانون الثاني ٢٠٢٦".
  pattern(`${NOT_AFTER_WORD}${DAY}\\s*${AR_MONTH}\\s*${AR_YEAR_WORD}${YEAR}${NO_DIGIT}${GREGORIAN_MARK}?`, ([d, m, y]) =>
    gregorian(isoDay(y, arabicMonthNumber.get(arabicKey(m ?? '')), d)),
  ),
  // "مارس 2026".
  pattern(`${NOT_AFTER_WORD}${AR_MONTH}\\s*${AR_YEAR_WORD}${YEAR}${NO_DIGIT}${GREGORIAN_MARK}?`, ([m, y]) =>
    gregorian(isoMonth(y, arabicMonthNumber.get(arabicKey(m ?? '')))),
  ),
];

const NUMBER_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|' +
  'eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)';
const NUMBER_WORDS = `(?:a\\s+)?${NUMBER_WORD}(?:[-\\s]+(?:and[-\\s]+)?${NUMBER_WORD})*`;
const EN_AMOUNT = `(?:${NUMBER_WORDS}\\s*\\(\\s*\\d+\\s*\\)|\\(?\\d+(?:\\.\\d+)?\\)?|${NUMBER_WORDS})`;
const EN_UNIT = '(?:(?:calendar|working|business|consecutive|clear)[-\\s]+)?(?:hours?|days?|weeks?|months?|years?)(?![\\p{L}])';
const EN_LEAD =
  '(?:(?:within|in|for|after|a\\s+period\\s+of|period\\s+of|not\\s+less\\s+than|at\\s+least|not\\s+exceeding|up\\s+to)\\s+)?';
const AR_UNIT = `(?:${[
  'يوماً', 'يوما', 'يوم', 'أيام', 'أسبوعاً', 'أسبوعا', 'أسبوع', 'أسابيع', 'شهراً', 'شهرا', 'شهر', 'أشهر', 'شهور',
  'سنوات', 'سنة', 'أعوام', 'عاماً', 'عاما', 'عام', 'ساعة', 'ساعات',
].map(arabicPattern).join('|')})(?![\\p{L}])(?:\\s+(?:${['تقويمية', 'تقويمي', 'تقويمياً', 'عمل'].map(arabicPattern).join('|')})(?![\\p{L}]))?`;
const AR_LEAD = `(?:(?:${['خلال', 'في غضون', 'لمدة', 'مدة', 'مدتها', 'مدته'].map(arabicPattern).join('|')})\\s*)?`;

const DURATION_PATTERNS: RegExp[] = [
  new RegExp(`${NOT_AFTER_WORD}${EN_LEAD}(${EN_AMOUNT}[-\\s]+${EN_UNIT})`, 'giu'),
  new RegExp(`${NOT_AFTER_WORD}${AR_LEAD}(\\(?\\d+\\)?\\s*${AR_UNIT})`, 'giu'),
];

/**
 * Every date and duration in a sentence, in order, without overlaps: a longer match wins over one inside it,
 * so "1 March 2026" is one date, not also "March 2026". Arabic-Indic digits are read as digits.
 */
export function findDateMentions(sentence: string): DateMention[] {
  const text = normalizeDigits(sentence);
  const found: DateMention[] = [];
  for (const { regex, read } of DATE_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const written = sentence.slice(match.index, match.index + match[0].length);
      const value = read(match.slice(1).map((group) => group ?? ''), written);
      if (value !== null) found.push({ ...value, start: match.index, end: match.index + match[0].length, text: written });
    }
  }
  for (const regex of DURATION_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      const end = match.index + match[0].length;
      const core = sentence.slice(end - (match[1] ?? '').length, end);
      const written = sentence.slice(match.index, end);
      found.push({ kind: 'duration', start: match.index, end, text: written, isoDate: null, hijri: null, duration: core });
    }
  }
  return withoutOverlaps(found);
}

/** The date a whole cell holds, such as "2026-03-01", "2026-03-01T00:00:00.000Z", "01/03/2026" or "1 March 2026". */
export function readDateText(value: string): DateMention | null {
  const text = value.trim().replace(/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/, '');
  const [mention, ...others] = findDateMentions(text);
  if (mention === undefined || others.length > 0 || mention.kind !== 'date') return null;
  const rest = text.slice(0, mention.start) + text.slice(mention.end);
  return /^[\s.,;:()]*$/.test(rest) ? mention : null;
}

/** First and last Excel serial dates accepted: 2000-01-01 to 2099-12-31. */
const SERIAL_RANGE = { from: 36526, to: 73050 } as const;
const UNIX_EPOCH_SERIAL = 25569;

/** yyyy-mm-dd for an Excel serial date between 2000 and 2099; null for any other number. */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < SERIAL_RANGE.from || serial >= SERIAL_RANGE.to + 1) return null;
  return new Date(Math.floor(serial - UNIX_EPOCH_SERIAL) * 86_400_000).toISOString().slice(0, 10);
}

function readNumeric(year = '', month = '', day = '', mark = '', text: string): Omit<DateMention, 'start' | 'end' | 'text'> | null {
  const y = Number(year);
  if (y >= 1300 && y < 1600) return validHijri(month, day) ? hijri(text) : null;
  if (/[ه]|A\.?H/i.test(mark)) return null;
  return gregorian(isoDay(year, Number(month), day));
}

function validHijri(month: string, day: string): boolean {
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 30;
}

function englishMonth(name = ''): number | undefined {
  return englishMonthNumber.get(name.toLowerCase().replace(/\.$/, ''));
}

/** yyyy-mm-dd when the parts make a real Gregorian date between 1900 and 2199. */
function isoDay(year = '', month: number | string | undefined, day = ''): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || y < 1900 || y > 2199) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function isoMonth(year = '', month: number | undefined): string | null {
  const y = Number(year);
  if (month === undefined || y < 1900 || y > 2199) return null;
  return `${y}-${pad(month)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Sorted by start; at the same start the longer match wins, and a match inside an earlier one is dropped. */
function withoutOverlaps(mentions: DateMention[]): DateMention[] {
  const sorted = mentions.toSorted((a, b) => a.start - b.start || b.end - a.end);
  const kept: DateMention[] = [];
  for (const mention of sorted) {
    const last = kept.at(-1);
    if (last && mention.start < last.end) continue;
    kept.push(mention);
  }
  return kept;
}

/** Longest first, so "sept" wins over "sep" and "march" over "mar". */
function alternatives(words: string[]): string {
  return words.toSorted((a, b) => b.length - a.length).map(escapeRegExp).join('|');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
