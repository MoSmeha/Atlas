import type { Box, PositionedWord, TextBlock, TextLine } from '../../domain/document';
import { lineDirection, logicalOrder, pageDirection, type Direction } from './rtlOrder';
import type { RawBlock, RawChar, RawLine } from './stextBlocks';

/** A page with fewer visible characters than this counts as having no text layer (scanned). */
export const MIN_TEXT_CHARS = 10;

export interface PageText {
  /** Lines joined with newlines, blocks separated by a blank line. */
  text: string;
  hasTextLayer: boolean;
  blocks: TextBlock[];
}

const SPACE = /\s/u;

/**
 * Turns mupdf's blocks into reading-order text with positioned words. Lines of one block that share a row,
 * such as the cells of a table row, become one line with the cells two spaces apart. Text is NFC-normalised
 * and coordinates are rounded to 0.01 pt.
 */
export function layoutPage(raw: readonly RawBlock[]): PageText {
  const chars = raw.flatMap((block) => block.lines.flatMap((line) => line.chars));
  const direction = pageDirection(chars.map((char) => char.c).join(''));
  const blocks = raw.map((block) => toBlock(block, direction)).filter((block) => block.lines.length > 0);
  const text = blocks.map((block) => block.lines.map((line) => line.text).join('\n')).join('\n\n');
  const visible = chars.filter((char) => !SPACE.test(char.c)).length;
  return { text, hasTextLayer: visible >= MIN_TEXT_CHARS, blocks };
}

function toBlock(block: RawBlock, page: Direction): TextBlock {
  const lines = groupRows(block.lines)
    .map((row) => toLine(row, page))
    .filter((line) => line.text.length > 0);
  return { box: roundBox(block.box), lines };
}

/** Consecutive lines that overlap vertically by at least half a line and not horizontally form one row. */
function groupRows(lines: readonly RawLine[]): RawLine[][] {
  const rows: RawLine[][] = [];
  for (const line of lines) {
    const row = rows.at(-1);
    if (row && row.every((other) => sameRow(other.box, line.box))) row.push(line);
    else rows.push([line]);
  }
  return rows;
}

function sameRow(a: Box, b: Box): boolean {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const apart = a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
  return apart && overlap >= 0.5 * Math.min(a.height, b.height);
}

function toLine(row: RawLine[], page: Direction): TextLine {
  const direction = lineDirection(row.flatMap((line) => line.chars.map((char) => char.c)).join(''), page);
  const cells = row.toSorted((a, b) => (direction === 'rtl' ? b.box.x - a.box.x : a.box.x - b.box.x));
  const chars: RawChar[] = [];
  cells.forEach((cell, index) => {
    const previous = cells[index - 1];
    if (previous) chars.push(...separator(previous.box, cell.box));
    const text = cell.chars.map((char) => char.c).join('');
    chars.push(...logicalOrder(cell.chars, lineDirection(text, direction)));
  });
  return {
    text: chars
      .map((char) => (SPACE.test(char.c) ? ' ' : char.c))
      .join('')
      .trim()
      .normalize('NFC'),
    box: roundBox(union(row.map((line) => line.box))),
    words: toWords(chars),
  };
}

/** One space between pieces of a line that nearly touch, two between table cells. */
function separator(a: Box, b: Box): RawChar[] {
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
  const space: RawChar = { c: ' ', x0: Math.min(a.x, b.x), x1: Math.min(a.x, b.x), rtl: false };
  return gap > 0.5 * Math.min(a.height, b.height) ? [space, space] : [space];
}

function toWords(chars: readonly RawChar[]): PositionedWord[] {
  const words: PositionedWord[] = [];
  let current: RawChar[] = [];
  const flush = () => {
    if (current.length === 0) return;
    words.push({
      text: current.map((char) => char.c).join('').normalize('NFC'),
      x0: round(Math.min(...current.map((char) => char.x0))),
      x1: round(Math.max(...current.map((char) => char.x1))),
    });
    current = [];
  };
  for (const char of chars) {
    if (SPACE.test(char.c)) flush();
    else current.push(char);
  }
  flush();
  return words;
}

function union(boxes: readonly Box[]): Box {
  const x0 = Math.min(...boxes.map((box) => box.x));
  const y0 = Math.min(...boxes.map((box) => box.y));
  const x1 = Math.max(...boxes.map((box) => box.x + box.width));
  const y1 = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function roundBox(box: Box): Box {
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
