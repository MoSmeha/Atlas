import type { Language } from '@atlas/shared';

const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const LATIN_LETTER = /(?=\p{L})\p{Script=Latin}/gu;
/** File names, item codes, numbers and paths: they say nothing about the language of a question. */
const CODE_LIKE = /[\d._/\\-]/;

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Removes Arabic diacritics and tatweel and unifies alef, yeh and kaf forms,
 * so "ألف" matches "الف" and "سعودى" matches "سعودي".
 */
export function foldArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/[\u0649\u06CC]/g, '\u064A')
    .replace(/\u06A9/g, '\u0643');
}

/** Language of a document's text from the share of Arabic letters among Arabic and Latin letters; null when there are no letters. */
export function detectLanguage(text: string): Language | null {
  const arabic = count(text, ARABIC_LETTER);
  const latin = count(text, LATIN_LETTER);
  if (arabic + latin === 0) return null;
  const share = arabic / (arabic + latin);
  if (share >= 0.8) return 'ar';
  if (share <= 0.2) return 'en';
  return 'mixed';
}

/**
 * True when a question is written in Arabic. File names, item codes and numbers are ignored,
 * so "كم إجمالي BOQ-Phase1.xlsx؟" is Arabic. When the words are close to evenly split, the first word decides.
 */
export function isArabic(text: string): boolean {
  if (text.includes('\u061F')) return true;
  const words = text
    .split(/\s+/)
    .filter((word) => !CODE_LIKE.test(word))
    .map((word) => ({ arabic: count(word, ARABIC_LETTER), latin: count(word, LATIN_LETTER) }))
    .filter((word) => word.arabic + word.latin > 0);
  const first = words[0];
  if (first === undefined) return false;
  const share = words.filter((word) => word.arabic > word.latin).length / words.length;
  if (share >= 0.75) return true;
  if (share < 0.25) return false;
  return first.arabic > first.latin;
}
