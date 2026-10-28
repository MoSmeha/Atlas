/** Arabic tatweel, the stretching stroke inside words. */
const TATWEEL = /ـ/g;
const MARKS = /\p{M}/gu;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/g;

/**
 * Text folded for matching: compatibility forms and ligatures split (Arabic presentation forms
 * become plain letters), accents, Arabic diacritics and tatweel dropped, lower case, Arabic-Indic
 * digits as 0-9, and alef maqsura and ta marbuta read as ya and ha, as Arabic search does.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(MARKS, '')
    .replace(TATWEEL, '')
    .toLowerCase()
    .replace(ARABIC_INDIC_DIGIT, (digit) => String((digit.codePointAt(0) ?? 0) & 0xf))
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}
