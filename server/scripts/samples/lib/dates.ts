/** Calendar helpers for the sample documents. Dates are UTC midnight so nothing shifts with the time zone. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** ASCII transliterations; the standard PDF fonts cannot draw the marks ICU uses. */
const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
];

const UMM_AL_QURA = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** Parses YYYY-MM-DD as UTC midnight. */
export function day(iso: string): Date {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a date: ${iso}`);
  return date;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/** "1 February 2026". */
export function longDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "25th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** The Umm al-Qura day, month (1 to 12) and year of a date. */
export function hijriParts(date: Date): { day: number; month: number; year: number } {
  const parts = UMM_AL_QURA.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: part('day'), month: part('month'), year: part('year') };
}

/** The Umm al-Qura date, for example "13 Sha'ban 1447 AH". */
export function hijriDate(date: Date): string {
  const hijri = hijriParts(date);
  return `${hijri.day} ${HIJRI_MONTHS[hijri.month - 1]} ${hijri.year} AH`;
}

/** Throws when a Hijri date written into a document does not match the Gregorian date beside it. */
export function checkHijri(iso: string, stated: string): string {
  const actual = hijriDate(day(iso));
  if (actual !== stated) throw new Error(`Hijri date for ${iso} is ${actual}, not ${stated}`);
  return stated;
}
