import { foldText } from './foldText';

/** One text item of a PDF page as pdf.js reads it: its text, its direction, whether a line ends after it. */
export interface TextPiece {
  str: string;
  dir?: string;
  hasEOL?: boolean;
}

/** Characters `start` to `end` (exclusive, UTF-16 offsets) of one text item. */
export interface TextRange {
  start: number;
  end: number;
}

/** A source character: the text item it is in and where, or a line break between items. */
interface Unit {
  item: number;
  offset: number;
  length: number;
}

/** A word of the page, folded, with the first and last units it covers. */
interface Word {
  text: string;
  first: number;
  last: number;
}

/** A stretch of page words equal to a stretch of quote words. */
interface Run {
  pageStart: number;
  quoteStart: number;
  length: number;
}

interface Match {
  runs: Run[];
  words: Word[];
  units: Unit[];
  best: number;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
const QUOTE_WORD = /[\p{L}\p{N}]+/gu;
const STRONG_CHAR = /[\p{L}\p{N}]/u;
const ARABIC_PREFIX = /^[وفبلك]+$/;

/** Unmarked words between two marked ones that still join them into one highlight. */
const MAX_GAP_WORDS = 2;

/** A partial match needs at least this many words in a row. */
const MIN_RUN = 3;

/**
 * Where a quote sits in a page's text items, as character ranges per item index. Matching is by
 * words, so case, spacing, punctuation, line breaks and Arabic letter forms do not matter.
 * Every full occurrence is marked; failing that, the longest stretch of the quote's words and the
 * stretches in line with it, when the longest has at least three words. Arabic lines that pdf.js
 * returns in visual order are also read in logical order. Empty when the page does not hold the quote.
 */
export function findQuote(items: TextPiece[], quote: string): Map<number, TextRange[]> {
  const quoteWords = foldText(quote).match(QUOTE_WORD) ?? [];
  if (quoteWords.length === 0) return new Map();
  const lines = pageLines(items);
  const asStored = match(items, lines, quoteWords);
  const logical = lines.some((line) => line.some((index) => items[index]?.dir === 'rtl'))
    ? match(items, lines.map((line) => logicalOrder(line, items)), quoteWords)
    : null;
  const chosen = logical && logical.best > asStored.best ? logical : asStored;
  return rangesOf(markedSpans(keptRuns(chosen.runs, quoteWords.length), chosen.words), chosen.words, chosen.units);
}

/** Item indexes grouped by line; pdf.js flags the item that ends each line. */
function pageLines(items: TextPiece[]): number[][] {
  const lines: number[][] = [[]];
  items.forEach((item, index) => {
    lines.at(-1)?.push(index);
    if (item.hasEOL) lines.push([]);
  });
  return lines;
}

/**
 * A line laid out left to right turned into reading order: items reversed, except that runs of
 * left-to-right items (Latin words, codes, numbers) keep their own order inside the line.
 */
function logicalOrder(line: number[], items: TextPiece[]): number[] {
  const reversed = [...line].reverse();
  const isLtr = (index: number) => {
    const item = items[index];
    return item !== undefined && item.dir !== 'rtl' && STRONG_CHAR.test(item.str);
  };
  const ordered: number[] = [];
  let i = 0;
  while (i < reversed.length) {
    if (!isLtr(reversed[i] ?? -1)) {
      ordered.push(reversed[i] ?? -1);
      i++;
      continue;
    }
    // Extend the run over neutral items (spaces, punctuation) that sit between two left-to-right items.
    let end = i;
    for (let j = i + 1; j < reversed.length; j++) {
      const index = reversed[j] ?? -1;
      if (isLtr(index)) end = j;
      else if (items[index]?.dir === 'rtl' && STRONG_CHAR.test(items[index]?.str ?? '')) break;
    }
    ordered.push(...reversed.slice(i, end + 1).reverse());
    i = end + 1;
  }
  return ordered;
}

function match(items: TextPiece[], lines: number[][], quoteWords: string[]): Match {
  const { units, words } = pageWords(items, lines);
  const runs = matchingRuns(words, quoteWords);
  return { runs, words, units, best: runs.reduce((top, run) => Math.max(top, run.length), 0) };
}

function pageWords(items: TextPiece[], lines: number[][]): { units: Unit[]; words: Word[] } {
  const units: Unit[] = [];
  const words: Word[] = [];
  let current: Word | null = null;
  const endWord = () => {
    if (current) words.push(current);
    current = null;
  };

  for (const line of lines) {
    for (const itemIndex of line) {
      let offset = 0;
      for (const char of items[itemIndex]?.str ?? '') {
        const unit = units.push({ item: itemIndex, offset, length: char.length }) - 1;
        offset += char.length;
        for (const folded of foldText(char)) {
          if (!WORD_CHAR.test(folded)) {
            endWord();
            continue;
          }
          if (current) {
            current.text += folded;
            current.last = unit;
          } else current = { text: folded, first: unit, last: unit };
        }
      }
    }
    units.push({ item: -1, offset: 0, length: 0 });
    endWord();
  }
  return { units, words };
}

/** Every maximal stretch where page words and quote words agree, by dynamic programming. */
function matchingRuns(words: Word[], quoteWords: string[]): Run[] {
  const runs: Run[] = [];
  let previous = new Array<number>(quoteWords.length).fill(0);
  words.forEach((word, i) => {
    const row = quoteWords.map((quoteWord, j) => (sameWord(word.text, quoteWord) ? (j > 0 ? (previous[j - 1] ?? 0) : 0) + 1 : 0));
    // A run ends where the next pair of words no longer agrees.
    row.forEach((length, j) => {
      const next = words[i + 1]?.text;
      const nextQuote = quoteWords[j + 1];
      if (length === 0 || (next !== undefined && nextQuote !== undefined && sameWord(next, nextQuote))) return;
      runs.push({ pageStart: i - length + 1, quoteStart: j - length + 1, length });
    });
    previous = row;
  });
  return runs;
}

/** Equal words, or a page word that only adds an Arabic prefix the quote left off (و, ف, ب, ل, ك). */
function sameWord(pageWord: string, quoteWord: string): boolean {
  if (pageWord === quoteWord) return true;
  const extra = pageWord.length - quoteWord.length;
  return extra > 0 && extra <= 2 && pageWord.endsWith(quoteWord) && ARABIC_PREFIX.test(pageWord.slice(0, extra));
}

/**
 * The runs to mark: every full occurrence, or else the longest run and the runs in line with it,
 * that is, where the quote would sit if a few words were added, dropped or changed.
 */
function keptRuns(runs: Run[], quoteLength: number): Run[] {
  const best = runs.reduce<Run | null>((top, run) => (top === null || run.length > top.length ? run : top), null);
  if (best === null) return [];
  if (best.length === quoteLength) return runs.filter((run) => run.length === quoteLength);
  if (best.length < MIN_RUN) return [];
  const slack = Math.max(3, Math.ceil(quoteLength / 5));
  const offset = best.pageStart - best.quoteStart;
  return runs.filter((run) => {
    const shift = Math.abs(run.pageStart - run.quoteStart - offset);
    return run.length >= MIN_RUN ? shift <= slack : shift <= MAX_GAP_WORDS;
  });
}

/** Runs as spans of page word indexes, joined across small gaps. */
function markedSpans(runs: Run[], words: Word[]): [number, number][] {
  const marked = new Array<boolean>(words.length).fill(false);
  for (const run of runs) marked.fill(true, run.pageStart, run.pageStart + run.length);
  const spans: [number, number][] = [];
  marked.forEach((isMarked, index) => {
    if (!isMarked) return;
    const last = spans.at(-1);
    if (last && index - last[1] - 1 <= MAX_GAP_WORDS) last[1] = index;
    else spans.push([index, index]);
  });
  return spans;
}

/** Each span from its first word's first character to its last word's last, split by text item. */
function rangesOf(spans: [number, number][], words: Word[], units: Unit[]): Map<number, TextRange[]> {
  const byItem = new Map<number, TextRange[]>();
  for (const [from, to] of spans) {
    const last = words[to]?.last ?? -1;
    for (let u = words[from]?.first ?? 0; u <= last; u++) {
      const unit = units[u];
      if (!unit || unit.item < 0) continue;
      const list = byItem.get(unit.item) ?? [];
      list.push({ start: unit.offset, end: unit.offset + unit.length });
      byItem.set(unit.item, list);
    }
  }
  for (const [item, list] of byItem) byItem.set(item, merged(list));
  return byItem;
}

function merged(ranges: TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: TextRange[] = [];
  for (const range of sorted) {
    const last = out.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else out.push({ ...range });
  }
  return out;
}
