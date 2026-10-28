import { describe, expect, it } from 'vitest';
import { layoutPage } from '../../src/infrastructure/readers/pageLayout';
import type { RawBlock, RawChar, RawLine } from '../../src/infrastructure/readers/stextBlocks';

const CHAR = 5;
const HEIGHT = 12;

/** A line as mupdf would give it: left-to-right text runs rightwards, Arabic runs leftwards from `x`. */
function line(text: string, x: number, y: number, rtl = false): RawLine {
  const chars: RawChar[] = [...text].map((c, i) =>
    rtl ? { c, x0: x - (i + 1) * CHAR, x1: x - i * CHAR, rtl: true } : { c, x0: x + i * CHAR, x1: x + (i + 1) * CHAR, rtl: false },
  );
  const left = rtl ? x - chars.length * CHAR : x;
  return { box: { x: left, y, width: chars.length * CHAR, height: HEIGHT }, chars };
}

function block(...lines: RawLine[]): RawBlock {
  const x0 = Math.min(...lines.map((l) => l.box.x));
  const y0 = Math.min(...lines.map((l) => l.box.y));
  const x1 = Math.max(...lines.map((l) => l.box.x + l.box.width));
  const y1 = Math.max(...lines.map((l) => l.box.y + l.box.height));
  return { box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, lines };
}

describe('layoutPage text', () => {
  it('joins lines with newlines and separates blocks with a blank line', () => {
    const page = layoutPage([
      block(line('General conditions apply', 50, 100), line('to every work package.', 50, 114)),
      block(line('Section 2 Payment terms', 50, 160)),
    ]);
    expect(page.text).toBe('General conditions apply\nto every work package.\n\nSection 2 Payment terms');
    expect(page.blocks).toHaveLength(2);
    expect(page.blocks[0]?.lines.map((l) => l.text)).toEqual(['General conditions apply', 'to every work package.']);
  });

  it('merges table cells on one row, two spaces apart', () => {
    const row = block(line('A.1', 50, 200), line('Excavation in soil', 120, 200), line('m3', 330, 200), line('45,000.00', 480, 200));
    const page = layoutPage([row]);
    expect(page.text).toBe('A.1  Excavation in soil  m3  45,000.00');
    const [merged] = page.blocks[0]!.lines;
    expect(merged?.box).toEqual({ x: 50, y: 200, width: 475, height: HEIGHT });
    expect(merged?.words.map((w) => w.text)).toEqual(['A.1', 'Excavation', 'in', 'soil', 'm3', '45,000.00']);
  });

  it('keeps lines that overlap horizontally apart even on the same row', () => {
    const page = layoutPage([block(line('Bold heading', 50, 300), line('Bold heading', 50.5, 300))]);
    expect(page.blocks[0]?.lines).toHaveLength(2);
  });

  it('maps other whitespace to spaces and normalises to NFC', () => {
    const page = layoutPage([block(line('Café SAR\t100 total', 50, 100))]);
    expect(page.text).toBe('Café SAR 100 total');
    expect(page.blocks[0]?.lines[0]?.words.map((w) => w.text)).toEqual(['Café', 'SAR', '100', 'total']);
  });

  it('puts the cells of an Arabic row in right-to-left order', () => {
    const page = layoutPage([block(line('500', 300, 100), line('ريال', 400, 100, true), line('المبلغ', 560, 100, true))]);
    expect(page.text).toBe('المبلغ  ريال  500');
  });
});

describe('layoutPage words', () => {
  it('gives each word its horizontal extent, left to right', () => {
    const page = layoutPage([block(line('Item Qty Rate', 50, 100))]);
    expect(page.blocks[0]?.lines[0]?.words).toEqual([
      { text: 'Item', x0: 50, x1: 70 },
      { text: 'Qty', x0: 75, x1: 90 },
      { text: 'Rate', x0: 95, x1: 115 },
    ]);
  });

  it('rounds coordinates to hundredths of a point', () => {
    const raw = line('Total', 50.123456, 99.98765);
    const page = layoutPage([block(raw)]);
    const [word] = page.blocks[0]!.lines[0]!.words;
    expect(word).toEqual({ text: 'Total', x0: 50.12, x1: 75.12 });
    expect(page.blocks[0]?.box.y).toBe(99.99);
  });
});

describe('layoutPage text layer', () => {
  it('needs ten visible characters for a text layer', () => {
    expect(layoutPage([block(line('Page 12', 50, 800))]).hasTextLayer).toBe(false);
    expect(layoutPage([block(line('Page 12 of 30', 50, 800))]).hasTextLayer).toBe(true);
  });

  it('has no text and no layer for a page without text', () => {
    expect(layoutPage([])).toEqual({ text: '', hasTextLayer: false, blocks: [] });
  });
});
