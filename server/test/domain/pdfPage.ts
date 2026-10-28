import type { PdfPage, PositionedWord, TextLine } from '../../src/domain/document';

/** Text placed at x points from the left edge of the page: its left edge, or its right edge when `right` is set. */
export interface Placed {
  text: string;
  x: number;
  right?: boolean;
}

/** Character and space widths in em, close to Helvetica. */
const CHAR = 0.5;
const SPACE = 0.28;
const ARABIC = /\p{Script=Arabic}/u;

/** The words of a placed text. Arabic words are laid out right to left, as a PDF prints them. */
function wordsOf(cell: Placed, size: number): PositionedWord[] {
  const parts = cell.text.split(' ');
  const width = (text: string) => text.length * CHAR * size;
  const total = parts.reduce((sum, part) => sum + width(part), 0) + (parts.length - 1) * SPACE * size;
  const visual = ARABIC.test(cell.text) ? parts.toReversed() : parts;
  let x = cell.right === true ? cell.x - total : cell.x;
  return visual.map((text) => {
    const word = { text, x0: x, x1: x + width(text) };
    x = word.x1 + SPACE * size;
    return word;
  });
}

/** One printed line whose box starts `top` points below the top of the page. */
export function line(top: number, cells: readonly Placed[], size = 9): TextLine {
  const words = cells
    .filter((cell) => cell.text !== '')
    .flatMap((cell) => wordsOf(cell, size))
    .toSorted((a, b) => a.x0 - b.x0);
  const x0 = Math.min(...words.map((word) => word.x0));
  const x1 = Math.max(...words.map((word) => word.x1));
  return { text: words.map((word) => word.text).join(' '), box: { x: x0, y: top, width: x1 - x0, height: size * 1.2 }, words };
}

/** Plain text from x = 40, as a paragraph line or a title. */
export function text(top: number, content: string, size = 9): TextLine {
  return line(top, [{ text: content, x: 40 }], size);
}

/** An A4 page with each line in its own block, as mupdf often splits table cells. */
export function pdfPage(number: number, lines: readonly TextLine[]): PdfPage {
  return {
    number,
    width: 595,
    height: 842,
    text: lines.map((item) => item.text).join('\n'),
    hasTextLayer: true,
    blocks: lines.map((item) => ({ box: item.box, lines: [item] })),
  };
}

/** Column positions of the test BOQ: item, description and unit left-aligned; quantity, rate and amount right-aligned. */
export const BOQ_X = { item: 40, description: 90, unit: 330, quantity: 400, rate: 470, amount: 550 } as const;

/** A BOQ line from its six cells; '' leaves a cell empty. */
export function boqLine(top: number, cells: readonly [string, string, string, string, string, string]): TextLine {
  const [item, description, unit, quantity, rate, amount] = cells;
  return line(top, [
    { text: item, x: BOQ_X.item },
    { text: description, x: BOQ_X.description },
    { text: unit, x: BOQ_X.unit },
    { text: quantity, x: BOQ_X.quantity, right: true },
    { text: rate, x: BOQ_X.rate, right: true },
    { text: amount, x: BOQ_X.amount, right: true },
  ]);
}

/** The usual BOQ header, numbers' labels right-aligned over their columns. */
export function boqHeader(top: number, rate = 'Rate (SAR)', amount = 'Amount (SAR)'): TextLine {
  return boqLine(top, ['Item', 'Description', 'Unit', 'Qty', rate, amount]);
}
