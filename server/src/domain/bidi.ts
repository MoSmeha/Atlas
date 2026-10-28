/** One character on a line of a PDF page: its text, its horizontal extent in points, and its direction. */
export interface PlacedChar {
  c: string;
  x0: number;
  x1: number;
  /** True when the PDF reader gave the character a right-to-left bidi level, as for Arabic letters. */
  rtl: boolean;
}

const SPACE = /\s/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
/** Points; extents narrower than this have no width. */
const SAME = 0.01;
/** Gaps between runs in typical character widths: below TOUCHING the runs touch, above WIDE they sit in different table cells. */
const TOUCHING = 0.25;
const WIDE = 2.5;

/**
 * A right-to-left line in reading order. Each run (a stretch of right-to-left text, of left-to-right text, or of
 * punctuation) must already read in order; the runs may be listed in any order, as PDF readers often list them
 * from left to right. Runs are put in order from right to left by their position on the line, and a run of
 * punctuation alone reads right to left like the Arabic around it, so "٧٠٪." keeps the percent sign before the
 * full stop. Runs are joined as they sit on the page: with nothing when they touch (a number and its percent sign,
 * a word and its colon), one space for a word gap, two for a gap as wide as one between table cells.
 */
export function orderRightToLeft(chars: readonly PlacedChar[]): PlacedChar[] {
  const runs = splitRuns(chars)
    .map(trimSpaces)
    .filter((run) => run.length > 0)
    .map(punctuationRightToLeft);
  if (runs.length < 2) return [...chars];
  const unit = typicalWidth(chars);
  const ordered = runs.toSorted((a, b) => center(b) - center(a));
  const out: PlacedChar[] = [];
  ordered.forEach((run, index) => {
    const right = ordered[index - 1];
    if (right) out.push(...separator(right, run, unit));
    out.push(...run);
  });
  return out;
}

/** Consecutive characters with the same direction. */
function splitRuns(chars: readonly PlacedChar[]): PlacedChar[][] {
  const runs: PlacedChar[][] = [];
  for (const char of chars) {
    const run = runs.at(-1);
    if (run && run[0]!.rtl === char.rtl) run.push(char);
    else runs.push([char]);
  }
  return runs;
}

function trimSpaces(run: PlacedChar[]): PlacedChar[] {
  let start = 0;
  let end = run.length;
  while (start < end && SPACE.test(run[start]!.c)) start += 1;
  while (end > start && SPACE.test(run[end - 1]!.c)) end -= 1;
  return run.slice(start, end);
}

/** A left-to-right run with no letter or digit, such as "." or ")" or ".٪", in order from right to left. */
function punctuationRightToLeft(run: PlacedChar[]): PlacedChar[] {
  if (run[0]!.rtl || run.some((char) => LETTER_OR_DIGIT.test(char.c))) return run;
  return run.toSorted((a, b) => b.x0 + b.x1 - (a.x0 + a.x1));
}

/** What goes between a run and the run to its left. */
function separator(right: PlacedChar[], left: PlacedChar[], unit: number): PlacedChar[] {
  const start = Math.max(...left.map((char) => char.x1));
  const end = Math.min(...right.map((char) => char.x0));
  const gap = end - start;
  if (gap < TOUCHING * unit) return [];
  const space: PlacedChar = { c: ' ', x0: start, x1: end, rtl: true };
  return gap > WIDE * unit ? [space, { ...space }] : [space];
}

/** The median width of the line's visible characters; 1 pt when none has a width. */
function typicalWidth(chars: readonly PlacedChar[]): number {
  const widths = chars
    .filter((char) => !SPACE.test(char.c))
    .map((char) => char.x1 - char.x0)
    .filter((width) => width > SAME)
    .sort((a, b) => a - b);
  return widths.length > 0 ? widths[Math.floor(widths.length / 2)]! : 1;
}

function center(run: PlacedChar[]): number {
  return (Math.min(...run.map((char) => char.x0)) + Math.max(...run.map((char) => char.x1))) / 2;
}
