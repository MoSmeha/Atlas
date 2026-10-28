/** Letters of the Arabic script, in every block; Arabic-Indic digits and diacritics are not letters. */
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const ANY_LETTER = /\p{L}/gu;

/** Arabic answers quote file names, item codes and "SAR" in Latin letters, so Arabic leads well below half. */
const ARABIC_SHARE = 0.4;

export interface ArabicTextOptions {
  /** Below this many letters the text says too little, for example "**SAR" at the start of a stream. */
  minLetters?: number;
  /** The answer for text too short to judge, such as the question's direction. */
  fallback?: boolean;
}

/** Share of the letters in `text` that are Arabic, from 0 to 1; null when it has no letters at all. */
export function arabicShare(text: string): number | null {
  const letters = text.match(ANY_LETTER)?.length ?? 0;
  if (letters === 0) return null;
  return (text.match(ARABIC_LETTER)?.length ?? 0) / letters;
}

/** True when `text` reads as Arabic, so it belongs right to left. */
export function isArabicText(text: string, { minLetters = 1, fallback = false }: ArabicTextOptions = {}): boolean {
  const letters = text.match(ANY_LETTER)?.length ?? 0;
  if (letters < Math.max(1, minLetters)) return fallback;
  return (arabicShare(text) ?? 0) >= ARABIC_SHARE;
}
