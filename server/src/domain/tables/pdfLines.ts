import type { PdfPage, PositionedWord, TextLine } from '../document';

/** One printed row of a page: the words of every text line at that height, left to right. */
export interface PageLine {
  page: number;
  /** Top and bottom edge in points from the top of the page. */
  top: number;
  bottom: number;
  /** Height of the shortest line in the row, about the font size. */
  height: number;
  words: PositionedWord[];
}

/** Lines that overlap vertically by at least this share of the shorter one are on the same row. */
const SAME_ROW = 0.5;
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/gu;
const LATIN_LETTER = /(?=\p{L})\p{Script=Latin}/gu;

/**
 * The printed rows of a page from top to bottom. mupdf can put the cells of one table row in different blocks (the
 * wrapped description in one, the numbers in another), so lines from all blocks at the same height are merged.
 */
export function pageLines(page: PdfPage): PageLine[] {
  const lines = page.blocks
    .flatMap((block) => block.lines)
    .filter((line) => line.words.length > 0)
    .toSorted((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  const rows: { anchor: TextLine; line: PageLine }[] = [];
  for (const line of lines) {
    const row = rows.at(-1);
    if (row !== undefined && sameRow(row.anchor, line)) {
      row.line.words.push(...line.words);
      row.line.bottom = Math.max(row.line.bottom, line.box.y + line.box.height);
      row.line.height = Math.min(row.line.height, line.box.height);
    } else {
      const { y, height } = line.box;
      rows.push({ anchor: line, line: { page: page.number, top: y, bottom: y + height, height, words: [...line.words] } });
    }
  }
  return rows.map(({ line }) => ({ ...line, words: line.words.toSorted((a, b) => a.x0 - b.x0) }));
}

function sameRow(a: TextLine, b: TextLine): boolean {
  const overlap = Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y);
  return overlap >= SAME_ROW * Math.min(a.box.height, b.box.height);
}

/** Words with no wide gap between them: one cell of a table row, or one header label. */
export interface WordRun {
  words: PositionedWord[];
  x0: number;
  x1: number;
}

/** Words further apart than this share of the line height are in different cells. */
const CELL_GAP = 0.5;

/** The row's words split into runs wherever the gap is wider than a space. */
export function wordRuns(line: PageLine): WordRun[] {
  const runs: WordRun[] = [];
  for (const word of line.words) {
    const run = runs.at(-1);
    if (run !== undefined && word.x0 - run.x1 <= CELL_GAP * line.height) {
      run.words.push(word);
      run.x1 = Math.max(run.x1, word.x1);
    } else {
      runs.push({ words: [word], x0: word.x0, x1: word.x1 });
    }
  }
  return runs;
}

/** Words placed left to right, read in order: right to left when most letters are Arabic. */
export function wordText(words: readonly PositionedWord[]): string {
  const texts = words.map((word) => word.text);
  const joined = texts.join(' ');
  const arabic = joined.match(ARABIC_LETTER)?.length ?? 0;
  const latin = joined.match(LATIN_LETTER)?.length ?? 0;
  return arabic > latin ? texts.reverse().join(' ') : joined;
}

/** A row's text in reading order. */
export function lineText(line: PageLine): string {
  return wordText(line.words);
}
