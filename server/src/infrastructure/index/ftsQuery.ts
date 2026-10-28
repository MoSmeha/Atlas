import { foldText } from './foldText';

const MAX_TERMS = 32;

/** Words too common to help ranking, folded like indexed text. Used only when other words remain. */
const STOP_WORDS = new Set(
  [
    'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'for', 'from', 'how', 'in', 'is', 'it',
    'of', 'on', 'or', 'show', 'that', 'the', 'this', 'to', 'what', 'which', 'with',
    'في', 'من', 'على', 'عن', 'إلى', 'ما', 'ماذا', 'هل', 'كم', 'هو', 'هي', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  ].map(foldText),
);

/**
 * Turns what a person or the model typed into a safe FTS5 MATCH expression. Every term is quoted, so FTS5
 * syntax in the text is never interpreted; a word joined by punctuation, such as "C-101" or "1,250", becomes a
 * phrase; terms are ORed so bm25 ranks chunks that share the most words first. Null when nothing searchable is left.
 */
export function ftsQuery(text: string): string | null {
  const terms: string[] = [];
  for (const word of foldText(text).toLowerCase().split(/\s+/)) {
    const tokens = word.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (tokens.length === 0) continue;
    if (tokens.length === 1 && /^\p{L}$/u.test(tokens[0] ?? '')) continue;
    const term = tokens.join(' ');
    if (!terms.includes(term)) terms.push(term);
  }
  const useful = terms.filter((term) => !STOP_WORDS.has(term));
  const chosen = (useful.length > 0 ? useful : terms).slice(0, MAX_TERMS);
  return chosen.length === 0 ? null : chosen.map((term) => `"${term}"`).join(' OR ');
}
