/** Short vowels, Quranic marks and tatweel: the FTS5 tokenizer would split Arabic words at these. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
/** The definite article, or the لل contraction, after optional و/ف and ب/ك, before a word of two or more letters. */
const ARABIC_ARTICLE = /(?<![\p{L}\p{N}])[وف]?(?:[بك]?ال|لل)(?=\p{L}{2})/gu;

/**
 * Normalises text the same way for indexing and for queries, so Arabic matches with or without vowels,
 * hamza forms, ta marbuta or the article, and Arabic-Indic digits match Western ones. Latin case and
 * accents are left to the tokenizer. Changing this needs a new schema version, since stored tokens depend on it.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFC')
    .replace(ARABIC_MARKS, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(ARABIC_ARTICLE, '');
}
