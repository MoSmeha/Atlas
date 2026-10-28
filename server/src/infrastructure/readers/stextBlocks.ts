import type * as mupdf from 'mupdf';
import type { Box } from '../../domain/document';

/** One character as mupdf placed it, with its horizontal extent in points from the page's left edge. */
export interface RawChar {
  c: string;
  x0: number;
  x1: number;
  /** True when mupdf gives the character an odd (right-to-left) bidi level, as for Arabic letters. */
  rtl: boolean;
}

export interface RawLine {
  box: Box;
  chars: RawChar[];
}

export interface RawBlock {
  box: Box;
  lines: RawLine[];
}

/** Stands for a character the PDF has no Unicode mapping for; it carries no text. */
const UNKNOWN = '�';

/**
 * The text blocks of one page in mupdf's order, with every character's extent, relative to `origin`
 * (the page's top-left corner). Image blocks and characters without a Unicode value are left out.
 */
export function collectBlocks(stext: mupdf.StructuredText, origin: { x: number; y: number }): RawBlock[] {
  const blocks: RawBlock[] = [];
  let block: RawBlock | null = null;
  let line: RawLine | null = null;
  stext.walk({
    beginTextBlock(bbox) {
      block = { box: toBox(bbox, origin), lines: [] };
    },
    beginLine(bbox) {
      line = { box: toBox(bbox, origin), chars: [] };
    },
    onChar(c, _origin, _font, _size, quad, _color, bidi) {
      if (!line || c === UNKNOWN) return;
      const xs = [quad[0], quad[2], quad[4], quad[6]];
      line.chars.push({ c, x0: Math.min(...xs) - origin.x, x1: Math.max(...xs) - origin.x, rtl: bidi % 2 === 1 });
    },
    endLine() {
      if (block && line && line.chars.length > 0) block.lines.push(line);
      line = null;
    },
    endTextBlock() {
      if (block && block.lines.length > 0) blocks.push(block);
      block = null;
    },
  });
  return blocks;
}

function toBox([x0, y0, x1, y1]: mupdf.Rect, origin: { x: number; y: number }): Box {
  return { x: x0 - origin.x, y: y0 - origin.y, width: x1 - x0, height: y1 - y0 };
}
