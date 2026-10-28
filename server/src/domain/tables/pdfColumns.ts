import type { PositionedWord } from '../document';
import type { ColumnRole } from '../table';
import { cellNumber } from './cellText';
import type { PdfColumn } from './pdfHeader';
import { type PageLine, type WordRun, wordRuns, wordText } from './pdfLines';

/** Where each column's cells sit: the header label widened by the cells found under it alone. */
export interface ColumnLayout {
  columns: PdfColumn[];
  extents: { x0: number; x1: number }[];
}

/** Columns whose text may run on into the next one, as a long item code into the description. */
const TEXT_ROLES: ReadonlySet<ColumnRole> = new Set(['item_code', 'description']);
const NUMBER_ROLES: ReadonlySet<ColumnRole> = new Set(['quantity', 'rate', 'amount']);
/** Words a cell of a short column may hold when it is not a number: "Included", "Rate only", "Lump Sum". */
const MAX_SHORT_WORDS = 3;
/** A line of at least this many evenly spaced words across three columns is a paragraph, not a row. */
const PARAGRAPH_WORDS = 6;
const EVEN_SPACING = 3;
/** How far text may sit beyond the outer columns, in line heights. */
const OUTSIDE = 2;

/**
 * The layout of a header's columns, each widened to take in the runs of `lines` that overlap its label and no other
 * label, so right-aligned amounts wider than "Qty" and descriptions under a centred "Description" still land in their
 * column. A column never grows past the labels of its neighbours.
 */
export function columnLayout(columns: readonly PdfColumn[], lines: readonly PageLine[]): ColumnLayout {
  const extents = columns.map(({ x0, x1 }) => ({ x0, x1 }));
  for (const line of lines) {
    for (const run of wordRuns(line)) {
      const hits = overlapping(columns, run);
      const index = hits[0];
      const extent = index === undefined ? undefined : extents[index];
      if (hits.length !== 1 || index === undefined || extent === undefined) continue;
      extent.x0 = Math.max(Math.min(extent.x0, run.x0), columns[index - 1]?.x1 ?? -Infinity);
      extent.x1 = Math.min(Math.max(extent.x1, run.x1), columns[index + 1]?.x0 ?? Infinity);
    }
  }
  for (let i = 1; i < extents.length; i++) {
    const left = extents[i - 1];
    const right = extents[i];
    if (left === undefined || right === undefined || left.x1 <= right.x0) continue;
    const middle = (left.x1 + right.x0) / 2;
    left.x1 = middle;
    right.x0 = middle;
  }
  return { columns: [...columns], extents };
}

/**
 * The text of each column for one printed line, '' where a column is empty; null when the line does not fit the
 * layout: a paragraph across the columns, text beyond the table, a word across a column edge, or words in a number
 * column that are not a number or a short note. A run over several columns is split word by word, by overlap and
 * otherwise by x-centre, each column reaching from its start to the next column's start.
 */
export function fitLine(line: PageLine, layout: ColumnLayout): string[] | null {
  const { columns, extents } = layout;
  const runs = wordRuns(line);
  if (isParagraph(line, layout)) return null;
  const first = extents[0];
  const last = extents.at(-1);
  if (first === undefined || last === undefined) return null;
  const parts: PositionedWord[][] = columns.map(() => []);
  for (const run of runs) {
    if (run.x1 < first.x0 - OUTSIDE * line.height || run.x0 > last.x1 + OUTSIDE * line.height) return null;
    const hits = overlapping(extents, run);
    if (hits.length <= 1) {
      parts[hits[0] ?? byCentre(extents, run)]?.push(...run.words);
    } else if (hits.every((i) => isTextColumn(columns[i]))) {
      parts[mostOverlap(extents, run, hits)]?.push(...run.words);
    } else {
      for (const word of run.words) {
        const wordHits = overlapping(extents, word);
        if (wordHits.length > 1) return null;
        parts[wordHits[0] ?? byCentre(extents, word)]?.push(word);
      }
    }
  }
  const texts = parts.map((words) => wordText(words));
  return texts.every((text, i) => fitsColumn(text, columns[i]?.role ?? null)) ? texts : null;
}

function isTextColumn(column: PdfColumn | undefined): boolean {
  return column !== undefined && column.role !== null && TEXT_ROLES.has(column.role);
}

/** Number columns hold numbers or a short note; unit and currency cells are short. */
function fitsColumn(text: string, role: ColumnRole | null): boolean {
  if (text === '' || role === null || TEXT_ROLES.has(role)) return true;
  if (NUMBER_ROLES.has(role) && cellNumber(text) !== null) return true;
  return text.split(' ').length <= MAX_SHORT_WORDS;
}

/** Many words with even gaps over three columns or more: running text, even when its spaces are wide. */
function isParagraph(line: PageLine, layout: ColumnLayout): boolean {
  const { words } = line;
  const firstWord = words[0];
  const lastWord = words.at(-1);
  if (words.length < PARAGRAPH_WORDS || firstWord === undefined || lastWord === undefined) return false;
  const span = { x0: firstWord.x0, x1: lastWord.x1 };
  if (overlapping(layout.extents, span).length < 3) return false;
  const gaps = words.slice(1).map((word, i) => Math.max(word.x0 - (words[i]?.x1 ?? word.x0), 0.5));
  return Math.max(...gaps) < EVEN_SPACING * Math.min(...gaps);
}

function overlapping(extents: readonly { x0: number; x1: number }[], span: { x0: number; x1: number }): number[] {
  return extents.flatMap((extent, i) => (Math.min(extent.x1, span.x1) > Math.max(extent.x0, span.x0) ? [i] : []));
}

function mostOverlap(extents: readonly { x0: number; x1: number }[], span: WordRun, hits: readonly number[]): number {
  const overlap = (i: number) => {
    const extent = extents[i];
    return extent === undefined ? 0 : Math.min(extent.x1, span.x1) - Math.max(extent.x0, span.x0);
  };
  return hits.reduce((best, i) => (overlap(i) > overlap(best) ? i : best));
}

/** The column the centre falls in, each column reaching from its start to the next column's start. */
function byCentre(extents: readonly { x0: number; x1: number }[], span: { x0: number; x1: number }): number {
  const middle = (span.x0 + span.x1) / 2;
  let index = 0;
  extents.forEach((extent, i) => {
    if (i > 0 && middle >= extent.x0) index = i;
  });
  return index;
}
