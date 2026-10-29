import { orderRightToLeft } from '../../domain/bidi';
import type { RawChar } from './stextBlocks';

export type Direction = 'ltr' | 'rtl';

const ARABIC = /\p{Script=Arabic}/u;
const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const SPACE = /\s/u;
/** Arabic-Indic digits, both sets. */
const ARABIC_DIGIT = /[٠-٩۰-۹]/u;
/** Joins Arabic-Indic digits into one number: the Arabic decimal and thousands separators, and , . : / as in times and dates. */
const NUMBER_JOINER = /[٫٬,.:/]/u;
/** Points; positions closer than this are the same position. */
const SAME = 0.01;

/** The page's main direction: right-to-left when it has more Arabic letters than Latin ones. */
export function pageDirection(text: string): Direction {
  const { arabic, latin } = letterCounts(text);
  return arabic > latin ? 'rtl' : 'ltr';
}

/** A line's direction from its own letters when one script clearly leads, otherwise the page's direction. */
export function lineDirection(text: string, page: Direction): Direction {
  const { arabic, latin } = letterCounts(text);
  if (arabic > 2 * latin) return 'rtl';
  if (latin > 2 * arabic) return 'ltr';
  return page;
}

/**
 * One line's characters in reading order. mupdf gives each Arabic word in logical order with four slips,
 * all undone here: it adds a space inside a word before a letter with a diacritic, the characters of one glyph
 * (lam-alef, the rial ligature, a letter with its diacritic) come out reversed, numbers in Arabic-Indic digits
 * come out from right to left, and on a right-to-left line the runs of Arabic, of Latin text or digits and of
 * punctuation are listed from left to right (see orderRightToLeft).
 */
export function logicalOrder(chars: readonly RawChar[], direction: Direction): RawChar[] {
  const ordered = unreverseArabicNumbers(unreverseClusters(dropClusterSpaces(chars)));
  return direction === 'rtl' ? orderRightToLeft(ordered) : ordered;
}

/**
 * Edge gives a letter and its diacritic as one cluster, which mupdf places with zero width at the letter's left
 * edge; mupdf then fills the letter's width with a space of its own, so "صباحًا" would read "صبا حًا". That space
 * starts exactly where the cluster sits. A real space before such a letter starts at the letter's right edge.
 */
function dropClusterSpaces(chars: readonly RawChar[]): RawChar[] {
  return chars.filter((char, index) => !(char.rtl && SPACE.test(char.c) && startsMarkCluster(chars, index + 1, char.x0)));
}

/** True when zero-width characters at `x`, one of them a diacritic, start at `index`. */
function startsMarkCluster(chars: readonly RawChar[], index: number, x: number): boolean {
  let end = index;
  while (end < chars.length && isZeroWidth(chars[end]!) && Math.abs(chars[end]!.x0 - x) < SAME) end += 1;
  return chars.slice(index, end).some((char) => MARK.test(char.c));
}

/**
 * mupdf marks Arabic-Indic digits right-to-left like the letters around them and lists them from right to left,
 * so "٢٬٣٥٠٬٠٠٠" comes out as "٠٠٠٬٠٥٣٬٢" and "١٠:٣٠" as "٠٣:٠١". A number reads from left to right, so each
 * such run is turned around.
 */
function unreverseArabicNumbers(chars: RawChar[]): RawChar[] {
  const out: RawChar[] = [];
  let index = 0;
  while (index < chars.length) {
    if (!isArabicDigit(chars[index])) {
      out.push(chars[index]!);
      index += 1;
      continue;
    }
    let end = index + 1;
    while (isArabicDigit(chars[end]) || (isJoiner(chars[end]) && isArabicDigit(chars[end + 1]))) end += 1;
    const run = chars.slice(index, end);
    out.push(...(run[0]!.x0 > run.at(-1)!.x0 ? run.reverse() : run));
    index = end;
  }
  return out;
}

/**
 * mupdf gives all but one character of a multi-character glyph zero width, at the glyph's right edge,
 * and lists them before the character that carries the glyph's width. Diacritics carry no width of their own.
 */
function unreverseClusters(chars: readonly RawChar[]): RawChar[] {
  const out: RawChar[] = [];
  let index = 0;
  while (index < chars.length) {
    const first = chars[index]!;
    if (!isZeroWidth(first)) {
      out.push(first);
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < chars.length && isZeroWidth(chars[end]!) && Math.abs(chars[end]!.x0 - first.x0) < SAME) end += 1;
    const cluster = chars.slice(index, end);
    const next = chars[end];
    const isLigature = !cluster.some((char) => MARK.test(char.c));
    if (isLigature && next && next.rtl && !SPACE.test(next.c) && Math.abs(next.x1 - first.x0) < SAME) {
      cluster.push(next);
      end += 1;
    }
    out.push(...cluster.reverse());
    index = end;
  }
  return out;
}

function isArabicDigit(char: RawChar | undefined): boolean {
  return char !== undefined && char.rtl && ARABIC_DIGIT.test(char.c);
}

function isJoiner(char: RawChar | undefined): boolean {
  return char !== undefined && char.rtl && NUMBER_JOINER.test(char.c);
}

function isZeroWidth(char: RawChar): boolean {
  return char.rtl && char.x1 - char.x0 < SAME && !SPACE.test(char.c);
}

function letterCounts(text: string): { arabic: number; latin: number } {
  let arabic = 0;
  let latin = 0;
  for (const char of text) {
    if (!LETTER.test(char)) continue;
    if (ARABIC.test(char)) arabic += 1;
    else if (LATIN.test(char)) latin += 1;
  }
  return { arabic, latin };
}
