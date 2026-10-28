import type { ScheduleFields } from './schedule';

/** Share of words two sentences must have in common (of all their words) to count as one repeated wording. */
const SAME_WORDING = 0.75;
/** A clause number such as "A1.1.2" or "(4.3)" at the start of a sentence: it differs in every repeat. */
const CLAUSE_NUMBER = /^[\s…]*\(?\p{L}?\d+(?:\.\d+)+\)?/u;
const WORD = /[\p{L}\p{N}]+/gu;

export interface MergedCandidate<T> {
  /** The first sentence with this wording. */
  candidate: T;
  /** How many later sentences repeat its wording and were merged into it. */
  repeats: number;
}

/**
 * Merges candidates whose sentences repeat one wording, as a long specification does clause after clause
 * ("Report any defect found in blockwork to the Engineer within two working days", "... in joinery items ...").
 * Two candidates merge when they come from the same document, have the same kind, match, dates and duration, and
 * share at least 75% of their words, clause numbers aside. The first is kept, in order, and counts the others.
 */
export function mergeRepeats<T extends ScheduleFields>(candidates: readonly T[]): MergedCandidate<T>[] {
  const kept: (MergedCandidate<T> & { words: Set<string> })[] = [];
  const byKey = new Map<string, (MergedCandidate<T> & { words: Set<string> })[]>();
  for (const candidate of candidates) {
    const key = [candidate.document, candidate.kind, candidate.match.toLowerCase(), candidate.isoDate, candidate.hijri, candidate.duration].join('\n');
    const words = wordsOf(candidate.sentence);
    const alike = byKey.get(key) ?? [];
    const first = alike.find((entry) => similarity(entry.words, words) >= SAME_WORDING);
    if (first) {
      first.repeats += 1;
      continue;
    }
    const entry = { candidate, repeats: 0, words };
    alike.push(entry);
    byKey.set(key, alike);
    kept.push(entry);
  }
  return kept.map(({ candidate, repeats }) => ({ candidate, repeats }));
}

function wordsOf(sentence: string): Set<string> {
  return new Set(sentence.replace(CLAUSE_NUMBER, '').toLowerCase().match(WORD) ?? []);
}

/** Shared words over all words (Jaccard); two empty sentences are the same. */
function similarity(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const all = a.size + b.size - shared;
  return all === 0 ? 1 : shared / all;
}
