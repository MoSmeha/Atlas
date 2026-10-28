const ELLIPSIS = '…';
/** How far a cut may move to land between words instead of inside one. */
const SNAP = 40;

/** Words worth looking for: runs of letters, marks and digits, two characters or more, lower case, no repeats. */
export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return [...new Set(words.filter((word) => word.length >= 2))];
}

/**
 * The part of a passage to show for a query. Short passages come back whole; longer ones are cut to about
 * `maxLength` characters around the best keyword match, between words, with "…" where text was cut.
 * Whitespace runs become single spaces. With no match the passage start is shown.
 */
export function snippetAround(text: string, query: string, maxLength = 500): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const center = bestMatchCenter(clean, query, maxLength) ?? 0;
  const end = Math.min(clean.length, Math.max(0, Math.round(center - maxLength / 2)) + maxLength);
  const start = Math.max(0, end - maxLength);
  const from = snapStart(clean, start);
  const to = snapEnd(clean, end);
  return `${from > 0 ? ELLIPSIS : ''}${clean.slice(from, to).trim()}${to < clean.length ? ELLIPSIS : ''}`;
}

/** Middle of the exact phrase when present, otherwise of the term whose neighbourhood holds the most query words. */
function bestMatchCenter(text: string, query: string, maxLength: number): number | null {
  const terms = queryTerms(query);
  const phrase = query.replace(/\s+/g, ' ').trim();
  if (terms.length > 1) {
    const at = text.search(new RegExp(escapeRegExp(phrase), 'iu'));
    if (at >= 0) return at + phrase.length / 2;
  }
  const matches = terms.flatMap((term) => {
    const stem = stemOf(term);
    return [...text.matchAll(new RegExp(escapeRegExp(stem), 'giu'))].map((match) => ({ stem, at: match.index }));
  });
  let best: { stem: string; at: number } | null = null;
  let bestWeight = 0;
  for (const match of matches) {
    const nearby = new Set(matches.filter((other) => Math.abs(other.at - match.at) <= maxLength / 2).map((o) => o.stem));
    const weight = [...nearby].reduce((sum, stem) => sum + stem.length, 0);
    if (weight > bestWeight) {
      best = match;
      bestWeight = weight;
    }
  }
  return best === null ? null : best.at + best.stem.length / 2;
}

/** Drops the last two letters of long words so "payments" still finds "payment". */
function stemOf(term: string): string {
  return term.length > 5 ? term.slice(0, -2) : term;
}

function snapStart(text: string, start: number): number {
  if (start === 0 || text[start - 1] === ' ') return start;
  const space = text.indexOf(' ', start);
  return space === -1 || space - start > SNAP ? start : space + 1;
}

function snapEnd(text: string, end: number): number {
  if (end === text.length || text[end] === ' ') return end;
  const space = text.lastIndexOf(' ', end);
  return space === -1 || end - space > SNAP ? end : space;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
